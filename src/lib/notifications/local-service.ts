import type { DashboardSummary } from "@/lib/api/types";
import type {
  AppNotification,
  NotificationService,
} from "@/lib/notifications/types";

/**
 * Everything the local service needs, passed in rather than reached for — the
 * same contract a remote implementation would satisfy, minus the network.
 */
export type LocalNotificationDeps = {
  summary: DashboardSummary | undefined;
  /** Already-localized copy, resolved by the caller from the `notifications` namespace. */
  copy: {
    pendingAuthorized: (count: number) => string;
    pendingAuthorizedBody: string;
    pendingExternal: (count: number) => string;
    pendingExternalBody: string;
    dailyVolume: (count: number) => string;
    dailyVolumeBody: string;
  };
  /** Injectable so a test does not depend on the wall clock. */
  now?: () => Date;
};

/**
 * Notifications derived from state the panel already knows about.
 *
 * There is no notification endpoint yet, and inventing fake alerts would train
 * operators to ignore the bell. So the centre reports the two queues that
 * genuinely need someone's attention plus the day's throughput, all read from
 * the dashboard summary. Ids are content-stable — the same pending queue keeps
 * the same id across refreshes — so marking one read makes it stay read.
 *
 * `createdAt` is the observation time, not the event time: a derived
 * notification cannot know when the first item entered the queue. A real feed
 * will carry the true timestamp and nothing in the UI changes.
 */
export function createLocalNotificationService(
  deps: LocalNotificationDeps,
): NotificationService {
  const { summary, copy, now = () => new Date() } = deps;

  return {
    async list() {
      if (!summary) return [];
      const at = now().toISOString();
      const items: AppNotification[] = [];

      if (summary.pendingAuthorizedWithdrawals > 0) {
        items.push({
          id: `approvals:authorized:${summary.pendingAuthorizedWithdrawals}`,
          category: "approvals",
          severity: "warning",
          title: copy.pendingAuthorized(summary.pendingAuthorizedWithdrawals),
          body: copy.pendingAuthorizedBody,
          href: "/core/authorized-withdrawal",
          createdAt: at,
        });
      }

      if (summary.pendingExternalTransfers > 0) {
        items.push({
          id: `approvals:external:${summary.pendingExternalTransfers}`,
          category: "approvals",
          severity: "warning",
          title: copy.pendingExternal(summary.pendingExternalTransfers),
          body: copy.pendingExternalBody,
          href: "/core/external-transfer",
          createdAt: at,
        });
      }

      if (summary.todayOperations > 0) {
        items.push({
          id: `operations:today:${summary.todayOperations}`,
          category: "operations",
          severity: "info",
          title: copy.dailyVolume(summary.todayOperations),
          body: copy.dailyVolumeBody,
          href: "/core/analytics/all-operations",
          createdAt: at,
        });
      }

      return items;
    },
  };
}
