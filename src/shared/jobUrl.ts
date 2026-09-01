/**
 * Where a job posting lives, given only `(source, externalId)`.
 *
 * WHY THIS EXISTS: the deadline alarm used to build a LinkedIn URL for every
 * notification regardless of `source`, so a JobNet reminder opened LinkedIn's
 * 404 page. A notification that navigates to the wrong site is worse than one
 * that doesn't navigate at all — it destroys trust in the reminder itself.
 *
 * The honest constraint: only LinkedIn and Indeed put the whole address in the
 * id. Khmer24 (`/en/<slug>-adid-<id>`), BongThom
 * (`/job_detail/<slug>_<id>.html`) and JobNet (`/job/<slug>/<id>`) all need the
 * slug, which an id alone cannot recover. CamHR is the exception among the
 * Cambodian boards: `/a/job/<id>` has no slug, so it rebuilds cleanly. For those this returns null RATHER
 * THAN GUESSING, and the caller falls back to something correct by construction
 * (the saved job's own stored URL, or the web app). Never invent a URL.
 */
import type { JobSource } from "./types";
import { WEB_APP_URL } from "./config";

/** The posting's canonical URL, or null when the id alone cannot address it. */
export function jobUrlFromId(source: JobSource, externalId: string): string | null {
  const id = encodeURIComponent(externalId);
  switch (source) {
    case "linkedin":
      return `https://www.linkedin.com/jobs/view/${id}`;
    case "indeed":
      return `https://www.indeed.com/viewjob?jk=${id}`;
    // CamHR's path carries no slug — /a/job/10666812 addresses the posting on its own.
    case "camhr":
      return `https://www.camhr.com/a/job/${id}`;
    // Slug-bearing paths: not reconstructible from the id. See the note above.
    case "khmer24":
    case "bongthom":
    case "jobnet":
      return null;
    default: {
      // A new JobSource must decide explicitly; failing closed is the safe half.
      const _never: never = source;
      return _never;
    }
  }
}

/**
 * Best available destination for a saved-job notification, in descending order
 * of trustworthiness:
 *   1. the URL captured when the user saved the job (always right),
 *   2. one rebuilt from the id, where the source allows it,
 *   3. the user's saved-jobs list on the web app — not the posting, but never
 *      the WRONG posting.
 */
export function savedJobUrl(
  source: JobSource,
  externalId: string,
  storedUrl?: string | null,
): string {
  if (storedUrl) return storedUrl;
  return jobUrlFromId(source, externalId) ?? `${WEB_APP_URL}/saved-jobs`;
}
