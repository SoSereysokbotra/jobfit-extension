/**
 * The content-script feature tree, mounted in the Shadow DOM beside a job title.
 * Composes the P0 features:
 *   - Phase 3: sub-score match badge (collapsed pill → expandable sub-scores)
 *   - Phase 5: skills-gap action cards (under the badge)
 *   - Phase 4: company intelligence sidebar (opened from the badge)
 */
import { useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobDeadline, JobMatch, JobSource } from "@/shared/types";
import type { Loadable } from "./useWorkerData";
import { useWorkerData } from "./useWorkerData";
import { openLogin, ScoreBar, SkeletonLines, StateNote } from "./ui";
import { SkillGapCards } from "./SkillGapCards";
import { CompanySidebar } from "./CompanySidebar";
import { SalaryPanel } from "./SalaryPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";

interface Props {
  externalId: string;
  source: JobSource;
  /** Company name from the page (local use only), enables the sidebar/salary. */
  company: string | null;
  /** Job title from the page, enables matching + salary intelligence. */
  role: string | null;
  /** Location text from the page — improves the location sub-score. */
  location: string | null;
}

/** Whole days until an ISO deadline (negative = past). */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** The "⏰ Closes in Nd" chip — only within a 14-day window. */
function DeadlineChip({ state }: { state: Loadable<JobDeadline> }) {
  if (state.status !== "ok" || !state.data.deadline) return null;
  const d = daysUntil(state.data.deadline);
  if (d < 0 || d > 14) return null;
  const urgent = d <= 3;
  return (
    <span
      className={`jf-inline-flex jf-items-center jf-gap-1 jf-rounded-full jf-px-2 jf-py-0.5 jf-text-xs jf-font-semibold ${
        urgent
          ? "jf-bg-warning-100 jf-text-warning-600"
          : "jf-bg-neutral-100 jf-text-content-secondary"
      }`}
    >
      ⏰ {d === 0 ? "Closes today" : `Closes in ${d}d`}
    </span>
  );
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
      <ScoreBar label="Industry" value={s.other} />
      {!state.data.semantic && (
        <p className="jf-text-xs jf-text-content-tertiary">
          Skills score is approximate — add a résumé to your JobFit profile for a
          semantic match.
        </p>
      )}
    </div>
  );
}

export function JobFitApp({ externalId, source, company, role, location }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, retry } = useWorkerData<JobMatch>(() =>
    sendMessage({
      type: "GET_JOB_MATCH",
      externalId,
      source,
      title: role,
      company,
      location,
    }),
  );
  const deadline = useWorkerData<JobDeadline>(() =>
    sendMessage({ type: "GET_JOB_DEADLINE", externalId, source }),
  );

  const label = pillLabel(state);

  return (
    <div className="jf-relative jf-inline-flex jf-items-center jf-gap-1 jf-font-sans">
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

      <DeadlineChip state={deadline.state} />

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

          {company && role && (
            <>
              <div className="jf-my-3 jf-border-t jf-border-border" />
              <span className="jf-mb-2 jf-block jf-text-xs jf-font-semibold jf-uppercase jf-tracking-wide jf-text-content-tertiary">
                💰 Salary
              </span>
              <SalaryPanel company={company} role={role} />
            </>
          )}

          <div className="jf-my-3 jf-border-t jf-border-border" />
          <span className="jf-mb-2 jf-block jf-text-xs jf-font-semibold jf-uppercase jf-tracking-wide jf-text-content-tertiary">
            ✨ Cover letter
          </span>
          <CoverLetterPanel ctx={{ externalId, source, company, role }} />
        </div>
      )}

      {sidebarOpen && company && (
        <CompanySidebar name={company} onClose={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
