"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import { errorReference, reportError } from "@/lib/report-error";

/**
 * The answer to "did that work?".
 *
 * Until now a mutation that failed did nothing visible: the spinner stopped,
 * the dialog stayed open, and the operator was left to infer the outcome from
 * whether the register had changed. On a transfer that is not a rough edge —
 * silence and success look identical, and the natural response to silence is to
 * press the button again.
 *
 * Two rules govern what appears here, and they are not symmetric:
 *
 * - **Success is transient.** It confirms something the operator already
 *   intended, and it auto-dismisses. A confirmation that has to be cleared is a
 *   second click for no information.
 * - **Failure is not.** It stays until dismissed, because the operator may have
 *   already looked away, and because the thing they need to write down — the
 *   reference — cannot be recovered once it is gone.
 *
 * The message is always one this application wrote. A backend error string can
 * carry internals, is not translated, and is not something an operator can act
 * on; the reference is what support asks for, which is the same contract
 * `ErrorPanel` already keeps.
 */

export type FeedbackTone = "success" | "danger";

export type Feedback = {
  id: string;
  tone: FeedbackTone;
  message: string;
  /** Quotable identifier for a failure. Never shown for a success. */
  reference?: string;
};

type FeedbackApi = {
  notify: (note: Omit<Feedback, "id">) => void;
  dismiss: (id: string) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

/** The client/server split never changes after hydration, so nothing subscribes. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** How long a success stays on screen. Long enough to read twice. */
const SUCCESS_MS = 6000;

export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackContext);
  if (!api) {
    throw new Error("useFeedback must be used inside <FeedbackProvider>");
  }
  return api;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("feedback");
  const [notes, setNotes] = useState<Feedback[]>([]);
  // The region is a fixed overlay, so it belongs to the document rather than to
  // whichever card happens to wrap the component that raised it — a parent with
  // `overflow: hidden` or its own stacking context would otherwise clip it.
  //
  // There is no document to portal into on the server, so the portal waits for
  // the client. Same shape as `useNow` in src/lib/clock.ts: a store whose server
  // snapshot differs from its client one, rather than a setState in an effect,
  // which would render the tree twice on every page.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  const dismiss = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const notify = useCallback(
    (note: Omit<Feedback, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotes((current) => [...current, { ...note, id }]);
      if (note.tone === "success") {
        window.setTimeout(() => dismiss(id), SUCCESS_MS);
      }
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {/*
        Bottom-inline-end, so it never covers the primary action of a dialog —
        which is where the operator's eye already is — and `end` rather than
        `right` so it follows the page into RTL. `pointer-events-none` on the
        stack with `auto` on each note keeps the region from swallowing clicks
        aimed at the page behind it.
      */}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
            // Polite for the region as a whole; a failure carries role="alert"
            // below, which is assertive and interrupts.
            aria-live="polite"
          >
            {notes.map((note) => (
              <div
                key={note.id}
                role={note.tone === "danger" ? "alert" : undefined}
                className={
                  note.tone === "danger"
                    ? "pointer-events-auto flex items-start gap-2 rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger shadow-lg"
                    : "pointer-events-auto flex items-start gap-2 rounded-lg border border-success bg-success-soft px-3 py-2.5 text-sm text-success shadow-lg"
                }
              >
                {note.tone === "danger" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p>{note.message}</p>
                  {note.reference ? (
                    <p className="numeric mt-1 text-xs opacity-80">
                      {t("reference", { reference: note.reference })}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(note.id)}
                  aria-label={t("dismiss")}
                  className="-me-1 rounded p-1 hover:opacity-70"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </FeedbackContext.Provider>
  );
}

/**
 * Runs a mutation and reports the outcome, so a caller never has to remember to.
 *
 * Returns whether it succeeded, which is the answer the caller actually needs:
 * a dialog should close on success and stay open on failure, and before this
 * existed every `await save.mutateAsync(...); onClose();` did the opposite —
 * a rejected promise left the dialog open with no message at all, and a
 * fulfilled one closed it with no confirmation.
 */
export function useNotifiedAction() {
  const { notify } = useFeedback();
  const t = useTranslations("feedback");

  return useCallback(
    async (
      run: () => Promise<unknown>,
      options: { success?: string } = {},
    ): Promise<boolean> => {
      try {
        await run();
        notify({ tone: "success", message: options.success ?? t("saved") });
        return true;
      } catch (error) {
        reportError(error, { boundary: "action" });
        notify({
          tone: "danger",
          message: t("failed"),
          reference: errorReference(error as { digest?: string }),
        });
        return false;
      }
    },
    [notify, t],
  );
}
