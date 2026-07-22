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
  /** 0–100 weighted total. */
  overall: number;
  subScores: JobMatchSubScores;
  /**
   * False when the semantic (skills) component couldn't be computed — no
   * candidate embedding, or the AI service was unreachable — and a neutral
   * value was substituted. Surfaced so the score isn't over-trusted.
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

// ─── Extension settings (chrome.storage.local) ──────────────────────────────
export interface ExtSettings {
  /** Opt-in browser notifications for approaching saved-job deadlines. */
  deadlineNotifications: boolean;
  /** Opt-in background alerts for new high-match jobs. */
  scoutAlerts: boolean;
  /** Only alert on jobs scoring at or above this (0–100). */
  scoutMinScore: number;
}
