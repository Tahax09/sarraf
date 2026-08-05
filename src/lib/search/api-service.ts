import { FileText, Users, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  Account,
  Client,
  LedgerEntry,
  Paged,
  PermissionAction,
} from "@/lib/api/types";
import { navGroups } from "@/lib/nav";
import type { PermissionModule } from "@/lib/permissions";
import { matchFields } from "@/lib/search/fuzzy";
import {
  MAX_RESULTS_PER_CATEGORY,
  type SearchResult,
  type SearchService,
} from "@/lib/search/types";

/**
 * Everything the service needs from React context, passed in rather than
 * reached for. Keeps the service a plain object that a test can call directly
 * and that a future remote implementation can satisfy identically.
 */
export type SearchDependencies = {
  /** Translates a `nav` message key. */
  navLabel: (labelKey: string) => string;
  /** The current user's authorization check — see `usePermission`. */
  can: (module: PermissionModule, action: PermissionAction) => boolean;
  formatAmount: (amount: number, currency: string) => string;
};

/** A navigation destination, matched locally. */
type PageEntry = {
  href: string;
  labelKey: string;
  groupLabelKey: string;
  module?: PermissionModule;
};

// Phase-2 groups are placeholders with no page behind them, so offering them as
// destinations would send the reader somewhere that does not exist yet.
const PAGES: PageEntry[] = navGroups
  .filter((group) => !group.phase2)
  .flatMap((group) =>
    group.items.map((item) => ({
      href: item.href,
      labelKey: item.labelKey,
      groupLabelKey: group.labelKey,
      module: item.module,
    })),
  );

/** Sorts by score and keeps the category's share of the palette. */
function top(results: SearchResult[]): SearchResult[] {
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS_PER_CATEGORY);
}

/**
 * Search over the endpoints this panel already has.
 *
 * There is no `/search` endpoint yet, so a query fans out to the registers that
 * can answer it and each branch is allowed to fail on its own — a register that
 * errors or times out costs its own results, not the whole palette. Swapping in
 * a real endpoint means writing one more `SearchService`; nothing in the UI
 * knows the difference.
 */
export function createApiSearchService(
  deps: SearchDependencies,
): SearchService {
  const { navLabel, can, formatAmount } = deps;

  /** Pages, matched in memory and filtered by what the reader may open. */
  function searchPages(query: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const page of PAGES) {
      if (page.module && !can(page.module, "view")) continue;
      const title = navLabel(page.labelKey);
      const group = navLabel(page.groupLabelKey);
      const match = matchFields(query, [title, group]);
      if (!match) continue;

      results.push({
        id: `page:${page.href}`,
        category: "pages",
        title,
        subtitle: group,
        href: page.href,
        icon: FileText,
        score: match.score,
        matches: match.matches,
      });
    }

    return top(results);
  }

  async function searchClients(
    query: string,
    signal: AbortSignal,
  ): Promise<SearchResult[]> {
    if (!can("clients", "view")) return [];
    // The clients register filters by `name` and `phone`, not a combined `q` —
    // these are the parameters the rest of the panel already sends, so the
    // palette invents no new contract. A mostly-numeric query is a phone
    // number; anything else is a name.
    const numeric = /^[\d\s+\-()]{4,}$/.test(query);
    const page = await apiFetch<Paged<Client>>(endpoints.clients, {
      params: {
        [numeric ? "phone" : "name"]: query,
        pageSize: MAX_RESULTS_PER_CATEGORY,
      },
      signal,
    });

    return page.items.map((client) => {
      const match = matchFields(query, [client.name, client.phone]);
      return {
        id: `client:${client.id}`,
        category: "clients" as const,
        title: client.name,
        subtitle: client.phone,
        href: "/core/clients/list",
        icon: Users,
        score: match?.score ?? 0,
        matches: match?.matches ?? [],
      };
    });
  }

  async function searchAccounts(
    query: string,
    signal: AbortSignal,
  ): Promise<SearchResult[]> {
    if (!can("accounts", "view")) return [];
    const page = await apiFetch<Paged<Account>>(endpoints.accounts, {
      params: { q: query, pageSize: MAX_RESULTS_PER_CATEGORY },
      signal,
    });

    return page.items.map((account) => {
      const match = matchFields(query, [
        account.number,
        account.clientName,
      ]);
      return {
        id: `account:${account.id}`,
        category: "accounts" as const,
        title: account.number,
        subtitle: account.clientName,
        meta: formatAmount(account.balance, account.currency),
        href: "/core/accounts",
        icon: Wallet,
        score: match?.score ?? 0,
        matches: match?.matches ?? [],
      };
    });
  }

  async function searchOperations(
    query: string,
    signal: AbortSignal,
  ): Promise<SearchResult[]> {
    if (!can("analytics", "view")) return [];
    const page = await apiFetch<Paged<LedgerEntry>>(
      endpoints.analytics.ledger,
      {
        params: { q: query, pageSize: MAX_RESULTS_PER_CATEGORY },
        signal,
      },
    );

    return page.items.map((entry) => {
      const match = matchFields(query, [
        entry.reference,
        entry.clientName,
        entry.accountNumber,
      ]);
      return {
        id: `operation:${entry.id}`,
        category: "operations" as const,
        title: entry.reference,
        subtitle: entry.clientName,
        meta: formatAmount(entry.amount, entry.currency),
        href: "/core/analytics/all-operations",
        score: match?.score ?? 0,
        matches: match?.matches ?? [],
      };
    });
  }

  return {
    async search(query, signal) {
      const remote = await Promise.allSettled([
        searchClients(query, signal),
        searchAccounts(query, signal),
        searchOperations(query, signal),
      ]);

      const results = searchPages(query);
      for (const branch of remote) {
        // A register that failed contributes nothing; the rest of the palette
        // still answers. The reader sees fewer groups, never a broken dialog.
        if (branch.status === "fulfilled") results.push(...top(branch.value));
      }

      return results;
    },
  };
}
