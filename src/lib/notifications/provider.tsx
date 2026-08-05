"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useDashboardSummary } from "@/lib/api/hooks";
import { formatCount } from "@/lib/format";
import { createStringListStore } from "@/lib/local-store";
import { createLocalNotificationService } from "@/lib/notifications/local-service";
import {
  NOTIFICATION_CATEGORIES,
  type AppNotification,
  type NotificationCategory,
  type NotificationService,
} from "@/lib/notifications/types";

/**
 * Ids of notifications the reader has already seen.
 *
 * Only ids live here — never a title, never an amount. The constraint that no
 * sensitive data is persisted client-side holds, and a read marker is worth
 * surviving a refresh: re-reading the same three alerts every morning is how a
 * bell becomes wallpaper.
 */
const readStore = createStringListStore("saraf.notifications.read");

type NotificationState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  items: AppNotification[];
  groups: { category: NotificationCategory; items: AppNotification[] }[];
  unread: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationState | null>(null);

export function NotificationProvider({
  children,
  /** Test seam, and the swap point for a real notifications endpoint. */
  service: injected,
}: {
  children: ReactNode;
  service?: NotificationService;
}) {
  const t = useTranslations("notifications");
  const { data: summary } = useDashboardSummary();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const read = useSyncExternalStore(
    readStore.subscribe,
    readStore.getSnapshot,
    readStore.getServerSnapshot,
  );

  const service = useMemo(
    () =>
      injected ??
      createLocalNotificationService({
        summary,
        copy: {
          pendingAuthorized: (count) =>
            t("items.pendingAuthorized", { count: formatCount(count) }),
          pendingAuthorizedBody: t("items.pendingAuthorizedBody"),
          pendingExternal: (count) =>
            t("items.pendingExternal", { count: formatCount(count) }),
          pendingExternalBody: t("items.pendingExternalBody"),
          dailyVolume: (count) =>
            t("items.dailyVolume", { count: formatCount(count) }),
          dailyVolumeBody: t("items.dailyVolumeBody"),
        },
      }),
    [injected, summary, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    service
      .list(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setItems(next);
      })
      .catch(() => {
        // A failed feed shows an empty bell rather than an error the operator
        // can do nothing about.
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [service]);

  const readSet = useMemo(() => new Set(read), [read]);
  const isRead = useCallback((id: string) => readSet.has(id), [readSet]);

  const groups = useMemo(
    () =>
      NOTIFICATION_CATEGORIES.map((category) => ({
        category,
        items: items.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  const unread = useMemo(
    () => items.filter((item) => !readSet.has(item.id)).length,
    [items, readSet],
  );

  const markRead = useCallback(
    (id: string) => {
      if (readSet.has(id)) return;
      readStore.set([...read, id]);
    },
    [read, readSet],
  );

  const markAllRead = useCallback(() => {
    readStore.set([...new Set([...read, ...items.map((item) => item.id)])]);
  }, [read, items]);

  const value: NotificationState = {
    open,
    setOpen,
    items,
    groups,
    unread,
    isRead,
    markRead,
    markAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used inside a <NotificationProvider>",
    );
  }
  return context;
}
