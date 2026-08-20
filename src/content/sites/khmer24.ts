import type { SiteAdapter } from "./types";
import { findHeadingWithText, readJobPosting, readText } from "./jsonld";

/**
 * Khmer24 adapter — Cambodia's biggest classifieds site, jobs included.
 *
 * Almost everything comes from the page's own JSON-LD (see jsonld.ts), which Khmer24
 * publishes unusually well: title, company, full address, salary WITH currency and
 * period, and `monthsOfExperience`. That is better data than LinkedIn gives us.
 *
 * THE CLASSIFIEDS PROBLEM: cars, phones and jobs all live at the same URL shape
 * (`/en/<slug>-adid-<id>`), so the id alone cannot tell us this is a job. Only job ads
 * carry a `JobPosting`, so the badge anchors only when one is present — no JobFit chip
 * on a motorbike listing.
 */

/** `/en/sale-officer-adid-13775799` → `13775799`. Also matches the `/km/` locale. */
const AD_ID_RE = /-adid-(\d+)/;

const TITLE_SELECTORS = ["h1.title", ".detail-title h1", "h1"];

/**
 * Where the ad body is drawn. Khmer24 renders it client-side, so these could not be
 * confirmed from the served HTML the way the JSON-LD could — they are ordered
 * most-specific first and every one is allowed to miss. If all of them do, the JSON-LD
 * description stands, and if that is thin too the Full Report says it could not read the
 * posting rather than reporting on a headline.
 */
const DESCRIPTION_SELECTORS = [
  '[itemprop="description"]',
  "#description",
  ".ad-description",
  ".description",
  ".detail-description",
];

/** Below this there is nothing for the requirement extractor to work with. */
const MIN_DESCRIPTION = 80;
const MAX_DESCRIPTION = 8000;

function firstMatch(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/**
 * The longest paragraph on the page, when it is long enough to be a job description.
 *
 * MEASURED NEED (2026-08-13): Khmer24 renders the ad body in
 * `<p class="text-base/8 whitespace-break-spaces wrap-break-word …">` — Tailwind utility
 * classes only, with no id, no semantic hook and nothing stable to select on. Those class
 * names change whenever they restyle, so selecting on them would break silently and
 * report "we could not read this posting" on a page that plainly shows one.
 *
 * A job description is the longest prose block on its own page — measured 2,135
 * characters here against ~300 for the "Safety Tips for Buyers" list, which is the only
 * competing block and is a <ul>, not a <p>. So the longest <p> is a more durable rule
 * than any selector, and the length floor keeps it from ever picking up a caption.
 */
function longestParagraph(minChars: number): string | null {
  let best = "";
  for (const paragraph of document.querySelectorAll<HTMLElement>("p")) {
    const text = (paragraph.innerText ?? paragraph.textContent ?? "").trim();
    if (text.length > best.length) best = text;
  }
  return best.length >= minChars ? best : null;
}

export const khmer24: SiteAdapter = {
  source: "khmer24",

  getExternalId(url: string): string | null {
    try {
      return new URL(url).pathname.match(AD_ID_RE)?.[1] ?? null;
    } catch {
      return null;
    }
  },

  isJobUrl(url: string): boolean {
    // True for ANY ad; whether it is a JOB is decided by getTitleAnchor, which is the
    // only place that can see the page's JobPosting.
    return this.getExternalId(url) !== null;
  },

  getTitleAnchor(): HTMLElement | null {
    // The gate for the whole site: no JobPosting means this is a phone, not a job.
    const posting = readJobPosting();
    if (!posting) return null;

    // Match the published title to the element showing it. Measured 2026-08-13: a live
    // job page carries THREE <h1>s — the job title, plus "Congratulations!" and "Select
    // Location on Map" from hidden dialogs — so `querySelector("h1")` is a bet on the
    // job's staying first in document order. Selectors are the fallback, not the rule.
    return findHeadingWithText(posting.title) ?? firstMatch(TITLE_SELECTORS);
  },

  getTitle(): string | null {
    return (
      readJobPosting()?.title ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
      null
    );
  },

  getCompany(): string | null {
    return readJobPosting()?.company ?? null;
  },

  getLocation(): string | null {
    return readJobPosting()?.location ?? null;
  },

  getDescription(): string | null {
    // The JSON-LD `description` is authoritative when it carries the real body, but on
    // Khmer24 it is sometimes just the headline repeated — measured 12 characters on a
    // live ad. So take it only when it is substantial, and read the rendered ad
    // otherwise. (The rendered body is drawn by their JavaScript, so it exists in the
    // browser even though it is absent from the served HTML.)
    const fromLd = readJobPosting()?.description?.trim() ?? "";
    if (fromLd.length >= MIN_DESCRIPTION) return fromLd.slice(0, MAX_DESCRIPTION);

    const rendered =
      readText(firstMatch(DESCRIPTION_SELECTORS)) ??
      longestParagraph(MIN_DESCRIPTION) ??
      "";
    const best = rendered.length > fromLd.length ? rendered : fromLd;
    if (best.length < MIN_DESCRIPTION) return null;

    return best.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_DESCRIPTION);
  },
};
