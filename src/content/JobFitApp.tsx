/**
 * The content-script feature tree, mounted in the Shadow DOM beside a job title.
 * Composes the P0 features:
 *   - Phase 3: sub-score match badge (collapsed pill → expandable sub-scores)
 *   - Phase 5: skills-gap action cards (under the badge)
 *   - Phase 4: company intelligence sidebar (opened from the badge)
 */
import { useRef, useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobDeadline, JobMatch, JobSource, PostedSalary } from "@/shared/types";
import type { Loadable } from "./useWorkerData";
import type { Extraction } from "./sites/extraction";
import { MatchReportPanel } from "./MatchReportPanel";
import { useWorkerData } from "./useWorkerData";
// `source` is a flags-only module with no imports — the content script still
// reaches the network only through the worker.
import { isMock, isSafeToShow } from "@/data/source";
import { openLogin, ScoreBar, SkeletonLines, StateNote } from "./ui";
import { SkillGapCards } from "./SkillGapCards";
import { CompanySidebar } from "./CompanySidebar";
import { SalaryPanel } from "./SalaryPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { DuplicateWarning } from "./DuplicateWarning";
import { InterviewPrepPanel } from "./InterviewPrepPanel";
import { SaveJobPanel } from "./SaveJobPanel";
import { AnchoredOverlay, FullscreenOverlay } from "./OverlayLayer";

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
  getDescription: () => Extraction | null;
  /**
   * The posting's OWN published experience bar in months, when the site states
   * one as a number. Read on the same click as the description. Language-proof
   * where reading prose is not — see SiteAdapter.getRequiredMonths.
   */
  getRequiredMonths: () => number | null;
  /** Pay as the posting advertises it, read on the same click. */
  getPostedSalary: () => PostedSalary | null;
}

/** Whole days until an ISO deadline (negative = past). */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/**
 * The "⏰ Closes in Nd" chip — only within a 14-day window.
 *
 * The chip is a claim about a real posting, so it renders ONLY when the
 * deadline came from the backend. While the endpoint is mocked it is absent
 * from release builds entirely (`isSafeToShow`) and carries a "sample"
 * marker in dev, because a wrong closing date makes a user rush or skip a real
 * application. See data/deadlines.ts.
 */
function DeadlineChip({ state }: { state: Loadable<JobDeadline> }) {
  if (!isSafeToShow("deadlines")) return null;
  if (state.status !== "ok" || !state.data.deadline) return null;
  const d = daysUntil(state.data.deadline);
  if (d < 0 || d > 14) return null;
  const sample = isMock("deadlines");
  const urgent = d <= 3 && !sample;
  const text = d === 0 ? "Closes today" : `Closes in ${d}d`;
  return (
    <span
      title={sample ? "Sample data — no deadline endpoint exists yet" : undefined}
      className={`jf-inline-flex jf-items-center jf-gap-1.5 jf-rounded-full jf-px-3 jf-py-1 jf-text-sm jf-font-semibold ${
        urgent
          ? "jf-bg-warning-100 jf-text-warning-600"
          : "jf-bg-neutral-100 jf-text-content-secondary"
      }`}
    >
      {sample ? `SAMPLE · ${text}` : text}
    </span>
  );
}

/**
 * WHAT THIS SCORE ACTUALLY SAW.
 *
 * The badge request sends identifiers — title, company, location — and NOT the
 * posting body. So the number beside a real job advert is a title-level
 * estimate, and "Software Engineer" covers wildly different roles. Rather than
 * soften that with vague wording, we state the arithmetic.
 *
 * The backend's weights (mirrored from JobMatchSubScores) are skills 40 ·
 * experience 25 · location 15 · salary 10 · industry 10. Each needs a specific
 * input, so how much of the total genuinely reflects THIS posting is
 * computable:
 *
 *   · skills 40   — only if the semantic comparison ran
 *   · location 15 — only if we could read a location
 *   · salary 10 ┐ both derive from the employer, so both need a company name
 *   · industry 10 ┘
 *   · experience 25 — NEVER job-specific. It counts entries on the CV without
 *     ever seeing the job, so it is the same number for every posting.
 *
 * Ceiling: 75. A "100% confident" title-based estimate cannot exist, and the UI
 * should not imply one.
 */
export interface Evidence {
  /** The semantic skills comparison ran (the only job-specific signal). */
  skills: boolean;
  company: boolean;
  location: boolean;
}

/** Percentage points of the total that reflect this posting rather than the CV. */
export function jobSpecificWeight(e: Evidence): number {
  return (e.skills ? 40 : 0) + (e.location ? 15 : 0) + (e.company ? 20 : 0);
}

type Confidence = "low" | "medium" | "high";

export function confidenceOf(e: Evidence): Confidence {
  const w = jobSpecificWeight(e);
  if (w >= 70) return "high";
  return w >= 50 ? "medium" : "low";
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "jf-bg-primary-100 jf-text-primary-700",
  medium: "jf-bg-neutral-100 jf-text-content-secondary",
  low: "jf-bg-warning-100 jf-text-warning-600",
};

/** "Confidence: medium" — how much of the total actually saw this posting. */
function ConfidenceChip({ evidence }: { evidence: Evidence }) {
  const level = confidenceOf(evidence);
  return (
    <span
      title={`${jobSpecificWeight(evidence)} of 100 points come from this posting's own details. The job description is not used — open Full Report for that.`}
      className={`jf-self-start jf-rounded-full jf-px-2 jf-py-0.5 jf-text-xs jf-font-semibold ${CONFIDENCE_STYLE[level]}`}
    >
      {level} confidence
    </span>
  );
}

/** A tick/cross list of exactly which identifiers were used. */
function EvidenceNote({ evidence }: { evidence: Evidence }) {
  const weight = jobSpecificWeight(evidence);
  const items: [string, boolean][] = [
    ["title", true],
    ["company", evidence.company],
    ["location", evidence.location],
    ["skills match", evidence.skills],
    ["job description", false],
  ];
  return (
    <div className="jf-mt-1 jf-flex jf-flex-col jf-gap-1 jf-border-t jf-border-neutral-100 jf-pt-2">
      <div className="jf-flex jf-flex-wrap jf-gap-x-2 jf-gap-y-0.5">
        {items.map(([label, used]) => (
          <span
            key={label}
            className={`jf-text-xs ${used ? "jf-text-content-secondary" : "jf-text-content-tertiary jf-line-through"}`}
          >
            {used ? "✓" : "✗"} {label}
          </span>
        ))}
      </div>
      <p className="jf-text-xs jf-text-content-tertiary">
        {weight}% of this score reflects this specific posting; the rest describes
        your CV regardless of the job.
      </p>
    </div>
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
      // The tilde is deliberate: this is an estimate from the title, and a bare
      // "82%" beside a real advert reads as a measurement of it.
      return state.data.overall === null ? "—" : `~${state.data.overall}%`;
    case "unauthenticated":
      return "Log in";
    case "empty":
      return "";
    case "error":
      return "!";
  }
}

export function MatchDetails({
  state,
  onRetry,
  company,
  location,
}: {
  state: Loadable<JobMatch>;
  onRetry: () => void;
  company: string | null;
  location: string | null;
}) {
  if (state.status === "loading") return <SkeletonLines rows={5} />;
  if (state.status === "empty") return <StateNote text="No match data yet for this job." />;
  if (state.status === "unauthenticated")
    return <StateNote text="Log in to see your match." actionLabel="Log in" onAction={openLogin} />;
  if (state.status === "error")
    return <StateNote tone="error" text={state.message} actionLabel="Retry" onAction={onRetry} />;

  const s = state.data.subScores;
  const semantic = state.data.semantic;
  const evidence: Evidence = {
    skills: semantic,
    company: Boolean(company),
    location: Boolean(location),
  };
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
          job, so it is the SAME number for every posting. The label carries that
          caveat now — a bar in a per-job panel otherwise implies it measured this
          job. The full report can do better: it has the description, so it reads
          the stated years bar and checks it. */}
      <ScoreBar label="CV depth" value={s.experience} />
      <p className="jf-pl-20 jf-text-xs jf-text-content-tertiary">
        same for every job — it scores your CV, not this posting
      </p>
      {/* NO LOCATION BAR. `scoreLocation` is a five-value ladder over whole-word
          string overlap between the posting's location text and the profile's
          city/country — no geocoding, no distance, no commute, no notion that
          "Phnom Penh" is in "Cambodia". A bar in a per-job panel reads as a
          measured fit, and this cannot honestly claim to be one; showing it
          would commit us to building real geo matching to make it true. It is
          still SENT and still scored (15% of the backend's total) — this hides
          the claim, not the input. See `evidence.location`, which continues to
          report that location was used.
          Salary/industry are only as good as the identifier they were given;
          when it was missing the backend still returns a number, so say it's a
          fallback rather than drawing an unqualified bar. */}
      <ScoreBar label="Salary" value={s.salary} />
      <ScoreBar label="Industry" value={s.other} />
      {!company && (
        <p className="jf-pl-20 jf-text-xs jf-text-content-tertiary">
          no company found on this page — salary and industry are general estimates
        </p>
      )}
      {!semantic && (
        <p className="jf-text-sm jf-text-content-tertiary">
          Skills fit couldn&apos;t be computed, so it&apos;s excluded from this score —
          add a résumé to your JobFit profile, or check the AI service is up.
        </p>
      )}
      <EvidenceNote evidence={evidence} />
    </div>
  );
}

/** Panel width in px. The overlay needs the number to keep itself on screen. */
const PANEL_WIDTH = 480;

export function JobFitApp({
  externalId,
  source,
  company,
  role,
  location,
  getDescription,
  getRequiredMonths,
  getPostedSalary,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  // The description is read ONLY here, on the click — never at mount. A failed
  // read is reported instead of producing a report with an empty skills table.
  const [report, setReport] = useState<Extraction | null>(null);
  // Captured with the description, from the same page state the user is looking at.
  const [requiredMonths, setRequiredMonths] = useState<number | null>(null);
  const [postedSalary, setPostedSalary] = useState<PostedSalary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  function openReport(): void {
    if (report) {
      setReport(null);
      return;
    }
    const extraction = getDescription();
    if (!extraction) {
      setReportError(
        "Couldn't read this posting's description. Scroll it into view and try again.",
      );
      return;
    }
    setReportError(null);
    setRequiredMonths(getRequiredMonths());
    setPostedSalary(getPostedSalary());
    setReport(extraction);
  }
  // The badge is what the panel is positioned from, once it renders in the page.
  const badgeRef = useRef<HTMLButtonElement>(null);
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
  // Skipped entirely when deadlines can't be shown, so a release build makes no
  // round-trip for data the chip would discard.
  const deadline = useWorkerData<JobDeadline>(() =>
    isSafeToShow("deadlines")
      ? sendMessage({ type: "GET_JOB_DEADLINE", externalId, source })
      : Promise.resolve({ status: "ok" as const, data: { externalId, source, deadline: null } }),
  );

  const label = pillLabel(state);

  return (
    <div className="jf-relative jf-inline-flex jf-items-center jf-gap-1 jf-font-sans">
      <button
        ref={badgeRef}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="jf-inline-flex jf-border-none jf-items-center jf-gap-2 jf-rounded-full jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-shadow-md jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-lg hover:-jf-translate-y-0.5"
      >

        <span>JobFit{label ? ` ${label}` : ""}</span>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>

      <DeadlineChip state={deadline.state} />

      {/* Rendered OUTSIDE this element on purpose: the badge sits inside the page's own
          job card, and on Khmer24 that card clips its overflow — which sliced the panel
          off. See OverlayLayer. */}
      {expanded && (
        <AnchoredOverlay anchor={badgeRef.current} width={PANEL_WIDTH}>
          <DuplicateWarning
            externalId={externalId}
            source={source}
            title={role}
            company={company}
          />

          <div className="jf-mb-2 jf-flex jf-items-start jf-justify-between jf-gap-2">
            {/* Was "Match breakdown", which claimed more than the request can
                support: this scores a title, not the advert underneath it. */}
            <div className="jf-flex jf-flex-col jf-gap-1">
              <span className="jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
                Quick title-based estimate
              </span>
              {state.status === "ok" && state.data.overall !== null && (
                <ConfidenceChip
                  evidence={{
                    skills: state.data.semantic,
                    company: Boolean(company),
                    location: Boolean(location),
                  }}
                />
              )}
            </div>
            <div className="jf-flex jf-shrink-0 jf-flex-col jf-items-end jf-gap-1">
              {company && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-3 jf-py-1.5 jf-text-sm jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
                >
                  Company
                </button>
              )}
              {/* Both need a title: it's what the report is ABOUT, and what the
                  save form requires. */}
              {role && (
                <button
                  type="button"
                  onClick={() => setSaveOpen((v) => !v)}
                  aria-expanded={saveOpen}
                  className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-3 jf-py-1.5 jf-text-sm jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
                >
                  {saveOpen ? "Close" : "Save Job"}
                </button>
              )}
              {role && (
                <div className="jf-flex jf-flex-col jf-items-end jf-gap-0.5">
                  <button
                    type="button"
                    onClick={() => openReport()}
                    aria-expanded={report !== null}
                    className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md"
                  >
                    Full Report
                  </button>
                  {/* The one result that reads the advert, and the only one that
                      should be described that way. */}
                  <span className="jf-text-xs jf-text-content-tertiary">
                    reads this posting&apos;s description
                  </span>
                </div>
              )}
            </div>
          </div>

          {reportError && (
            <div className="jf-mb-3">
              <StateNote tone="error" text={reportError} />
            </div>
          )}

          {report && role && (
            <MatchReportPanel
              externalId={externalId}
              source={source}
              title={role}
              company={company}
              location={location}
              extraction={report}
              requiredMonths={requiredMonths}
              postedSalary={postedSalary}
              onClose={() => setReport(null)}
            />
          )}

          {saveOpen && role && (
            <SaveJobPanel
              externalId={externalId}
              source={source}
              title={role}
              company={company}
              getDescription={getDescription}
              onClose={() => setSaveOpen(false)}
            />
          )}

          <MatchDetails state={state} onRetry={retry} company={company} location={location} />

          <div className="jf-my-2.5 jf-border-t jf-border-border" />

          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Skill gaps
          </span>
          <SkillGapCards externalId={externalId} source={source} role={role} />

          {company && role && (
            <>
              <div className="jf-my-2.5 jf-border-t jf-border-border" />
              <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
                Salary
              </span>
              <SalaryPanel company={company} role={role} />
            </>
          )}

          <div className="jf-my-2.5 jf-border-t jf-border-border" />
          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Cover letter
          </span>
          <CoverLetterPanel ctx={{ externalId, source, company, role }} />

          <div className="jf-my-2.5 jf-border-t jf-border-border" />
          <span className="jf-mb-2 jf-block jf-text-sm jf-font-bold jf-uppercase jf-tracking-wider jf-text-content-tertiary">
            Interview prep
          </span>
          <InterviewPrepPanel externalId={externalId} source={source} company={company} role={role} />
        </AnchoredOverlay>
      )}

      {sidebarOpen && company && (
        <FullscreenOverlay>
          <CompanySidebar name={company} onClose={() => setSidebarOpen(false)} />
        </FullscreenOverlay>
      )}
    </div>
  );
}
