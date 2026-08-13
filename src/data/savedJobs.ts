import { api } from "@/background/api";
import { DATA_SOURCE, mockDelay } from "./source";
import type { JobSource, SavedJob, SaveJobInput } from "@/shared/types";

/**
 * POST /saved-jobs/external — the badge's "Save Job" form. See docs/CONTRACTS.md.
 *
 * PRIVACY: this sends the posting text, like the match report does. The same
 * reasoning applies and no more: it is read on the user's click, it is what THEY
 * chose to save, and it lands on their own row as a bookmark. Re-saving updates
 * that row instead of making a duplicate.
 *
 * NOT the web app's `/saved-jobs`, which keys on an internal `jobId` a LinkedIn
 * posting will never have.
 */
async function mockSave(input: SaveJobInput): Promise<SavedJob> {
  await mockDelay(700);
  return {
    id: "mock-saved-job",
    source: input.source,
    externalId: input.externalId,
    title: input.title,
    company: input.company,
    description: input.description,
    url: input.url,
    salary: input.salary,
    notes: input.notes,
    savedAt: new Date().toISOString(),
  };
}

function realSave(input: SaveJobInput): Promise<SavedJob | null> {
  return api.post<SavedJob | null>("/saved-jobs/external", input);
}

export function saveJob(input: SaveJobInput): Promise<SavedJob | null> {
  return DATA_SOURCE.savedJobs === "mock" ? mockSave(input) : realSave(input);
}

/**
 * GET /saved-jobs/external/lookup — the saved copy of this posting, or null.
 * Lets the form open as "Saved" with what the user typed last time, rather than
 * silently overwriting it.
 */
export function getSavedJob(
  externalId: string,
  source: JobSource,
): Promise<SavedJob | null> {
  if (DATA_SOURCE.savedJobs === "mock") return Promise.resolve(null);
  return api.get<SavedJob | null>("/saved-jobs/external/lookup", {
    query: { source, externalId },
  });
}
