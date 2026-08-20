/**
 * Shared reader for schema.org `JobPosting` data embedded in a page.
 *
 * WHY THIS EXISTS: writing a bespoke adapter per job board does not scale — every one is
 * a bet on that site's current HTML, and it breaks on their next redesign. Most boards
 * that want traffic publish their jobs as JSON-LD, because that is what Google Jobs
 * indexes. Reading THAT is one implementation that works on many sites at once, and it
 * cannot rot the way a CSS selector does: it is the site's own published contract.
 *
 * Measured 2026-08-13 — Khmer24 publishes title, company, full address, salary (with
 * currency AND period) and `monthsOfExperience`; Indeed publishes the core fields. See
 * docs/MULTI_SITE_PLAN.md §2.
 *
 * Everything here fails silently and returns null: a malformed blob on someone else's
 * page must never throw into their site.
 */

export interface JobPostingLd {
  title: string | null;
  company: string | null;
  /** "Dangkao, Phnom Penh, Cambodia" — assembled from the postal address. */
  location: string | null;
  /** Plain text; the site's own HTML markup is stripped. */
  description: string | null;
  /** The site's own id for the posting, when it publishes one. */
  identifier: string | null;
}

/**
 * Read a property CASE-INSENSITIVELY.
 *
 * schema.org properties are lowercase, and a strict reader is the obvious implementation
 * — but sites get this wrong and their data is still perfectly good. Measured 2026-08-13:
 * JobNet Cambodia publishes `Title`, `Description` and `Name`/`Value`, so a strict reader
 * returned a posting with no title and no description while 1,546 characters of real
 * description sat right there. Reading their capitalisation costs nothing and is not
 * "accepting broken data" — the meaning is unambiguous.
 */
function prop(node: Record<string, unknown>, name: string): unknown {
  if (name in node) return node[name];
  const wanted = name.toLowerCase();
  for (const key of Object.keys(node)) {
    if (key.toLowerCase() === wanted) return node[key];
  }
  return undefined;
}

/** Read a string out of a field that may be a string, or an object with `name`. */
function nameOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const name = prop(value as Record<string, unknown>, "name");
    if (typeof name === "string") return name.trim() || null;
  }
  return null;
}

/** `@type` may be a string or an array of them ("JobPosting" among others). */
function isJobPosting(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type === "JobPosting";
  return Array.isArray(type) && type.some((t) => t === "JobPosting");
}

/**
 * Assemble a human location from a schema.org PostalAddress.
 *
 * Locality → region → country, deduplicated: Khmer24 writes addressLocality as
 * "Dangkao, Phnom Penh" and addressRegion as "Phnom Penh", so a naive join produces
 * "Dangkao, Phnom Penh, Phnom Penh, Cambodia".
 */
function addressOf(jobLocation: unknown): string | null {
  const first = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  if (!first || typeof first !== "object") return null;

  const address = prop(first as Record<string, unknown>, "address");
  if (typeof address === "string") return address.trim() || null;
  if (!address || typeof address !== "object") return null;

  const a = address as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["addressLocality", "addressRegion", "addressCountry"]) {
    const value = nameOf(prop(a, key));
    if (!value) continue;
    // Skip anything already named in what we've assembled (see the doc comment).
    if (parts.some((p) => p.toLowerCase().includes(value.toLowerCase()))) continue;
    parts.push(value);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Descriptions are published as HTML; the extractor wants readable text. */
function toText(html: unknown): string | null {
  if (typeof html !== "string" || !html.trim()) return null;
  const el = document.createElement("div");
  // Not innerHTML on a live node: this element is never attached to the page, so no
  // script or image in the string can run or fetch. It is only used to unescape markup.
  el.innerHTML = html;
  const text = (el.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text || null;
}

/** Recursively find the first JobPosting — sites nest them in arrays and `@graph`. */
function findJobPosting(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || !node || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  if (isJobPosting(record)) return record;
  return findJobPosting(record["@graph"], depth + 1);
}

/**
 * The page's JobPosting, or null if it publishes none.
 *
 * Null is also the signal a classifieds site needs: Khmer24 sells phones and cars on the
 * same URL shape as jobs, and only the job ads carry a JobPosting. Adapters use that to
 * decide whether to show the badge at all.
 */
export function readJobPosting(): JobPostingLd | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );

  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? "");
    } catch {
      continue; // One malformed blob must not hide a valid one later in the page.
    }
    const posting = findJobPosting(parsed);
    if (!posting) continue;

    const identifier = prop(posting, "identifier");
    return {
      title: nameOf(prop(posting, "title")),
      company: nameOf(prop(posting, "hiringOrganization")),
      location: addressOf(prop(posting, "jobLocation")),
      description: toText(prop(posting, "description")),
      identifier:
        typeof identifier === "string"
          ? identifier
          : identifier && typeof identifier === "object"
            ? (() => {
                const value = prop(identifier as Record<string, unknown>, "value");
                return typeof value === "string" || typeof value === "number"
                  ? String(value)
                  : null;
              })()
            : null,
    };
  }
  return null;
}

/**
 * An element's visible text, or null.
 *
 * `innerText` first because it respects layout — a bulleted posting keeps its line breaks,
 * and the requirement extractor reads a list far better than one run-on paragraph. It is a
 * rendering-dependent property though (undefined without a layout engine), so textContent
 * backs it up.
 */
export function readText(el: HTMLElement | null): string | null {
  const text = (el?.innerText ?? el?.textContent ?? "").trim();
  return text || null;
}

/** True when this page publishes a JobPosting — i.e. it really is a job page. */
export function hasJobPosting(): boolean {
  return readJobPosting() !== null;
}

/**
 * Find the on-page heading that shows a known title, to anchor the badge beside.
 *
 * Selector-free ON PURPOSE. Once the JSON-LD has told us the exact title, matching it
 * against the page's headings is more durable than any class name — a site can rename
 * `.job-title` next week, but the heading still contains the title it published. This is
 * what lets a JSON-LD site be supported without betting on its markup.
 */
export function findHeadingWithText(title: string | null): HTMLElement | null {
  const wanted = title?.trim().toLowerCase();
  if (!wanted) return null;

  const headings = document.querySelectorAll<HTMLElement>(
    'h1, h2, h3, [role="heading"], [class*="title" i]',
  );
  for (const heading of headings) {
    const text = heading.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) continue;
    // Equality first, then containment — a heading often wraps the title in extra
    // furniture ("Content Creator — Apply now").
    if (text === wanted || text.includes(wanted)) return heading;
  }

  // Last resort: any LEAF element whose entire text is the title. Sites do render a job
  // title in a plain <div> or <span>, and without this the badge would simply never
  // appear there. Leaf-only so we anchor to the label itself rather than to some
  // ancestor container that happens to contain it.
  for (const node of document.querySelectorAll<HTMLElement>("div, span, p, a, strong")) {
    if (node.childElementCount > 0) continue;
    if (node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() === wanted) return node;
  }
  return null;
}
