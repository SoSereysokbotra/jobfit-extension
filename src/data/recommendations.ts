import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { JobMatch, JobSource } from "@/shared/types";

/**
 * GET /recommendations/by-job — see docs/CONTRACTS.md.
 *
 * The backend scores the job AD HOC: our DB never contains LinkedIn postings
 * (ingestion is TheMuse-only and scraping listings is forbidden), so a lookup by
 * externalId would always miss. Instead we send identifiers only — title,
 * company, location — and the backend scores them against the user's profile
 * using the same scorers as the web app. The posting body is never sent.
 *
 * 204/null → no profile to match against → the UI shows its empty state.
 */

export interface JobMatchInput {
  externalId: string;
  source: JobSource;
  title: string | null;
  company: string | null;
  location: string | null;
}

async function mock(input: JobMatchInput): Promise<JobMatch | null> {
  await mockDelay();
  const h = hashString(`${input.source}:${input.externalId}`);
  const subScores = {
    skills: scaled(h, 60, 95),
    experience: scaled(h >> 2, 55, 98),
    location: scaled(h >> 4, 50, 100),
    salary: scaled(h >> 6, 45, 92),
    other: scaled(h >> 8, 58, 96),
  };
  // Same weighting the backend applies, so mock and real look consistent.
  const overall = Math.round(
    subScores.skills * 0.4 +
      subScores.experience * 0.25 +
      subScores.location * 0.15 +
      subScores.salary * 0.1 +
      subScores.other * 0.1,
  );
  return {
    externalId: input.externalId,
    source: input.source,
    overall,
    subScores,
    semantic: true,
  };
}

function real(input: JobMatchInput): Promise<JobMatch | null> {
  // `title` is required by the endpoint; without it there is nothing to score.
  if (!input.title) return Promise.resolve(null);
  return api.get<JobMatch | null>("/recommendations/by-job", {
    query: {
      externalId: input.externalId,
      source: input.source,
      title: input.title,
      company: input.company,
      location: input.location,
    },
  });
}

export function getRecommendationByJob(input: JobMatchInput): Promise<JobMatch | null> {
  return DATA_SOURCE.recommendations === "mock" ? mock(input) : real(input);
}
