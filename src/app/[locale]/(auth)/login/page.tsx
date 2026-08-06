import { headers } from "next/headers";
import { LoginForm } from "@/components/auth/login-form";

/**
 * A server shell around the form, for one reason: the CSP nonce for this
 * request. The Turnstile script is refused without it, and a client component
 * cannot read a request header.
 */
export default async function LoginPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <LoginForm nonce={nonce} />;
}
