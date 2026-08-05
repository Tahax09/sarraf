"use client";

import { useTranslations } from "next-intl";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";

/**
 * §8 — Phase 2 routes exist so navigation and permissions can be wired now,
 * and say plainly that the module is still being built.
 */
export function ComingSoon({ title }: { title: string }) {
  const tc = useTranslations("common");

  return (
    <div className="space-y-4">
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={<Construction className="size-6" aria-hidden />}
          title={tc("comingSoon")}
          description={tc("comingSoonBody")}
        />
      </Card>
    </div>
  );
}
