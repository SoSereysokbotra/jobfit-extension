/**
 * Site-adapter contract. Each supported job board implements this so all
 * site-specific DOM knowledge (which breaks when the site ships a redesign) is
 * isolated to one file and fails silently without breaking the host page.
 *
 * PRIVACY / TOS: adapters may read title/company text for LOCAL use only
 * (anchoring, labels). Only `externalId` + `source` may ever leave the page.
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

  /** Best-effort company name — LOCAL use only, never transmitted. */
  getCompany(): string | null;
}
