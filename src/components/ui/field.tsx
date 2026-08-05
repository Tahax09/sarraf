"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

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
  /** Force LTR presentation for amounts, phones, IBANs and IDs. */
  numeric?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, error, hint, numeric, className, ...props }, ref) {
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
          className={cn(CONTROL, numeric && "numeric", className)}
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
