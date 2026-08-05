import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // Flat fills only — no gradients anywhere in this design system.
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-accent/50",
  secondary:
    "bg-surface text-fg border border-border hover:bg-surface-muted disabled:text-fg-subtle",
  ghost: "bg-transparent text-fg hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90",
  link: "bg-transparent text-accent underline-offset-4 hover:underline p-0 h-auto",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icon: "h-9 w-9 p-0",
};

/** Same visual treatment for anchors (`<Link>`) that act as buttons. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
    VARIANTS[variant],
    variant === "link" ? "" : SIZES[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-60",
          VARIANTS[variant],
          variant === "link" ? "" : SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
