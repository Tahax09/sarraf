/**
 * Notification model.
 *
 * The centre renders these and nothing else. Strings are already localized when
 * they reach the UI, so the same shape works whether they were derived in the
 * browser (`createLocalNotificationService`) or delivered by a future
 * `/notifications` endpoint — the backend can localize from the `Accept-Language`
 * the API client already sends.
 */

/** Drives the icon and the accent, not the wording. */
export type NotificationSeverity = "info" | "success" | "warning" | "danger";

/** Grouping in the drawer, in this order. */
export type NotificationCategory = "approvals" | "operations" | "system";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "approvals",
  "operations",
  "system",
];

export type AppNotification = {
  /**
   * Stable across refreshes: the read/unread marker is keyed by it, so an id
   * that changes on every poll would resurrect notifications already dismissed.
   */
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  /** Where the notification takes the reader, if anywhere. */
  href?: string;
  /** ISO 8601. Derived notifications carry the time the state was observed. */
  createdAt: string;
};

/**
 * The seam between the centre and wherever notifications come from. One method,
 * because a poll is all the UI needs; a push transport would implement this and
 * refresh on its own schedule.
 */
export type NotificationService = {
  list(signal: AbortSignal): Promise<AppNotification[]>;
};
