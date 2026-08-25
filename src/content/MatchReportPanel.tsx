/**
 * "Full Report" — shows the user exactly what is about to be sent, then sends it.
 *
 * WHY A PREVIEW STEP EXISTS. This is the one control that transmits the posting
 * body, and every adapter that produces that body ends in a fallback: a broad
 * container, the JSON-LD blob, or on Khmer24 the largest paragraph on a
 * classifieds page. Those fallbacks fail softly, which is right — but a wrong
 * block of text that clears the 80-character floor looks exactly like a real
 * posting from here on. The result is a polished AI report about a Safety Tips
 * panel: worse than no report, because it reads as authoritative.
 *
 * The fix is not a better guess, it's showing the guess. The panel names where
 * the text came from, counts it, flags anything that doesn't read like a job
 * advert, and leaves it editable. The user is looking at the posting — they can
 * settle in one glance what no heuristic can.
 *
 * Constraints: Shadow DOM, `jf-` prefixed utilities, token colours only.
 */
import { useMemo, useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobSource, PostedSalary } from "@/shared/types";
import { openLogin, openWebApp, StateNote } from "./ui";
import { assessExtraction, describeStrategy, type Extraction } from "./sites/extraction";

interface Props {
  externalId: string;
  source: JobSource;
  title: string;
  company: string | null;
  location: string | null;
  extraction: Extraction;
  /** The posting's own published experience bar, in months, or null. */
  requiredMonths: number | null;
  /** Pay as advertised, with its period. Displayed in the report, never scored. */
  postedSalary: PostedSalary | null;
  onClose: () => void;
}

type Status =
  | { kind: "preview" }
  | { kind: "building" }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

export function MatchReportPanel({
  externalId,
  source,
  title,
  company,
  location,
  extraction,
  requiredMonths,
  postedSalary,
  onClose,
}: Props) {
  const [text, setText] = useState(extraction.text);
  const [status, setStatus] = useState<Status>({ kind: "preview" });

  // Assessed against what is CURRENTLY in the box, so an edit that fixes the
  // problem clears the warning instead of leaving a stale one on screen.
  const quality = useMemo(
    () => assessExtraction({ ...extraction, text }),
    [extraction, text],
  );
  const edited = text !== extraction.text;

  async function build(): Promise<void> {
    if (status.kind === "building") return;
    setStatus({ kind: "building" });
    const result = await sendMessage({
      type: "CREATE_MATCH_REPORT",
      externalId,
      source,
      title,
      company,
      location,
      jobDescription: text,
      // Provenance travels WITH the text so the stored report can record what it
      // was built from, rather than leaving "where did this come from?"
      // answerable only by re-running the adapter against a page that has since
      // changed.
      extraction: {
        strategy: extraction.strategy,
        via: extraction.via,
        chars: text.length,
        edited,
      },
      // Not derived from `text`: this is the site's own published number, so
      // editing the description above cannot and should not change it.
      requiredMonths,
      postedSalary,
    });

    if (result.status === "ok") {
      onClose();
      openWebApp(`/match-report/${result.data.id}`);
      return;
    }
    if (result.status === "unauthenticated") {
      setStatus({ kind: "unauthenticated" });
      return;
    }
    setStatus({
      kind: "error",
      message: result.status === "error" ? result.message : "Couldn't build the report.",
    });
  }

  return (
    <div className="jf-mb-3 jf-flex jf-flex-col jf-gap-2 jf-rounded-md jf-border jf-border-border jf-bg-surface jf-p-3">
      <div className="jf-flex jf-items-start jf-justify-between jf-gap-2">
        <span className="jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
          Check what gets sent
        </span>
        <button
          type="button"
          onClick={onClose}
          className="jf-shrink-0 jf-rounded-md jf-border-none jf-bg-transparent jf-px-2 jf-py-1 jf-text-sm jf-text-content-secondary hover:jf-bg-surface-hover"
        >
          Cancel
        </button>
      </div>

      <p className="jf-text-xs jf-text-content-tertiary">
        Read from {describeStrategy(extraction)} · {text.length.toLocaleString()}{" "}
        characters{edited ? " · edited" : ""}
      </p>

      {quality.level === "uncertain" && (
        <div className="jf-rounded-md jf-bg-warning-100 jf-px-3 jf-py-2">
          <p className="jf-text-xs jf-font-semibold jf-text-warning-600">
            This may not be the job description:
          </p>
          <ul className="jf-mt-1 jf-mb-0 jf-list-disc jf-pl-4">
            {quality.reasons.map((reason) => (
              <li key={reason} className="jf-text-xs jf-text-warning-600">
                {reason}
              </li>
            ))}
          </ul>
          <p className="jf-mt-1 jf-mb-0 jf-text-xs jf-text-warning-600">
            Paste the correct text below, or cancel.
          </p>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        aria-label="Job description that will be sent"
        className="jf-w-full jf-resize-y jf-rounded-md jf-border jf-border-border jf-bg-card jf-p-2 jf-font-sans jf-text-sm jf-text-content jf-outline-none focus:jf-border-primary-600"
      />

      <div className="jf-flex jf-items-center jf-gap-2">
        <button
          type="button"
          onClick={() => void build()}
          disabled={status.kind === "building" || text.trim().length < 80}
          className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md disabled:jf-opacity-60"
        >
          {status.kind === "building" ? "Building…" : "Generate report"}
        </button>
        {text.trim().length < 80 && (
          <span className="jf-text-xs jf-text-content-tertiary">
            Needs at least 80 characters.
          </span>
        )}
      </div>

      {status.kind === "unauthenticated" && (
        <StateNote
          text="Log in to build your report."
          actionLabel="Log in"
          onAction={openLogin}
        />
      )}
      {status.kind === "error" && <StateNote tone="error" text={status.message} />}
    </div>
  );
}
