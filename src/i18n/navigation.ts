import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation. Always import Link/useRouter/redirect from here —
 * never from `next/link` or `next/navigation` — so the active locale prefix is
 * preserved across the app.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
