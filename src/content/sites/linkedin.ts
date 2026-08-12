import type { SiteAdapter } from "./types";

/**
 * LinkedIn adapter. Two job-page URL shapes exist:
 *   - detail view:  /jobs/view/<id>/
 *   - split view:   /jobs/search/?currentJobId=<id>  (also /jobs/collections/...)
 *
 * All selectors are best-effort with fallbacks; LinkedIn ships class-name
 * redesigns often, so every lookup tolerates misses and the caller fails silently.
 */

const VIEW_ID_RE = /\/jobs\/view\/(\d+)/;

/** Return the first element matching any selector, as an HTMLElement. */
function firstMatch(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

const TITLE_SELECTORS = [
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
  ".jobs-details-top-card__job-title",
  "h1.t-24",
];

const COMPANY_SELECTORS = [
  ".job-details-jobs-unified-top-card__company-name",
  ".jobs-unified-top-card__company-name",
  ".jobs-details-top-card__company-url",
];

/**
 * The "About the job" body. LinkedIn has shipped several containers for it, and
 * the outermost (`.jobs-description`) also swallows the "See more" control and
 * the skills-match widget — so the inner content nodes are tried first.
 */
const DESCRIPTION_SELECTORS = [
  ".jobs-description-content__text--stretch",
  ".jobs-description__content .jobs-box__html-content",
  ".jobs-description-content__text",
  "#job-details",
  ".jobs-box__html-content",
  ".jobs-description",
];

/**
 * Upper bound on the description we send.
 *
 * Requirement extraction reads the top of a posting; the tail is benefits, EEO
 * boilerplate and "how to apply", none of which is a requirement. 8k characters
 * covers a long posting in full while keeping the request (and the model's
 * context) bounded — the backend caps it again independently.
 */
const MAX_DESCRIPTION_CHARS = 8000;

/** The description line reads "Phnom Penh, Cambodia · Reposted 2 weeks ago · 28 applicants". */
const LOCATION_SELECTORS = [
  ".job-details-jobs-unified-top-card__primary-description-container",
  ".jobs-unified-top-card__primary-description",
  ".job-details-jobs-unified-top-card__tertiary-description-container",
  ".jobs-unified-top-card__subtitle-primary-grouping",
];

export const linkedin: SiteAdapter = {
  source: "linkedin",

  getExternalId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const fromPath = parsed.pathname.match(VIEW_ID_RE)?.[1];
      if (fromPath) return fromPath;
      const fromQuery = parsed.searchParams.get("currentJobId");
      if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
      return null;
    } catch {
      return null;
    }
  },

  isJobUrl(url: string): boolean {
    return this.getExternalId(url) !== null;
  },

  getTitleAnchor(): HTMLElement | null {
    return firstMatch(TITLE_SELECTORS);
  },

  getTitle(): string | null {
    return firstMatch(TITLE_SELECTORS)?.textContent?.trim() || null;
  },

  getCompany(): string | null {
    return firstMatch(COMPANY_SELECTORS)?.textContent?.trim() || null;
  },

  getLocation(): string | null {
    const text = firstMatch(LOCATION_SELECTORS)?.textContent;
    if (!text) return null;
    // Keep only the leading location segment, dropping "· Reposted 2 weeks ago
    // · 28 applicants". LinkedIn uses "·" (and sometimes "•") as the separator.
    const location = text.split(/[·•]/)[0]?.replace(/\s+/g, " ").trim();
    return location || null;
  },

  getDescription(): string | null {
    // `innerText` (not textContent) so LinkedIn's <li>/<br> layout keeps its line
    // breaks — the requirement extractor reads a bulleted list far better than one
    // run-on paragraph, and textContent would glue every bullet together.
    const text = firstMatch(DESCRIPTION_SELECTORS)?.innerText;
    if (!text) return null;
    const cleaned = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // A stub like "About the job" alone means the panel hasn't loaded its body yet;
    // sending it would produce a report with no requirements in it.
    if (cleaned.length < 80) return null;
    return cleaned.slice(0, MAX_DESCRIPTION_CHARS);
  },
};
