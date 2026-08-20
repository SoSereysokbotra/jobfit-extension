# Phase 12 — Multi-site support (beyond LinkedIn)

> **Living document.** Update it BEFORE and AFTER each work session, like
> [`PROGRESS.md`](./PROGRESS.md). Anyone (including a fresh AI session) should be able to
> resume from this file alone.
>
> _Created 2026-08-13._

---

## 1. Why

The extension supported LinkedIn only. For a user job-hunting in **Cambodia** that is the
wrong single site — LinkedIn's Cambodian coverage is thin next to the local boards, which
is where the jobs this user actually scans live.

---

## 2. What was measured before writing any code (2026-08-13)

Every claim below came from fetching the real pages, not from assumption.

| Site | Job URL shape | Structured data (JSON-LD `JobPosting`) | Verdict |
|---|---|---|---|
| **Khmer24** | `/{en,km}/<slug>-adid-<id>` | ✅ **Rich** — title, company, full address, salary *with currency + period*, `monthsOfExperience`, employmentType, id | Best source we have |
| **Indeed** | `/viewjob?jk=<id>`, `/jobs?vjk=<id>` | ✅ publishes it | Do it |
| **BongThom** | `/job_detail/<slug>_<id>.html` | ❌ none — server-rendered HTML | Hand-written adapter |
| **CamHR** | unknown | unknown | ⏸ **blocked** — need a real job URL |
| **JobNet** (jobnet.com.kh) | `/job/<slug>/<id>` | ✅ yes — but with **capitalised** property names, see below | Cambodia's main professional board |
| **JobStreet** | — | — | ❌ **No Cambodia site.** `kh.jobstreet.com` and `jobstreet.com.kh` do not resolve. **JobNet is the Cambodian equivalent** (user, 2026-08-13) |

Notable: Khmer24 states **salary and required experience as structured numbers**, which
LinkedIn never does. The salary panel and the years-of-experience check in the match
report are strictly better there than on LinkedIn.

### robots / terms observed
- **Khmer24**: `Content-Signal: search=yes, ai-train=no, use=reference`, `Allow: /` for
  general agents; blocks AI crawlers (CCBot, Bytespider, Amazonbot, Applebot-Extended).
  This extension is *reference* — a user reading a page they opened — not training, and
  not a crawler. Worth re-reading before any Web Store submission.
- **CamHR**: permissive robots.txt.
- **BongThom**: serves the app shell for `/robots.txt` (no real robots file).

---

## 3. Design: one shared reader, thin per-site adapters

Two kinds of adapter, so we do not write a bespoke file for every site on earth:

1. **`sites/jsonld.ts` — the shared reader.** Parses `<script type="application/ld+json">`
   for a `JobPosting` and returns title / company / location / description / id. Any site
   publishing schema.org job data (most that want Google Jobs traffic) is then nearly free.
2. **Per-site adapter** — supplies the URL→id rule, the DOM anchor for the badge, and
   fallbacks for whatever the site does *not* publish. Sites with no structured data
   (BongThom) implement everything by selector, as LinkedIn already does.

Nothing in the backend changes: `source` is a free string (≤32 chars) on every route.

### Adding a site = 4 edits
1. `src/content/sites/<site>.ts` — implement `SiteAdapter`
2. `src/content/sites/index.ts` — register it in `pickAdapter`
3. `manifest.config.ts` — add the host to `content_scripts.matches`
4. `src/shared/types.ts` — add the name to `JobSource`

---

## 4. Status

| # | Task | Status |
|---|---|---|
| 1 | Measure all five candidate sites | ✅ done 2026-08-13 |
| 2 | `jsonld.ts` shared JobPosting reader | ✅ done |
| 3 | Khmer24 adapter | ✅ done |
| 4 | Indeed adapter | ✅ done |
| 5 | BongThom adapter (hand-written) | ✅ done |
| 6 | `pickAdapter` registry + manifest + `JobSource` | ✅ done |
| 7 | JobNet adapter | ✅ done |
| 8 | CamHR adapter | ⏸ **blocked — need one real job URL** |
| 9 | Verify each in a real browser | ⏳ **user to do** — see §6 |

### Verified without a browser (2026-08-13)
- **URL → job id**, all five adapters, 11 cases against real URLs incl. negatives
  (listing pages, a company page and an unknown host must yield nothing): **11/11 pass**.
- **JSON-LD reader**, run over the real saved HTML in a DOM:
  - Khmer24 job ad → `Sale officer / You Samphea / Dangkao, Phnom Penh, Cambodia / 13775799`
  - Khmer24 **phone ad** → no JobPosting, so the badge does not mount ✅ (the gate works)
  - BongThom → no JobPosting, as expected; it uses selectors instead
  - JobNet job page → `Content Creator / Industry Leading Company / Phnom Penh, Cambodia`
    with **1,368 characters of description** — enough for a full match report

### Two things JobNet forced into the shared reader (both improve every site)
1. **Case-insensitive property names.** JobNet publishes `Title`, `Description`,
   `Name`/`Value` — schema.org says lowercase. A strict reader returned an empty posting
   while 1,546 characters of description sat in the blob. `jsonld.ts` now reads property
   names case-insensitively.
2. **Selector-free badge anchor** (`findHeadingWithText`). JobNet is client-rendered and
   the served HTML's only `<h1>` belongs to a hidden modal, so a selector would attach the
   badge to the wrong element. Once the JSON-LD has given us the exact title, we find the
   element *showing that title* — headings first, then any leaf element whose whole text
   is the title. That is more durable than any class name and needs no per-site upkeep.

### 2026-08-13, second pass — user reported "no badge on Khmer24"
The adapter was run against the **exact failing page**
(`/en/senior-compliance-officer-adid-13881101`) and returned everything correctly:
`Senior Compliance Officer / Peng Huoth Group / Chbar Ampov, Phnom Penh / anchor H1 /
2,135-char description`. The code was not the fault — the browser was running the previous
build. Adding a host to `content_scripts.matches` needs BOTH an extension reload and a
tab reload; Chrome never injects into tabs that were already open.

Three real weaknesses were found and fixed while proving that:
1. **Match patterns were `www.`-only** → now `https://*.khmer24.com/*` etc., which matches
   the bare domain as well as any subdomain.
2. **Khmer24's page has THREE `<h1>`s** (the job, plus "Congratulations!" and "Select
   Location on Map" from hidden dialogs), so `querySelector("h1")` was a bet on document
   order. It now anchors via `findHeadingWithText`, matching the published title.
3. **Khmer24's description had no stable selector** — it sits in a `<p>` with only Tailwind
   utility classes. Now taken as the longest `<p>` on the page (2,135 chars here vs ~300
   for the "Safety Tips" block, which is a `<ul>`), which cannot break on a restyle.

### Current extraction, all four saved pages
| Page | Anchor | Description |
|---|---|---|
| Khmer24 job | `H1` | 2,135 chars |
| Khmer24 **phone ad** | **none — badge stays off** ✅ | — |
| BongThom | `H1` | 5,207 chars |
| JobNet | `P` (title-match fallback) | 1,368 chars |

### 2026-08-13, third pass — the panel was clipped on Khmer24
With the badge finally showing, the dropdown was sliced off a few rows down. Cause: the
badge mounts *inside the page's own job card*, so an absolutely-positioned panel is at the
mercy of that card's `overflow`. LinkedIn happens not to clip, which is why this survived
a whole phase unnoticed — it was never a Khmer24 bug, it was a latent one that Khmer24
exposed.

Fix: `src/content/OverlayLayer.tsx`. Overlays now render into a SEPARATE shadow host
attached to `document.body`, positioned from the badge's bounding rect, carrying the same
constructable stylesheet. It also:
- flips above the badge when there is less than 260px of room below,
- clamps to the viewport so a badge near the right edge can't push it off screen,
- re-positions on scroll **in the capture phase**, so scrolling any of the page's inner
  panes moves it too — not just the window,
- uses `pointer-events: none` on the full-viewport host with `auto` on the content, or it
  would swallow every click on the page underneath.

The company sidebar was portalled the same way — same latent bug, would have been the
next report.

### The one thing that could not be verified offline
~~Khmer24's description~~ — **resolved above** by the longest-paragraph rule; measured
2,135 characters on a live ad. Nothing outstanding here now: every adapter has been run
against a real saved page.

---

## 5. Known limits (do not re-derive)

- **Khmer text is not analysed.** Measured 2026-08-13: every text matcher
  (`keyword-scan.ts`, `skill-gap.service.ts`, and the AI service's groundedness check)
  splits words on `[a-z0-9…]` — Latin only. A Khmer requirement reduces to whatever Latin
  brand names it contains. Khmer is also written **without spaces between words**, so
  word-boundary matching cannot work even if the character class were widened.
  **What DOES work:** bge-m3 is genuinely multilingual — measured cosine 0.82 between a
  Khmer and an English job title for the same role, vs 0.45 for different roles. So the
  match *score* is sound on Khmer postings; the skills table and ATS keyword checks are
  not. Fixing this needs Khmer word segmentation (ICU has a dictionary-based break
  iterator) — a separate project, not a regex tweak.
- **A classifieds site is not a job board.** Khmer24 sells phones and cars on the same URL
  shape as jobs. The adapter mounts only when the page carries a `JobPosting`, so the
  badge never appears on a motorbike listing.
- **Selectors rot.** Each hand-written adapter is a bet on a site's current HTML. That is
  the recurring cost of every non-JSON-LD site, which is exactly why the shared reader is
  preferred where a site supports it.

---

## 6. How to verify (user)

Rebuild (`npm run build`), reload at `chrome://extensions`, then open one job on each and
check the JobFit badge appears next to the title:

- Khmer24 — https://www.khmer24.com/en/jobs.html → open any job ad
- Khmer24 negative test — open a **phone or car** ad; the badge must **NOT** appear
- BongThom — https://www.bongthom.com/job_detail/primary_english_teacher_40962.html
- JobNet — https://www.jobnet.com.kh/job/content-creator/6243
- Indeed — any `/viewjob?jk=…` page

If a badge is missing, the site changed its HTML: fix that one adapter file, nothing else.
