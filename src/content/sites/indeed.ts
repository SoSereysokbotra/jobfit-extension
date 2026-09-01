import type { SiteAdapter } from "./types";
import { readJobPosting, readText, type PostedSalary } from "./jsonld";
import { cleanDescription, findFirstWithSelector, type Extraction } from "./extraction";

/**
 * Indeed adapter.
 *
 * Two URL shapes, same as LinkedIn's split:
 *   - detail view: /viewjob?jk=<id>
 *   - split view:  /jobs?q=…&vjk=<id>   (the right-hand pane)
 *
 * Indeed publishes JSON-LD on job pages, so the text fields come from there first and
 * fall back to selectors. The selectors are the fragile half — Indeed ships DOM changes
 * often and uses generated class names — so every lookup is `data-testid` first (those
 * are far more stable than classes) and tolerates a miss.
 */

const TITLE_SELECTORS = [
  '[data-testid="jobsearch-JobInfoHeader-title"]',
  ".jobsearch-JobInfoHeader-title",
  "h2.jobsearch-JobInfoHeader-title",
  "h1.jobsearch-JobInfoHeader-title",
];

const COMPANY_SELECTORS = [
  '[data-testid="inlineHeader-companyName"]',
  '[data-company-name="true"]',
  ".jobsearch-CompanyInfoContainer a",
];

const LOCATION_SELECTORS = [
  '[data-testid="inlineHeader-companyLocation"]',
  '[data-testid="job-location"]',
  ".jobsearch-JobInfoHeader-subtitle div:last-child",
];

const DESCRIPTION_SELECTORS = ["#jobDescriptionText", ".jobsearch-JobComponent-description"];

function firstMatch(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

function text(selectors: string[]): string | null {
  return firstMatch(selectors)?.textContent?.replace(/\s+/g, " ").trim() || null;
}

export const indeed: SiteAdapter = {
  source: "indeed",

  getExternalId(url: string): string | null {
    try {
      const parsed = new URL(url);
      // `jk` on a detail page, `vjk` for the selected job in the split view.
      const id = parsed.searchParams.get("jk") ?? parsed.searchParams.get("vjk");
      return id && /^[A-Za-z0-9]+$/.test(id) ? id : null;
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
    return readJobPosting()?.title ?? text(TITLE_SELECTORS);
  },

  getCompany(): string | null {
    return readJobPosting()?.company ?? text(COMPANY_SELECTORS);
  },

  getLocation(): string | null {
    return readJobPosting()?.location ?? text(LOCATION_SELECTORS);
  },

  getDescription(): Extraction | null {
    // The rendered description first: it is what the user is actually looking at, and
    // Indeed's JSON-LD copy is sometimes truncated.
    //
    // innerText keeps the posting's line breaks (the extractor reads bullets much
    // better than one run-on paragraph); textContent is the fallback where innerText
    // is unavailable, which is also what makes this testable outside a browser.
    const found = findFirstWithSelector(DESCRIPTION_SELECTORS);
    const rendered = found ? readText(found.el)?.trim() : null;
    const raw = rendered || readJobPosting()?.description || null;
    if (!raw) return null;
    const text = cleanDescription(raw, 8000);
    if (text.length < 80) return null;
    // Report which of the two actually supplied the text, not which was tried.
    return rendered && found
      ? { text, strategy: "selector", via: found.selector }
      : { text, strategy: "json-ld", via: "JobPosting.description" };
  },

  /**
   * The posting's own stated requirement, when it publishes one. Language-proof:
   * a published 36 needs no reading of Khmer or English prose.
   */
  getRequiredMonths(): number | null {
    return readJobPosting()?.requiredMonths ?? null;
  },

  /** Advertised pay with its period, when the site publishes it. Displayed, not scored. */
  getSalary(): PostedSalary | null {
    return readJobPosting()?.salary ?? null;
  },
};
