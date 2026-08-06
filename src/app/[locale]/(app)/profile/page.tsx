"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Languages,
  Repeat,
  Send,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  useChangePassword,
  useCurrentUser,
  useRevokeSession,
  useSessions,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { locales, type Locale } from "@/i18n/routing";
import { formatDateTime, formatPhone } from "@/lib/format";
import type { Session } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

const QUICK_ACTIONS = [
  { href: "/core/deposit/register", key: "deposits", icon: ArrowDownToLine },
  { href: "/core/withdrawal/register", key: "withdrawal", icon: ArrowUpFromLine },
  { href: "/core/fund-transfer/register", key: "fundTransfer", icon: Repeat },
  { href: "/core/external-transfer/register", key: "externalTransfer", icon: Send },
] as const;

export default function ProfilePage() {
  const t = useTranslations("profile");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      <QuickActions />
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountInfo />
        <div className="space-y-4">
          <LanguageCard />
          <ChangePasswordCard />
        </div>
      </div>
      <SessionsCard />
    </div>
  );
}

function QuickActions() {
  const t = useTranslations("profile");
  const tNav = useTranslations("nav");

  return (
    <Card>
      <CardHeader title={t("quickActions")} />
      <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={buttonStyles({
              variant: "secondary",
              className: "justify-start gap-2",
            })}
          >
            <action.icon className="size-4 rtl-flip" aria-hidden />
            {tNav(action.key)}
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

function AccountInfo() {
  const t = useTranslations("profile");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();
  const me = useCurrentUser();

  if (me.isLoading || !me.data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const user = me.data;
  const rows: {
    label: string;
    value: string;
    numeric?: boolean;
    identifier?: boolean;
  }[] = [
    { label: tf("name"), value: user.name },
    { label: tf("username"), value: user.username, numeric: true },
    { label: tf("phone"), value: formatPhone(user.phone), identifier: true },
    { label: tf("userType"), value: labels.userType(user.userType) },
    { label: tf("roles"), value: user.roleNames.join("، ") },
    { label: tf("defaultBranch"), value: user.defaultBranchName },
  ];

  return (
    <Card>
      <CardHeader
        title={t("accountInfo")}
        action={
          <Badge tone={user.active ? "success" : "neutral"}>
            {user.active ? tf("active") : tf("inactive")}
          </Badge>
        }
      />
      <CardBody>
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <dt className="text-xs text-fg-muted">{row.label}</dt>
              <dd className="text-sm text-fg">
                <bdi
                  className={cn(
                    row.numeric && "numeric",
                    row.identifier && "identifier",
                  )}
                >
                  {row.value || tc("notAvailable")}
                </bdi>
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

/** Language switch mirrors the header menu — same locale-aware navigation. */
function LanguageCard() {
  const tUser = useTranslations("user");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function switchLocale(next: Locale) {
    const query = searchParams.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: next });
  }

  return (
    <Card>
      <CardHeader title={tUser("language")} />
      <CardBody>
        <div
          role="radiogroup"
          aria-label={tUser("language")}
          className="flex flex-wrap gap-2"
        >
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={locale === code}
              onClick={() => switchLocale(code)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                locale === code
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg hover:bg-surface-muted",
              )}
            >
              <Languages className="size-4" aria-hidden />
              {LOCALE_NAMES[code]}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ChangePasswordCard() {
  const t = useTranslations("profile");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");

  const change = useChangePassword();
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, tv("required")),
      newPassword: z.string().min(8, tv("minLength", { min: 8 })),
      confirmPassword: z.string().min(1, tv("required")),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ["confirmPassword"],
      message: tv("passwordMismatch"),
    });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <Card>
      <CardHeader title={t("changePassword")} description={t("security")} />
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await change.mutateAsync({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          });
          // Passwords are never kept around after the request completes.
          form.reset();
          setDone(true);
        })}
      >
        <CardBody className="space-y-4">
          <TextInput
            label={t("currentPassword")}
            type="password"
            autoComplete="current-password"
            required
            error={form.formState.errors.currentPassword?.message}
            {...form.register("currentPassword")}
          />
          <TextInput
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            required
            error={form.formState.errors.newPassword?.message}
            {...form.register("newPassword")}
          />
          <TextInput
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
            required
            error={form.formState.errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />
          {done ? (
            <p className="text-sm text-success" role="status">
              {t("passwordChanged")}
            </p>
          ) : null}
          {change.isError ? (
            <p className="text-sm text-danger" role="alert">
              {tc("error")}
            </p>
          ) : null}
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={change.isPending}>
            {t("changePassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const query = useSessions();
  const revoke = useRevokeSession();
  const [pending, setPending] = useState<Session | null>(null);

  const columns: Column<Session>[] = [
    {
      key: "device",
      header: t("device"),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{row.device}</span>
          {row.current ? (
            <Badge tone="info">{t("currentSession")}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "ip",
      header: t("ipAddress"),
      cell: (row) => <span className="numeric text-sm">{row.ip}</span>,
    },
    {
      key: "lastActiveAt",
      header: t("lastActive"),
      align: "end",
      cell: (row) => (
        <span className="identifier text-xs text-fg-muted">
          {formatDateTime(row.lastActiveAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: tc("actions"),
      align: "end",
      // The session you are using cannot be revoked from here.
      cell: (row) =>
        row.current ? null : (
          <Button
            size="sm"
            variant="danger"
            onClick={(event) => {
              event.stopPropagation();
              setPending(row);
            }}
          >
            {t("revokeSession")}
          </Button>
        ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader title={t("activeSessions")} />
        <DataTable
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("activeSessions")}
          paginate={false}
        />
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        loading={revoke.isPending}
        tone="danger"
        title={t("revokeSession")}
        body={t("revokeConfirm")}
        confirmLabel={t("revokeSession")}
        onConfirm={async () => {
          if (!pending) return;
          await revoke.mutateAsync(pending.id);
          setPending(null);
        }}
      />
    </>
  );
}
