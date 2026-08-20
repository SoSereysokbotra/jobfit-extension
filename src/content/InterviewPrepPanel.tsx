/**
 * Phase 10 — Interview prep trigger. On demand, generates tailored prep for the
 * role: expected question-type mix + the top questions to rehearse. Mirrors the
 * cover-letter panel's generate-on-click pattern.
 */
import { useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { InterviewPrep, JobSource } from "@/shared/types";
import { openLogin } from "./ui";

type Status = "idle" | "loading" | "done";

export function InterviewPrepPanel({
  externalId,
  source,
  company,
  role,
}: {
  externalId: string;
  source: JobSource;
  company: string | null;
  role: string | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function generate() {
    setStatus("loading");
    setError(null);
    setNeedsLogin(false);
    try {
      const r = await sendMessage({
        type: "GENERATE_INTERVIEW_PREP",
        externalId,
        source,
        company,
        role,
      });
      if (r.status === "ok") {
        setPrep(r.data);
        setStatus("done");
        return;
      }
      if (r.status === "unauthenticated") setNeedsLogin(true);
      else if (r.status === "empty") setError("No prep available for this role yet.");
      else setError(r.message);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setStatus("idle");
    }
  }

  return (
    <div className="jf-flex jf-flex-col jf-gap-2">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={status === "loading"}
        className="jf-inline-flex jf-border-none jf-items-center jf-gap-2 jf-self-start jf-rounded-md jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-shadow-sm jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md hover:-jf-translate-y-0.5 disabled:jf-opacity-60"
      >
        {status === "loading" ? "Preparing…" : prep ? "Regenerate" : "Interview prep"}
      </button>

      {needsLogin && (
        <div className="jf-flex jf-items-center jf-gap-2">
          <span className="jf-text-sm jf-text-content-secondary">Log in to JobFit to generate.</span>
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

      {prep && (
        <div className="jf-flex jf-flex-col jf-gap-2">
          <div className="jf-flex jf-flex-col jf-gap-1">
            {prep.questionTypes.map((q) => (
              <div key={q.label} className="jf-flex jf-items-center jf-gap-2">
                <span className="jf-w-32 jf-shrink-0 jf-text-sm jf-text-content-secondary">
                  {q.label}
                </span>
                <div className="jf-h-1.5 jf-flex-1 jf-overflow-hidden jf-rounded-full jf-bg-neutral-100">
                  <div className="jf-h-full jf-rounded-full jf-bg-primary-500" style={{ width: `${q.pct}%` }} />
                </div>
                <span className="jf-w-10 jf-shrink-0 jf-text-right jf-text-sm jf-font-semibold jf-text-content">
                  {q.pct}%
                </span>
              </div>
            ))}
          </div>
          <ul className="jf-flex jf-flex-col jf-gap-1">
            {prep.topQuestions.map((q, i) => (
              <li
                key={i}
                className="jf-rounded-md jf-bg-background-secondary jf-p-3 jf-text-sm jf-text-content-secondary"
              >
                {i + 1}. {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
