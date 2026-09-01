/**
 * What we extracted, how we found it, and whether it looks like a job advert.
 *
 * WHY THIS EXISTS: every adapter's `getDescription` is best-effort and ends in a
 * fallback — a broad container, the JSON-LD blob, or on Khmer24 literally the
 * longest paragraph on the page. Those fallbacks fail SOFTLY, which is right,
 * but soft failure has a failure mode of its own: a wrong block of text that
 * happens to clear the 80-character floor is indistinguishable from a real
 * posting by the time it reaches the backend. The user then gets a confident,
 * well-formatted AI report about a "Safety Tips" panel.
 *
 * So the text no longer travels alone. It carries where it came from, and a
 * cheap assessment of whether it reads like a job description — enough for the
 * UI to show the user what is about to be sent and let them fix it.
 *
 * This is a heuristic, not a classifier. It is deliberately biased toward
 * flagging: the cost of a warning on a good extraction is one glance, and the
 * cost of silence on a bad one is a fabricated report.
 */

/** How the text was located. Ordered most to least trustworthy. */
export type ExtractionStrategy =
  /** The site's own published JobPosting data — its contract, not our guess. */
  | "json-ld"
  /** A container we named explicitly for this site. */
  | "selector"
  /** Last resort: the biggest block of text on the page. */
  | "longest-paragraph";

export interface Extraction {
  text: string;
  strategy: ExtractionStrategy;
  /** The selector or property that matched, for display and debugging. */
  via: string;
}

/** Human-readable provenance, shown to the user before anything is sent. */
export function describeStrategy(e: Extraction): string {
  switch (e.strategy) {
    case "json-ld":
      return "the page's own structured job data";
    case "selector":
      return `the posting body (${e.via})`;
    case "longest-paragraph":
      return "the largest block of text on the page — no posting container matched";
  }
}

export interface ExtractionQuality {
  level: "ok" | "uncertain";
  /** Plain-language reasons, shown verbatim to the user. */
  reasons: string[];
}

/**
 * Below this a posting is too short to be a real advert. Measured against the
 * shortest genuine listings on BongThom and Khmer24, which run 400–600 chars;
 * 80 (the adapters' hard floor) only rules out an empty container.
 */
const SHORT_TEXT_CHARS = 300;

/** Words that appear in essentially every real job advert, in any of these forms. */
const JOB_VOCABULARY =
  /\b(responsib|requirement|qualificat|experience|skills?|salary|appl(y|icant|ication)|candidate|duties|benefits?|degree|hiring|position|role|team|knowledge|abilit)/i;

/**
 * Blocks that sit beside job adverts on these sites and are long enough to pass
 * a length check on their own. Each was chosen from a real page: Khmer24 and
 * BongThom both render a standing safety/advice panel, and job boards surround
 * a posting with alert and account prompts.
 */
const BOILERPLATE = [
  { pattern: /safety tips/i, label: "the site's Safety Tips panel" },
  { pattern: /report this (ad|job|posting)/i, label: "a “report this ad” block" },
  { pattern: /(sign|log) in to (see|view|apply)/i, label: "a sign-in prompt" },
  { pattern: /create (a )?job alert/i, label: "a job-alert prompt" },
  { pattern: /(similar|related) jobs/i, label: "a related-jobs list" },
  { pattern: /cookie (policy|preferences|settings)/i, label: "a cookie notice" },
];

/**
 * Navigation and link lists come out of `innerText` as many very short lines.
 * A real posting has prose and bullets; menus have neither.
 */
function looksFragmentary(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 8) return false;
  const shortLines = lines.filter((l) => l.length < 25).length;
  return shortLines / lines.length > 0.7;
}

/** Does this read like a job advert? Cheap, local, and never blocking. */
export function assessExtraction(extraction: Extraction): ExtractionQuality {
  const { text } = extraction;
  const reasons: string[] = [];

  if (text.length < SHORT_TEXT_CHARS) {
    reasons.push(`It's only ${text.length} characters — shorter than a typical posting.`);
  }
  if (!JOB_VOCABULARY.test(text)) {
    reasons.push("It doesn't mention responsibilities, requirements, or skills.");
  }
  for (const { pattern, label } of BOILERPLATE) {
    if (pattern.test(text)) reasons.push(`It contains ${label}.`);
  }
  if (looksFragmentary(text)) {
    reasons.push("It's mostly short lines, which usually means a menu or link list.");
  }
  if (extraction.strategy === "longest-paragraph") {
    reasons.push("No posting container matched, so this is the page's largest text block.");
  }

  return { level: reasons.length > 0 ? "uncertain" : "ok", reasons };
}

/**
 * Normalise a description read from a page: collapse runs of spaces/tabs, cap
 * blank-line runs, trim, and truncate. `innerText`'s single newlines are KEPT —
 * the requirement extractor reads a bulleted list far better than one run-on
 * paragraph.
 */
export function cleanDescription(raw: string, maxChars: number): string {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

/** First matching element, plus the selector that found it (for provenance). */
export function findFirstWithSelector(
  selectors: string[],
): { el: HTMLElement; selector: string } | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return { el, selector };
  }
  return null;
}
