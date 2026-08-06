"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Coins, Pencil, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar, STAT_COLORS } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailGrid, DetailItem } from "@/components/shared/detail-grid";
import { useClientNameText } from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { ClientEditDialog } from "@/components/modules/client-edit-dialog";
import { useAccounts, useClient } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { usePermission } from "@/lib/use-permission";
import { formatAmount, formatCount, formatDateTime, formatPhone, isolate } from "@/lib/format";
import type { Account } from "@/lib/api/types";

/**
 * One client, in full: the identity the register only summarises, every account
 * the client holds, and the way into an edit. Reached from the row drawer, and
 * linkable on its own — an operator can hand the URL to a colleague.
 */
export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tAccounts = useTranslations("accounts");
  const labels = useLabels();
  const clientName = useClientNameText();
  const { can } = usePermission();

  const query = useClient(id);
  // The client's own accounts, not the register: 50 is far above any real
  // holding and keeps this to a single request.
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

  if (query.isLoading) return <PageSkeleton stats={2} />;
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
    <div className="space-y-4">
      <PageHeader
        title={clientName(client.name, client.nameEn)}
        description={t("profile")}
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
            label: tStats("count"),
            value: formatCount(client.accountsCount),
            numeric: true,
            icon: <Wallet className="size-4" aria-hidden />,
            color: "var(--color-accent)",
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

      <Card>
        <CardHeader title={tc("details")} />
        <CardBody>
          <DetailGrid>
            <DetailItem label={tf("entryId")} value={client.id} numeric />
            <DetailItem label={tf("name")} value={client.name} />
            <DetailItem
              label={tf("nameEn")}
              value={client.nameEn ?? tc("notAvailable")}
            />
            <DetailItem
              label={tf("phone")}
              value={formatPhone(client.phone)}
              numeric
            />
            <DetailItem
              label={tf("email")}
              value={client.email ?? tc("notAvailable")}
            />
            <DetailItem
              label={tf("createdAt")}
              value={formatDateTime(client.createdAt)}
              numeric
            />
          </DetailGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tAccounts("heldAccounts")} />
        <DataTable
          columns={columns}
          rows={accounts}
          getRowId={(row) => row.id}
          loading={accountsQuery.isLoading}
          error={accountsQuery.isError}
          onRetry={() => accountsQuery.refetch()}
          caption={tf("account")}
          paginate={false}
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
      </Card>

      <ClientEditDialog
        client={client}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
