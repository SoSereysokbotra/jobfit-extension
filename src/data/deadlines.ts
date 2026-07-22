import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { JobDeadline, JobSource, UpcomingDeadline } from "@/shared/types";

/**
 * Saved-job deadline data. No backend endpoint exists yet, so both are mocked.
 * `getJobDeadline` powers the "⏰ Closes in Nd" chip; `getUpcomingDeadlines`
 * feeds the notification alarm (Phase 7).
 */

async function mockDeadline(externalId: string, source: JobSource): Promise<JobDeadline> {
  await mockDelay(200);
  const h = hashString(`${source}:deadline:${externalId}`);
  // ~60% of jobs have a deadline; when present it's 1–14 days out.
  if (h % 5 < 2) return { externalId, source, deadline: null };
  const days = scaled(h, 1, 14);
  return {
    externalId,
    source,
    deadline: new Date(Date.now() + days * 86_400_000).toISOString(),
  };
}

function realDeadline(externalId: string, source: JobSource): Promise<JobDeadline> {
  return api.get<JobDeadline>("/saved-jobs/deadline", { query: { externalId, source } });
}

export function getJobDeadline(externalId: string, source: JobSource): Promise<JobDeadline> {
  return DATA_SOURCE.deadlines === "mock"
    ? mockDeadline(externalId, source)
    : realDeadline(externalId, source);
}

/** Saved jobs whose deadline is within `withinHours` — for the notification alarm. */
export async function getUpcomingDeadlines(withinHours = 72): Promise<UpcomingDeadline[]> {
  if (DATA_SOURCE.deadlines !== "mock") {
    return api.get<UpcomingDeadline[]>("/saved-jobs/upcoming-deadlines", {
      query: { withinHours },
    });
  }
  await mockDelay(150);
  // Deterministic sample: one saved job closing soon.
  return [
    {
      externalId: "3901234567",
      source: "linkedin",
      title: "Senior Backend @ Google",
      deadline: new Date(Date.now() + 46 * 3_600_000).toISOString(),
      matchScore: 87,
    },
  ];
}
