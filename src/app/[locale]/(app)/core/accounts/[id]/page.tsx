"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Scale, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailGrid, DetailItem } from "@/components/shared/detail-grid";
import { ClientNameText } from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { AccountEditDialog } from "@/components/modules/account-edit-dialog";
import { useAccount, useAllOperations } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { usePermission } from "@/lib/use-permission";
import { formatAmount, formatDateTime, formatPhone } from "@/lib/format";
import type { LedgerEntry } from "@/lib/api/types";

/**
 * One account, in full: the record the drawer summarises, the client it belongs
 * to, its latest movements, and the way into an edit.
 */
export default function AccountProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const t = useTranslations("accounts");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();
  const { can } = usePermission();

  const query = useAccount(id);
  const account = query.data;
  // The account's own movements, pulled from the ledger the analytics register
  // already serves — the account number is the search token, so no new endpoint
  // is invented for this panel.
  const operations = useAllOperations({
    q: account?.number ?? "",
    page: 1,
    pageSize: 10,
  });
  const rows = operations.data?.items ?? [];
  const [editing, setEditing] = useState(false);

  const columns: Column<LedgerEntry>[] = [
    {
      key: "reference",
      header: tf("reference"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.reference}</span>,
    },
    {
      key: "type",
      header: tf("type"),
      cell: (row) => labels.operationType(row.type),
    },
    {
      key: "date",
      header: tf("date"),
      cell: (row) => (
        <span className="numeric text-sm">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: "amount",
      header: tf("amount"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium text-fg">
          {formatAmount(row.amount, row.currency)}
        </span>
      ),
    },
  ];

  if (query.isLoading) return <PageSkeleton stats={2} />;
  if (query.isError || !account) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <Card>
          <ErrorState onRetry={() => query.refetch()} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={<span className="numeric">{account.number}</span>}
        description={t("profile")}
        actions={
          <>
            <Link
              href="/core/accounts"
              className={buttonStyles({ variant: "secondary" })}
            >
              <ArrowLeft className="rtl-flip size-4" aria-hidden />
              {tc("back")}
            </Link>
            {can("accounts", "create") ? (
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
            label: tf("balance"),
            value: formatAmount(account.balance, account.currency),
            numeric: true,
            icon: <Scale className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: tf("accountType"),
            value: labels.accountType(account.type),
            icon: <Tag className="size-4" aria-hidden />,
            color: "var(--color-chart-exchange)",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={tc("details")} />
          <CardBody>
            {/* Two columns at most: this card shares the row with the client
                card, so a third would put one field per line anyway. */}
            <DetailGrid className="lg:grid-cols-2">
              <DetailItem label={tf("entryId")} value={account.id} numeric />
              <DetailItem
                label={tf("accountNumber")}
                value={account.number}
                numeric
              />
              <DetailItem
                label={tf("iban")}
                wide
                value={
                  <MaskedField
                    value={account.iban}
                    fieldName={tf("iban")}
                    subjectType="account"
                    subjectId={account.id}
                    format="iban"
                  />
                }
              />
              <DetailItem
                label={tf("accountType")}
                value={labels.accountType(account.type)}
              />
              <DetailItem label={tf("currency")} value={account.currency} />
              <DetailItem
                label={tf("balance")}
                value={formatAmount(account.balance, account.currency)}
                numeric
              />
              <DetailItem label={tf("branch")} value={account.branchName} />
            </DetailGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={tf("client")}
            action={
              <Link
                href={`/core/clients/${account.clientId}`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                {tc("viewFull")}
              </Link>
            }
          />
          <CardBody>
            <DetailGrid className="lg:grid-cols-2">
              <DetailItem
                label={tf("clientName")}
                value={
                  <ClientNameText
                    name={account.clientName}
                    nameEn={account.clientNameEn}
                  />
                }
              />
              <DetailItem
                label={tf("phone")}
                value={formatPhone(account.clientPhone)}
                numeric
              />
            </DetailGrid>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("recentOperations")} />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={operations.isLoading}
          error={operations.isError}
          onRetry={() => operations.refetch()}
          caption={t("recentOperations")}
          paginate={false}
        />
      </Card>

      <AccountEditDialog
        account={account}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
