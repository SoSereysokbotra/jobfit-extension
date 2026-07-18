import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names with clsx + tailwind-merge — the same pattern the web app
 * uses (rule §2.1). Later Tailwind classes win over earlier conflicting ones,
 * so callers can override component defaults via `className`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
