import type { SiteAdapter } from "./types";
import { readText } from "./jsonld";
import { cleanDescription, findFirstWithSelector, type Extraction } from "./extraction";

/**
 * CamHR adapter (camhr.com).
 *
 * THE HARDEST OF THE FIVE, and worth writing down why. Measured 2026-08-25 on
 * /a/job/10666812:
 *
 *  - No JSON-LD at all.
 *  - The served HTML contains NO job content — it is a Nuxt shell whose <title> is
 *    literally "CamHR" and whose og:title is the site's generic strapline. The posting
 *    arrives by XHR after load.
 *  - `window.__NUXT__` IS plain JSON (not the usual wrapped function), but the job is not
 *    in it — and a content script runs in an isolated world, so page variables are
 *    unreachable from here regardless.
 *
 * So the selectors below could not be read off a rendered page the way BongThom's were.
 * They come from CamHR's OWN STYLESHEET, which is server-rendered and therefore visible:
 * the rules define
 *
 *   .job-header-content .job-title-content .job-name .job-name-span
 *   .job-main-container .job-maininfo .job-descript .descript-title/.descript-list
 *   .job-company .compnay-name
 *
 * That is evidence about the DOM their app builds, not a guess at it — but it is still
 * one step removed from a rendered page, so every lookup tolerates a miss and the user
 * sees the extracted text (with its provenance) before anything is sent.
 *
 * `.compnay-name` IS SPELLED THAT WAY IN THEIR CSS. Do not "fix" it — correcting their
 * typo would simply stop matching.
 */

/** `/a/job/10666812` → `10666812`. */
const JOB_ID_RE = /\/a\/job\/(\d+)/;

const TITLE_SELECTORS = [
  ".job-title-content .job-name .job-name-span",
  ".job-title-content .job-name",
  ".job-name-span",
  ".job-name",
];

const COMPANY_SELECTORS = [".job-company .compnay-name", ".job-company .company-name"];

const DESCRIPTION_SELECTORS = [
  ".job-maininfo .job-descript",
  ".job-descript",
  ".descript-list",
  ".job-main-container .job-maininfo",
];

const MIN_DESCRIPTION = 80;
const MAX_DESCRIPTION = 8000;

export const camhr: SiteAdapter = {
  source: "camhr",

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
    // Null until their XHR has painted the title — the observer retries, so a slow
    // response just delays the badge rather than losing it.
    return findFirstWithSelector(TITLE_SELECTORS)?.el ?? null;
  },

  getTitle(): string | null {
    const el = findFirstWithSelector(TITLE_SELECTORS)?.el ?? null;
    return readText(el)?.replace(/\s+/g, " ") ?? null;
  },

  getCompany(): string | null {
    const el = findFirstWithSelector(COMPANY_SELECTORS)?.el ?? null;
    return readText(el)?.replace(/\s+/g, " ") ?? null;
  },

  getLocation(): string | null {
    // DELIBERATELY NULL. Their `.job-demand` block holds the header's tag row, but the
    // stylesheet does not say whether that row is location, experience, employment type
    // or all three — and sending "3 years experience" as a location would quietly
    // corrupt the location sub-score. Null costs a neutral score; a wrong value costs a
    // wrong answer. Fill this in once someone reads a rendered page.
    return null;
  },

  getDescription(): Extraction | null {
    const found = findFirstWithSelector(DESCRIPTION_SELECTORS);
    const raw = found ? readText(found.el) : null;
    if (!raw || !found) return null;
    const text = cleanDescription(raw, MAX_DESCRIPTION);
    if (text.length < MIN_DESCRIPTION) return null;
    return { text, strategy: "selector", via: found.selector };
  },
};
