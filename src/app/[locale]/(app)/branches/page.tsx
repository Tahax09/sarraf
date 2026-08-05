"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useBranches, useSaveBranch } from "@/lib/api/hooks";
import { formatCount } from "@/lib/format";
import type { Branch } from "@/lib/api/types";

export default function BranchesPage() {
  const t = useTranslations("branches");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tv = useTranslations("validation");

  const query = useBranches();
  const save = useSaveBranch();
  const [editing, setEditing] = useState<Branch | "new" | null>(null);

  const schema = z.object({
    name: z.string().min(2, tv("required")),
    city: z.string().min(2, tv("required")),
    region: z.string().min(2, tv("required")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", city: "", region: "" },
  });

  function open(branch: Branch | "new") {
    form.reset(
      branch === "new"
        ? { name: "", city: "", region: "" }
        : { name: branch.name, city: branch.city, region: branch.region },
    );
    setEditing(branch);
  }

  const columns: Column<Branch>[] = [
    { key: "name", header: tf("name"), primary: true, cell: (row) => row.name },
    { key: "city", header: tf("city"), cell: (row) => row.city },
    { key: "region", header: tf("region"), cell: (row) => row.region },
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
            open(row);
          }}
        >
          {tc("edit")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => open("new")}>
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
            icon: <Building2 className="size-4" aria-hidden />,
            iconTone: "accent",
          },
        ]}
      />

      <Card>
        <DataTable
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
        />
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("add") : t("title")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </Button>
            <Button
              loading={save.isPending}
              onClick={form.handleSubmit(async (values) => {
                await save.mutateAsync({
                  id: editing && editing !== "new" ? editing.id : undefined,
                  ...values,
                });
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
            label={tf("name")}
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <TextInput
            label={tf("city")}
            required
            error={form.formState.errors.city?.message}
            {...form.register("city")}
          />
          <TextInput
            label={tf("region")}
            required
            error={form.formState.errors.region?.message}
            {...form.register("region")}
          />
        </form>
      </Dialog>
    </div>
  );
}
