"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PhoneInput, TextInput } from "@/components/ui/field";
import {
  isValidPhone,
  nationalPhone,
  normalizePhone,
} from "@/lib/format";
import { CountryPicker } from "@/components/shared/country-picker";
import { useSaveClient } from "@/lib/api/hooks";
import type { Client } from "@/lib/api/types";
import { directionSafe } from "@/lib/text-safety";

/**
 * Edits the fields the panel legitimately owns on a client record: the two
 * names, the phone, the email, the nationality and the address. Everything else
 * on a client — its id, its account count, when it was opened — belongs to the
 * backend and is never sent.
 */
export function ClientEditDialog({
  client,
  open,
  onClose,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const save = useSaveClient();

  const schema = z.object({
    name: z.string().min(2, tv("required")).refine(directionSafe, tv("noDirectionalMarks")),
    nameEn: z.string().refine(directionSafe, tv("noDirectionalMarks")),
    // Validated on the normalised number, not the typed one: the field shows a
    // `+218` prefix and takes the national part, so what the operator types is
    // only part of what gets stored.
    phone: z.string().refine(isValidPhone, tv("invalidPhone")),
    email: z.union([z.literal(""), z.string().email(tv("invalidEmail"))]),
    // Optional on purpose: the two fields postdate the register, and a client
    // onboarded before them must still be editable without inventing a value.
    nationalityCode: z.string(),
    address: z.string().refine(directionSafe, tv("noDirectionalMarks")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      nameEn: "",
      phone: "",
      email: "",
      nationalityCode: "",
      address: "",
    },
  });

  const { reset } = form;
  /*
   * `useWatch`, not `form.watch()`. The latter returns a fresh function on
   * every render, which the React Compiler cannot memoize, so it bails out of
   * optimising this component entirely. `useWatch` subscribes through the
   * control and returns a value.
   */
  const nationalityCode = useWatch({
    control: form.control,
    name: "nationalityCode",
  });
  // The dialog outlives the row it was opened from, so the form is refilled
  // whenever a different client is handed to it.
  useEffect(() => {
    if (!client) return;
    reset({
      name: client.name,
      nameEn: client.nameEn ?? "",
      phone: nationalPhone(client.phone),
      email: client.email ?? "",
      nationalityCode: client.nationalityCode ?? "",
      address: client.address ?? "",
    });
  }, [client, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("edit")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            loading={save.isPending}
            onClick={form.handleSubmit(async (values) => {
              if (!client) return;
              await save.mutateAsync({
                id: client.id,
                name: values.name,
                nameEn: values.nameEn.trim() || null,
                phone: normalizePhone(values.phone) ?? values.phone,
                email: values.email.trim() || null,
                nationalityCode: values.nationalityCode || null,
                address: values.address.trim() || null,
              });
              onClose();
            })}
          >
            {tc("save")}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label={tf("name")}
          required
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />
        <TextInput
          label={tf("nameEn")}
          error={form.formState.errors.nameEn?.message}
          {...form.register("nameEn")}
        />
        <PhoneInput
          label={tf("phone")}
          required
          error={form.formState.errors.phone?.message}
          {...form.register("phone")}
        />
        <TextInput
          label={tf("email")}
          type="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <div className="sm:col-span-2">
          <CountryPicker
            label={tf("nationality")}
            required={false}
            value={nationalityCode ?? ""}
            onChange={(code) => form.setValue("nationalityCode", code)}
            error={form.formState.errors.nationalityCode?.message}
          />
        </div>

        {/* One line, full width: a street, a district and a city do not fit in
            half a dialog, and wrapping them mid-address reads as two fields. */}
        <TextInput
          label={tf("address")}
          className="sm:col-span-2"
          error={form.formState.errors.address?.message}
          {...form.register("address")}
        />
      </form>
    </Dialog>
  );
}
