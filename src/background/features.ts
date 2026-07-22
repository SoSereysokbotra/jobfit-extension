/**
 * Feature handlers — turn a data adapter (mock or real) into the standard
 * `DataResult` the UI consumes: `ok | empty | unauthenticated | error`.
 * The worker is the only place network + auth errors are interpreted.
 */
import { ApiError } from "./api";
import { getRecommendationByJob, type JobMatchInput } from "@/data/recommendations";
import { getCompanyByName } from "@/data/companies";
import { getSkillGap } from "@/data/learning";
import { getApplications } from "@/data/applications";
import { getSalaryIntel } from "@/data/salary";
import { getJobDeadline } from "@/data/deadlines";
import { generateCoverLetter, type CoverLetterInput } from "@/data/generate";
import type { DataResult } from "@/shared/messaging";
import type {
  CompanyIntel,
  CoverLetter,
  JobDeadline,
  JobMatch,
  JobSource,
  SalaryIntel,
  SkillGapReport,
  TrackedApplication,
} from "@/shared/types";

/**
 * Wrap an adapter call. `null` → empty; 401/403 → unauthenticated; anything else
 * that throws → error. `isEmpty` lets a feature treat a non-null-but-empty
 * payload (e.g. an empty gaps array) as the empty state.
 */
async function toResult<T>(
  fn: () => Promise<T | null>,
  isEmpty?: (data: T) => boolean,
): Promise<DataResult<T>> {
  try {
    const data = await fn();
    if (data == null || (isEmpty && isEmpty(data))) return { status: "empty" };
    return { status: "ok", data };
  } catch (error) {
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      return { status: "unauthenticated" };
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export function getJobMatch(input: JobMatchInput): Promise<DataResult<JobMatch>> {
  return toResult(() => getRecommendationByJob(input));
}

export function getCompanyIntel(name: string): Promise<DataResult<CompanyIntel>> {
  return toResult(() => getCompanyByName(name));
}

export function getSkillGapReport(
  externalId: string,
  source: JobSource,
): Promise<DataResult<SkillGapReport>> {
  return toResult(
    () => getSkillGap(externalId, source),
    (report) => report.gaps.length === 0,
  );
}

export function getApplicationsPipeline(
  limit: number,
): Promise<DataResult<TrackedApplication[]>> {
  return toResult(
    () => getApplications(limit),
    (rows) => rows.length === 0,
  );
}

export function getSalary(
  company: string,
  role: string,
): Promise<DataResult<SalaryIntel>> {
  return toResult(() => getSalaryIntel(company, role));
}

export function generateCoverLetterFor(
  input: CoverLetterInput,
): Promise<DataResult<CoverLetter>> {
  return toResult(
    () => generateCoverLetter(input),
    // A model that returns nothing usable is an empty state, not a success.
    (letter) => letter.text.trim().length === 0,
  );
}

export function getDeadline(
  externalId: string,
  source: JobSource,
): Promise<DataResult<JobDeadline>> {
  // A job with no deadline is still a valid "ok" result (deadline: null); the UI
  // decides whether to render the chip.
  return toResult(() => getJobDeadline(externalId, source));
}
