import type { SiteAdapter } from "./types";
import { findHeadingWithText, readJobPosting } from "./jsonld";

/**
 * JobNet Cambodia (jobnet.com.kh) — the country's main professional job board, and the
 * one the JobStreet search was really looking for (JobStreet has no Cambodian site).
 *
 * Every field comes from the page's JSON-LD, so this adapter is almost entirely the
 * shared reader. Two site-specific facts made it non-trivial (both measured 2026-08-13
 * on /job/content-creator/6243):
 *
 *  1. JobNet CAPITALISES its property names — `Title`, `Description`, `Name`/`Value`.
 *     A strict schema.org reader sees a posting with no title and no description while
 *     1,546 characters of real description sit in the blob. `jsonld.ts` reads property
 *     names case-insensitively because of this page.
 *  2. The page is CLIENT-RENDERED. The served HTML's only <h1> belongs to a hidden modal
 *     ("Reported successfully"), so a selector-based anchor would attach the badge to the
 *     wrong element. The anchor is found by matching the JSON-LD title against the
 *     page's headings instead — see findHeadingWithText.
 */

/** `/job/content-creator/6243` → `6243`. The slug is decorative; the trailing id is not. */
const JOB_ID_RE = /\/job\/[^/]+\/(\d+)/;

const MIN_DESCRIPTION = 80;
const MAX_DESCRIPTION = 8000;

export const jobnet: SiteAdapter = {
  source: "jobnet",

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
    const posting = readJobPosting();
    if (!posting) return null;
    // Match the published title to a heading; no class names are relied on.
    return findHeadingWithText(posting.title);
  },

  getTitle(): string | null {
    return readJobPosting()?.title ?? null;
  },

  getCompany(): string | null {
    return readJobPosting()?.company ?? null;
  },

  getLocation(): string | null {
    return readJobPosting()?.location ?? null;
  },

  getDescription(): string | null {
    const text = readJobPosting()?.description?.trim();
    if (!text || text.length < MIN_DESCRIPTION) return null;
    return text.slice(0, MAX_DESCRIPTION);
  },
};
