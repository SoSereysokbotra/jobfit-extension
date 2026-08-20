import type { SiteAdapter } from "./types";
import { readJobPosting, readText } from "./jsonld";

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

  getDescription(): string | null {
    // The rendered description first: it is what the user is actually looking at, and
    // Indeed's JSON-LD copy is sometimes truncated.
    //
    // innerText keeps the posting's line breaks (the extractor reads bullets much
    // better than one run-on paragraph); textContent is the fallback where innerText
    // is unavailable, which is also what makes this testable outside a browser.
    const rendered = readText(firstMatch(DESCRIPTION_SELECTORS));
    const raw = rendered?.trim() || readJobPosting()?.description || null;
    if (!raw) return null;
    const cleaned = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (cleaned.length < 80) return null;
    return cleaned.slice(0, 8000);
  },
};
