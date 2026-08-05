"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { CountryPicker } from "@/components/shared/country-picker";
import { useSaveSystemInfo, useSystemInfo } from "@/lib/api/hooks";
import { formatNumber } from "@/lib/format";
import type { SystemInfo } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export default function SystemInfoPage() {
  const t = useTranslations("systemInfo");

  const query = useSystemInfo();

  if (query.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <Card>
          <CardBody>
            <ErrorState onRetry={() => query.refetch()} />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <SystemInfoForm initial={query.data} />;
}

/**
 * Editable copy of the saved record. Keyed on the fetch timestamp so a fresh
 * server response re-seeds the form instead of being copied in via an effect.
 */
function SystemInfoForm({ initial }: { initial: SystemInfo }) {
  const t = useTranslations("systemInfo");
  const tc = useTranslations("common");

  const save = useSaveSystemInfo();
  const [draft, setDraft] = useState<SystemInfo>(initial);

  const update = (patch: Partial<SystemInfo>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <Card className="max-w-3xl">
        <CardHeader title={t("title")} />
        <CardBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t("companyName")}
              required
              value={draft.companyName}
              onChange={(event) => update({ companyName: event.target.value })}
            />
            <TextInput
              label={t("hqAddress")}
              value={draft.address}
              onChange={(event) => update({ address: event.target.value })}
            />
          </div>

          <LogoDropzone
            value={draft.logoUrl}
            onChange={(logoUrl) => update({ logoUrl })}
          />

          <CountryPicker
            value={draft.countryCode}
            onChange={(countryCode) => update({ countryCode })}
          />

          <LocationPicker
            latitude={draft.latitude}
            longitude={draft.longitude}
            onChange={(latitude, longitude) => update({ latitude, longitude })}
          />

          <RepeatableFields
            label={t("emails")}
            type="email"
            values={draft.emails}
            onChange={(emails) => update({ emails })}
          />
          <RepeatableFields
            label={t("phones")}
            type="tel"
            values={draft.phones}
            onChange={(phones) => update({ phones })}
          />
        </CardBody>
        <CardFooter>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate(draft)}
          >
            {tc("save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function LogoDropzone({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useTranslations("systemInfo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function read(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <Field label={t("logo")}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          read(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6 text-center",
          dragging && "border-accent bg-surface-muted",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URI preview
          <img
            src={value}
            alt=""
            className="max-h-20 w-auto object-contain"
          />
        ) : (
          <Upload className="size-6 text-fg-subtle" aria-hidden />
        )}
        <p className="text-xs text-fg-muted">{t("logoDrop")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => read(event.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          {value ? t("logoReplace") : t("logoDrop")}
        </Button>
      </div>
    </Field>
  );
}

/**
 * Coordinate picker without third-party tiles: click anywhere on the plate to
 * set latitude/longitude, or type exact values. Keeps the page free of
 * external map scripts while still being point-and-click.
 */
function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const t = useTranslations("systemInfo");

  const x = longitude === null ? null : ((longitude + 180) / 360) * 100;
  const y = latitude === null ? null : ((90 - latitude) / 180) * 100;

  return (
    <Field label={t("pickOnMap")}>
      <div className="space-y-3">
        <button
          type="button"
          aria-label={t("pickOnMap")}
          className="relative block h-40 w-full overflow-hidden rounded-lg border border-border bg-surface-muted"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratioX = (event.clientX - rect.left) / rect.width;
            const ratioY = (event.clientY - rect.top) / rect.height;
            onChange(
              Number((90 - ratioY * 180).toFixed(5)),
              Number((ratioX * 360 - 180).toFixed(5)),
            );
          }}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-px bg-border"
          />
          {/*
            Physical `left`, deliberately — this is the prime meridian on a
            world map, and the marker below is positioned by longitude. A map
            that mirrored itself in Arabic would put Libya west of Morocco.
          */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-px bg-border"
          />
          {x !== null && y !== null ? (
            <span
              aria-hidden
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ) : null}
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t("latitude")}
            numeric
            inputMode="decimal"
            value={latitude === null ? "" : String(latitude)}
            onChange={(event) =>
              onChange(Number(event.target.value), longitude ?? 0)
            }
          />
          <TextInput
            label={t("longitude")}
            numeric
            inputMode="decimal"
            value={longitude === null ? "" : String(longitude)}
            onChange={(event) =>
              onChange(latitude ?? 0, Number(event.target.value))
            }
          />
        </div>

        {latitude !== null && longitude !== null ? (
          <p className="numeric text-xs text-fg-muted">
            {formatNumber(latitude, 5)}, {formatNumber(longitude, 5)}
          </p>
        ) : null}
      </div>
    </Field>
  );
}

function RepeatableFields({
  label,
  type,
  values,
  onChange,
}: {
  label: string;
  type: "email" | "tel";
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useTranslations("systemInfo");

  return (
    <Field label={label}>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label={`${label} ${index + 1}`}
                type={type}
                numeric={type === "tel"}
                inputMode={type === "tel" ? "tel" : "email"}
                value={value}
                onChange={(event) =>
                  onChange(
                    values.map((item, i) =>
                      i === index ? event.target.value : item,
                    ),
                  )
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("removeField")}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...values, ""])}
        >
          <Plus className="size-4" aria-hidden />
          {t("addAnother")}
        </Button>
      </div>
    </Field>
  );
}
