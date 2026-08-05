"use client";

import { useEffect } from "react";
import { errorReference, reportError } from "@/lib/report-error";

/**
 * Last line of defence: catches throws in the root layout itself, where the
 * locale provider, the theme and the message catalogue may all be unavailable.
 *
 * It therefore renders its own `<html>`/`<body>`, uses no translation hook, and
 * writes both languages side by side rather than guessing. Every other failure
 * is caught by a segment `error.tsx` that has the full app available.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const reference = errorReference(error);

  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    // No `lang` is asserted: at this point the requested locale is unknown.
    <html dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#1c1e1c",
        }}
      >
        <main
          role="alert"
          style={{ maxWidth: "28rem", textAlign: "center", lineHeight: 1.6 }}
        >
          <h1 style={{ fontSize: "1.125rem", margin: "0 0 0.5rem" }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ margin: "0 0 1rem", color: "#5f635f" }} dir="ltr">
            Something went wrong. Reference: <code>{reference}</code>
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0056f5",
              color: "#ffffff",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            إعادة المحاولة / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
