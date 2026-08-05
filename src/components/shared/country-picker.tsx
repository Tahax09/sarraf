"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, TextInput, controlClassName } from "@/components/ui/field";
import { useCountries } from "@/lib/api/hooks";
import { countryFlag } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Country selector with type-ahead — the country list is long enough that a
 * bare `<select>` is unusable on a phone.
 */
export function CountryPicker({
  value,
  onChange,
  label,
  error,
  required = true,
}: {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const countries = useCountries();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const all = countries.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term),
    );
  }, [countries.data, search]);

  const selected = (countries.data ?? []).find(
    (country) => country.code === value,
  );

  return (
    <div className="space-y-2">
      <TextInput
        label={label ?? t("country")}
        required={required}
        error={error}
        placeholder={tc("searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        role="combobox"
        aria-expanded
        aria-controls="country-picker-list"
      />
      <Field label={tc("selectPlaceholder")} htmlFor="country-picker-list">
        <select
          id="country-picker-list"
          size={6}
          className={cn(controlClassName, "h-auto py-1")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {matches.map((country) => (
            <option key={country.code} value={country.code}>
              {countryFlag(country.code)} {country.name} ({country.code})
            </option>
          ))}
        </select>
      </Field>
      {selected ? (
        <p className="text-xs text-fg-muted">
          <span aria-hidden>{countryFlag(selected.code)} </span>
          {selected.name}
        </p>
      ) : null}
    </div>
  );
}
