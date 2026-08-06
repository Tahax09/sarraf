"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Globe, Map, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput, TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useCountries,
  useCreateCountry,
  useDeleteCountry,
  useExternalTransfers,
  useUpdateCountry,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { countryFlag, formatCount } from "@/lib/format";
import { CONTINENTS, type Continent, type Country } from "@/lib/api/types";

export default function CountriesPage() {
  const t = useTranslations("countries");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tv = useTranslations("validation");
  const labels = useLabels();

  const query = useCountries();
  const create = useCreateCountry();
  const update = useUpdateCountry();

  const [editing, setEditing] = useState<Country | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Country | null>(null);
  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState("");

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter(
      (country) =>
        (!continent || country.continent === continent) &&
        (!term ||
          country.name.toLowerCase().includes(term) ||
          country.nameEn.toLowerCase().includes(term) ||
          country.code.toLowerCase().includes(term) ||
          (country.phoneCode ?? "").includes(term)),
    );
  }, [query.data, search, continent]);

  // Some records carry no dial code; the column is dropped entirely when the
  // backend supplies none, rather than showing a column of dashes.
  const anyPhoneCode = (query.data ?? []).some((c) => c.phoneCode);

  const schema = z.object({
    code: z
      .string()
      .regex(/^[A-Za-z]{2}$/, tv("required"))
      .transform((value) => value.toUpperCase()),
    name: z.string().min(2, tv("required")),
    nameEn: z.string().min(2, tv("required")),
    // Digits only: the `+` is added at render, never stored (that produced the
    // `++216` double prefix).
    phoneCode: z
      .string()
      .regex(/^[0-9]{0,4}$/, tv("required"))
      .optional(),
    continent: z.enum(CONTINENTS),
  });
  type Values = z.input<typeof schema>;

  const empty: Values = {
    code: "",
    name: "",
    nameEn: "",
    phoneCode: "",
    continent: "africa",
  };

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });

  function openAdd() {
    form.reset(empty);
    setEditing(null);
    setAdding(true);
  }

  function openEdit(row: Country) {
    form.reset({
      code: row.code,
      name: row.name,
      nameEn: row.nameEn,
      phoneCode: row.phoneCode ?? "",
      continent: row.continent,
    });
    setEditing(row);
    setAdding(true);
  }

  const columns: Column<Country>[] = [
    {
      key: "name",
      header: t("nameAr"),
      primary: true,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span aria-hidden>{countryFlag(row.code)}</span>
          <bdi>{row.name}</bdi>
        </span>
      ),
    },
    {
      key: "nameEn",
      header: t("nameEn"),
      cell: (row) => row.nameEn,
    },
    {
      key: "code",
      header: t("code"),
      cell: (row) => <span className="numeric text-sm">{row.code}</span>,
    },
    {
      key: "continent",
      header: t("continent"),
      cell: (row) => labels.continent(row.continent),
    },
    {
      key: "phoneCode",
      header: t("phoneCode"),
      hidden: !anyPhoneCode,
      cell: (row) => (
        // The `+` is added once, here — the stored value is digits only.
        <span className="numeric text-sm">
          {row.phoneCode ? `+${row.phoneCode}` : tc("notAvailable")}
        </span>
      ),
    },
    {
      key: "actions",
      header: tc("actions"),
      align: "end",
      cell: (row) => (
        <span className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row);
            }}
          >
            {tc("edit")}
          </Button>
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
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={openAdd}>
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
            icon: <Globe className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: t("continent"),
            value: formatCount(
              new Set((query.data ?? []).map((c) => c.continent)).size,
            ),
            numeric: true,
            icon: <Map className="size-4" aria-hidden />,
            color: "var(--color-chart-6)",
          },
        ]}
      />

      <Card>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2">
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectInput
            label={t("continent")}
            value={continent}
            onChange={(event) => setContinent(event.target.value)}
          >
            <option value="">{tc("all")}</option>
            {CONTINENTS.map((value) => (
              <option key={value} value={value}>
                {labels.continent(value)}
              </option>
            ))}
          </SelectInput>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.code}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
        />
      </Card>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={editing ? t("edit") : t("add")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              {tc("cancel")}
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              onClick={form.handleSubmit(async (values) => {
                const code = values.code.toUpperCase();
                const payload: Country = {
                  code,
                  name: values.name,
                  nameEn: values.nameEn,
                  phoneCode: values.phoneCode || null,
                  continent: values.continent as Continent,
                };
                if (editing) {
                  await update.mutateAsync(payload);
                } else {
                  if ((query.data ?? []).some((c) => c.code === code)) {
                    form.setError("code", { message: t("codeTaken") });
                    return;
                  }
                  await create.mutateAsync(payload);
                }
                setAdding(false);
                setEditing(null);
              })}
            >
              {tc("save")}
            </Button>
          </>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t("nameAr")}
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <TextInput
            label={t("nameEn")}
            required
            error={form.formState.errors.nameEn?.message}
            {...form.register("nameEn")}
          />
          <TextInput
            label={t("code")}
            required
            numeric
            maxLength={2}
            // The code is the record's identity; changing it would be a move.
            disabled={editing !== null}
            error={form.formState.errors.code?.message}
            {...form.register("code")}
          />
          <TextInput
            label={t("phoneCode")}
            numeric
            inputMode="numeric"
            maxLength={4}
            hint={t("phoneCodeHint")}
            error={form.formState.errors.phoneCode?.message}
            {...form.register("phoneCode")}
          />
          <SelectInput
            label={t("continent")}
            required
            error={form.formState.errors.continent?.message}
            {...form.register("continent")}
          >
            {CONTINENTS.map((value) => (
              <option key={value} value={value}>
                {labels.continent(value)}
              </option>
            ))}
          </SelectInput>
        </form>
      </Dialog>

      {deleting ? (
        <DeleteCountryDialog
          country={deleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Delete confirmation for one country.
 *
 * A country named by an external transfer cannot be removed. The guard is
 * server-side too; asking here — scoped to the one country, one `total`-only
 * request — keeps the reader from walking into a 409. The page used to prefetch
 * hundreds of transfers for the same answer, which missed any transfer past the
 * prefetch window.
 */
function DeleteCountryDialog({
  country,
  onClose,
}: {
  country: Country;
  onClose: () => void;
}) {
  const t = useTranslations("countries");
  const tc = useTranslations("common");
  const remove = useDeleteCountry();
  const usage = useExternalTransfers({
    countryCode: country.code,
    pageSize: 1,
  });
  // The check is advisory: the typed confirmation is the real gate and the
  // server refuses an in-use country regardless, so an unsettled check never
  // holds the dialog hostage.
  const inUse = (usage.data?.total ?? 0) > 0;

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      tone="danger"
      requireTyped
      loading={remove.isPending}
      title={t("deleteTitle")}
      body={t("deleteBody", { name: country.name })}
      confirmLabel={tc("delete")}
      blocked={inUse ? t("deleteBlocked") : undefined}
      onConfirm={async () => {
        await remove.mutateAsync(country.code);
        onClose();
      }}
    />
  );
}
