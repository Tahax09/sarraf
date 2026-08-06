"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COUNTRY_ISO,
  DEFAULT_DIAL_CODE,
  countryFlag,
} from "@/lib/format";

/**
 * Every control shares one focus treatment: a real, offset outline rather than
 * a border colour swap. A 1px border changing hue is not a visible focus
 * indicator under WCAG 2.4.11, and it disappears entirely in high contrast.
 */
const CONTROL =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg " +
  "placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:bg-surface-muted disabled:text-fg-subtle";

export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  messageId,
  children,
  className,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  /**
   * Id given to the error or hint line so the control can point at it with
   * `aria-describedby`. Without it a screen reader announces the label and the
   * invalid state but never the reason.
   */
  messageId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
        {label}
        {/* The asterisk is decorative: `required` on the control is what
            assistive technology actually announces. */}
        {required ? (
          <span aria-hidden className="text-danger">
            {" *"}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Points a control at its message line, and only when there is one. */
function describedBy(
  messageId: string,
  error: string | undefined,
  hint: ReactNode,
  own: string | undefined,
) {
  const ids = [own, error || hint ? messageId : undefined].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** An amount or a count: one run, laid out with the rest of the page. */
  numeric?: boolean;
  /**
   * A phone, IBAN or reference: several runs whose order carries meaning, so
   * the value is pinned left-to-right rather than following the page.
   */
  identifier?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { label, error, hint, numeric, identifier, className, ...props },
    ref,
  ) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const messageId = `${id}-message`;
    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={props.required}
        htmlFor={id}
        messageId={messageId}
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            numeric && "numeric",
            identifier && "identifier",
            className,
          )}
          {...props}
          aria-describedby={describedBy(
            messageId,
            error,
            hint,
            props["aria-describedby"],
          )}
        />
      </Field>
    );
  },
);

/**
 * A phone field that shows the country it dials.
 *
 * The prefix is fixed and not editable. Every number this panel holds is
 * Libyan, and the operator types the part that varies — the same nine digits
 * they read off a form — while the `+218` stays on screen so what is being
 * stored is never in doubt.
 *
 * `identifier` on the wrapper, not on the input alone: the country code and the
 * national number are two runs whose order carries meaning, so the pair is
 * pinned left-to-right and the prefix stays at the number's head in Arabic as
 * well. The label and any error line keep the page's direction, because they
 * are prose.
 *
 * Whatever is typed goes through `normalizePhone` before it is sent, so a
 * leading zero or a pasted `+218` costs nothing.
 */
export const PhoneInput = forwardRef<HTMLInputElement, TextInputProps>(
  function PhoneInput({ label, error, hint, className, ...props }, ref) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const messageId = `${id}-message`;
    const prefixId = `${id}-prefix`;

    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={props.required}
        htmlFor={id}
        messageId={messageId}
      >
        <div
          className={cn(
            CONTROL,
            "identifier flex items-center gap-2 py-0 ps-0",
            "focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
            className,
          )}
        >
          <span
            id={prefixId}
            className="flex shrink-0 items-center gap-1.5 self-stretch border-e border-border px-3 text-sm text-fg-muted"
          >
            <span aria-hidden>{countryFlag(DEFAULT_COUNTRY_ISO)}</span>
            {`+${DEFAULT_DIAL_CODE}`}
          </span>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-invalid={error ? true : undefined}
            className="min-w-0 flex-1 bg-transparent py-2 pe-3 text-sm text-fg outline-none placeholder:text-fg-subtle"
            {...props}
            // The country code is read as part of the field rather than left as
            // decoration next to it.
            aria-describedby={describedBy(
              messageId,
              error,
              hint,
              [props["aria-describedby"], prefixId].filter(Boolean).join(" ") ||
                undefined,
            )}
          />
        </div>
      </Field>
    );
  },
);

/**
 * A password field with a reveal toggle.
 *
 * Typing a password blind on a keyboard laid out for another script is where
 * lockouts come from, so the operator can check what they typed. The field
 * starts masked, the toggle is a real button with its state in its accessible
 * name, and the value is never written anywhere but the input.
 */
export const PasswordInput = forwardRef<HTMLInputElement, TextInputProps>(
  function PasswordInput({ label, error, hint, className, ...props }, ref) {
    const t = useTranslations("auth");
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const id = props.id ?? autoId;
    const messageId = `${id}-message`;

    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={props.required}
        htmlFor={id}
        messageId={messageId}
      >
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            // Room for the toggle on the end side, in whichever direction the
            // page reads.
            className={cn(CONTROL, "pe-10", className)}
            {...props}
            aria-describedby={describedBy(
              messageId,
              error,
              hint,
              props["aria-describedby"],
            )}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            // Not a toggle button with `aria-pressed`: the label states the
            // action, which reads the same way in both languages.
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            className={cn(
              "absolute inset-y-0 end-0 flex items-center px-3 text-fg-muted",
              "hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </Field>
    );
  },
);

export type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
};

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  function SelectInput({ label, error, hint, className, children, ...props }, ref) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const messageId = `${id}-message`;
    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={props.required}
        htmlFor={id}
        messageId={messageId}
      >
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, className)}
          {...props}
          aria-describedby={describedBy(
            messageId,
            error,
            hint,
            props["aria-describedby"],
          )}
        >
          {children}
        </select>
      </Field>
    );
  },
);

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  error?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, error, className, ...props }, ref) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const messageId = `${id}-message`;
    return (
      <Field
        label={label}
        error={error}
        required={props.required}
        htmlFor={id}
        messageId={messageId}
      >
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, "min-h-24", className)}
          {...props}
          aria-describedby={describedBy(
            messageId,
            error,
            undefined,
            props["aria-describedby"],
          )}
        />
      </Field>
    );
  },
);

export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description ? (
          <span className="block text-xs text-fg-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export { CONTROL as controlClassName };
