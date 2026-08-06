"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  Coins,
  Pencil,
  User,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar, STAT_COLORS } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  DetailGrid,
  DetailItem,
  RecordHeader,
  RecordSection,
} from "@/components/shared/detail-page";
import { CountryName, useClientNameText } from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { ClientEditDialog } from "@/components/modules/client-edit-dialog";
import { useAccounts, useClient } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { usePermission } from "@/lib/use-permission";
import {
  formatAmount,
  formatCount,
  formatDate,
  formatDateTime,
  formatPhone,
  isolate,
} from "@/lib/format";
import type { Account } from "@/lib/api/types";

/**
 * One client, read top to bottom: who this is, the figures that describe the
 * relationship, the identity record, how to reach them, and what they hold.
 * Reached from the row drawer, and linkable on its own — an operator can hand
 * the URL to a colleague.
 */
export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const ts = useTranslations("sections");
  const tStats = useTranslations("stats");
  const tAccounts = useTranslations("accounts");
  const labels = useLabels();
  const clientName = useClientNameText();
  const { can } = usePermission();

  const query = useClient(id);
  /*
   * The client's own accounts, not the register: 50 is far above any real
   * holding and keeps this to a single request.
   *
   * Deliberately not paged, unlike the account panel next door. The balance
   * cards below sum the whole holding per currency, and a paged table would
   * hand them one page — a total that changes as the reader turns pages is
   * worse than a table with no pager.
   */
  const accountsQuery = useAccounts({ clientId: id, pageSize: 50 });
  const accounts = useMemo(
    () => accountsQuery.data?.items ?? [],
    [accountsQuery.data],
  );
  const [editing, setEditing] = useState(false);

  // One card per currency the client holds — a mixed-currency sum would be a
  // meaningless number.
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const account of accounts) {
      map.set(account.currency, (map.get(account.currency) ?? 0) + account.balance);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const columns: Column<Account>[] = [
    {
      key: "number",
      header: tf("accountNumber"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.number}</span>,
    },
    {
      key: "iban",
      header: tf("iban"),
      cell: (row) => (
        <MaskedField
          value={row.iban}
          fieldName={tf("iban")}
          subjectType="account"
          subjectId={row.id}
          format="iban"
          className="text-sm"
        />
      ),
    },
    {
      key: "type",
      header: tf("accountType"),
      cell: (row) => labels.accountType(row.type),
    },
    { key: "branch", header: tf("branch"), cell: (row) => row.branchName },
    {
      key: "balance",
      header: tf("balance"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium text-fg">
          {formatAmount(row.balance, row.currency)}
        </span>
      ),
    },
  ];

  if (query.isLoading) return <PageSkeleton stats={3} />;
  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <Card>
          <ErrorState onRetry={() => query.refetch()} />
        </Card>
      </div>
    );
  }

  const client = query.data;

  return (
    <div className="space-y-5">
      <RecordHeader
        icon={<User className="size-5" aria-hidden />}
        eyebrow={t("profile")}
        title={clientName(client.name, client.nameEn)}
        meta={[
          <span key="phone" className="identifier">
            {formatPhone(client.phone)}
          </span>,
          client.email,
        ]}
        actions={
          <>
            <Link
              href="/core/clients/list"
              className={buttonStyles({ variant: "secondary" })}
            >
              <ArrowLeft className="rtl-flip size-4" aria-hidden />
              {tc("back")}
            </Link>
            {can("clients", "create") ? (
              <Button onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                {tc("edit")}
              </Button>
            ) : null}
          </>
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tAccounts("title"),
            value: formatCount(client.accountsCount),
            numeric: true,
            icon: <Wallet className="size-4" aria-hidden />,
            // Not a link: every one of these accounts is listed further down
            // the page, and the register cannot be pre-filtered to a client
            // without putting the client's id in a query string.
            color: "var(--color-accent)",
          },
          {
            label: tf("createdAt"),
            value: formatDate(client.createdAt),
            numeric: true,
            icon: <CalendarDays className="size-4" aria-hidden />,
            color: "var(--color-chart-deposit)",
          },
          ...totals.map(([currency, sum], index) => ({
            label: `${tStats("total")} — ${isolate(currency)}`,
            value: formatAmount(sum, currency),
            numeric: true,
            icon: <Coins className="size-4" aria-hidden />,
            color: STAT_COLORS[index % STAT_COLORS.length],
          })),
        ]}
      />

      <RecordSection title={ts("clientInformation")}>
        <DetailGrid>
          {/* Both names, each on its own line. One is what the identity
              document says, the other is what a correspondent bank will show —
              neither is a translation of the other, so neither is dropped. */}
          <DetailItem label={tf("nameAr")} value={client.name} />
          <DetailItem
            label={tf("nameEn")}
            value={client.nameEn ?? tc("notAvailable")}
          />
          <DetailItem
            label={tf("nationality")}
            value={<CountryName code={client.nationalityCode} />}
          />
          <DetailItem label={tf("entryId")} value={client.id} identifier />
          <DetailItem
            label={tf("createdAt")}
            value={formatDateTime(client.createdAt)}
            identifier
          />
        </DetailGrid>
      </RecordSection>

      <RecordSection title={ts("contactInformation")}>
        <DetailGrid>
          <DetailItem
            label={tf("phone")}
            value={formatPhone(client.phone)}
            identifier
          />
          <DetailItem
            label={tf("email")}
            value={client.email ?? tc("notAvailable")}
            identifier={Boolean(client.email)}
          />
          <DetailItem
            label={tf("address")}
            value={client.address ?? tc("notAvailable")}
            wide
          />
        </DetailGrid>
      </RecordSection>

      <RecordSection
        title={ts("relatedRecords")}
        description={tAccounts("heldAccounts")}
        flush
      >
        <DataTable
          columns={columns}
          rows={accounts}
          getRowId={(row) => row.id}
          loading={accountsQuery.isLoading}
          error={accountsQuery.isError}
          onRetry={() => accountsQuery.refetch()}
          caption={tAccounts("heldAccounts")}
          // Bounded by the request above, and by what a client plausibly holds.
          paging="none"
          renderActions={(row) => (
            <Link
              href={`/core/accounts/${row.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
              onClick={(event) => event.stopPropagation()}
            >
              {tc("view")}
            </Link>
          )}
        />
      </RecordSection>

      <ClientEditDialog
        client={client}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
