/**
 * Phase 9 — the "✨ Generate with JobFit AI" control injected above LinkedIn's
 * Easy Apply free-text field. Generation happens in the background worker; this
 * component hands the text to `onInsert`, which writes it into the textarea.
 *
 * Note many Easy Apply flows have no free-text step at all — the same generator
 * is therefore also available from the badge panel (see CoverLetterPanel).
 */
import { openLogin } from "./ui";
import { useCoverLetter, type JobContext } from "./useCoverLetter";

export type { JobContext };

export function CoverLetterButton({
  ctx,
  onInsert,
}: {
  ctx: JobContext;
  onInsert: (text: string) => void;
}) {
  const { status, error, needsLogin, generate } = useCoverLetter(ctx);

  const label =
    status === "loading"
      ? "✨ Generating…"
      : status === "done"
        ? "✨ Regenerate with JobFit AI"
        : "✨ Generate with JobFit AI";

  return (
    <div className="jf-flex jf-flex-col jf-gap-1 jf-font-sans">
      <div className="jf-flex jf-items-center jf-gap-2">
        <button
          type="button"
          onClick={() => void generate(onInsert)}
          disabled={status === "loading"}
          className="jf-inline-flex jf-items-center jf-gap-1 jf-rounded-md jf-bg-gradient-to-br jf-from-primary-800 jf-to-primary-600 jf-px-3 jf-py-1.5 jf-text-xs jf-font-semibold jf-text-on-primary jf-shadow-sm jf-transition-all jf-duration-200 disabled:jf-opacity-60"
        >
          {label}
        </button>
        {status === "done" && (
          <span className="jf-text-xs jf-font-medium jf-text-success-600">
            ✓ Inserted — review before submitting
          </span>
        )}
      </div>

      {needsLogin && (
        <div className="jf-flex jf-items-center jf-gap-2">
          <span className="jf-text-xs jf-text-content-secondary">
            Log in to JobFit to generate.
          </span>
          <button
            type="button"
            onClick={openLogin}
            className="jf-rounded-md jf-border jf-border-border jf-px-2 jf-py-0.5 jf-text-xs jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
          >
            Log in
          </button>
        </div>
      )}

      {error && <span className="jf-text-xs jf-text-error-600">{error}</span>}
    </div>
  );
}
