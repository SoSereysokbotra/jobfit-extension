import { api } from "@/background/api";
import { DATA_SOURCE, hashString, isSafeToShow, mockDelay, scaled } from "./source";
import type { JobDeadline, JobSource, UpcomingDeadline } from "@/shared/types";

/**
 * Saved-job deadline data. No backend endpoint exists yet, so both are mocked.
 * `getJobDeadline` powers the "⏰ Closes in Nd" chip; `getUpcomingDeadlines`
 * feeds the notification alarm (Phase 7).
 *
 * A DEADLINE IS NOT AN ORDINARY MOCK. Every other fixture here shows the user
 * something inert; an invented closing date makes them rush or abandon a real
 * application. So while `DATA_SOURCE.deadlines` is "mock", these return EMPTY
 * in release builds (`isSafeToShow`) and the callers hide the UI entirely. The
 * fixtures still work in dev, where they render behind a "sample" label.
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
  // Release build + no endpoint = no deadline. Not an error: the job genuinely
  // has no deadline we can vouch for, and the chip renders nothing for null.
  if (!isSafeToShow("deadlines")) {
    return Promise.resolve({ externalId, source, deadline: null });
  }
  return DATA_SOURCE.deadlines === "mock"
    ? mockDeadline(externalId, source)
    : realDeadline(externalId, source);
}

/** Saved jobs whose deadline is within `withinHours` — for the notification alarm. */
export async function getUpcomingDeadlines(withinHours = 72): Promise<UpcomingDeadline[]> {
  if (!isSafeToShow("deadlines")) return [];
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
      url: "https://www.linkedin.com/jobs/view/3901234567",
    },
  ];
}
