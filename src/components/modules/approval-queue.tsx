"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Coins, Plus, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar, STAT_COLORS } from "@/components/shared/header-stat-bar";
import { StatusTabbedList } from "@/components/shared/status-tabbed-list";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpiryIndicator } from "@/components/shared/expiry-indicator";
import {
  AmountCell,
  ClientCell,
  ClientNameText,
  DateCell,
  StatusCell,
  useClientNameText,
} from "@/components/shared/cells";
import {
  useApproveOperation,
  useCancelOperation,
  useOperationRules,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import {
  formatAmount,
  formatCount,
  formatDateTime,
  formatPhone,
  isolate,
} from "@/lib/format";
import { useTableQuery } from "@/lib/use-table-query";
import type { QueryParams } from "@/lib/api/client";
import { useFeedback } from "@/components/providers/feedback-provider";
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
  statIcon,
  statColor = "var(--color-accent)",
}: {
  title: string;
  amountLabel: string;
  registerHref: string;
  kind: "authorized-withdrawals" | "external-transfers";
  /** Icon on the record-count card — the module's own, as in the sidebar. */
  statIcon?: ReactNode;
  /** Colour of that card's icon tile when nothing is waiting. */
  statColor?: string;
  useData: (params: QueryParams) => {
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
  const tc = useTranslations("common");
  const labels = useLabels();

  const rules = useOperationRules();
  const windowHours =
    kind === "authorized-withdrawals"
      ? rules.data?.authorizedWithdrawalExpiryHours
      : rules.data?.externalTransferExpiryHours;

  const [confirming, setConfirming] = useState<{
    row: T;
    action: "approve" | "cancel";
  } | null>(null);

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
            statIcon={statIcon}
            statColor={statColor}
            onAction={(row, action) => setConfirming({ row, action })}
          />
        )}
      </StatusTabbedList>

      <QueueConfirmDialog
        kind={kind}
        pending={confirming}
        onClose={() => setConfirming(null)}
        approveTitle={approveTitle}
        approveBody={approveBody}
        cancelTitle={cancelTitle}
      />
    </div>
  );
}

/**
 * The approve/cancel confirmation, and the two mutations behind it.
 *
 * It owns them rather than taking them as props so that the pending state of a
 * request lives next to the button that shows it, and the queue above stays a
 * layout: header, tabs, dialog.
 */
function QueueConfirmDialog<T extends QueueOperation>({
  kind,
  pending,
  onClose,
  approveTitle,
  approveBody,
  cancelTitle,
}: {
  kind: "authorized-withdrawals" | "external-transfers";
  pending: { row: T; action: "approve" | "cancel" } | null;
  onClose: () => void;
  approveTitle: string;
  approveBody: (row: T) => string;
  cancelTitle: string;
}) {
  const tc = useTranslations("common");
  const tAuth = useTranslations("authorizedWithdrawal");
  const tFeedback = useTranslations("feedback");
  const { notify } = useFeedback();
  const approve = useApproveOperation(kind);
  const cancel = useCancelOperation(kind);
  const cancelling = pending?.action === "cancel";

  return (
    <ConfirmDialog
      open={pending !== null}
      onClose={onClose}
      tone={cancelling ? "danger" : "success"}
      loading={approve.isPending || cancel.isPending}
      title={cancelling ? cancelTitle : approveTitle}
      body={
        pending
          ? cancelling
            ? tAuth("cancelBody")
            : approveBody(pending.row)
          : null
      }
      confirmLabel={cancelling ? tc("cancel") : tc("approve")}
      // Cancelling releases held funds — capture why, and make it deliberate.
      requireTyped={cancelling}
      reason={
        cancelling
          ? { label: tAuth("cancelReason"), required: true }
          : undefined
      }
      onConfirm={async ({ reason }) => {
        if (!pending) return;
        // A rejection propagates: ConfirmDialog keeps itself open and shows the
        // reference rather than closing on a change that did not happen.
        if (pending.action === "approve") {
          await approve.mutateAsync(pending.row.id);
          notify({ tone: "success", message: tFeedback("approved") });
        } else {
          await cancel.mutateAsync({ id: pending.row.id, reason });
          notify({ tone: "success", message: tFeedback("cancelled") });
        }
        onClose();
      }}
    />
  );
}

function QueueTable<T extends QueueOperation>({
  status,
  title,
  amountLabel,
  useData,
  windowHours,
  beneficiaryHeader,
  renderBeneficiaryCell,
  renderBeneficiaryDetail,
  statIcon,
  statColor,
  onAction,
}: {
  status: QueueTab;
  title: string;
  amountLabel: string;
  useData: (params: QueryParams) => {
    data?: Paged<T>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  windowHours?: number;
  beneficiaryHeader: ReactNode;
  renderBeneficiaryCell: (row: T) => ReactNode;
  renderBeneficiaryDetail: (row: T) => ReactNode;
  statIcon?: ReactNode;
  statColor?: string;
  onAction: (row: T, action: "approve" | "cancel") => void;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tAuth = useTranslations("authorizedWithdrawal");
  const enumLabels = useLabels();
  const clientName = useClientNameText();
  // The tab is a server-side filter, so switching it returns to page 1 and the
  // count below is the queue's real depth, not the number of rows fetched.
  const table = useTableQuery({
    filters: { status },
    sort: { key: "createdAt", direction: "desc" },
    searchable: false,
  });
  const query = useData(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const anyFee = rows.some((row) => row.fee && row.fee.amount > 0);
  const pending = status === "reserve";

  // Sums cover the rows on screen only — see the note in SimpleOperationList.
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
      header: t("client"),
      primary: true,
      sortKey: "clientName",
      cell: (row) => (
        <ClientCell
          name={row.clientName}
          nameEn={row.clientNameEn}
          phone={row.clientPhone}
        />
      ),
    },
    {
      key: "beneficiary",
      header: beneficiaryHeader,
      cell: renderBeneficiaryCell,
    },
    {
      key: "amount",
      header: amountLabel,
      align: "end",
      sortKey: "amount",
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
      header: t("expiresAt"),
      // Only the reserve queue is racing a clock.
      hidden: !pending,
      cell: (row) => (
        <ExpiryIndicator expiresAt={row.expiresAt} windowHours={windowHours} />
      ),
    },
    {
      key: "date",
      header: t("date"),
      sortKey: "createdAt",
      cell: (row) => <DateCell value={row.createdAt} />,
    },
    {
      key: "actions",
      header: tc("actions"),
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
            {tc("approve")}
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
            {tc("cancel")}
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
            label: tStats("count"),
            value: formatCount(total),
            numeric: true,
            tone: pending ? "warning" : "default",
            icon: statIcon,
            // Waiting work is amber whatever the module's own colour is: the
            // reserve tab holding records is the one figure on this page an
            // operator has to act on.
            color: pending ? "var(--color-warning)" : statColor,
          },
          ...totals.map(([currency, sum], index) => ({
            label: `${tStats("pageTotal")} — ${isolate(currency)}`,
            value: formatAmount(sum, currency),
            numeric: true,
            icon: <Coins className="size-4" aria-hidden />,
            color: STAT_COLORS[index % STAT_COLORS.length],
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
        paging={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onPageChange: table.setPage,
          onPageSizeChange: table.setPageSize,
        }}
        sort={table.sort}
        onSortChange={table.setSort}
        detailTitle={(row) => clientName(row.clientName, row.clientNameEn)}
        renderDetail={(row) => (
          <>
            <DetailSection title={tc("details")}>
              <DetailRow label={t("entryId")} value={row.id} numeric />
              <DetailRow label={t("reference")} value={row.reference} numeric />
              <DetailRow
                label={t("status")}
                value={<StatusCell status={row.status} />}
              />
              <DetailRow label={t("branch")} value={row.branchName} />
              <DetailRow
                label={t("createdAt")}
                value={formatDateTime(row.createdAt)}
                identifier
              />
              {row.expiresAt ? (
                <DetailRow
                  label={t("expiresAt")}
                  value={formatDateTime(row.expiresAt)}
                  identifier
                />
              ) : null}
              {row.cancelledReason ? (
                <DetailRow
                  label={tAuth("cancelReason")}
                  value={row.cancelledReason}
                />
              ) : null}
            </DetailSection>

            <DetailSection title={t("client")}>
              <DetailRow
                label={t("clientName")}
                value={
                  <ClientNameText
                    name={row.clientName}
                    nameEn={row.clientNameEn}
                  />
                }
              />
              <DetailRow
                label={t("phone")}
                value={formatPhone(row.clientPhone)}
                identifier
              />
              <DetailRow
                label={t("accountNumber")}
                value={row.accountNumber}
                numeric
              />
            </DetailSection>

            {renderBeneficiaryDetail(row)}

            <DetailSection title={amountLabel}>
              <DetailRow
                label={amountLabel}
                value={formatAmount(row.amount, row.currency)}
                numeric
              />
              {row.fee && row.fee.amount > 0 ? (
                <>
                  <DetailRow
                    label={t("feeType")}
                    value={enumLabels.feeType(row.fee.type)}
                  />
                  <DetailRow
                    label={t("fee")}
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
