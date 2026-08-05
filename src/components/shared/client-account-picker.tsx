"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useAccounts, useClients } from "@/lib/api/hooks";
import type { Account } from "@/lib/api/types";
import { formatAmount, formatPhone } from "@/lib/format";
import { Field, SelectInput, controlClassName } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type ClientAccountValue = {
  clientId: string | null;
  accountId: string | null;
};

/**
 * Searchable client picker that auto-populates the client's accounts and shows
 * the live balance of the selected one. Used by every register form.
 */
export function ClientAccountPicker({
  value,
  onChange,
  labelPrefix,
  error,
  disabledAccountIds = [],
}: {
  value: ClientAccountValue;
  onChange: (value: ClientAccountValue, account: Account | null) => void;
  /** Distinguishes the sender/receiver instances in dual-party forms. */
  labelPrefix?: string;
  error?: { client?: string; account?: string };
  disabledAccountIds?: string[];
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const listboxId = useId();

  const clientsQuery = useClients({ name: search, pageSize: 8 });
  const accountsQuery = useAccounts({ pageSize: 200 });

  const clientAccounts = useMemo(
    () =>
      (accountsQuery.data?.items ?? []).filter(
        (a) => a.clientId === value.clientId,
      ),
    [accountsQuery.data, value.clientId],
  );

  const selectedAccount =
    clientAccounts.find((a) => a.id === value.accountId) ?? null;

  const selectedClient = (clientsQuery.data?.items ?? []).find(
    (c) => c.id === value.clientId,
  );

  // Single-account clients skip a pointless second choice.
  useEffect(() => {
    if (!value.accountId && clientAccounts.length === 1) {
      onChange(
        { clientId: value.clientId, accountId: clientAccounts[0].id },
        clientAccounts[0],
      );
    }
  }, [clientAccounts, value.accountId, value.clientId, onChange]);

  const label = (base: string) =>
    labelPrefix ? `${labelPrefix} — ${base}` : base;

  return (
    <div className="space-y-3">
      <Field label={label(t("client"))} error={error?.client} required>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
            style={{ insetInlineStart: "0.75rem" }}
          />
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className={cn(controlClassName, "ps-9")}
            placeholder={tc("searchPlaceholder")}
            value={open ? search : (selectedClient?.name ?? search)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              setSearch(event.target.value);
              setOpen(true);
            }}
          />
          {open ? (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface shadow-[var(--shadow-pop)]"
            >
              {(clientsQuery.data?.items ?? []).map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={client.id === value.clientId}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start hover:bg-surface-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange({ clientId: client.id, accountId: null }, null);
                      setSearch(client.name);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm text-fg">{client.name}</span>
                    <span className="numeric text-xs text-fg-muted">
                      {formatPhone(client.phone)}
                    </span>
                  </button>
                </li>
              ))}
              {clientsQuery.data?.items.length === 0 ? (
                <li className="px-3 py-2 text-xs text-fg-muted">
                  {tc("noResults")}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </Field>

      <SelectInput
        label={label(t("account"))}
        required
        error={error?.account}
        value={value.accountId ?? ""}
        disabled={!value.clientId}
        onChange={(event) => {
          const account =
            clientAccounts.find((a) => a.id === event.target.value) ?? null;
          onChange(
            { clientId: value.clientId, accountId: account?.id ?? null },
            account,
          );
        }}
      >
        <option value="">{tc("selectPlaceholder")}</option>
        {clientAccounts.map((account) => (
          <option
            key={account.id}
            value={account.id}
            disabled={disabledAccountIds.includes(account.id)}
          >
            {account.number} — {account.currency}
          </option>
        ))}
      </SelectInput>

      {selectedAccount ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
          <span className="text-xs text-fg-muted">{t("availableBalance")}</span>
          <span className="numeric text-sm font-semibold text-fg">
            {formatAmount(selectedAccount.balance, selectedAccount.currency)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
