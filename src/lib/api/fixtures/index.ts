import { ApiError, type QueryParams } from "@/lib/api/client";
import { parseSort } from "@/lib/api/types";
import type {
  AnyOperation,
  AuthorizedWithdrawalOperation,
  BranchFlow,
  CblConnectionStatus,
  ExternalTransferOperation,
  Paged,
} from "@/lib/api/types";
import * as db from "./data";

type FixtureRequest = {
  method: string;
  body?: unknown;
  params?: QueryParams;
};

const state = {
  authorizedWithdrawals: [...db.authorizedWithdrawals],
  externalTransfers: [...db.externalTransfers],
  // Editable in fixture mode, so a name or a branch changed in the panel is
  // still changed after navigating away — the same thing a backend would do.
  clients: [...db.clients],
  accounts: [...db.accounts],
  operationRules: { ...db.operationRules },
  currencies: [...db.currencies],
  countries: [...db.countries],
  branches: [...db.branches],
  users: [...db.users],
  roles: [...db.roles],
  pricing: [...db.pricing],
  systemInfo: { ...db.systemInfo },
  sessions: [...db.sessions],
  cbl: {
    state: "disconnected",
    endpointReachable: false,
    authenticated: false,
    baseUrl: null,
    secretConfigured: false,
    checkedAt: new Date().toISOString(),
  } as CblConnectionStatus,
};

function resolveRoleNames(body: unknown, fallback: string[]): string[] {
  const ids = (body as { roleIds?: string[] } | undefined)?.roleIds;
  if (!ids) return fallback;
  return ids
    .map((id) => state.roles.find((r) => r.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

function resolveBranchName(body: unknown, fallback: string): string {
  const id = (body as { defaultBranchId?: string } | undefined)?.defaultBranchId;
  if (!id) return fallback;
  return state.branches.find((b) => b.id === id)?.name ?? fallback;
}

/**
 * Stands in for the backend's `ORDER BY`. Strings compare with the Arabic
 * collator so the fixture ordering matches what an operator would expect from
 * the real service.
 */
function sortItems<T>(items: T[], params?: QueryParams): T[] {
  const sort = parseSort(params?.sort);
  if (!sort) return items;
  const collator = new Intl.Collator("ar");
  return [...items].sort((a, b) => {
    const left = (a as Record<string, unknown>)[sort.key];
    const right = (b as Record<string, unknown>)[sort.key];
    let comparison: number;
    if (typeof left === "number" && typeof right === "number") {
      comparison = left - right;
    } else {
      comparison = collator.compare(String(left ?? ""), String(right ?? ""));
    }
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Slices one page out of the matching set. `total` stays the full count, which
 * is what the pager and the record counter read.
 */
function paginate<T>(items: T[], params?: QueryParams): Paged<T> {
  const ordered = sortItems(items, params);
  const page = Number(params?.page ?? 1);
  const pageSize = Number(params?.pageSize ?? 25);
  const start = (page - 1) * pageSize;
  return {
    items: ordered.slice(start, start + pageSize),
    total: ordered.length,
    page,
    pageSize,
  };
}

function matches(haystack: string, needle: unknown): boolean {
  if (needle === undefined || needle === null || needle === "") return true;
  return haystack.toLowerCase().includes(String(needle).toLowerCase());
}

function byStatus<T extends { status: string }>(
  items: T[],
  params?: QueryParams,
): T[] {
  const status = params?.status;
  if (!status || status === "all") return items;
  return items.filter((i) => i.status === status);
}

function searchOperations(items: AnyOperation[], params?: QueryParams) {
  const q = params?.q;
  if (!q) return items;
  return items.filter(
    (o) =>
      matches(o.clientName, q) ||
      matches(o.clientNameEn ?? "", q) ||
      matches(o.accountNumber, q) ||
      matches(o.reference, q) ||
      matches(o.clientPhone, q),
  );
}

const branchFlow: BranchFlow[] = db.branches.map((b) => {
  const rows = db.ledger.filter((l) => l.branchName === b.name);
  const deposits = rows
    .filter((r) => r.type === "deposit")
    .reduce((s, r) => s + r.amount, 0);
  const withdrawals = rows
    .filter((r) => r.type === "withdrawal")
    .reduce((s, r) => s + r.amount, 0);
  return {
    branchId: b.id,
    branchName: b.name,
    operations: rows.length,
    deposits: Number(deposits.toFixed(3)),
    withdrawals: Number(withdrawals.toFixed(3)),
    netFlow: Number((deposits - withdrawals).toFixed(3)),
  };
});

/** Simulated latency so loading and empty states are exercised in dev. */
const delay = () => new Promise((r) => setTimeout(r, 120));

export async function fixtureFetch<T>(
  path: string,
  req: FixtureRequest,
): Promise<T> {
  await delay();
  const { method, params, body } = req;
  const p = path.split("?")[0];

  // ---- mutations -------------------------------------------------------
  if (method !== "GET") {
    // Audit sinks accept and discard: reveal events and boundary crashes are
    // recorded by the backend, and fixture mode only has to not break.
    if (p === "/audit/ui-events" || p === "/audit/ui-errors") {
      return undefined as T;
    }

    // Sign-in. Any credentials are accepted — the fixtures have no password
    // store — except the reserved username below, which exists so the second
    // factor and its failure paths can be walked without a backend.
    if (p === "/auth/login") {
      const username = (body as { username?: string } | null)?.username ?? "";
      if (username === "otp") {
        return { otpRequired: true, challengeId: "fixture-challenge" } as T;
      }
      return undefined as T;
    }
    if (p === "/auth/login/otp") {
      const code = (body as { code?: string } | null)?.code;
      if (code !== "123456") throw new ApiError("Invalid code", 401);
      return undefined as T;
    }
    if (p === "/auth/password-reset/request" || p === "/auth/logout") {
      return undefined as T;
    }
    if (p.endsWith("/approve")) {
      const id = p.split("/").at(-2)!;
      const target =
        state.authorizedWithdrawals.find((o) => o.id === id) ??
        state.externalTransfers.find((o) => o.id === id);
      if (!target) throw new ApiError("Operation not found", 404);
      target.status = "confirmed";
      target.expiresAt = null;
      return target as T;
    }
    if (p.endsWith("/cancel")) {
      const id = p.split("/").at(-2)!;
      const reason =
        (body as { reason?: string } | undefined)?.reason ?? null;
      const target =
        state.authorizedWithdrawals.find((o) => o.id === id) ??
        state.externalTransfers.find((o) => o.id === id);
      if (!target) throw new ApiError("Operation not found", 404);
      target.status = "cancelled";
      target.expiresAt = null;
      target.cancelledReason = reason;
      return target as T;
    }
    // Client and account edits. Only the fields the forms send are written —
    // identifiers, balances and IBANs are not editable from the panel, so a
    // body carrying one would be ignored here exactly as the backend ignores it.
    if (p.startsWith("/clients/") && method === "PATCH") {
      const client = state.clients.find((c) => c.id === p.split("/").at(-1));
      if (!client) throw new ApiError("Client not found", 404);
      const payload = body as {
        name: string;
        nameEn: string | null;
        phone: string;
        email: string | null;
      };
      Object.assign(client, payload);
      // The name is denormalized onto every account and operation the client
      // owns, so the copies move with it.
      for (const account of state.accounts) {
        if (account.clientId !== client.id) continue;
        account.clientName = client.name;
        account.clientNameEn = client.nameEn;
        account.clientPhone = client.phone;
      }
      return client as T;
    }
    if (p.startsWith("/accounts/") && method === "PATCH") {
      const account = state.accounts.find((a) => a.id === p.split("/").at(-1));
      if (!account) throw new ApiError("Account not found", 404);
      const payload = body as { type: string; branchId: string };
      account.type = payload.type;
      account.branchId = payload.branchId;
      account.branchName =
        state.branches.find((b) => b.id === payload.branchId)?.name ??
        account.branchName;
      return account as T;
    }
    if (p === "/settings/operation-rules") {
      state.operationRules = {
        ...state.operationRules,
        ...(body as object),
      };
      return state.operationRules as T;
    }
    if (p === "/cbl/connection/test") {
      return {
        ok: true,
        message: "pong",
      } as T;
    }
    if (p === "/cbl/connection") {
      const payload = body as { baseUrl?: string; secretKey?: string };
      state.cbl = {
        state: "connected",
        endpointReachable: true,
        authenticated: true,
        baseUrl: payload.baseUrl ?? state.cbl.baseUrl,
        // The secret is never stored client-side — only the fact it exists.
        secretConfigured: Boolean(payload.secretKey) || state.cbl.secretConfigured,
        checkedAt: new Date().toISOString(),
      };
      return state.cbl as T;
    }
    if (p.startsWith("/settings/countries")) {
      // The ISO code is the identity here — there is no separate row id.
      const code = p.split("/").at(-1)!;
      if (method === "DELETE") {
        // Mirrors the backend guard: a country named by a transfer stays.
        const inUse = state.externalTransfers.some(
          (o) => o.beneficiary.countryCode === code,
        );
        if (inUse) throw new ApiError("Country in use", 409);
        state.countries = state.countries.filter((c) => c.code !== code);
        return undefined as T;
      }
      if (code !== "countries") {
        state.countries = state.countries.map((c) =>
          c.code === code ? { ...c, ...(body as object) } : c,
        );
        return state.countries.find((c) => c.code === code) as T;
      }
      const created = body as (typeof state.countries)[number];
      if (state.countries.some((c) => c.code === created.code)) {
        throw new ApiError("Country already exists", 409);
      }
      state.countries = [...state.countries, created];
      return created as T;
    }

    if (p.startsWith("/settings/currencies")) {
      const id = p.split("/").at(-1)!;
      if (method === "DELETE") {
        // Mirrors the backend guard: a currency in use cannot be removed.
        const inUse = state.accounts.some(
          (a) =>
            a.currency ===
            state.currencies.find((c) => c.id === id)?.alphabeticCode,
        );
        if (inUse) throw new ApiError("Currency in use", 409);
        state.currencies = state.currencies.filter((c) => c.id !== id);
        return undefined as T;
      }
      const created = {
        id: `cur_${state.currencies.length + 1}`,
        ...(body as object),
      } as (typeof state.currencies)[number];
      state.currencies = [...state.currencies, created];
      return created as T;
    }

    if (p === "/settings/operations-pricing") {
      const payload = body as { id: string };
      state.pricing = state.pricing.map((row) =>
        row.id === payload.id ? { ...row, ...(body as object) } : row,
      );
      return body as T;
    }

    if (p.startsWith("/profile/sessions/")) {
      const id = p.split("/").at(-1)!;
      // The current session is never revocable from this list.
      state.sessions = state.sessions.filter((s) => s.id !== id || s.current);
      return undefined as T;
    }

    if (p === "/profile/password") return undefined as T;

    if (p === "/settings/system-info") {
      state.systemInfo = { ...state.systemInfo, ...(body as object) };
      return state.systemInfo as T;
    }

    if (p.startsWith("/branches")) {
      const id = p.split("/").at(-1);
      if (id && id !== "branches") {
        state.branches = state.branches.map((b) =>
          b.id === id ? { ...b, ...(body as object) } : b,
        );
        return state.branches.find((b) => b.id === id) as T;
      }
      const created = {
        id: `br_${state.branches.length + 1}`,
        ...(body as object),
      } as (typeof state.branches)[number];
      state.branches = [...state.branches, created];
      return created as T;
    }

    if (p.startsWith("/users")) {
      if (p.endsWith("/password-reset")) return undefined as T;
      const id = p.split("/").at(-1);
      if (id && id !== "users") {
        state.users = state.users.map((u) =>
          u.id === id
            ? {
                ...u,
                ...(body as object),
                roleNames: resolveRoleNames(body, u.roleNames),
                defaultBranchName: resolveBranchName(body, u.defaultBranchName),
              }
            : u,
        );
        return state.users.find((u) => u.id === id) as T;
      }
      const payload = body as { roleIds?: string[]; defaultBranchId?: string };
      const created = {
        id: `usr_${state.users.length + 1}`,
        active: true,
        avatarUrl: null,
        roleIds: payload.roleIds ?? [],
        roleNames: resolveRoleNames(body, []),
        defaultBranchName: resolveBranchName(body, ""),
        ...(body as object),
      } as (typeof state.users)[number];
      state.users = [...state.users, created];
      return created as T;
    }

    if (p.startsWith("/roles")) {
      const id = p.split("/").at(-1);
      if (id && id !== "roles") {
        state.roles = state.roles.map((r) =>
          r.id === id ? { ...r, ...(body as object) } : r,
        );
        return state.roles.find((r) => r.id === id) as T;
      }
      const created = {
        id: `role_${state.roles.length + 1}`,
        assignedUsers: 0,
        permissions: {},
        ...(body as object),
      } as (typeof state.roles)[number];
      state.roles = [...state.roles, created];
      return created as T;
    }

    // Registers and generic writes echo back a created reference.
    return {
      id: `new_${Math.random().toString(16).slice(2)}`,
      reference: `NEW-${Date.now().toString().slice(-6)}`,
      ...(body as object),
    } as T;
  }

  // ---- reads -----------------------------------------------------------
  switch (p) {
    case "/me":
      return db.currentUser as T;

    case "/dashboard/summary":
      return {
        totalClients: state.clients.length,
        totalAccounts: state.accounts.length,
        todayOperations: db.ledger.filter(
          (l) => l.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10),
        ).length,
        pendingAuthorizedWithdrawals: state.authorizedWithdrawals.filter(
          (o) => o.status === "reserve",
        ).length,
        pendingExternalTransfers: state.externalTransfers.filter(
          (o) => o.status === "reserve",
        ).length,
      } as T;

    case "/dashboard/trends": {
      // The generated series is 90 days long; the selector takes its tail.
      const days = Number(params?.days ?? 30);
      return db.trends.slice(-days) as T;
    }
    case "/dashboard/currency-balances":
      return db.currencyBalances as T;
    case "/dashboard/top-clients": {
      const mode = params?.mode ?? "balance";
      const enriched = state.clients.map((c) => {
        const owned = state.accounts.filter((a) => a.clientId === c.id);
        // `balance` is denominated in `currency`, so it sums one currency's
        // accounts rather than every account the client holds. Adding LYD to
        // USD and labelling the result LYD would make the figure a currency
        // it is not — and Top clients now measures it against that currency's
        // whole book, where such a total can exceed the book itself.
        const byCurrency = new Map<string, number>();
        for (const account of owned) {
          byCurrency.set(
            account.currency,
            (byCurrency.get(account.currency) ?? 0) + account.balance,
          );
        }
        const [currency, balance] = [...byCurrency.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0] ?? ["LYD", 0];
        return {
          ...c,
          balance: Number(balance.toFixed(3)),
          currency,
          operations: db.ledger.filter((l) => l.clientName === c.name).length,
        };
      });
      enriched.sort((a, b) =>
        mode === "activity" ? b.operations - a.operations : b.balance - a.balance,
      );
      return enriched.slice(0, 10) as T;
    }
    case "/dashboard/recent-operations":
      return db.ledger.slice(0, 8) as T;

    case "/clients": {
      const filtered = state.clients.filter(
        (c) =>
          // Either spelling answers a name filter: the register is bilingual.
          (matches(c.name, params?.name) ||
            matches(c.nameEn ?? "", params?.name)) &&
          matches(c.email ?? "", params?.email) &&
          matches(c.phone, params?.phone),
      );
      return paginate(filtered, params) as T;
    }

    case "/accounts": {
      const filtered = state.accounts.filter(
        (a) =>
          (matches(a.clientName, params?.name) ||
            matches(a.clientNameEn ?? "", params?.name)) &&
          matches(a.number, params?.q) &&
          (!params?.clientId || a.clientId === params.clientId) &&
          (!params?.currency || a.currency === params.currency) &&
          (!params?.branchId || a.branchId === params.branchId) &&
          (!params?.type || a.type === params.type),
      );
      return paginate(filtered, params) as T;
    }

    default:
      break;
  }

  // One client or one account, by id — the profile pages.
  if (p.startsWith("/clients/")) {
    const client = state.clients.find((c) => c.id === p.split("/").at(-1));
    if (!client) throw new ApiError("Client not found", 404);
    return client as T;
  }
  if (p.startsWith("/accounts/") && !p.endsWith("/balance")) {
    const account = state.accounts.find((a) => a.id === p.split("/").at(-1));
    if (!account) throw new ApiError("Account not found", 404);
    return account as T;
  }

  switch (p) {

    case "/operations/withdrawals":
      return paginate(searchOperations(db.withdrawals, params), params) as T;
    case "/operations/deposits":
      return paginate(searchOperations(db.deposits, params), params) as T;
    case "/operations/authorized-withdrawals":
      return paginate(
        byStatus(
          searchOperations(
            state.authorizedWithdrawals,
            params,
          ) as AuthorizedWithdrawalOperation[],
          params,
        ),
        params,
      ) as T;
    case "/operations/external-transfers":
      return paginate(
        byStatus(
          searchOperations(
            state.externalTransfers,
            params,
          ) as ExternalTransferOperation[],
          params,
        ).filter(
          (transfer) =>
            !params?.countryCode ||
            transfer.beneficiary.countryCode === params.countryCode,
        ),
        params,
      ) as T;
    case "/operations/fund-transfers":
      return paginate(searchOperations(db.fundTransfers, params), params) as T;
    case "/operations/currency-exchange-transfers":
      return paginate(searchOperations(db.ceftOperations, params), params) as T;

    case "/exchange-rate": {
      const from = String(params?.from ?? "LYD");
      const to = String(params?.to ?? "LYD");
      const table: Record<string, number> = {
        LYD: 1,
        USD: 4.79777,
        EUR: 5.21344,
        GBP: 6.11202,
        TND: 1.55031,
      };
      const rate = (table[from] ?? 1) / (table[to] ?? 1);
      return { from, to, rate: Number(rate.toFixed(5)) } as T;
    }

    case "/settings/operations-pricing":
      return state.pricing as T;
    case "/settings/currencies":
      return state.currencies as T;
    case "/settings/operation-rules":
      return state.operationRules as T;
    case "/settings/system-info":
      return state.systemInfo as T;
    case "/settings/countries":
      return state.countries as T;
    case "/branches":
      return state.branches as T;
    case "/users":
      return state.users as T;
    case "/roles":
      return state.roles as T;

    case "/logs": {
      const filtered = db.systemLogs.filter(
        (l) =>
          (!params?.level || l.level === params.level) &&
          (!params?.tag || l.tags.includes(String(params.tag))) &&
          // Inclusive ISO day bounds — see docs/API_CONTRACT.md.
          (!params?.dateFrom || l.createdAt.slice(0, 10) >= String(params.dateFrom)) &&
          (!params?.dateTo || l.createdAt.slice(0, 10) <= String(params.dateTo)) &&
          matches(l.title + l.message, params?.q),
      );
      return paginate(filtered, params) as T;
    }

    case "/reports": {
      const date = String(params?.date ?? new Date().toISOString().slice(0, 10));
      const rows = db.ledger.filter((l) => l.createdAt.slice(0, 10) === date);
      const perBranch: BranchFlow[] = db.branches.map((b) => {
        const branchRows = rows.filter((r) => r.branchName === b.name);
        const deposits = branchRows
          .filter((r) => r.type === "deposit")
          .reduce((s, r) => s + r.amount, 0);
        const withdrawals = branchRows
          .filter((r) => r.type === "withdrawal")
          .reduce((s, r) => s + r.amount, 0);
        return {
          branchId: b.id,
          branchName: b.name,
          operations: branchRows.length,
          deposits: Number(deposits.toFixed(3)),
          withdrawals: Number(withdrawals.toFixed(3)),
          netFlow: Number((deposits - withdrawals).toFixed(3)),
        };
      });
      const currencyCounts = new Map<string, number>();
      for (const row of rows) {
        currencyCounts.set(row.currency, (currencyCounts.get(row.currency) ?? 0) + 1);
      }

      // Seven days ending on the selected date — context, not a rolling trend.
      const trailing = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(`${date}T00:00:00.000Z`);
        day.setUTCDate(day.getUTCDate() - (6 - i));
        const key = day.toISOString().slice(0, 10);
        const dayRows = db.ledger.filter((l) => l.createdAt.slice(0, 10) === key);
        const net = dayRows.reduce(
          (sum, r) =>
            sum +
            (r.type === "deposit" ? r.amount : r.type === "withdrawal" ? -r.amount : 0),
          0,
        );
        return { date: key, netFlow: Number(net.toFixed(3)) };
      });

      return {
        date,
        currencyMix: [...currencyCounts.entries()]
          .map(([currency, operations]) => ({ currency, operations }))
          .sort((a, b) => b.operations - a.operations),
        trailing,
        branches: perBranch,
        totals: perBranch.reduce<BranchFlow>(
          (acc, b) => ({
            branchId: "all",
            branchName: "—",
            operations: acc.operations + b.operations,
            deposits: Number((acc.deposits + b.deposits).toFixed(3)),
            withdrawals: Number((acc.withdrawals + b.withdrawals).toFixed(3)),
            netFlow: Number((acc.netFlow + b.netFlow).toFixed(3)),
          }),
          {
            branchId: "all",
            branchName: "—",
            operations: 0,
            deposits: 0,
            withdrawals: 0,
            netFlow: 0,
          },
        ),
      } as T;
    }

    case "/analytics/branch-flow":
      return branchFlow as T;
    case "/analytics/all-operations": {
      // Range parameters follow the contract in docs/API_CONTRACT.md:
      // `dateFrom`/`dateTo` are inclusive ISO dates, `amountMin`/`amountMax`
      // inclusive numbers in the row's own currency.
      const day = (value: string) => value.slice(0, 10);
      const filtered = db.ledger.filter(
        (l) =>
          (!params?.type || l.type === params.type) &&
          (!params?.currency || l.currency === params.currency) &&
          (!params?.branchId ||
            l.branchName ===
              state.branches.find((b) => b.id === params.branchId)?.name) &&
          (!params?.dateFrom || day(l.createdAt) >= String(params.dateFrom)) &&
          (!params?.dateTo || day(l.createdAt) <= String(params.dateTo)) &&
          (params?.amountMin === undefined ||
            params.amountMin === "" ||
            l.amount >= Number(params.amountMin)) &&
          (params?.amountMax === undefined ||
            params.amountMax === "" ||
            l.amount <= Number(params.amountMax)) &&
          matches(
            `${l.clientName} ${l.clientNameEn ?? ""} ${l.accountNumber} ${l.reference}`,
            params?.q,
          ),
      );
      // Paged like every other register: returning all ~3,700 matching rows
      // made the page render the whole ledger in one table.
      return paginate(filtered, params) as T;
    }
    case "/analytics/activity":
      return db.activity as T;

    case "/profile/sessions":
      return state.sessions as T;

    case "/cbl/connection":
      return state.cbl as T;

    default:
      throw new ApiError(`No fixture for ${p}`, 404);
  }
}
