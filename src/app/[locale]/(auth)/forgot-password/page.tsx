import { headers } from "next/headers";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

/**
 * A server shell around the form, for one reason: the CSP nonce for this
 * request. The Turnstile script is refused without it, and a client component
 * cannot read a request header.
 */
export default async function ForgotPasswordPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <ForgotPasswordForm nonce={nonce} />;
}
