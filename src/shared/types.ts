/**
 * Backend types, mirrored VERBATIM from the web app so the extension speaks the
 * exact same contract. Source of truth: web repo
 * `src/providers/auth-provider.tsx` (`AuthUser` = the `GET /auth/me` shape).
 */

/** Backend roles (SafeUser.role). */
export type UserRole = "JOB_SEEKER" | "EMPLOYER" | "ADMIN";

/**
 * `GET /auth/me` → User.toSafe(). Backend shape verbatim: a single `name`
 * (not firstName/lastName). NOTE: there is deliberately no subscription/tier
 * here — tier lives in a separate `subscriptions` table/endpoint, so the popup
 * must not invent one.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  deletedAt: string | null;
}

/** Job board a job id came from. */
export type JobSource = "linkedin" | "indeed";

// ─── P0 · Sub-score match (GET /recommendations/by-job) ─────────────────────
/**
 * Mirrors the backend's `SubScores` verbatim (matching/domain/scoring/types.ts).
 * Weights: skills 40% · experience 25% · location 15% · salary 10% · other 10%.
 * NOTE `other` is industry alignment — the backend has no "culture" dimension.
 */
export interface JobMatchSubScores {
  skills: number;
  experience: number;
  location: number;
  salary: number;
  other: number;
}

export interface JobMatch {
  externalId: string;
  source: JobSource;
  /**
   * 0–100 weighted total, or NULL when it couldn't be computed. Skills is the
   * only sub-score that measures fit to THIS role, so when it didn't run the
   * backend emits no total rather than one built from experience + location —
   * those are generous by construction and scored an unrelated job 92%.
   */
  overall: number | null;
  subScores: JobMatchSubScores;
  /**
   * False when the semantic (skills) component couldn't be computed — no
   * candidate embedding, or the AI service was unreachable. Then `overall` is
   * null and `subScores.skills` is a placeholder to show as "not computed".
   */
  semantic: boolean;
}

// ─── P0 · Company intelligence (GET /companies/by-name) ─────────────────────
export type HiringVelocity = "LOW" | "MEDIUM" | "HIGH";

export interface CompanySalaryRange {
  min: number;
  max: number;
  currency: string;
  dataPoints: number;
}

export interface CompanyMatch {
  title: string;
  score: number;
}

export interface CompanyIntel {
  name: string;
  glassdoorRating: number | null;
  fundingStage: string | null;
  hiringVelocity: HiringVelocity | null;
  openRoles: number | null;
  salaryRange: CompanySalaryRange | null;
  topMatches: CompanyMatch[];
}

// ─── P0 · Skills gap (GET /learning/gap) ────────────────────────────────────
export interface LearningPath {
  id: string;
  title: string;
  durationWeeks: number;
  isFree: boolean;
}

export interface SkillGap {
  skill: string;
  demandCount: number;
  jobsWithoutSkill: number;
  /** null when no learning path exists for this skill. */
  learningPath: LearningPath | null;
}

export interface SkillGapReport {
  jobExternalId: string;
  source: JobSource;
  gaps: SkillGap[];
}

// ─── P1 · Quick Apply Tracker (real: GET /applications + GET /jobs/{id}) ─────
/** Backend ApplicationStatus enum (10 states). */
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "ACCEPTED"
  | "NEGOTIATING"
  | "REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED";

/** The three pipeline columns shown in the popup. */
export type PipelineStage = "applied" | "interview" | "offer";

/** An application joined with its job's title/company for display. */
export interface TrackedApplication {
  id: string;
  stage: PipelineStage;
  status: ApplicationStatus;
  appliedAt: string;
  jobTitle: string;
  companyName: string | null;
}

// ─── P1 · Salary intelligence (GET /salary) ─────────────────────────────────
export interface SalaryMarket {
  p25: number;
  p50: number;
  p75: number;
  totalCompAvg: number;
  currency: string;
  dataPoints: number;
}

export interface SalaryIntel {
  company: string;
  role: string;
  listed: { min: number; max: number; currency: string } | null;
  market: SalaryMarket;
  /** Which market band the user's profile fits. */
  fitPercentile: "P25" | "P50" | "P75";
  tip: string;
}

// ─── P1 · Deadline urgency (mock saved-jobs deadline) ───────────────────────
export interface JobDeadline {
  externalId: string;
  source: JobSource;
  /** ISO date, or null if the job has no deadline. */
  deadline: string | null;
}

/** A saved job whose deadline is approaching — used by the notification alarm. */
export interface UpcomingDeadline {
  externalId: string;
  source: JobSource;
  title: string;
  deadline: string;
  matchScore: number | null;
}

// ─── P1 · Cover letter generation (POST /generate/cover-letter) ─────────────
export interface CoverLetter {
  /** The generated letter, plain text. */
  text: string;
  /** Model that produced it, for display/debugging. */
  model: string | null;
}

// ─── P3 · Passive job-scout alerts (GET /recommendations/scout) ─────────────
export interface ScoutMatch {
  externalId: string;
  source: JobSource;
  title: string;
  company: string | null;
  /** 0–100 overall match. */
  score: number;
  /** Where to send the user when they click the notification. */
  url: string;
}

// ─── P2 · Duplicate application detector (GET /applications/similar) ─────────
export interface DuplicateMatch {
  applicationId: string;
  jobTitle: string;
  companyName: string | null;
  status: ApplicationStatus;
  appliedAt: string;
}

// ─── P2 · Interview prep trigger (POST /generate/interview) ─────────────────
export interface InterviewQuestionType {
  /** e.g. "System Design". */
  label: string;
  /** 0–100 share of the interview. */
  pct: number;
}
export interface InterviewPrep {
  questionTypes: InterviewQuestionType[];
  topQuestions: string[];
  model: string | null;
}

// ─── P2 · Momentum score (real: GET /analytics/my-stats) ────────────────────
export interface MomentumStats {
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
  /** Fractions in [0,1], per the backend AnalyticsStatsResponseDto. */
  interviewRate: number;
  offerRate: number;
  profileViewCount: number;
  /** 0–100 gamified momentum, derived from the counts above. */
  momentum: number;
}

// ─── P4 · Full-page match report (POST /match-report) ───────────────────────
/**
 * What the backend hands back after generating a report: just its id. The report
 * itself is rendered by the web app at {WEB_APP_URL}/match-report/{id} — the
 * extension never fetches or displays the payload, so it doesn't mirror it.
 */
export interface MatchReportRef {
  id: string;
}

// ─── P4 · Save Job (POST /saved-jobs/external) ──────────────────────────────
/**
 * A job the user saved from the badge's "Save Job" form. Mirrors the backend's
 * SavedExternalJobDto.
 *
 * PRIVACY: like the match report, this carries the posting text — but only what
 * the USER chose to save, on their own row, on their click. It is a bookmark,
 * not a feed: nothing reads across users and no background job writes it.
 */
export interface SavedJob {
  id: string;
  source: JobSource;
  externalId: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string | null;
  /** Free text — postings write "$70k–90k", "1,200 USD/month", "negotiable". */
  salary: string | null;
  notes: string | null;
  savedAt: string;
}

/** What the form sends. `title` is the only required field, as on the form. */
export interface SaveJobInput {
  externalId: string;
  source: JobSource;
  title: string;
  company: string | null;
  description: string | null;
  url: string | null;
  salary: string | null;
  notes: string | null;
}

// ─── Extension settings (chrome.storage.local) ──────────────────────────────
export interface ExtSettings {
  /** Opt-in browser notifications for approaching saved-job deadlines. */
  deadlineNotifications: boolean;
  /** Opt-in background alerts for new high-match jobs. */
  scoutAlerts: boolean;
  /** Only alert on jobs scoring at or above this (0–100). */
  scoutMinScore: number;
}
