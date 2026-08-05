import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NotificationBell,
  NotificationCenter,
} from "@/components/layout/notification-center";
import { NotificationProvider } from "@/lib/notifications/provider";
import { createLocalNotificationService } from "@/lib/notifications/local-service";
import type {
  AppNotification,
  NotificationService,
} from "@/lib/notifications/types";
import type { DashboardSummary } from "@/lib/api/types";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

jest.mock("@/lib/api/hooks", () => ({
  useDashboardSummary: () => ({ data: undefined }),
}));

const ITEMS: AppNotification[] = [
  {
    id: "approvals:authorized:3",
    category: "approvals",
    severity: "warning",
    title: "3 authorized withdrawals awaiting approval",
    body: "Review them.",
    href: "/core/authorized-withdrawal",
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "operations:today:42",
    category: "operations",
    severity: "info",
    title: "42 operations recorded today",
    createdAt: "2026-01-15T09:00:00.000Z",
  },
];

function service(items: AppNotification[] = ITEMS): NotificationService {
  return { list: async () => items };
}

function renderCenter(items?: AppNotification[]) {
  return renderWithProviders(
    <NotificationProvider service={service(items)}>
      <NotificationBell />
      <NotificationCenter />
    </NotificationProvider>,
  );
}

beforeEach(() => {
  navigation.reset("/dashboard");
  window.localStorage.clear();
});

describe("NotificationCenter", () => {
  it("counts the unread items on the bell", async () => {
    renderCenter();
    expect(
      await screen.findByRole("button", {
        name: message("notifications.openWithUnread", { count: "2" }),
      }),
    ).toBeInTheDocument();
  });

  it("groups by category in the drawer", async () => {
    const user = userEvent.setup();
    renderCenter();

    await user.click(await screen.findByRole("button"));
    expect(
      await screen.findByText(message("notifications.categories.approvals")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(message("notifications.categories.operations")),
    ).toBeInTheDocument();
  });

  it("opens the linked queue and marks that item read", async () => {
    const user = userEvent.setup();
    renderCenter();

    await user.click(await screen.findByRole("button"));
    await user.click(
      await screen.findByText("3 authorized withdrawals awaiting approval"),
    );

    await waitFor(() =>
      expect(navigation.calls).toContain("/core/authorized-withdrawal"),
    );
    expect(
      await screen.findByRole("button", {
        name: message("notifications.openWithUnread", { count: "1" }),
      }),
    ).toBeInTheDocument();
  });

  it("marks everything read and keeps it read across a remount", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCenter();

    await user.click(await screen.findByRole("button"));
    await user.click(
      await screen.findByRole("button", {
        name: message("notifications.markAllRead"),
      }),
    );

    await screen.findByRole("button", { name: message("notifications.open") });

    unmount();
    renderCenter();

    // Re-reading the same alerts every morning is how a bell becomes wallpaper.
    expect(
      await screen.findByRole("button", {
        name: message("notifications.open"),
      }),
    ).toBeInTheDocument();
  });

  it("shows an empty state rather than a blank drawer", async () => {
    const user = userEvent.setup();
    renderCenter([]);

    await user.click(await screen.findByRole("button"));
    expect(
      await screen.findByText(message("notifications.emptyTitle")),
    ).toBeInTheDocument();
  });
});

describe("createLocalNotificationService", () => {
  const summary: DashboardSummary = {
    totalClients: 10,
    totalAccounts: 20,
    todayOperations: 42,
    pendingAuthorizedWithdrawals: 3,
    pendingExternalTransfers: 0,
  };

  const copy = {
    pendingAuthorized: (count: number) => `authorized ${count}`,
    pendingAuthorizedBody: "body a",
    pendingExternal: (count: number) => `external ${count}`,
    pendingExternalBody: "body b",
    dailyVolume: (count: number) => `volume ${count}`,
    dailyVolumeBody: "body c",
  };

  it("reports only the queues that actually need attention", async () => {
    const items = await createLocalNotificationService({
      summary,
      copy,
    }).list(new AbortController().signal);

    expect(items.map((item) => item.title)).toEqual([
      "authorized 3",
      "volume 42",
    ]);
  });

  it("gives the same queue the same id across refreshes", async () => {
    const build = () =>
      createLocalNotificationService({ summary, copy }).list(
        new AbortController().signal,
      );

    const [first, second] = await Promise.all([build(), build()]);
    // An id that churned would resurrect notifications already dismissed.
    expect(first[0].id).toBe(second[0].id);
  });

  it("reports nothing before the summary has loaded", async () => {
    const items = await createLocalNotificationService({
      summary: undefined,
      copy,
    }).list(new AbortController().signal);

    expect(items).toEqual([]);
  });
});
