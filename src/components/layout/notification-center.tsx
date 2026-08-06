"use client";

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Info,
  OctagonAlert,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useNotifications } from "@/lib/notifications/provider";
import type {
  AppNotification,
  NotificationSeverity,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

/** Severity decides the icon and its colour — never the wording. */
const SEVERITY = {
  info: { Icon: Info, tone: "text-accent" },
  success: { Icon: CheckCircle2, tone: "text-success" },
  warning: { Icon: AlertTriangle, tone: "text-warning" },
  danger: { Icon: OctagonAlert, tone: "text-danger" },
} satisfies Record<
  NotificationSeverity,
  { Icon: typeof Info; tone: string }
>;

/** Header bell. The badge is the only unread signal, so it carries a label. */
export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("notifications");
  const { unread, setOpen } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={
        unread > 0 ? t("openWithUnread", { count: unread }) : t("open")
      }
      className={cn(
        "relative rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? (
        <span
          aria-hidden
          className="numeric absolute top-1 end-1 min-w-4 rounded-full bg-danger px-1 text-[10px] font-medium leading-4 text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export function NotificationCenter() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { open, setOpen, groups, items, unread, isRead, markRead, markAllRead } =
    useNotifications();

  function activate(notification: AppNotification) {
    markRead(notification.id);
    if (notification.href) {
      setOpen(false);
      router.push(notification.href);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      variant="sheet"
      title={t("title")}
      description={
        unread > 0 ? t("unreadCount", { count: unread }) : t("allRead")
      }
      footer={
        items.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            {t("markAllRead")}
          </Button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="size-8 text-fg-subtle" aria-hidden />
          <p className="mt-3 text-sm font-medium text-fg">{t("emptyTitle")}</p>
          <p className="mt-1 text-xs text-fg-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.category}>
              <h3 className="mb-2 text-xs font-medium text-fg-muted">
                {t(`categories.${group.category}`)}
              </h3>
              <ul className="space-y-2">
                {group.items.map((notification) => {
                  const { Icon, tone } = SEVERITY[notification.severity];
                  const unreadItem = !isRead(notification.id);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => activate(notification)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-start",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          unreadItem
                            ? "border-border bg-surface-muted"
                            : "border-border/60 bg-surface",
                        )}
                      >
                        <Icon
                          className={cn("mt-0.5 size-4 shrink-0", tone)}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-sm",
                                unreadItem
                                  ? "font-medium text-fg"
                                  : "text-fg-muted",
                              )}
                            >
                              {notification.title}
                            </span>
                            {unreadItem ? (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-accent"
                                aria-label={t("unread")}
                                role="img"
                              />
                            ) : null}
                          </span>
                          {notification.body ? (
                            <span className="mt-0.5 block text-xs text-fg-muted">
                              {notification.body}
                            </span>
                          ) : null}
                          <time
                            dateTime={notification.createdAt}
                            className="identifier mt-1 block text-[11px] text-fg-subtle"
                          >
                            {formatDateTime(notification.createdAt)}
                          </time>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
