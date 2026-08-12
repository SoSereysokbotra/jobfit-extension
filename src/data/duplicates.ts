import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { DuplicateMatch, JobSource } from "@/shared/types";

/**
 * GET /applications/similar — "Application Radar". Detects that the user likely
 * already applied to this role (fuzzy title + company, backend uses embeddings).
 * Returns null when there's no prior application. See docs/CONTRACTS.md.
 *
 * PRIVACY: only identifiers + display title/company are sent, never page content.
 */
export interface DuplicateInput {
  externalId: string;
  source: JobSource;
  title: string | null;
  company: string | null;
}

async function mock(input: DuplicateInput): Promise<DuplicateMatch | null> {
  await mockDelay(300);
  const h = hashString(`${input.source}:dup:${input.externalId}`);
  // ~1 in 4 jobs is flagged as a likely re-application, deterministically.
  if (h % 4 !== 0) return null;
  const daysAgo = scaled(h, 20, 90);
  return {
    applicationId: `app_${h % 100000}`,
    jobTitle: input.title?.trim() || "this role",
    companyName: input.company?.trim() || null,
    status: "SUBMITTED",
    appliedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

function real(input: DuplicateInput): Promise<DuplicateMatch | null> {
  return api.get<DuplicateMatch | null>("/applications/similar", {
    query: {
      externalId: input.externalId,
      source: input.source,
      jobTitle: input.title ?? "",
      companyName: input.company ?? "",
    },
  });
}

export function getDuplicateApplication(input: DuplicateInput): Promise<DuplicateMatch | null> {
  return DATA_SOURCE.duplicates === "mock" ? mock(input) : real(input);
}
