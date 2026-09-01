import { api } from "@/background/api";
import { DATA_SOURCE, mockDelay } from "./source";
import type { ExtractionProvenance, JobSource, MatchReportRef, PostedSalary } from "@/shared/types";

/**
 * POST /match-report — generate the full-page résumé↔job report the web app
 * renders at {WEB_APP_URL}/match-report/{id}. See docs/CONTRACTS.md.
 *
 * PRIVACY: unlike every other adapter here, this one sends the posting text.
 * That is the deliberate, user-initiated exception documented on
 * `SiteAdapter.getDescription` — it is read only on a click, SHOWN TO THE USER
 * for review before it leaves the page, sent once so the backend can extract
 * the job's requirements, and stored only as the derived report on the user's
 * own row. Nothing here caches or re-sends it.
 */
export interface MatchReportInput {
  externalId: string;
  source: JobSource;
  title: string;
  company: string | null;
  location: string | null;
  jobDescription: string;
  /** How the text was obtained — persisted with the report. */
  extraction: ExtractionProvenance;
  /** The posting's own published experience bar, in months, or null. */
  requiredMonths: number | null;
  /** Pay as advertised, with its period. Displayed in the report, never scored. */
  postedSalary: PostedSalary | null;
}

async function mock(_input: MatchReportInput): Promise<MatchReportRef> {
  // Long delay on purpose: the real route runs résumé scoring, a match and an
  // AI extraction, so a mock that returns instantly would hide the loading state
  // this button most needs to get right.
  await mockDelay(1800);
  return { id: "mock-report-id" };
}

function real(input: MatchReportInput): Promise<MatchReportRef | null> {
  return api.post<MatchReportRef | null>("/match-report", input);
}

export function createMatchReport(
  input: MatchReportInput,
): Promise<MatchReportRef | null> {
  return DATA_SOURCE.matchReport === "mock" ? mock(input) : real(input);
}
