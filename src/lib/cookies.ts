/**
 * Shared cookie attributes for the two preference cookies the client writes
 * (theme and accessibility). The session cookie is not written here — it is
 * httpOnly and set by the backend.
 */

/**
 * `; secure` once the page is actually served over TLS.
 *
 * Decided at write time rather than from `NODE_ENV`: a production build served
 * over plain HTTP behind a terminating proxy would silently drop a `Secure`
 * cookie and lose the preference, while a developer on `http://localhost`
 * would lose it too. The protocol in the address bar is the fact that matters.
 */
export function secureFlag(): string {
  return typeof location !== "undefined" && location.protocol === "https:"
    ? "; secure"
    : "";
}
