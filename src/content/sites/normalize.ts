/**
 * Clean up text read from someone else's DOM before it is used as an identifier.
 *
 * WHY: the match endpoint scores a job from its TITLE. Whatever the page hands
 * us is that title — including the newlines and runs of spaces that come from
 * reading `textContent` off a multi-line heading, non-breaking spaces from the
 * site's own layout, and zero-width characters some boards inject. "Senior
 * Backend Engineer" and "Senior\n  Backend\u00a0Engineer" are the same job, but
 * they are not the same string, and a semantic scorer can return different
 * numbers for them. Normalising here means the same posting scores the same way
 * on every visit.
 *
 * This is the client half only. Lengths must still be validated server-side —
 * a content script is not a trust boundary.
 */

/** Longest value we will send for each identifier field. */
export const FIELD_LIMITS = {
  title: 200,
  company: 120,
  location: 120,
} as const;

/**
 * Collapse whitespace, drop invisible characters, trim, and cap the length.
 * Returns null for anything that is empty once cleaned, so a blank heading
 * becomes "no title" rather than "".
 */
export function normalizeField(raw: string | null, limit: number): string | null {
  if (!raw) return null;
  const cleaned = raw
    // Zero-width space/non-joiner/joiner and the BOM: invisible, and they defeat
    // every string comparison downstream.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Control characters, including the newlines textContent brings along.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    // Any run of whitespace (NBSP included) becomes one plain space.
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > limit ? cleaned.slice(0, limit).trim() : cleaned;
}

export const normalizeTitle = (raw: string | null): string | null =>
  normalizeField(raw, FIELD_LIMITS.title);
export const normalizeCompany = (raw: string | null): string | null =>
  normalizeField(raw, FIELD_LIMITS.company);
export const normalizeLocation = (raw: string | null): string | null =>
  normalizeField(raw, FIELD_LIMITS.location);
