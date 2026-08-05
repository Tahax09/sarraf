"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardKpiCards } from "@/components/dashboard/kpi-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AlertsCard } from "@/components/dashboard/alerts-card";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { CurrencyBalancesCard } from "@/components/dashboard/currency-balances-card";
import { PricingSummaryCard } from "@/components/dashboard/pricing-summary-card";
import {
  RecentOperationsCard,
  TopClientsCard,
} from "@/components/dashboard/preview-cards";

/**
 * §6.1 — the Dashboard is the *only* page carrying the 30-day trend charts and
 * the canonical currency balances (§7 items 3 and 4). Other modules link here
 * instead of repeating them.
 *
 * The page itself is only the running order. Each card owns its own query, so
 * one card failing or still loading says nothing about the others, and the
 * shared queries (the summary behind the KPI bar and the alerts) are de-duped
 * by the query cache rather than threaded through props.
 */
export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <DashboardKpiCards />
      <QuickActions />
      <AlertsCard />
      <TrendsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <CurrencyBalancesCard />
        <PricingSummaryCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopClientsCard />
        <RecentOperationsCard />
      </div>
    </div>
  );
}
