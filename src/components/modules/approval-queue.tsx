"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { StatusTabbedList } from "@/components/shared/status-tabbed-list";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpiryIndicator } from "@/components/shared/expiry-indicator";
import { AmountCell, ClientCell, DateCell } from "@/components/shared/cells";
import {
  useApproveOperation,
  useCancelOperation,
  useOperationRules,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import type {
  Beneficiary,
  OperationBase,
  OperationStatus,
  Paged,
} from "@/lib/api/types";

/** Shape both approval queues share. */
export type QueueOperation = OperationBase & {
  status: OperationStatus;
  beneficiary: Beneficiary;
  expiresAt: string | null;
  cancelledReason: string | null;
};

type QueueTab = "reserve" | "confirmed" | "cancelled";

const TABS: QueueTab[] = ["reserve", "confirmed", "cancelled"];

/**
 * Reserve → confirm/cancel queue used by Authorized Withdrawal and External
 * Transfer. Both hold funds, both expire, both are approved the same way — the
 * only differences are the beneficiary block and the extra bank columns.
 */
export function ApprovalQueue<T extends QueueOperation>({
  title,
  amountLabel,
  registerHref,
  kind,
  useData,
  beneficiaryHeader,
  renderBeneficiaryCell,
  renderBeneficiaryDetail,
  approveBody,
  cancelTitle,
  approveTitle,
}: {
  title: string;
  amountLabel: string;
  registerHref: string;
  kind: "authorized-withdrawals" | "external-transfers";
  useData: (params: { status: QueueTab; pageSize: number }) => {
    data?: Paged<T>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  beneficiaryHeader: ReactNode;
  renderBeneficiaryCell: (row: T) => ReactNode;
  renderBeneficiaryDetail: (row: T) => ReactNode;
  approveTitle: string;
  approveBody: (row: T) => string;
  cancelTitle: string;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tAuth = useTranslations("authorizedWithdrawal");
  const labels = useLabels();

  const rules = useOperationRules();
  const windowHours =
    kind === "authorized-withdrawals"
      ? rules.data?.authorizedWithdrawalExpiryHours
      : rules.data?.externalTransferExpiryHours;

  const [confirming, setConfirming] = useState<
    { row: T; action: "approve" | "cancel" } | null
  >(null);

  const approve = useApproveOperation(kind);
  const cancel = useCancelOperation(kind);

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          <Link href={registerHref} className={buttonStyles()}>
            <Plus className="size-4" aria-hidden />
            {tc("add")}
          </Link>
        }
      />

      <StatusTabbedList<QueueTab>
        defaultTab="reserve"
        ariaLabel={title}
        tabs={TABS.map((status) => ({
          value: status,
          label: labels.status(status),
        }))}
      >
        {(status) => (
          <QueueTable
            status={status}
            amountLabel={amountLabel}
            title={title}
            useData={useData}
            windowHours={windowHours}
            beneficiaryHeader={beneficiaryHeader}
            renderBeneficiaryCell={renderBeneficiaryCell}
            renderBeneficiaryDetail={renderBeneficiaryDetail}
            onAction={(row, action) => setConfirming({ row, action })}
            labels={{
              client: t("client"),
              amount: amountLabel,
              date: t("date"),
              expiry: t("expiresAt"),
              actions: tc("actions"),
              approve: tc("approve"),
              cancel: tc("cancel"),
              count: tStats("count"),
              total: tStats("total"),
              details: tc("details"),
              entryId: t("entryId"),
              reference: t("reference"),
              branch: t("branch"),
              createdAt: t("createdAt"),
              clientName: t("clientName"),
              phone: t("phone"),
              accountNumber: t("accountNumber"),
              status: t("status"),
              fee: t("fee"),
              feeType: t("feeType"),
              cancelledReason: tAuth("cancelReason"),
            }}
          />
        )}
      </StatusTabbedList>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        tone={confirming?.action === "cancel" ? "danger" : "success"}
        loading={approve.isPending || cancel.isPending}
        title={confirming?.action === "cancel" ? cancelTitle : approveTitle}
        body={
          confirming
            ? confirming.action === "cancel"
              ? tAuth("cancelBody")
              : approveBody(confirming.row)
            : null
        }
        confirmLabel={
          confirming?.action === "cancel" ? tc("cancel") : tc("approve")
        }
        // Cancelling releases held funds — capture why, and make it deliberate.
        requireTyped={confirming?.action === "cancel"}
        reason={
          confirming?.action === "cancel"
            ? { label: tAuth("cancelReason"), required: true }
            : undefined
        }
        onConfirm={async ({ reason }) => {
          if (!confirming) return;
          if (confirming.action === "approve") {
            await approve.mutateAsync(confirming.row.id);
          } else {
            await cancel.mutateAsync({ id: confirming.row.id, reason });
          }
          setConfirming(null);
        }}
      />
    </div>
  );
}

type QueueLabels = Record<
  | "client"
  | "amount"
  | "date"
  | "expiry"
  | "actions"
  | "approve"
  | "cancel"
  | "count"
  | "total"
  | "details"
  | "entryId"
  | "reference"
  | "branch"
  | "createdAt"
  | "clientName"
  | "phone"
  | "accountNumber"
  | "status"
  | "fee"
  | "feeType"
  | "cancelledReason",
  string
>;

function QueueTable<T extends QueueOperation>({
  status,
  title,
  amountLabel,
  useData,
  windowHours,
  beneficiaryHeader,
  renderBeneficiaryCell,
  renderBeneficiaryDetail,
  onAction,
  labels,
}: {
  status: QueueTab;
  title: string;
  amountLabel: string;
  useData: (params: { status: QueueTab; pageSize: number }) => {
    data?: Paged<T>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  windowHours?: number;
  beneficiaryHeader: ReactNode;
  renderBeneficiaryCell: (row: T) => ReactNode;
  renderBeneficiaryDetail: (row: T) => ReactNode;
  onAction: (row: T, action: "approve" | "cancel") => void;
  labels: QueueLabels;
}) {
  const enumLabels = useLabels();
  const query = useData({ status, pageSize: 100 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const anyFee = rows.some((row) => row.fee && row.fee.amount > 0);
  const pending = status === "reserve";

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
    }
    return [...map.entries()];
  }, [rows]);

  const columns: Column<T>[] = [
    {
      key: "client",
      header: labels.client,
      primary: true,
      cell: (row) => <ClientCell name={row.clientName} phone={row.clientPhone} />,
    },
    {
      key: "beneficiary",
      header: beneficiaryHeader,
      cell: renderBeneficiaryCell,
    },
    {
      key: "amount",
      header: labels.amount,
      align: "end",
      cell: (row) => (
        <AmountCell
          amount={row.amount}
          currency={row.currency}
          fee={anyFee ? row.fee : null}
        />
      ),
    },
    {
      key: "expiry",
      header: labels.expiry,
      // Only the reserve queue is racing a clock.
      hidden: !pending,
      cell: (row) => (
        <ExpiryIndicator expiresAt={row.expiresAt} windowHours={windowHours} />
      ),
    },
    {
      key: "date",
      header: labels.date,
      cell: (row) => <DateCell value={row.createdAt} />,
    },
    {
      key: "actions",
      header: labels.actions,
      hidden: !pending,
      align: "end",
      cell: (row) => (
        <span className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="success"
            onClick={(event) => {
              event.stopPropagation();
              onAction(row, "approve");
            }}
          >
            <Check className="size-4" aria-hidden />
            {labels.approve}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onAction(row, "cancel");
            }}
          >
            <X className="size-4" aria-hidden />
            {labels.cancel}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <HeaderStatBar
        stats={[
          {
            label: labels.count,
            value: formatCount(query.data?.total ?? 0),
            numeric: true,
            tone: pending ? "warning" : "default",
          },
          ...totals.map(([currency, total]) => ({
            label: `${labels.total} — ${currency}`,
            value: formatAmount(total, currency),
            numeric: true,
          })),
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={`${title} — ${enumLabels.status(status)}`}
        detailTitle={(row) => row.clientName}
        renderDetail={(row) => (
          <>
            <DetailSection title={labels.details}>
              <DetailRow label={labels.entryId} value={row.id} numeric />
              <DetailRow label={labels.reference} value={row.reference} numeric />
              <DetailRow
                label={labels.status}
                value={enumLabels.status(row.status)}
              />
              <DetailRow label={labels.branch} value={row.branchName} />
              <DetailRow
                label={labels.createdAt}
                value={formatDateTime(row.createdAt)}
                numeric
              />
              {row.expiresAt ? (
                <DetailRow
                  label={labels.expiry}
                  value={formatDateTime(row.expiresAt)}
                  numeric
                />
              ) : null}
              {row.cancelledReason ? (
                <DetailRow
                  label={labels.cancelledReason}
                  value={row.cancelledReason}
                />
              ) : null}
            </DetailSection>

            <DetailSection title={labels.client}>
              <DetailRow label={labels.clientName} value={row.clientName} />
              <DetailRow
                label={labels.phone}
                value={formatPhone(row.clientPhone)}
                numeric
              />
              <DetailRow
                label={labels.accountNumber}
                value={row.accountNumber}
                numeric
              />
            </DetailSection>

            {renderBeneficiaryDetail(row)}

            <DetailSection title={amountLabel}>
              <DetailRow
                label={labels.amount}
                value={formatAmount(row.amount, row.currency)}
                numeric
              />
              {row.fee && row.fee.amount > 0 ? (
                <>
                  <DetailRow
                    label={labels.feeType}
                    value={enumLabels.feeType(row.fee.type)}
                  />
                  <DetailRow
                    label={labels.fee}
                    value={formatAmount(row.fee.amount, row.fee.currency)}
                    numeric
                  />
                </>
              ) : null}
            </DetailSection>
          </>
        )}
      />
    </div>
  );
}
