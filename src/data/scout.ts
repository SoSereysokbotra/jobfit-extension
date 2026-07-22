import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { ScoutMatch } from "@/shared/types";

/**
 * GET /recommendations/scout — new jobs matching the user's profile above a
 * score threshold, for the passive background scout (Phase 11).
 * See docs/CONTRACTS.md.
 */

const MOCK_JOBS = [
  { externalId: "3928471056", title: "Senior Backend Engineer", company: "Wise" },
  { externalId: "3917740921", title: "Platform Engineer", company: "Grab" },
  { externalId: "3944012877", title: "Security Engineer", company: "Agoda" },
];

async function mock(minScore: number): Promise<ScoutMatch[]> {
  await mockDelay(250);
  return MOCK_JOBS.map((j) => {
    const h = hashString(j.externalId);
    return {
      externalId: j.externalId,
      source: "linkedin" as const,
      title: j.title,
      company: j.company,
      score: scaled(h, 78, 96),
      url: `https://www.linkedin.com/jobs/view/${j.externalId}`,
    };
  }).filter((m) => m.score >= minScore);
}

function real(minScore: number, since: string | null): Promise<ScoutMatch[]> {
  return api.get<ScoutMatch[]>("/recommendations/scout", {
    query: { minScore, since },
  });
}

export function getScoutMatches(
  minScore: number,
  since: string | null,
): Promise<ScoutMatch[]> {
  return DATA_SOURCE.scout === "mock" ? mock(minScore) : real(minScore, since);
}
