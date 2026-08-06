"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useAccounts,
  useCreateCurrency,
  useCurrencies,
  useDeleteCurrency,
} from "@/lib/api/hooks";
import { formatCount } from "@/lib/format";
import type { Currency } from "@/lib/api/types";

export default function CurrenciesPage() {
  const t = useTranslations("currencies");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tv = useTranslations("validation");

  const query = useCurrencies();
  const create = useCreateCurrency();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Currency | null>(null);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (currency) =>
        currency.name.toLowerCase().includes(term) ||
        currency.alphabeticCode.toLowerCase().includes(term) ||
        currency.numericCode.includes(term),
    );
  }, [query.data, search]);

  const schema = z.object({
    name: z.string().min(2, tv("required")),
    alphabeticCode: z
      .string()
      .regex(/^[A-Za-z]{3}$/, tv("required"))
      .transform((value) => value.toUpperCase()),
    numericCode: z.string().regex(/^[0-9]{3}$/, tv("required")),
    precision: z.number().min(0).max(6),
    country: z.string().optional(),
  });
  type Values = z.input<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      alphabeticCode: "",
      numericCode: "",
      precision: 2,
      country: "",
    },
  });

  const columns: Column<Currency>[] = [
    {
      key: "name",
      header: tf("name"),
      primary: true,
      sortKey: true,
      cell: (row) => row.name,
    },
    {
      key: "alpha",
      header: t("alphabeticCode"),
      sortKey: "alphabeticCode",
      cell: (row) => <span className="numeric text-sm">{row.alphabeticCode}</span>,
    },
    {
      key: "numeric",
      header: t("numericCode"),
      sortKey: "numericCode",
      cell: (row) => <span className="numeric text-sm">{row.numericCode}</span>,
    },
    {
      key: "precision",
      header: t("precision"),
      sortKey: true,
      align: "end",
      cell: (row) => <span className="numeric text-sm">{row.precision}</span>,
    },
    {
      key: "actions",
      header: tc("actions"),
      align: "end",
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            setDeleting(row);
          }}
        >
          {tc("delete")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(query.data?.length ?? 0),
            numeric: true,
            icon: <Coins className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
        ]}
      />

      <Card>
        <div className="border-b border-border p-3">
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {/* ~170 rows — paginated, so a phone never mounts more than a page. */}
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
          // A hundred and seventy currencies, delivered whole and paged here.
          paging="client"
        />
      </Card>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t("add")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              {tc("cancel")}
            </Button>
            <Button
              loading={create.isPending}
              onClick={form.handleSubmit(async (values) => {
                await create.mutateAsync({
                  name: values.name,
                  alphabeticCode: values.alphabeticCode.toUpperCase(),
                  numericCode: values.numericCode,
                  precision: Number(values.precision),
                  country: values.country || null,
                });
                form.reset();
                setAdding(false);
              })}
            >
              {tc("save")}
            </Button>
          </>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={tf("name")}
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <TextInput
            label={tf("country")}
            hint={tc("optional")}
            error={form.formState.errors.country?.message}
            {...form.register("country")}
          />
          <TextInput
            label={t("alphabeticCode")}
            required
            numeric
            maxLength={3}
            error={form.formState.errors.alphabeticCode?.message}
            {...form.register("alphabeticCode")}
          />
          <TextInput
            label={t("numericCode")}
            required
            numeric
            inputMode="numeric"
            maxLength={3}
            error={form.formState.errors.numericCode?.message}
            {...form.register("numericCode")}
          />
          <TextInput
            label={t("precision")}
            required
            numeric
            inputMode="numeric"
            error={form.formState.errors.precision?.message}
            {...form.register("precision", { valueAsNumber: true })}
          />
        </form>
      </Dialog>

      {deleting ? (
        <DeleteCurrencyDialog
          currency={deleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Delete confirmation for one currency.
 *
 * Whether a currency is in use is asked about the currency being deleted, at
 * the moment of deletion — one `total`-only request. The page used to prefetch
 * hundreds of accounts to build the same answer, which was both wasteful and
 * wrong: an account past the prefetch window made a used currency look free.
 */
function DeleteCurrencyDialog({
  currency,
  onClose,
}: {
  currency: Currency;
  onClose: () => void;
}) {
  const t = useTranslations("currencies");
  const tc = useTranslations("common");
  const remove = useDeleteCurrency();
  const usage = useAccounts({
    currency: currency.alphabeticCode,
    pageSize: 1,
  });
  // Advisory: the typed confirmation is the real gate and the server refuses an
  // in-use currency regardless, so an unsettled check never blocks the dialog.
  const inUse = (usage.data?.total ?? 0) > 0;

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      tone="danger"
      requireTyped
      loading={remove.isPending}
      title={t("deleteTitle")}
      body={t("deleteBody", { code: currency.alphabeticCode })}
      confirmLabel={tc("delete")}
      blocked={inUse ? t("deleteBlocked") : undefined}
      onConfirm={async () => {
        await remove.mutateAsync(currency.id);
        onClose();
      }}
    />
  );
}
