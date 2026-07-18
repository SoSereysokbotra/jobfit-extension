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

/** Subscription tier — resolved separately from /auth/me (see src/data/tier.ts). */
export type SubscriptionTier = "FREE" | "PREMIUM" | "PROFESSIONAL";

// ─── P0 · Sub-score match (GET /recommendations/by-job) ─────────────────────
export interface JobMatchSubScores {
  skills: number;
  experience: number;
  location: number;
  salary: number;
  culture: number;
}

export interface JobMatch {
  externalId: string;
  source: JobSource;
  /** 0–100 overall match. */
  overall: number;
  subScores: JobMatchSubScores;
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
  /** null on FREE tier (gaps only); populated for PREMIUM+. */
  learningPath: LearningPath | null;
}

export interface SkillGapReport {
  jobExternalId: string;
  source: JobSource;
  gaps: SkillGap[];
}
