/**
 * Per-endpoint data-source flags. The P0 backend endpoints don't exist yet, so
 * every feature runs against a MOCK that matches the contract in
 * `docs/CONTRACTS.md`. When a real endpoint lands, flip ONLY its flag to "real"
 * — no UI or messaging change required.
 */
export type Source = "mock" | "real";

export const DATA_SOURCE: {
  recommendations: Source;
  companies: Source;
  learningGap: Source;
  applications: Source;
  salary: Source;
  deadlines: Source;
  coverLetter: Source;
  scout: Source;
  duplicates: Source;
  interview: Source;
  momentum: Source;
  matchReport: Source;
  savedJobs: Source;
} = {
  // GET /recommendations/by-job — REAL. Verified against jobfit-backend
  // (matching.controller `@Get('by-job')`): query + response + 204→empty match the
  // adapter, and it's not premium-gated. Requires auth (cookie SSO) + a readable
  // page title. Needs the backend running at VITE_API_URL; falls back to the
  // badge's empty/error/login states otherwise.
  recommendations: "real",
  // GET /companies/by-name — REAL (route built 2026-08-10). Returns Glassdoor
  // rating + open-role count + derived hiring velocity; fundingStage/salaryRange
  // are null and topMatches [] until those joins exist (sidebar renders each field
  // conditionally). Not-found → data:null → empty state.
  companies: "real",
  // GET /learning/gap — REAL (route built 2026-08-10). Field-aware: gaps are
  // scoped to PUBLISHED jobs SIMILAR to the viewed role (by title, seniority words
  // dropped), excluding skills the user already has. learningPath is null (no
  // LearningPath table). No skills/title/similar roles → empty.
  learningGap: "real",
  // `applications` uses the REAL, existing endpoint by default (GET /applications
  // + GET /jobs/{id}). Flip to "mock" to preview the tracker UI without a backend.
  applications: "real",
  // GET /salary — REAL (route built 2026-08-10). P25/P50/P75 derived from
  // PUBLISHED postings at the company (role-filtered w/ company-wide fallback).
  // listed=null, fitPercentile defaults P50 until per-user salary is wired.
  // No salary postings → data:null → empty state.
  salary: "real",
  deadlines: "mock", // saved-jobs deadline (endpoint not built yet)
  // POST /generate/cover-letter — REAL (ungated extension route built 2026-08-10).
  // Composed from résumé + job title/company; AI when available, template fallback.
  coverLetter: "real",
  // GET /recommendations/scout — REAL (route built 2026-08-10). Returns the user's
  // recommendations at/above minScore (optionally newer than `since`), mapped to
  // ScoutMatch. Internal jobs link to the web app; ingested jobs to their apply URL.
  scout: "real",
  // GET /applications/similar — REAL (route built 2026-08-10). Matches the user's
  // prior applications by company (exact, case-insensitive) + title (contains).
  // No prior application → data:null → the warning stays hidden.
  duplicates: "real",
  // POST /generate/interview-prep — REAL (ungated extension route built 2026-08-10).
  // Questions from the job title; AI when available, static-question fallback.
  interview: "real",
  // `momentum` uses the REAL, existing endpoint (GET /analytics/my-stats).
  // Flip to "mock" to preview the widget without a backend.
  momentum: "real",
  // POST /match-report — REAL (route built 2026-08-12). Composes résumé ATS/quality
  // scores + the external match + AI-extracted requirements matched against the
  // résumé, stores the payload and returns its id; the web app renders it at
  // {WEB_APP_URL}/match-report/{id}. Ungated. Flip to "mock" to exercise the
  // button's loading/error states without a backend (it returns a dead id).
  matchReport: "real",
  // POST/GET /saved-jobs/external — REAL (routes built 2026-08-13). The badge's
  // "Save Job" form: company, title, description, URL, salary, notes, stored on
  // the user's own row. Separate from the web app's /saved-jobs, which keys on an
  // internal jobId a LinkedIn posting will never have. Ungated.
  savedJobs: "real",
};

/** Shared helpers for mock adapters. */
export const mockDelay = (ms = 450): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Stable 32-bit hash so mock data is deterministic per job/company. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Map a seed into an inclusive [lo, hi] integer range. */
export function scaled(seed: number, lo: number, hi: number): number {
  return lo + (seed % (hi - lo + 1));
}
