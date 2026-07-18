import type { HTMLAttributes } from "react";
import { cn } from "@/shared/cn";

type BadgeVariant = "primary" | "neutral" | "success" | "warning" | "error" | "info";
type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

/**
 * Small status pill — ported from the web design system as Phase 0's proof that
 * the token classes work here identically. Every color is a token class
 * (bg-primary-100, text-primary-700, …); no hex, no rgba, no inline color.
 */
const variantClasses: Record<BadgeVariant, string> = {
  primary: "bg-primary-100 text-primary-700",
  neutral: "bg-neutral-100 text-neutral-700",
  success: "bg-success-100 text-success-600",
  warning: "bg-warning-100 text-warning-600",
  error: "bg-error-100 text-error-600",
  info: "bg-info-100 text-info-600",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  variant = "primary",
  size = "sm",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium leading-tight",
        "transition-all duration-200",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
