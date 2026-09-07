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
    <div className="jf-flex jf-items-center jf-gap-3">
      <span className="jf-w-20 jf-shrink-0 jf-text-sm jf-text-content-secondary">{label}</span>
      <div className="jf-h-2 jf-flex-1 jf-overflow-hidden jf-rounded-full jf-bg-neutral-100">
        <div className={`jf-h-full jf-rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
      <span className="jf-w-10 jf-shrink-0 jf-text-right jf-text-sm jf-font-semibold jf-text-content">
        {value}%
      </span>
    </div>
  );
}

/**
 * A labelled circular gauge. `value` is 0–100; `null` renders the "not computed" ring.
 *
 * WHY A RING AND NOT A BAR: the panel is down to two sub-scores, and two lonely
 * horizontal bars read as the start of a longer list the user should scroll for. Two
 * side-by-side dials read as the whole answer, which is what they now are.
 *
 * The arc length is `strokeDasharray` — a computed value, the same permitted exception
 * the bar's `width` uses. Colour still comes only from tokens (`var(--color-*)`, the
 * same variables the `jf-` classes compile to), never a literal.
 *
 * Mirrors the dashboard's match widget (jobfit-frontend match-score-widget.tsx) so the
 * same score looks the same in both places.
 */
export function ScoreRing({
  label,
  value,
  caption,
}: {
  label: string;
  /** Null = the backend could not measure it; the ring shows a dash, never a 0%. */
  value: number | null;
  /** Optional line under the label, for a caveat the number itself cannot carry. */
  caption?: string;
}) {
  const RADIUS = 42;
  const circumference = 2 * Math.PI * RADIUS;
  const stroke =
    value === null
      ? "var(--color-neutral-100)"
      : value >= 75
        ? "var(--color-primary-600)"
        : value >= 55
          ? "var(--color-primary-400)"
          : "var(--color-warning-500)";

  return (
    <div className="jf-flex jf-flex-1 jf-flex-col jf-items-center jf-gap-1">
      <div className="jf-relative jf-h-32 jf-w-32">
        <svg className="jf-h-32 jf-w-32 -jf-rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--color-neutral-100)"
            strokeWidth="10"
          />
          {/* Value arc. Omitted entirely when unmeasured — a 0-length arc would still
              read as "zero", and zero is a score. */}
          {value !== null && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
            />
          )}
        </svg>
        <div className="jf-absolute jf-inset-0 jf-flex jf-items-center jf-justify-center">
          <span className="jf-text-2xl jf-font-bold jf-text-content">
            {value === null ? "–" : `${value}%`}
          </span>
        </div>
      </div>
      <span className="jf-text-base jf-font-semibold jf-text-content-secondary">{label}</span>
      {caption && (
        <span className="jf-text-center jf-text-xs jf-text-content-tertiary">{caption}</span>
      )}
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
        className={`jf-text-sm ${tone === "error" ? "jf-text-error-600" : "jf-text-content-secondary"}`}
      >
        {text}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="jf-self-start jf-border-none jf-rounded-md jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
