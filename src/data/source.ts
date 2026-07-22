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
} = {
  // GET /recommendations/by-job — the endpoint IS implemented in jobfit-backend,
  // but flip this to "real" only AFTER that backend is deployed, or every job
  // page will show an error instead of a score.
  recommendations: "mock",
  companies: "mock", // GET /companies/by-name
  learningGap: "mock", // GET /learning/gap
  // `applications` uses the REAL, existing endpoint by default (GET /applications
  // + GET /jobs/{id}). Flip to "mock" to preview the tracker UI without a backend.
  applications: "real",
  salary: "mock", // GET /salary (endpoint not built yet)
  deadlines: "mock", // saved-jobs deadline (endpoint not built yet)
  coverLetter: "mock", // POST /generate/cover-letter (Qwen 3 — planned)
  scout: "mock", // GET /recommendations/scout (endpoint not built yet)
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
