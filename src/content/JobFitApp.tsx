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
import { openLogin, openWebApp, ScoreBar, SkeletonLines, StateNote } from "./ui";
import { SkillGapCards } from "./SkillGapCards";
import { CompanySidebar } from "./CompanySidebar";
import { SalaryPanel } from "./SalaryPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { DuplicateWarning } from "./DuplicateWarning";
import { InterviewPrepPanel } from "./InterviewPrepPanel";

interface Props {
  externalId: string;
  source: JobSource;
  /** Company name from the page (local use only), enables the sidebar/salary. */
  company: string | null;
  /** Job title from the page, enables matching + salary intelligence. */
  role: string | null;
  /** Location text from the page — improves the location sub-score. */
  location: string | null;
  /**
   * Reads the visible "About the job" text. A callback, not a string, so the
   * description is read at CLICK time: it is the one thing we send that isn't an
   * identifier, and reading it on mount would take it from every job the user
   * merely scrolled past.
   */
  getDescription: () => string | null;
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
      className={`jf-inline-flex jf-items-center jf-gap-1.5 jf-rounded-full jf-px-3 jf-py-1 jf-text-sm jf-font-semibold ${
        urgent
          ? "jf-bg-warning-100 jf-text-warning-600"
          : "jf-bg-neutral-100 jf-text-content-secondary"
      }`}
    >
      {d === 0 ? "Closes today" : `Closes in ${d}d`}
    </span>
  );
}

/** Short text shown in the collapsed pill, derived from the match state. */
function pillLabel(state: Loadable<JobMatch>): string {
  switch (state.status) {
    case "loading":
      return "…";
    case "ok":
      // No total means the skills comparison didn't run — the pill says nothing
      // rather than a number, and the panel explains why.
      return state.data.overall === null ? "—" : `${state.data.overall}%`;
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
  const semantic = state.data.semantic;
  return (
    <div className="jf-flex jf-flex-col jf-gap-1.5">
      {/* Without an embedding the skills comparison never ran; the backend leaves it out
          of the total, so the row says so instead of drawing a bar nobody measured. */}
      {semantic ? (
        <ScoreBar label="Skills" value={s.skills} />
      ) : (
        <div className="jf-flex jf-items-center jf-gap-3">
          <span className="jf-w-20 jf-shrink-0 jf-text-sm jf-text-content-secondary">Skills</span>
          <span className="jf-flex-1 jf-text-sm jf-text-content-tertiary">not computed</span>
        </div>
      )}
      {/* "CV depth", not "Experience": this counts entries on the CV and never sees the
          job, so it is the SAME number for every posting. The full report can do better —
          it has the description, so it reads the stated years bar and checks it. */}
      <ScoreBar label="CV depth" value={s.experience} />
      <ScoreBar label="Location" value={s.location} />
      <ScoreBar label="Salary" value={s.salary} />
      <ScoreBar label="Industry" value={s.other} />
      {!semantic && (
        <p className="jf-text-sm jf-text-content-tertiary">
          Skills fit couldn&apos;t be computed, so it&apos;s excluded from this score —
          add a résumé to your JobFit profile, or check the AI service is up.
        </p>
      )}
    </div>
  );
}

/** Idle → building → (new tab | a reason it couldn't). */
type ReportState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/**
 * "📊 Full Report" — generates the roomy, full-page report on the web app.
 *
 * The badge can only ever show a number in a corner; this is the same analysis
 * with the room to explain itself. It is also the only control that sends the
 * posting text (read here, on the click, and never before).
 */
function FullReportButton({
  externalId,
  source,
  title,
  company,
  location,
  getDescription,
}: {
  externalId: string;
  source: JobSource;
  title: string;
  company: string | null;
  location: string | null;
  getDescription: () => string | null;
}) {
  const [state, setState] = useState<ReportState>({ status: "idle" });

  async function build(): Promise<void> {
    if (state.status === "building") return;
    const jobDescription = getDescription();
    if (!jobDescription) {
      // LinkedIn hadn't rendered the body yet, or shipped another redesign. Say
      // so rather than generating a report with an empty skills table in it.
      setState({
        status: "error",
        message: "Couldn't read this posting's description. Scroll it into view and retry.",
      });
      return;
    }

    setState({ status: "building" });
    const result = await sendMessage({
      type: "CREATE_MATCH_REPORT",
      externalId,
      source,
      title,
      company,
      location,
      jobDescription,
    });

    if (result.status === "ok") {
      setState({ status: "idle" });
      openWebApp(`/match-report/${result.data.id}`);
      return;
    }
    if (result.status === "unauthenticated") {
      setState({ status: "unauthenticated" });
      return;
    }
    setState({
      status: "error",
      message: result.status === "error" ? result.message : "Couldn't build the report.",
    });
  }

  return (
    <div className="jf-flex jf-flex-col jf-gap-1">
      <button
        type="button"
        onClick={() => void build()}
        disabled={state.status === "building"}
        className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-5 jf-py-2 jf-text-base jf-font-bold jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md disabled:jf-opacity-60"
      >
        {state.status === "building" ? "Building…" : "Full Report"}
      </button>
      {state.status === "unauthenticated" && (
        <StateNote
          text="Log in to build your report."
          actionLabel="Log in"
          onAction={openLogin}
        />
      )}
      {state.status === "error" && <StateNote tone="error" text={state.message} />}
    </div>
  );
}

export function JobFitApp({
  externalId,
  source,
  company,
  role,
  location,
  getDescription,
}: Props) {
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
        className="jf-inline-flex jf-border-none jf-items-center jf-gap-2 jf-rounded-full jf-bg-primary-600 jf-px-5 jf-py-2 jf-text-base jf-font-bold jf-text-on-primary jf-shadow-md jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-lg hover:-jf-translate-y-0.5"
      >

        <span>JobFit{label ? ` ${label}` : ""}</span>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>

      <DeadlineChip state={deadline.state} />

      {expanded && (
        <div className="jf-absolute jf-left-0 jf-top-full jf-z-50 jf-mt-2 jf-w-80 jf-rounded-xl jf-border jf-border-border jf-bg-card jf-p-4 jf-shadow-2xl">
          <DuplicateWarning
            externalId={externalId}
            source={source}
            title={role}
            company={company}
          />

          <div className="jf-mb-2 jf-flex jf-items-start jf-justify-between jf-gap-2">
            <span className="jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
              Match breakdown
            </span>
            <div className="jf-flex jf-shrink-0 jf-flex-col jf-items-end jf-gap-1">
              {company && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-4 jf-py-2 jf-text-base jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
                >
                  Company
                </button>
              )}
              {/* Needs a title: it's what the report is a report ABOUT, and the
                  backend requires it to extract the job's requirements. */}
              {role && (
                <FullReportButton
                  externalId={externalId}
                  source={source}
                  title={role}
                  company={company}
                  location={location}
                  getDescription={getDescription}
                />
              )}
            </div>
          </div>

          <MatchDetails state={state} onRetry={retry} />

          <div className="jf-my-3 jf-border-t jf-border-border" />

          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Skill gaps
          </span>
          <SkillGapCards externalId={externalId} source={source} role={role} />

          {company && role && (
            <>
              <div className="jf-my-3 jf-border-t jf-border-border" />
              <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
                Salary
              </span>
              <SalaryPanel company={company} role={role} />
            </>
          )}

          <div className="jf-my-3 jf-border-t jf-border-border" />
          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Cover letter
          </span>
          <CoverLetterPanel ctx={{ externalId, source, company, role }} />

          <div className="jf-my-3 jf-border-t jf-border-border" />
          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Interview prep
          </span>
          <InterviewPrepPanel externalId={externalId} source={source} company={company} role={role} />
        </div>
      )}

      {sidebarOpen && company && (
        <CompanySidebar name={company} onClose={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
