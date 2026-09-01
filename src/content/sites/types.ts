import type { Extraction } from "./extraction";
import type { PostedSalary } from "./jsonld";

/**
 * Site-adapter contract. Each supported job board implements this so all
 * site-specific DOM knowledge (which breaks when the site ships a redesign) is
 * isolated to one file and fails silently without breaking the host page.
 *
 * PRIVACY / TOS: adapters may read title/company text for LOCAL use only
 * (anchoring, labels). Only `externalId` + `source` may ever leave the page —
 * with ONE deliberate, user-initiated exception, `getDescription()`; see there.
 */
export interface SiteAdapter {
  /** Stable identifier sent to the backend alongside externalId, e.g. "linkedin". */
  readonly source: string;

  /** True if this URL is a job-detail view we should annotate. */
  isJobUrl(url: string): boolean;

  /** The external job id from the URL (never scraped from the DOM), or null. */
  getExternalId(url: string): string | null;

  /**
   * The element to anchor the JobFit chip beside (the job title). Returns null
   * when the page hasn't rendered it yet — the caller retries via the observer.
   */
  getTitleAnchor(): HTMLElement | null;

  /** Best-effort job title text — LOCAL use only, never transmitted. */
  getTitle(): string | null;

  /** Best-effort company name — sent as an identifier only. */
  getCompany(): string | null;

  /** Best-effort location text, e.g. "Phnom Penh, Cambodia". Improves the
   *  location sub-score; null when it can't be read. */
  getLocation(): string | null;

  /**
   * The visible "About the job" text WITH ITS PROVENANCE, or null when it isn't
   * on the page.
   *
   * THE ONE EXCEPTION to "only identifiers leave the page", and it is narrow on
   * purpose: read only when the user clicks *Full Report*, sent once so the
   * backend can extract the job's requirements, and never stored as a listing —
   * only the derived report is kept, on that user's own row. Nothing calls this
   * on page load, and no background job calls it at all.
   *
   * It returns an `Extraction`, not a bare string, because every implementation
   * here ends in a fallback and a wrong-but-long block of text is otherwise
   * indistinguishable from a real posting. Reporting HOW the text was found
   * lets the UI show the user what is about to be sent. See extraction.ts.
   */
  getDescription(): Extraction | null;

  /**
   * Months of experience the posting REQUIRES, when the site publishes it as a
   * number rather than burying it in prose.
   *
   * Optional: only sites with structured job data can answer it, and a site that
   * cannot simply omits the method. The match report prefers this over reading
   * "3 years" out of the description, because a published number is unambiguous
   * in any language — which is what makes the experience check work on a Khmer
   * advert. See docs/MULTI_SITE_PLAN.md.
   */
  getRequiredMonths?(): number | null;

  /**
   * The pay the posting advertises, with its period, when the site publishes it as
   * structured data. Optional for the same reason as getRequiredMonths.
   *
   * Displayed, NOT scored: the candidate's expected salary is stored without a period,
   * so comparing a monthly advert against it would require assuming a unit the profile
   * never captured. See the report's `job.salary`.
   */
  getSalary?(): PostedSalary | null;
}
