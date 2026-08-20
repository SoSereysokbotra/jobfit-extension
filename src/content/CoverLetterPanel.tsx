/**
 * Cover-letter generation from the badge panel — available on EVERY job, not
 * only when LinkedIn's Easy Apply happens to render a free-text field (most
 * flows don't). Shows the letter with copy-to-clipboard; the Easy Apply
 * injection remains a bonus that auto-fills the field when one exists.
 */
import { useState } from "react";
import { openLogin } from "./ui";
import { useCoverLetter, type JobContext } from "./useCoverLetter";

export function CoverLetterPanel({ ctx }: { ctx: JobContext }) {
  const { status, letter, error, needsLogin, generate } = useCoverLetter(ctx);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by page permissions — the text is still
      // selectable in the box below, so this is a soft failure.
    }
  }

  return (
    <div className="jf-flex jf-flex-col jf-gap-2">
      <div className="jf-flex jf-flex-wrap jf-items-center jf-gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={status === "loading"}
          className="jf-inline-flex jf-border-none jf-items-center jf-gap-2 jf-rounded-md jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-shadow-sm jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md hover:-jf-translate-y-0.5 disabled:jf-opacity-60"
        >
          {status === "loading"
            ? "Generating…"
            : letter
              ? "Regenerate"
              : "Generate cover letter"}
        </button>
        {letter && (
          <button
            type="button"
            onClick={() => void copy()}
            className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-3 jf-py-1.5 jf-text-sm jf-font-medium jf-text-content-secondary jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {needsLogin && (
        <div className="jf-flex jf-items-center jf-gap-2">
          <span className="jf-text-sm jf-text-content-secondary">
            Log in to JobFit to generate.
          </span>
          <button
            type="button"
            onClick={openLogin}
            className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-3 jf-py-1.5 jf-text-sm jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
          >
            Log in
          </button>
        </div>
      )}

      {error && <span className="jf-text-sm jf-text-error-600">{error}</span>}

      {letter && (
        <div className="jf-max-h-40 jf-overflow-y-auto jf-rounded-md jf-border jf-border-border jf-bg-background-secondary jf-p-3">
          <p className="jf-whitespace-pre-wrap jf-text-sm jf-leading-relaxed jf-text-content-secondary">
            {letter}
          </p>
        </div>
      )}
    </div>
  );
}
