# JobFit Extension — Progress & Task Tracker

> **Living document.** Update this BEFORE and AFTER each work session so anyone
> (including a fresh AI session) can resume without re-deriving context.
> Related: [`extension_build_plan.md`](./extension_build_plan.md) (original brief),
> [`CONTRACTS.md`](./CONTRACTS.md) (request/response specs), [`../README.md`](../README.md).

_Last updated: 2026-08-12_

---

## 0. How to use this file

- Every feature ships behind a **data-source adapter** with a **mock**. Wiring a
  feature to the real backend = flip its flag in [`src/data/source.ts`](../src/data/source.ts)
  from `"mock"` → `"real"` **after** the backend route exists and matches
  [`CONTRACTS.md`](./CONTRACTS.md). No UI/messaging changes needed.
- `[ ]` = todo · `[x]` = done · `[~]` = in progress. Keep the tables honest.
- After finishing anything, tick it here and bump "Last updated".

---

## 1. Status snapshot

**All build phases 0–11 are implemented and the extension builds/loads.**
What is *real* vs *mock* is the important part now:

What is *real* vs *mock* is the important part now. The **Backend reality** column
was verified against `jobfit-backend` source on 2026-08-10 (every `@Controller`/route
enumerated — not assumed):

| Feature | Phase | Extension calls | Flag | Backend reality (verified) |
|---|---|---|---|---|
| Auth (cookie SSO) | 1 | `/auth/refresh-token`, `/auth/me` | **real** | ✅ exists; needs cookie fix + re-login (§4) |
| Quick Apply Tracker | 6 | `GET /applications`, `GET /jobs/:id` | **real** | ✅ both exist (`@Controller('applications')` `@Get()`, `@Controller('jobs')`) |
| Momentum score | 10 | `GET /analytics/my-stats` | **real** | ✅ exists (`@Controller('analytics')`) |
| Sub-score badge | 3 | `GET /recommendations/by-job` | mock | ✅ **EXISTS & purpose-built for the extension** — query + response match the adapter, 204→empty, **not premium-gated**. **Clean flip.** |
| Skills-gap cards | 5 | `GET /learning/gap` | **real** | ✅ **route BUILT 2026-08-10** — new field-aware route on the learning module: gaps scoped to PUBLISHED jobs SIMILAR to the viewed role (title tokens, seniority words dropped) minus the user's own skills. Extension now sends the job title. `learningPath: null` (no LearningPath table). |
| Cover letter (panel) | 9 | `POST /generate/cover-letter` | **real** | ✅ **ungated route BUILT 2026-08-10 (option B)** — job-context generation from résumé + title/company, no application/premium. AI when up, template fallback. Web app's `/applications/:id/cover-letter` untouched. |
| Interview prep | 10 | `POST /generate/interview-prep` | **real** | ✅ **ungated route BUILT 2026-08-10 (option B)** — questions from the title, mapped to type-shares + top questions. AI when up, static fallback. Web app's premium `/generate/interview` untouched. |
| Company sidebar | 4 | `GET /companies/by-name` | **real** | ✅ **route BUILT 2026-08-10** — Glassdoor rating + open-role count + derived hiring velocity. `fundingStage`/`salaryRange` = null, `topMatches` = [] until those joins exist (sidebar renders each field conditionally). |
| Salary panel | 8 | `GET /salary` | **real** | ✅ **route BUILT 2026-08-10** — P25/P50/P75 derived from PUBLISHED postings' `minSalary`/`maxSalary` at the company (role-filtered, company-wide fallback). `listed`=null, `fitPercentile`=P50 default. No postings → empty. |
| Deadline chip + alarm | 7 | `GET /saved-jobs/deadline` (+`/upcoming-deadlines`) | mock | ⛔ **BLOCKED** — verified: **no deadline column exists anywhere** (`Job`, `SavedJob` have none). Needs a schema migration + a data source; external LinkedIn jobs aren't stored regardless. Stays mock. |
| Duplicate detector | 10 | `GET /applications/similar` | **real** | ✅ **route BUILT 2026-08-10** — matches the user's prior applications by company (exact, case-insensitive) + title (contains). No match → warning hidden. |
| Scout alerts | 11 | `GET /recommendations/scout` | **real** | ✅ **route BUILT 2026-08-10** — user's recommendations ≥ minScore (optionally newer than `since`); internal jobs link to the web app, ingested to their apply URL. |
| Cover letter (Easy Apply auto-fill) | 9 | *(DOM inject, no endpoint)* | n/a | ⚠️ fragile DOM — test separately (§5) |
| Full-page match report | — | `POST /match-report`, `GET /match-report/:id` | **real** | ✅ **module BUILT 2026-08-12** (`jobfit-backend/src/modules/match-report`) — composes résumé ATS/quality + external match + AI-extracted requirements matched against the résumé; stores the payload, returns `{id}`. Web page: `jobfit-frontend` `/(seeker)/match-report/[id]`. **The one route that receives the posting text** (Option A — see §5). |

**Not built (never in the phase plan):** Indeed site adapter · Recruiter Radar ·
Referral tracker.

> **⚠️ Two things the audit changed:**
> 1. **Only `recommendations/by-job` is a clean flip.** It was built *for* the extension,
>    so query + response already match; it requires `title` (adapter returns null → empty
>    badge if the LinkedIn title selector fails — keep `sites/linkedin.ts` current).
> 2. **`skill-gap`, `interview`, `cover-letter` endpoints EXIST but are incompatible**
>    (they need internal `jobId`/application-id and/or are premium-gated). They are NOT
>    simple flag flips — see Phase C2. The extension currently has **no tier concept**,
>    so it can't satisfy the premium gate on the two generation endpoints.

---

## 2. Go-forward plan (phases)

Work the phases top-to-bottom. Each is independently shippable.

### Phase A — Make auth actually work end-to-end ⚠️ blocks everything real
- [ ] Apply backend cookie fix (done in code — see §4) and **re-login** so a fresh
      `SameSite=None` cookie is issued.
- [ ] Confirm the popup shows the logged-in user (name/email/role).
- [ ] Confirm the Tracker (Phase 6) and Momentum (Phase 10) show **real** data.
- [ ] Add the extension origin to backend CORS allowlist for any non-localhost env
      (see §4). Local dev works via `host_permissions` CORS bypass.

### Phase B — Flip the ONE endpoint that's a clean match
- [x] `recommendations` → `"real"` — **DONE (2026-08-10).** Verified against
      `matching.controller.ts` `@Get('by-job')`: query, response (`SubScores` =
      `{skills,experience,location,salary,other}`), and 204→empty all match the
      adapter; not premium-gated. Requires auth (cookie SSO) + readable page title.
- [ ] **User to verify in-browser:** re-login, open a real job, confirm the badge
      shows live sub-scores (not the mock 60–98 range).
- [ ] Re-verify `applications` and `momentum` (already `"real"`) against the backend.

### Phase C1 — Build the genuinely-missing routes (to `CONTRACTS.md` shapes)
For each: build route → confirm it returns the [`CONTRACTS.md`](./CONTRACTS.md) shape →
flip the flag → test in-page → tick both boxes.

| Endpoint (as the extension calls it) | Route built | Flag flipped |
|---|---|---|
| `GET /companies/by-name` | [x] 2026-08-10 | [x] |
| `GET /salary` (aggregates Job.minSalary/maxSalary; no salary table) | [x] 2026-08-10 | [x] |
| `GET /applications/similar` | [x] 2026-08-10 | [x] |
| `GET /recommendations/scout` | [x] 2026-08-10 | [x] |
| ~~`GET /saved-jobs/deadline` (+upcoming)~~ | ⛔ BLOCKED — no deadline column in schema (migration + data source needed) | stays mock |

**Phase C1 is complete** (every buildable route done; deadlines blocked on schema).

> **Envelope note (found while building companies):** a handler returning
> `undefined` makes the `TransformInterceptor` drop the `data` key, and the
> extension's `unwrap()` then returns the whole envelope (→ crash). **Backend
> handlers for extension routes must return `null`, not `undefined`, for the
> not-found/empty case.** Fixed here for `by-name` and `by-job`.

### Phase C2 — Reconcile the endpoints that exist but DON'T match ⚠️
These already have backend endpoints with **different contracts**. Decide per item:
**(a)** add an extension-friendly route, or **(b)** change the extension to the
backend's shape. Both generation endpoints also need the **premium gate** resolved.

- [x] **Skills gap — DONE 2026-08-10.** Did NOT reuse `/recommendations/skill-gap`
      (needs internal `jobId` + the job's requirements, which we don't have for an
      external job). Instead built a NEW field-aware route `GET /learning/gap` on the
      learning module: scopes gaps to PUBLISHED jobs whose title shares distinctive
      words with the viewed role (seniority words dropped) minus the user's skills —
      deliberately NOT the market-wide "in-demand skills" list this codebase removed.
      Threaded the job `title` through the extension (message → adapter → query).
- [x] **Cover letter — DONE 2026-08-10 (option B).** New ungated route
      `POST /generate/cover-letter` (job-context: résumé + title/company, no application,
      no premium). AI when the service is up, template fallback otherwise. Web app's
      `/applications/:id/cover-letter` untouched.
- [x] **Interview prep — DONE 2026-08-10 (option B).** New ungated route
      `POST /generate/interview-prep` (questions from title → type-shares + top questions).
      AI when up, static-question fallback. Web app's premium `/generate/interview`
      untouched. Extension updated to call the new path.
- [x] **Premium gating — RESOLVED: option B.** Extension gets real AI via ungated,
      extension-specific routes; the web app keeps its paywall.
      ⚠️ **Accepted caveat:** the ungated routes are a paywall *bypass* if hit directly
      (any authenticated user can call them). Add rate-limiting later if it matters.

### Phase D — Remaining features (optional / stretch)
- [ ] **Indeed adapter** — `src/content/sites/indeed.ts` implementing `SiteAdapter`;
      add `https://*.indeed.com/*` to `content_scripts` matches.
- [ ] **Recruiter Radar** — "you know someone here" from `contact_persons`.
- [ ] **Referral tracker** — from `referrals`.

### Phase E — Ship to the Chrome Web Store
- [ ] Real screenshots + promo tiles.
- [ ] Privacy policy page (what leaves the page: only `externalId` + `source`).
- [ ] Store listing copy + categories.
- [ ] Point `VITE_API_URL` / `host_permissions` at the **production** API origin.
- [ ] `npm run build` → zip `dist/` → upload → review.

---

## 3. The one-line wiring step (reference)

In [`src/data/source.ts`](../src/data/source.ts):
```ts
export const DATA_SOURCE = {
  recommendations: "mock",   // ← change to "real" when the route is live
  ...
};
```
Nothing else changes — the adapter's `real()` already calls the right endpoint,
and the worker/UI already handle `ok | empty | unauthenticated | error`.

---

## 4. Backend requirements (jobfit-backend)

- [x] **Cookie fix (done):** `src/common/utils/cookie.util.ts` now uses
      `sameSite: 'none'; secure: true` in **all** envs, so the httpOnly refresh
      cookie is sent from the extension's cross-site origin. Production behaviour
      is unchanged (it was already none+secure). **Requires re-login** to take effect.
- [ ] **CORS for deployed use:** add `chrome-extension://<EXTENSION_ID>` to
      `CORS_ORIGIN`. Not needed for local dev — the service worker bypasses CORS via
      `host_permissions`, which is **auto-derived from `VITE_API_URL`** in
      `manifest.config.ts` (covers the API origin **and** the web origin). To retarget
      environments you only change `VITE_API_URL`/`VITE_WEB_URL` in `.env`; the manifest
      and `src/shared/config.ts` both follow — no manual manifest edit.
- [ ] Build the Phase-C routes above to the `CONTRACTS.md` shapes.

---

## 5. Key decisions & gotchas (don't re-derive)

- **Cookie SSO, not stored tokens.** The extension has no login; it rides the web
  app's httpOnly refresh cookie. This is the project's biggest risk (plan §2.2).
- **Two Tailwind builds:** popup (preflight ON, unprefixed) vs content
  (preflight OFF, `jf-` prefix, tokens on `:host`) — via `@config` in `content.css`.
- **All network calls go through the background worker.** Content/popup only send
  typed messages (`src/shared/messaging.ts`).
- **Privacy/TOS:** what leaves the page is `externalId` + `source` + the **displayed**
  `title` / `company` / `location` (short strings the endpoints need — e.g. the by-job
  DTO **requires `title`**, ≤200 chars). Nothing is scraped in the background and no
  listing is stored. When wiring real routes, confirm each one only consumes these
  identifiers. (This is a deliberate, minor relaxation of the original
  "only externalId + source" wording, forced by the matching endpoint's contract.)
- **ONE endpoint receives page content — `POST /match-report` (Option A, locked
  2026-08-12).** The "📊 Full Report" button reads the visible "About the job" text
  **at click time** (`SiteAdapter.getDescription`, ≤8000 chars) and sends it once, so the
  backend can extract the job's requirements for the report's skills table — the one
  section that is impossible without it. It is **user-initiated and ephemeral**: no
  background job reads it, nothing caches it, and only the DERIVED report is stored, on
  that user's own row. Everything else in the extension stays identifiers-only. For a
  **published** Web Store build this is the item to re-review — see
  `docs/MATCH_REPORT_PLAN.md` §4 for the Option A/B trade-off that was decided here.
- **Easy Apply cover-letter injection** (`src/content/easyApply.tsx`) auto-fills
  LinkedIn's cover-letter textarea **when one is rendered** — most flows don't show one,
  so the badge panel's copy-to-clipboard is the primary path. This DOM injection is the
  most fragile surface; test it separately and expect to update selectors when LinkedIn
  changes the Easy Apply modal.
- **DECISION (locked): the extension has NO premium tier.** Every feature is free
  and ungated — there is no `tier.ts`, no `GET_TIER`, no upsell/lock UI (verified:
  only doc comments mention "tier"). **Do not re-introduce tier gating in the
  extension.** Consequence: any backend endpoint that is premium-gated (403 for
  free users) cannot serve the extension as-is — see Phase C2.
- **`/auth/me` has no tier field** (it's in `subscriptions`) — don't invent one.
- **Badge only mounts on job pages** (`/jobs/view/<id>` or `?currentJobId=`), never
  on company/feed/profile pages. If it doesn't appear, check `sites/linkedin.ts`
  selectors and that you rebuilt + reloaded + hard-refreshed the tab.

---

## 6. Verify commands

```bash
npm run build      # tsc --noEmit + vite build → dist/
# chrome://extensions → Reload → hard-refresh the LinkedIn tab
```
Local backend must run on `:4000`, web app on `:3000`, and you must be logged in
on the web app for the real features.
