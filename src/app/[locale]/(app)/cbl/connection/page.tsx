"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { SecretField } from "@/components/shared/masked-field";
import {
  useCblConnection,
  useSaveCblConnection,
  useTestCblConnection,
} from "@/lib/api/hooks";
import { formatDateTime } from "@/lib/format";
import type { CblConnectionStatus } from "@/lib/api/types";

const STATE_TONE: Record<CblConnectionStatus["state"], BadgeTone> = {
  connected: "success",
  degraded: "warning",
  disconnected: "danger",
};

/**
 * §8 — the one Central Bank screen that ships in this phase.
 *
 * The secret key is write-only: it is sent once for storage and never read
 * back, never persisted client-side, and never logged.
 */
export default function CblConnectionPage() {
  const t = useTranslations("cbl");
  const tf = useTranslations("fields");

  const query = useCblConnection();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("connectionTitle")} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("connectionTitle")} />
        <Card>
          <CardBody>
            <ErrorState onRetry={() => query.refetch()} />
          </CardBody>
        </Card>
      </div>
    );
  }

  const status = query.data;
  const stateLabel = {
    connected: t("statusConnected"),
    degraded: t("statusDegraded"),
    disconnected: t("statusDisconnected"),
  }[status.state];

  return (
    <div className="space-y-4">
      <PageHeader title={t("connectionTitle")} />

      <Card>
        <CardHeader
          title={t("connectionTitle")}
          description={formatDateTime(status.checkedAt)}
          action={<Badge tone={STATE_TONE[status.state]}>{stateLabel}</Badge>}
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <StatusLine label={t("endpoint")} ok={status.endpointReachable} />
          <StatusLine label={t("authentication")} ok={status.authenticated} />
        </CardBody>
      </Card>

      <ConnectionForm key={status.baseUrl ?? ""} status={status} />

      <p className="text-xs text-fg-subtle">{tf("notes")}: {t("secretStored")}</p>
    </div>
  );
}


/**
 * Base URL + write-only secret. Mounted with a key on the stored base URL so
 * refreshed server state re-seeds the field instead of being synced in an
 * effect.
 */
function ConnectionForm({ status }: { status: CblConnectionStatus }) {
  const t = useTranslations("cbl");
  const tc = useTranslations("common");

  const save = useSaveCblConnection();
  const test = useTestCblConnection();

  const [baseUrl, setBaseUrl] = useState(status.baseUrl ?? "");
  const [secretKey, setSecretKey] = useState("");

  return (
      <Card className="max-w-2xl">
        <CardHeader title={t("baseUrl")} />
        <CardBody className="space-y-4">
          <TextInput
            label={t("baseUrl")}
            type="url"
            numeric
            inputMode="url"
            placeholder="https://"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />

          <SecretField
            label={t("secretKey")}
            configured={status.secretConfigured}
            value={secretKey}
            onChange={setSecretKey}
          />

          {test.data ? (
            <p
              role="status"
              className={
                test.data.ok ? "text-sm text-success" : "text-sm text-danger"
              }
            >
              {test.data.ok ? t("testSuccess") : t("testFailure")}
            </p>
          ) : null}
          {test.isError || save.isError ? (
            <p role="alert" className="text-sm text-danger">
              {tc("error")}
            </p>
          ) : null}
        </CardBody>
        <CardFooter>
          <Button
            variant="secondary"
            loading={test.isPending}
            disabled={!baseUrl}
            onClick={() =>
              test.mutate({
                baseUrl,
                // Only sent when the operator is entering a new key.
                ...(secretKey ? { secretKey } : {}),
              })
            }
          >
            <PlugZap className="size-4" aria-hidden />
            {t("testConnection")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!baseUrl}
            onClick={async () => {
              await save.mutateAsync({
                baseUrl,
                ...(secretKey ? { secretKey } : {}),
              });
              // Drop the plaintext secret the moment the request resolves.
              setSecretKey("");
            }}
          >
            {tc("save")}
          </Button>
        </CardFooter>
      </Card>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  const tc = useTranslations("common");
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="text-sm text-fg">{label}</span>
      <span
        className={
          ok
            ? "inline-flex items-center gap-1.5 text-xs text-success"
            : "inline-flex items-center gap-1.5 text-xs text-danger"
        }
      >
        {ok ? (
          <CheckCircle2 className="size-4" aria-hidden />
        ) : (
          <XCircle className="size-4" aria-hidden />
        )}
        {ok ? tc("yes") : tc("no")}
      </span>
    </div>
  );
}
