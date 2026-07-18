import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { JobMatch, JobSource } from "@/shared/types";

/** GET /recommendations/by-job — see docs/CONTRACTS.md. Returns null = no match. */

async function mock(externalId: string, source: JobSource): Promise<JobMatch | null> {
  await mockDelay();
  const h = hashString(`${source}:${externalId}`);
  const subScores = {
    skills: scaled(h, 60, 95),
    experience: scaled(h >> 2, 55, 98),
    location: scaled(h >> 4, 50, 100),
    salary: scaled(h >> 6, 45, 92),
    culture: scaled(h >> 8, 58, 96),
  };
  const overall = Math.round(
    (subScores.skills +
      subScores.experience +
      subScores.location +
      subScores.salary +
      subScores.culture) /
      5,
  );
  return { externalId, source, overall, subScores };
}

function real(externalId: string, source: JobSource): Promise<JobMatch | null> {
  return api.get<JobMatch | null>("/recommendations/by-job", {
    query: { externalId, source },
  });
}

export function getRecommendationByJob(
  externalId: string,
  source: JobSource,
): Promise<JobMatch | null> {
  return DATA_SOURCE.recommendations === "mock"
    ? mock(externalId, source)
    : real(externalId, source);
}
