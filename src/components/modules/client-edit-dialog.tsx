"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { useSaveClient } from "@/lib/api/hooks";
import type { Client } from "@/lib/api/types";

/**
 * Edits the fields the panel legitimately owns on a client record: the two
 * names, the phone and the email. Everything else on a client — its id, its
 * account count, when it was opened — belongs to the backend and is never sent.
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
    name: z.string().min(2, tv("required")),
    nameEn: z.string(),
    phone: z.string().min(6, tv("invalidPhone")),
    email: z.union([z.literal(""), z.string().email(tv("invalidEmail"))]),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nameEn: "", phone: "", email: "" },
  });

  const { reset } = form;
  // The dialog outlives the row it was opened from, so the form is refilled
  // whenever a different client is handed to it.
  useEffect(() => {
    if (!client) return;
    reset({
      name: client.name,
      nameEn: client.nameEn ?? "",
      phone: client.phone,
      email: client.email ?? "",
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
                phone: values.phone,
                email: values.email.trim() || null,
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
          // Latin-script name: typed left to right whatever the page direction.
          dir="ltr"
          error={form.formState.errors.nameEn?.message}
          {...form.register("nameEn")}
        />
        <TextInput
          label={tf("phone")}
          required
          type="tel"
          inputMode="tel"
          dir="ltr"
          error={form.formState.errors.phone?.message}
          {...form.register("phone")}
        />
        <TextInput
          label={tf("email")}
          type="email"
          inputMode="email"
          dir="ltr"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
      </form>
    </Dialog>
  );
}
