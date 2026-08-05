"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useRoles, useSaveRole } from "@/lib/api/hooks";
import {
  MODULE_ACTIONS,
  PERMISSION_MODULES,
  type PermissionModule,
} from "@/lib/permissions";
import { formatCount } from "@/lib/format";
import type { PermissionAction, Role } from "@/lib/api/types";

export default function RolesPage() {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");

  const query = useRoles();
  const save = useSaveRole();

  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [pendingMatrix, setPendingMatrix] = useState<Role | null>(null);

  const roles = query.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t("emptyCta")}
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <Card>
          <CardBody>
            <ErrorState onRetry={() => query.refetch()} />
          </CardBody>
        </Card>
      ) : roles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="size-6" aria-hidden />}
            title={t("emptyTitle")}
            action={
              <Button onClick={() => setEditing("new")}>{t("emptyCta")}</Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader
                title={role.name}
                description={role.description}
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing(role)}
                  >
                    {t("permissions")}
                  </Button>
                }
              />
              <CardBody className="text-sm text-fg-muted">
                {t("assignedUsers")}:{" "}
                <span className="numeric text-fg">
                  {formatCount(role.assignedUsers)}
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <RoleDialog
          key={editing === "new" ? "new" : editing.id}
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(next) => setPendingMatrix(next)}
          moduleLabel={(module) => tNav(module as string)}
          saving={save.isPending}
        />
      ) : null}

      <ConfirmDialog
        open={pendingMatrix !== null}
        onClose={() => setPendingMatrix(null)}
        loading={save.isPending}
        title={t("permissionMatrix")}
        // Permission edits change who can move money — always confirmed.
        body={tc("confirm")}
        onConfirm={async () => {
          if (!pendingMatrix) return;
          await save.mutateAsync(pendingMatrix);
          setPendingMatrix(null);
          setEditing(null);
        }}
      />
    </div>
  );
}

function RoleDialog({
  role,
  onClose,
  onSubmit,
  moduleLabel,
  saving,
}: {
  role: Role | null;
  onClose: () => void;
  onSubmit: (role: Role) => void;
  moduleLabel: (module: PermissionModule) => string;
  saving: boolean;
}) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");

  const [draft, setDraft] = useState<Role>(
    role ?? {
      id: "",
      name: "",
      description: "",
      assignedUsers: 0,
      permissions: {},
    },
  );

  function toggle(module: PermissionModule, action: PermissionAction) {
    setDraft((prev) => {
      const current = prev.permissions[module] ?? [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, permissions: { ...prev.permissions, [module]: next } };
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={role ? role.name : t("emptyCta")}
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            loading={saving}
            disabled={draft.name.trim().length < 2}
            onClick={() => onSubmit(draft)}
          >
            {tc("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={tf("name")}
            required
            value={draft.name}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <TextInput
            label={tf("description")}
            value={draft.description}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">{t("permissionMatrix")}</caption>
            <thead>
              <tr className="border-b border-border text-xs text-fg-muted">
                <th scope="col" className="p-2 text-start font-medium">
                  {t("permissions")}
                </th>
                {(["view", "create", "approve", "delete"] as const).map(
                  (action) => (
                    <th
                      key={action}
                      scope="col"
                      className="p-2 text-center font-medium"
                    >
                      {t(`perm.${action}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((module) => (
                <tr key={module} className="border-b border-border">
                  <th scope="row" className="p-2 text-start font-normal text-fg">
                    {moduleLabel(module)}
                  </th>
                  {(["view", "create", "approve", "delete"] as const).map(
                    (action) => {
                      const supported =
                        MODULE_ACTIONS[module].includes(action);
                      const checked = (
                        draft.permissions[module] ?? []
                      ).includes(action);
                      return (
                        <td key={action} className="p-2 text-center">
                          {supported ? (
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--color-accent)]"
                              aria-label={`${moduleLabel(module)} — ${t(
                                `perm.${action}`,
                              )}`}
                              checked={checked}
                              onChange={() => toggle(module, action)}
                            />
                          ) : (
                            <span className="text-fg-subtle" aria-hidden>
                              —
                            </span>
                          )}
                        </td>
                      );
                    },
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
