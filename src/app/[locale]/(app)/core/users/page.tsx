"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Plus, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PhoneText } from "@/components/shared/cells";
import {
  useBranches,
  useCurrentUser,
  useResetUserPassword,
  useRoles,
  useSaveUser,
  useSetUserActive,
  useUsers,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatCount, isValidPhone } from "@/lib/format";
import type { User } from "@/lib/api/types";

/** Backend user-type codes; the visible labels come from the dictionary. */
const USER_TYPES = ["systemAdmin", "branchManager", "teller", "auditor"];

export default function UsersPage() {
  const t = useTranslations("users");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const query = useUsers();
  const roles = useRoles();
  const branches = useBranches();
  const me = useCurrentUser();
  const setActive = useSetUserActive();
  const resetPassword = useResetUserPassword();

  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);

  const columns: Column<User>[] = [
    { key: "name", header: tf("name"), primary: true, cell: (row) => row.name },
    {
      key: "username",
      header: tf("username"),
      cell: (row) => <span className="numeric text-sm">{row.username}</span>,
    },
    {
      key: "phone",
      header: tf("phone"),
      cell: (row) => <PhoneText value={row.phone} />,
    },
    {
      key: "roles",
      header: tf("roles"),
      cell: (row) => row.roleNames.join("، ") || tc("notAvailable"),
    },
    {
      key: "branch",
      header: tf("defaultBranch"),
      cell: (row) => row.defaultBranchName,
    },
    {
      key: "active",
      header: tf("status"),
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"}>
          {row.active ? tf("active") : tf("inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: tc("actions"),
      align: "end",
      cell: (row) => (
        <span className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(row);
            }}
          >
            {tc("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              setResetting(row);
            }}
          >
            {t("resetPassword")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            // A user can never lock themselves out of the panel.
            disabled={!row.active || row.id === me.data?.id}
            title={row.id === me.data?.id ? t("cannotDeactivateSelf") : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setDeactivating(row);
            }}
          >
            {t("deactivate")}
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
          <Button onClick={() => setEditing("new")}>
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
            icon: <Users className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: tf("active"),
            value: formatCount(
              (query.data ?? []).filter((user) => user.active).length,
            ),
            numeric: true,
            tone: "success",
            icon: <UserCheck className="size-4" aria-hidden />,
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

      {editing ? (
        <UserDialog
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? null : editing}
          roles={(roles.data ?? []).map((role) => ({
            id: role.id,
            name: role.name,
          }))}
          branches={(branches.data ?? []).map((branch) => ({
            id: branch.id,
            name: branch.name,
          }))}
          userTypes={USER_TYPES.map((code) => ({
            code,
            label: labels.userType(code),
          }))}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        tone="danger"
        requireTyped
        loading={setActive.isPending}
        title={t("deactivateTitle")}
        body={t("deactivateBody", { name: deactivating?.name ?? "" })}
        confirmLabel={t("deactivate")}
        onConfirm={async () => {
          if (!deactivating) return;
          await setActive.mutateAsync({ id: deactivating.id, active: false });
          setDeactivating(null);
        }}
      />

      <ConfirmDialog
        open={resetting !== null}
        onClose={() => setResetting(null)}
        loading={resetPassword.isPending}
        title={t("resetPassword")}
        // No plaintext password is ever rendered in the admin UI.
        body={t("resetPasswordBody")}
        confirmLabel={tc("confirm")}
        onConfirm={async () => {
          if (!resetting) return;
          await resetPassword.mutateAsync(resetting.id);
          setResetting(null);
        }}
      />
    </div>
  );
}

function UserDialog({
  user,
  roles,
  branches,
  userTypes,
  onClose,
}: {
  user: User | null;
  roles: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  userTypes: { code: string; label: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("users");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const save = useSaveUser();

  const schema = z.object({
    name: z.string().min(2, tv("required")),
    username: z.string().min(3, tv("required")),
    phone: z.string().refine(isValidPhone, tv("invalidPhone")),
    userType: z.string().min(1, tv("required")),
    roleIds: z.array(z.string()).min(1, tv("selectOne")),
    defaultBranchId: z.string().min(1, tv("required")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      username: user?.username ?? "",
      phone: user?.phone ?? "",
      userType: user?.userType ?? userTypes[0]?.code ?? "",
      roleIds: user?.roleIds ?? [],
      defaultBranchId: user?.defaultBranchId ?? "",
    },
  });

  const selectedRoles = form.watch("roleIds");

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? t("editTitle") : t("add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            loading={save.isPending}
            onClick={form.handleSubmit(async (values) => {
              await save.mutateAsync({ id: user?.id, ...values });
              onClose();
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
          label={tf("username")}
          required
          autoComplete="off"
          error={form.formState.errors.username?.message}
          {...form.register("username")}
        />
        <TextInput
          label={tf("phone")}
          required
          numeric
          inputMode="tel"
          error={form.formState.errors.phone?.message}
          {...form.register("phone")}
        />
        <SelectInput
          label={tf("userType")}
          required
          error={form.formState.errors.userType?.message}
          {...form.register("userType")}
        >
          {userTypes.map((type) => (
            <option key={type.code} value={type.code}>
              {type.label}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label={tf("defaultBranch")}
          required
          error={form.formState.errors.defaultBranchId?.message}
          {...form.register("defaultBranchId")}
        >
          <option value="">{tc("selectPlaceholder")}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectInput>

        <Field
          label={tf("roles")}
          required
          error={form.formState.errors.roleIds?.message}
          className="sm:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => {
              const checked = selectedRoles.includes(role.id);
              return (
                <label
                  key={role.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={checked}
                    onChange={(event) =>
                      form.setValue(
                        "roleIds",
                        event.target.checked
                          ? [...selectedRoles, role.id]
                          : selectedRoles.filter((id) => id !== role.id),
                        { shouldValidate: true },
                      )
                    }
                  />
                  {role.name}
                </label>
              );
            })}
          </div>
        </Field>
      </form>
    </Dialog>
  );
}
