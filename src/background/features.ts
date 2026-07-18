/**
 * Feature handlers — turn a data adapter (mock or real) into the standard
 * `DataResult` the UI consumes: `ok | empty | unauthenticated | error`.
 * The worker is the only place network + auth errors are interpreted.
 */
import { ApiError } from "./api";
import { getRecommendationByJob } from "@/data/recommendations";
import { getCompanyByName } from "@/data/companies";
import { getSkillGap } from "@/data/learning";
import { getTier } from "@/data/tier";
import type { DataResult } from "@/shared/messaging";
import type {
  CompanyIntel,
  JobMatch,
  JobSource,
  SkillGapReport,
  SubscriptionTier,
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

export function getJobMatch(
  externalId: string,
  source: JobSource,
): Promise<DataResult<JobMatch>> {
  return toResult(() => getRecommendationByJob(externalId, source));
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

export function getSubscriptionTier(): Promise<SubscriptionTier> {
  return getTier();
}
