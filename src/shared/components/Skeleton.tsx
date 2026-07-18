import { cn } from "@/shared/cn";

/**
 * Token-styled skeleton block for async loading states (rule §4.2). Uses the
 * `animate-pulse` utility and a neutral token background — no hardcoded color.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-neutral-100", className)} />
  );
}
