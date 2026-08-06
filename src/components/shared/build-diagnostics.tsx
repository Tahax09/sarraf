"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ClipboardCopy } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildInfo, isStampedBuild } from "@/lib/observability/build-info";
import { flagStates } from "@/lib/observability/flags";
import { usingFixtures } from "@/lib/api/client";
import { sessionId } from "@/lib/observability/correlation";

/**
 * What support asks for, in the place an operator can be talked to.
 *
 * Every one of these is already discoverable — a commit SHA is in the asset
 * filenames, the API mode is visible in the network tab, flags are inlined in
 * the bundle. Putting them on a page changes nothing an attacker can learn and
 * removes a phone call: "read me the grey line at the bottom" beats "open the
 * developer tools and click Network".
 *
 * The session id is here for the same reason it exists at all: it is what ties
 * a screenshot to the request log, and it is useless without the backend's
 * side of the correlation.
 *
 * Deliberately absent: the API base URL. It is not secret either, but a full
 * internal hostname on a screen that gets screenshotted into chat threads is a
 * free reconnaissance step, and nobody debugging needs it — the mode line
 * already says whether a backend is being talked to at all.
 */
export function BuildDiagnostics() {
  const t = useTranslations("diagnostics");
  const [copied, setCopied] = useState(false);

  const rows: { label: string; value: string }[] = [
    { label: t("version"), value: buildInfo.version },
    { label: t("commit"), value: buildInfo.commit ?? t("unstamped") },
    { label: t("builtAt"), value: buildInfo.builtAt ?? t("unstamped") },
    { label: t("environment"), value: buildInfo.environment },
    {
      label: t("apiMode"),
      value: usingFixtures ? t("apiModeFixtures") : t("apiModeLive"),
    },
    { label: t("sessionId"), value: sessionId() },
  ];

  const flags = flagStates();

  /**
   * Plain text rather than JSON: it is pasted into a ticket or a chat message,
   * where JSON is something the reader has to decode before they can help.
   */
  const asText = [
    ...rows.map((row) => `${row.label}: ${row.value}`),
    `${t("flags")}: ${
      flags
        .filter((flag) => flag.on)
        .map((flag) => flag.flag)
        .join(", ") || t("flagsNone")
    }`,
  ].join("\n");

  return (
    <Card className="max-w-3xl">
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody className="space-y-4">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap gap-x-2 text-sm">
              <dt className="text-fg-muted">{row.label}</dt>
              {/* `identifier` pins the internal order of a SHA or an id so it
                  reads left-to-right inside an Arabic page. */}
              <dd className="identifier font-medium text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-2 text-sm text-fg-muted">{t("flags")}</p>
          <ul className="flex flex-wrap gap-2">
            {flags.map(({ flag, on }) => (
              <li
                key={flag}
                className={
                  on
                    ? "rounded-lg bg-success-soft px-2 py-1 text-xs text-success"
                    : "rounded-lg bg-surface-muted px-2 py-1 text-xs text-fg-muted"
                }
              >
                {/* The flag name is a build constant, not a translated string:
                    it is what a maintainer greps for. */}
                <span className="identifier">{flag}</span>
                <span className="sr-only">
                  {on ? ` — ${t("flagOn")}` : ` — ${t("flagOff")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!isStampedBuild() ? (
          <p className="text-xs text-fg-subtle">{t("unstampedNote")}</p>
        ) : null}

        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(asText).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden />
          )}
          {copied ? t("copied") : t("copy")}
        </Button>
        {/* Announced rather than only coloured: the icon swap is invisible to a
            screen reader, and "did that work?" is the whole question here. */}
        <p role="status" className="sr-only">
          {copied ? t("copied") : ""}
        </p>
      </CardBody>
    </Card>
  );
}
