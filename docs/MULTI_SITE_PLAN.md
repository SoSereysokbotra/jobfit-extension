# Phase 12 — Multi-site support (beyond LinkedIn)

> **Continuing this work?** Start with
> [`HANDOFF_2026-08-25.md`](./HANDOFF_2026-08-25.md) — current state, open tasks, and
> the traps that cost the most time.

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
| **CamHR** | `/a/job/<id>` | ❌ none — a Nuxt shell; job arrives by XHR. Selectors mined from THEIR OWN stylesheet | Hand-written adapter |
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
| 8 | CamHR adapter | ✅ done 2026-08-25 (user supplied /a/job/10666812) |
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


---

## 7. Khmer support (2026-08-25)

Two changes, both driven by measurement on live Khmer24 adverts, not by assumption.

### 7.1 The posting's OWN published bar wins — `monthsOfExperience`

Khmer24 publishes `experienceRequirements.monthsOfExperience` as a NUMBER. Verified live:

| Advert | Published | Page displays |
|---|---|---|
| Senior Compliance Officer | `36` | "3Year+" |
| Accounting Supervisor | `48` | — |
| Creative designer | `24` | — |
| Accounting Officer / Tax | `12` | — |
| Dental Assistant, stock role | `0` | — |

A published 36 is unambiguous in **any script**, so it sidesteps the language problem
entirely. The chain: `jsonld.ts` reads it → optional `SiteAdapter.getRequiredMonths()`
(implemented by the three JSON-LD sites) → `CREATE_MATCH_REPORT` → `CreateMatchReportDto`
→ `MatchReportService`, which prefers it over parsing prose and records
`experience.statedIn = "posting-data"`.

**ZERO IS TREATED AS "NOT STATED".** Two of the six ads publish `0`, including one whose
body never mentions experience — so a `0` cannot be told apart from a blank field.
Reporting "you meet this role's 0-year bar" on an advert that asked nothing would be a
confident claim about nothing. It falls back to the text instead.

### 7.2 Khmer text parsing — and the trap that nearly shipped

`parseYearsRequired` now normalises Khmer digits (០–៩ = U+17E0–U+17E9, contiguous —
verified by codepoint) and accepts `ឆ្នាំ` ("years"), plus `បទពិសោធន៍` ("experience") and
`យ៉ាងតិច` ("at least") as requirement context.

That alone would have been **wrong**. From a live dental-assistant advert:

```
អាយុ18 ដល់ 30ឆ្នាំ  - មិនទាមទារបទពិសោធន៍
"AGE 18 to 30 years"  "does NOT require experience"
```

The Khmer word for *experience* sits ~30 characters from "30 years", well inside the
context window, so the naive rule reports **"this role asks for 30+ years"** on an advert
that explicitly requires none. Two guards were added and are pinned by tests using this
verbatim text:
- `AGE_CONTEXT` (`អាយុ`, English `age/aged`) checked in a tight 30-char look-behind,
- `NEGATED_CONTEXT` (`មិន...ទាមទារ`, "no prior experience", "not required").

Note also that Khmer ads mix scripts freely — "30ឆ្នាំ" uses ASCII digits, "៣ឆ្នាំ" Khmer
ones. Both are handled.

### 7.3 Found while doing the above — `POST /match-report` was returning 400

The extension's extraction-preview feature began sending an `extraction` object, but
`CreateMatchReportDto` never declared it. With `whitelist + forbidNonWhitelisted`
(`main.ts:43`), one undeclared field rejects the WHOLE request — so **Full Report was
broken on every site**, showing only "couldn't build the report". `ExtractionProvenanceDto`
now declares and validates it. Keep this file's rule in mind: the DTO and the
`CREATE_MATCH_REPORT` message are one contract in two repos.

### 7.4 What is still NOT supported in Khmer
Unchanged from §5: the skills table and ATS keyword checks need word matching, and Khmer
is written without spaces between words. The backend already detects this and reports
`skills.reason = "LANGUAGE_UNSUPPORTED"` rather than an empty table.


---

## 8. 2026-08-25 — CamHR, salary, and stated requirements

### 8.1 CamHR (the last of the six)
Measured on `/a/job/10666812`: no JSON-LD, and the served HTML contains **no job content
at all** — `<title>` is literally "CamHR", og:title is the site's strapline, and the
posting arrives by XHR. `window.__NUXT__` is plain JSON but does not contain the job, and
a content script could not read a page variable anyway (isolated world).

So the selectors came from **CamHR's own server-rendered stylesheet**, which defines
`.job-header-content .job-title-content .job-name .job-name-span`,
`.job-maininfo .job-descript`, `.job-company .compnay-name`. That is evidence about the
DOM their app builds — one step removed from a rendered page, so every lookup tolerates a
miss and the extraction preview shows the user what was grabbed.

`.compnay-name` is spelled that way IN THEIR CSS. Do not "fix" it.

`getLocation()` returns null deliberately: their `.job-demand` row might be location,
experience, employment type or all three, and sending "3 years experience" as a location
would quietly corrupt the location sub-score.

### 8.2 Advertised salary — carried and DISPLAYED, never scored
Khmer24 publishes `baseSalary` (verified: `USD 700.00 / MONTH`). It now travels into the
report and renders in the header as "USD 700 / month".

**It does not touch `subScores.salary`, and that is not laziness.** `Profile.minSalary` is
a bare integer with **no period column** — and this repo's own schema note (from a prior
review) records exactly why that matters: a Cambodian monthly figure and a US annual one
were indistinguishable in one column, ~83% of the corpus being Cambodian where monthly is
the norm. Scoring a monthly advert against an unlabelled expectation would mean inventing
the candidate's unit, possibly by a factor of twelve.

**To make it scoreable, `Profile` needs a `salaryPeriod`** (schema + profile form). Until
then, showing the advert's own words claims nothing false.

### 8.3 Stated requirements (degree + language) — WARN, never penalise
Option A, chosen by the user. `hard-requirements.ts` reads degree and language bars from
the extracted requirements plus the description, checks them against the CV, and the page
renders them ABOVE the match rate. The score is untouched, and a test pins that.

Guards, each from a real advert:
- **Negation** — TELUS's "You don't need a technical degree…" must not produce a degree
  requirement. Reporting one there would be confident and backwards.
- **Requirement context** — "a degree is a plus" is not a bar.
- **Proficiency context** — "English website" is not a language requirement; "Minimum C1
  English proficiency" is.
- **`met: null`** when there is no parsed CV — "couldn't check" is not "you lack this".
  A bug found by its own test: `JSON.stringify([])` is `"[]"`, which made an empty CV look
  parsed and turned every flag into a false "not met".

Degree LEVELS are deliberately not ranked: parsed degree strings are free text, and
ordering them would be guesswork dressed as a verdict.

### 8.4 Fixed while reviewing a real report — the "×11" column
A C++ Engineer report printed **×11 against four different requirements**, because the
count took the requirement's most-frequent content word and every requirement contains
"c++" (11 occurrences). A column where every row says the same number distinguishes
nothing. `requirementCount` now excludes the posting's own theme words via
`themeWordsOf` — the same measured technique the skill-gap matcher uses.

### 8.5 Not a bug: "your résumé shows about 0.1 years"
Investigated. The calculation is right; the PARSE is thin. The CV re-uploaded 2026-08-17
parsed to a single entry — an "Electrical Engineering Intern", 2023-11 → 2023-12 = one
month. An earlier parse of the same CV found a 2021-01 → 2024-01 span. Same document,
different answers: `qwen3:0.6b` again. Nothing to fix in this repo; the `.env` note about
switching to full `qwen3` on the GPU box is the fix.


### 8.6 What a real DHL report exposed (2026-08-25, second look)
Running the finished feature on a live JobNet advert (DHL Express, Procurement Officer)
showed two defects that only appear with real requirement lists:

1. **The degree bar was reported TWICE** — once in "Stated requirements" and again as a
   missing *hard skill*. A qualification is not a skill, and counting it as one inflated
   the "not shown on your CV" number the reader is meant to act on. The skills table now
   skips anything the stated-requirements section already covers.
2. **A hedged item was counted as missing.** "Experience in logistics or transport **is an
   advantage**" was listed among the candidate's gaps. It is now marked `optional`, shown
   with a "preferred, not required" tag, sorted last, and excluded from BOTH the
   matched and missing counts — on the page and in the payload.

The lesson, again: the rule that looked right against invented examples ("require a
requirement word in the sentence") was wrong against real adverts, which state bars as
bare bullets under a heading and mark niceties inline.


### 8.7 The fix nobody could see — report cache had no code version
The two defects in §8.6 were fixed, the user re-scanned the same posting, and the output
was **byte-identical**. Neither the code nor the browser was at fault: `findReusable` keys
on `user + source + externalId + descriptionHash + freshness`, so an unchanged job judged
against an unchanged CV correctly returned the STORED payload — which had been built
before the fix.

That is a general defect, not a one-off: **every future improvement to the report would
have been invisible to anyone holding a cached one.**

Fix: `match_reports.payloadVersion` (migration `20260825120000`), written on create and
required to match on reuse. `PAYLOAD_VERSION` lives in `match-report.service.ts`; bump it
whenever the payload's shape or meaning changes, and older rows rebuild on next scan.
Rows predating the column default to 1.

**Discipline for future work:** changing what a report MEANS without bumping
`PAYLOAD_VERSION` ships a fix that users cannot see.
