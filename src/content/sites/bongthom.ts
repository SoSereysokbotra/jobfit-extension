import type { SiteAdapter } from "./types";
import { readText } from "./jsonld";

/**
 * BongThom adapter — Cambodia's long-running job announcements board.
 *
 * NO JSON-LD (verified 2026-08-13 against two live postings), so every field is a
 * selector. The pages are server-rendered plain HTML, which at least means the content
 * is present the moment the script runs — no waiting for a framework to paint.
 *
 * Structure confirmed on:
 *   /job_detail/entrepreneurship_ecosystem_specialist_an_40985.html
 *   /job_detail/primary_english_teacher_40962.html
 */

/** `/job_detail/primary_english_teacher_40962.html` → `40962`. */
const JOB_ID_RE = /\/job_detail\/.*?_(\d+)\.html/;

const TITLE_SELECTORS = ["h1.title", "#job-detail h1", "h1"];

/** The company is a link into the company profile, labelled "with <Company>". */
const COMPANY_SELECTORS = ['a[href*="company_detail"]'];

const DESCRIPTION_SELECTORS = [
  "#job-detail",
  ".ql-editor",
  ".pos-details-english",
];

function firstMatch(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

export const bongthom: SiteAdapter = {
  source: "bongthom",

  getExternalId(url: string): string | null {
    try {
      return new URL(url).pathname.match(JOB_ID_RE)?.[1] ?? null;
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
    return firstMatch(TITLE_SELECTORS)?.textContent?.replace(/\s+/g, " ").trim() || null;
  },

  getCompany(): string | null {
    const raw = firstMatch(COMPANY_SELECTORS)?.textContent?.replace(/\s+/g, " ").trim();
    if (!raw) return null;
    // The link reads "with Khmer Enterprise" — the preposition is page furniture, and
    // sending it would have the backend look up a company called "with Khmer Enterprise".
    return raw.replace(/^with\s+/i, "").trim() || null;
  },

  getLocation(): string | null {
    // No dedicated element: the page prints "Location: Phnom Penh" inside a details
    // block. Read the label rather than guess at a container that may be renamed.
    const body = document.body?.innerText ?? "";
    const match = body.match(/Location:\s*([^\n]{2,60})/i);
    return match?.[1]?.replace(/\s+/g, " ").trim() || null;
  },

  getDescription(): string | null {
    // innerText keeps the posting's line breaks (the extractor reads bullets much
    // better than one run-on paragraph); textContent is the fallback where innerText
    // is unavailable, which is also what makes this testable outside a browser.
    const raw = readText(firstMatch(DESCRIPTION_SELECTORS));
    if (!raw) return null;
    const cleaned = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (cleaned.length < 80) return null;
    return cleaned.slice(0, 8000);
  },
};
