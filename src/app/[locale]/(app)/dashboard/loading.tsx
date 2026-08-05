import { PageSkeleton } from "@/components/ui/states";

/**
 * The dashboard is the heaviest route (four KPI cards, three charts, four
 * tables) and the app's landing page, so it gets its own fallback sized to what
 * actually arrives rather than the generic four-stat shape.
 */
export default function DashboardLoading() {
  return <PageSkeleton stats={4} />;
}
