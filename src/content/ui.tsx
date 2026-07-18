/**
 * Small presentational primitives for the content-script UI. All classes carry
 * the `jf-` prefix (content Tailwind build) and every color is a token. The only
 * inline style anywhere is the score bar's dynamic `width` (a permitted computed
 * value, not color).
 */
import { LOGIN_URL, WEB_APP_URL } from "@/shared/config";

export function openLogin(): void {
  window.open(LOGIN_URL, "_blank", "noopener");
}
export function openWebApp(path = ""): void {
  window.open(`${WEB_APP_URL}${path}`, "_blank", "noopener");
}

/** A labelled progress bar. `value` is 0–100; the width is the one dynamic style. */
export function ScoreBar({ label, value }: { label: string; value: number }) {
  const bar =
    value >= 75 ? "jf-bg-primary-500" : value >= 55 ? "jf-bg-primary-400" : "jf-bg-warning-500";
  return (
    <div className="jf-flex jf-items-center jf-gap-2">
      <span className="jf-w-16 jf-shrink-0 jf-text-xs jf-text-content-secondary">{label}</span>
      <div className="jf-h-1.5 jf-flex-1 jf-overflow-hidden jf-rounded-full jf-bg-neutral-100">
        <div className={`jf-h-full jf-rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
      <span className="jf-w-8 jf-shrink-0 jf-text-right jf-text-xs jf-font-semibold jf-text-content">
        {value}%
      </span>
    </div>
  );
}

/** Skeleton lines for loading states (rule §4.2). */
export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="jf-flex jf-flex-col jf-gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="jf-h-2 jf-animate-pulse jf-rounded-full jf-bg-neutral-100" />
      ))}
    </div>
  );
}

/** Neutral note + optional action, used for empty / login / error states. */
export function StateNote({
  text,
  actionLabel,
  onAction,
  tone = "neutral",
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="jf-flex jf-flex-col jf-gap-2">
      <p
        className={`jf-text-xs ${tone === "error" ? "jf-text-error-600" : "jf-text-content-secondary"}`}
      >
        {text}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="jf-self-start jf-rounded-md jf-bg-primary-600 jf-px-3 jf-py-1 jf-text-xs jf-font-medium jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
