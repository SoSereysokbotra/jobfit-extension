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
    // Deterministically null for one job in four, so a dev build actually exercises the
    // "not computed" row. The backend returns null whenever a place could not be
    // resolved on either side, and a mock that never produced one would let that state
    // ship untested.
    location: h % 4 === 0 ? null : scaled(h >> 4, 30, 100),
    salary: scaled(h >> 6, 45, 92),
  };
  // Same weighting AND the same null handling the backend applies (blendMeasured):
  // an unmeasured component is dropped and the rest rescaled, never scored as neutral.
  const parts: Array<[number | null, number]> = [
    [subScores.skills, 0.4],
    [subScores.experience, 0.25],
    [subScores.location, 0.15],
    [subScores.salary, 0.1],
  ];
  let weighted = 0;
  let weight = 0;
  for (const [value, w] of parts) {
    if (value === null) continue;
    weighted += value * w;
    weight += w;
  }
  const overall = Math.round(weighted / weight);
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
