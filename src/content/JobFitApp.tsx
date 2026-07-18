/**
 * The content-script feature tree, mounted in the Shadow DOM beside a job title.
 * Composes the P0 features:
 *   - Phase 3: sub-score match badge (collapsed pill → expandable sub-scores)
 *   - Phase 5: skills-gap action cards (under the badge)
 *   - Phase 4: company intelligence sidebar (opened from the badge)
 */
import { useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobMatch, JobSource } from "@/shared/types";
import type { Loadable } from "./useWorkerData";
import { useWorkerData } from "./useWorkerData";
import { openLogin, ScoreBar, SkeletonLines, StateNote } from "./ui";
import { SkillGapCards } from "./SkillGapCards";
import { CompanySidebar } from "./CompanySidebar";

interface Props {
  externalId: string;
  source: JobSource;
  /** Company name from the page (local use only), enables the sidebar. */
  company: string | null;
}

/** Short text shown in the collapsed pill, derived from the match state. */
function pillLabel(state: Loadable<JobMatch>): string {
  switch (state.status) {
    case "loading":
      return "…";
    case "ok":
      return `${state.data.overall}%`;
    case "unauthenticated":
      return "Log in";
    case "empty":
      return "";
    case "error":
      return "!";
  }
}

function MatchDetails({
  state,
  onRetry,
}: {
  state: Loadable<JobMatch>;
  onRetry: () => void;
}) {
  if (state.status === "loading") return <SkeletonLines rows={5} />;
  if (state.status === "empty") return <StateNote text="No match data yet for this job." />;
  if (state.status === "unauthenticated")
    return <StateNote text="Log in to see your match." actionLabel="Log in" onAction={openLogin} />;
  if (state.status === "error")
    return <StateNote tone="error" text={state.message} actionLabel="Retry" onAction={onRetry} />;

  const s = state.data.subScores;
  return (
    <div className="jf-flex jf-flex-col jf-gap-1.5">
      <ScoreBar label="Skills" value={s.skills} />
      <ScoreBar label="Experience" value={s.experience} />
      <ScoreBar label="Location" value={s.location} />
      <ScoreBar label="Salary" value={s.salary} />
      <ScoreBar label="Culture" value={s.culture} />
    </div>
  );
}

export function JobFitApp({ externalId, source, company }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, retry } = useWorkerData<JobMatch>(() =>
    sendMessage({ type: "GET_JOB_MATCH", externalId, source }),
  );

  const label = pillLabel(state);

  return (
    <div className="jf-relative jf-font-sans">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="jf-inline-flex jf-items-center jf-gap-1 jf-rounded-full jf-bg-gradient-to-br jf-from-primary-800 jf-to-primary-600 jf-px-2 jf-py-0.5 jf-text-xs jf-font-semibold jf-text-on-primary jf-shadow-sm jf-transition-all jf-duration-200"
      >
        <span aria-hidden="true">✦</span>
        <span>JobFit{label ? ` ${label}` : ""}</span>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="jf-absolute jf-left-0 jf-top-full jf-z-50 jf-mt-1 jf-w-72 jf-rounded-lg jf-border jf-border-border jf-bg-card jf-p-3 jf-shadow-xl">
          <div className="jf-mb-2 jf-flex jf-items-center jf-justify-between">
            <span className="jf-text-xs jf-font-semibold jf-uppercase jf-tracking-wide jf-text-content-tertiary">
              Match breakdown
            </span>
            {company && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="jf-rounded-md jf-border jf-border-border jf-px-2 jf-py-0.5 jf-text-xs jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
              >
                🏢 Company
              </button>
            )}
          </div>

          <MatchDetails state={state} onRetry={retry} />

          <div className="jf-my-3 jf-border-t jf-border-border" />

          <span className="jf-mb-2 jf-block jf-text-xs jf-font-semibold jf-uppercase jf-tracking-wide jf-text-content-tertiary">
            Skill gaps
          </span>
          <SkillGapCards externalId={externalId} source={source} />
        </div>
      )}

      {sidebarOpen && company && (
        <CompanySidebar name={company} onClose={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
