import { PageSkeleton } from "@/components/ui/states";

/**
 * Streams instantly on navigation so `<main>` is never blank while the route's
 * client bundle loads. Every app route shares the same page shape, so one
 * fallback at the group level is enough — a per-route file would only repeat
 * this.
 */
export default function AppLoading() {
  return <PageSkeleton />;
}
