"use client";

import { useTranslations } from "next-intl";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  const tNav = useTranslations("nav");
  return <ComingSoon title={tNav("cblContracts")} />;
}
