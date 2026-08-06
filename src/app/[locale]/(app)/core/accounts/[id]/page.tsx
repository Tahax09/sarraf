"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowLeftRight,
  Clock,
  Pencil,
  Scale,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  DetailGrid,
  DetailItem,
  RecordHeader,
  RecordSection,
} from "@/components/shared/detail-page";
import { ClientNameText } from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { AccountEditDialog } from "@/components/modules/account-edit-dialog";
import { useAccount, useAllOperations } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { usePermission } from "@/lib/use-permission";
import {
  formatAmount,
  formatCount,
  formatDateTime,
  formatPhone,
  isolate,
} from "@/lib/format";
import type { LedgerEntry } from "@/lib/api/types";

/**
 * One account, read top to bottom: which account this is, the figures that
 * describe it, then the record itself in titled sections, then its movements.
 */
export default function AccountProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const t = useTranslations("accounts");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const ts = useTranslations("sections");
  const tStats = useTranslations("stats");
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
  const operationsTotal = operations.data?.total ?? 0;
  const lastActivity = rows[0]?.createdAt ?? null;
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

  if (query.isLoading) return <PageSkeleton stats={3} />;
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
    <div className="space-y-5">
      <RecordHeader
        icon={<Wallet className="size-5" aria-hidden />}
        eyebrow={t("profile")}
        title={<span className="numeric">{account.number}</span>}
        badges={
          <>
            <Badge tone="accent">{labels.accountType(account.type)}</Badge>
            <Badge>
              <span className="numeric">{isolate(account.currency)}</span>
            </Badge>
          </>
        }
        meta={[
          account.branchName,
          <ClientNameText
            key="client"
            name={account.clientName}
            nameEn={account.clientNameEn}
          />,
        ]}
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
            label: tStats("operations"),
            value: formatCount(operationsTotal),
            numeric: true,
            icon: <ArrowLeftRight className="size-4" aria-hidden />,
            // No drill-down: the register searches by account number, and this
            // panel keeps account numbers out of query strings (ADR-0003). The
            // movements themselves are in the section below.
            color: "var(--color-chart-exchange)",
          },
          {
            label: tStats("lastActivity"),
            value: lastActivity
              ? formatDateTime(lastActivity)
              : tc("notAvailable"),
            numeric: Boolean(lastActivity),
            icon: <Clock className="size-4" aria-hidden />,
            color: "var(--color-chart-deposit)",
          },
        ]}
      />

      <RecordSection title={ts("accountInformation")}>
        <DetailGrid>
          <DetailItem
            label={tf("accountNumber")}
            value={account.number}
            numeric
          />
          <DetailItem
            label={tf("accountType")}
            value={labels.accountType(account.type)}
          />
          <DetailItem label={tf("branch")} value={account.branchName} />
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
          <DetailItem label={tf("entryId")} value={account.id} numeric />
        </DetailGrid>
      </RecordSection>

      <RecordSection title={ts("balanceInformation")}>
        <DetailGrid>
          <DetailItem
            label={tf("balance")}
            value={formatAmount(account.balance, account.currency)}
            numeric
            hint={labels.accountType(account.type)}
          />
          <DetailItem label={tf("currency")} value={account.currency} numeric />
          <DetailItem
            label={tStats("lastActivity")}
            value={
              lastActivity ? formatDateTime(lastActivity) : tc("notAvailable")
            }
            numeric={Boolean(lastActivity)}
          />
        </DetailGrid>
      </RecordSection>

      <RecordSection
        title={ts("ownerInformation")}
        action={
          <Link
            href={`/core/clients/${account.clientId}`}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            {tc("viewFull")}
          </Link>
        }
      >
        <DetailGrid>
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
          <DetailItem label={tf("clientId")} value={account.clientId} numeric />
        </DetailGrid>
      </RecordSection>

      <RecordSection
        title={ts("recentActivity")}
        description={t("recentOperations")}
        flush
      >
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
      </RecordSection>

      <AccountEditDialog
        account={account}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
