# JobFit Chrome Extension (MV3)

Surfaces JobFit's match intelligence — 5-dimension sub-scores, company data, salary
data, skill gaps, and the application pipeline — directly on LinkedIn / Indeed job
pages, plus a popup that acts as the user's job-search command center.

> **Governing docs** live in the web repo: `docs/extension_build_plan.md` (the brief),
> `docs/jobfit_extension_features.md` (feature spec), `docs/rule_for_develop_frontend.md`
> (design-system rules). This extension deliberately lives in its **own folder** so it
> never touches the Next.js app's Vercel build.

## Stack

- **Vite + `@crxjs/vite-plugin`** (MV3 build + HMR)
- **React 19 + TypeScript**
- **Tailwind CSS 3** using the web app's exact purple token layer
  (`src/styles/tokens.css` = a verbatim copy of the web app's `:root` block)

## Prerequisites

- Node ≥ 20 (developed on Node 22)

## Install

```bash
npm install
```

## Build (load unpacked)

```bash
npm run build      # tsc --noEmit + vite build → ./dist
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. **Load unpacked** → select the `dist/` folder
4. Click the JobFit icon in the toolbar → the popup renders in JobFit purple

## Develop (HMR)

```bash
npm run dev        # vite dev server + crxjs live reload
```

Load unpacked pointing at `dist/` once; crxjs reloads the extension on save.

## Design-system rules (non-negotiable)

- **Pure Tailwind, token-backed classes only** — `bg-card`, `text-content`,
  `text-content-secondary`, `border-border`, `bg-primary-600`, …
- **No inline color styling.** Inline `style` is allowed only for genuinely dynamic
  values (e.g. a score bar's `width: ${n}%`).
- **No hardcoded colors** (`#hex`, `rgba()`) and **no arbitrary Tailwind values**
  (`text-[13px]`, `w-[312px]`). Standard scale only.
- Color values live in [`src/styles/tokens.css`](src/styles/tokens.css); the semantic
  aliases are mapped in [`tailwind.config.ts`](tailwind.config.ts) — kept in sync with
  the web app so the same classes exist in both.

## Project layout

```
jobfit-extension/
├─ manifest.config.ts       # MV3 manifest (typed, via crxjs)
├─ vite.config.ts
├─ tailwind.config.ts       # tokens + semantic aliases (mirrors web)
├─ postcss.config.js
└─ src/
   ├─ styles/tokens.css     # copied :root token block (source of truth for color)
   ├─ popup/                # popup shell (index.html, main.tsx, App.tsx, popup.css)
   └─ shared/
      ├─ cn.ts              # clsx + tailwind-merge helper
      └─ components/        # Badge (ported) — more ported components to come
```

Folders arriving in later phases (per the build plan): `src/data/` (mock/real
endpoint adapters — Phase 3+).

### Two Tailwind builds (popup vs. content script)

| | Popup | Content script |
|---|---|---|
| Config | `tailwind.config.ts` | `tailwind.content.config.ts` (via `@config` in `content.css`) |
| Preflight | ON (owns its document) | **OFF** (never resets LinkedIn) |
| Prefix | none | **`jf-`** (e.g. `jf-bg-primary-600`) |
| Mounted in | its own page | **Shadow DOM**, tokens on `:host` |

The token → class map is shared by both via `tailwind.theme.ts`; color values live
once in `src/styles/tokens.css` (selector `:root, :host` so it serves both).

## Testing Phase 2 (LinkedIn chip)

1. `npm run build`, load/refresh `dist/` unpacked in `chrome://extensions`.
2. Open a LinkedIn job — either a detail URL (`/jobs/view/<id>`) or the split
   search view (`/jobs/search/?currentJobId=<id>`).
3. A small purple **✦ JobFit** pill should appear right after the job title.
4. Click through several jobs without reloading (LinkedIn is a SPA) — the pill
   should re-appear/update on every job, and LinkedIn's own styling must be
   visually unchanged.

If LinkedIn changes its markup and the title can't be found, the chip simply
doesn't render (fail-silent) — update the selectors in `src/content/sites/linkedin.ts`.
Nothing is scraped or transmitted in this phase; only the URL's `externalId` is read.

## Testing Phases 3–5 (P0 features — all on MOCK data)

The P0 backend endpoints don't exist yet, so these run on deterministic mock data
(same job id → same numbers). See `docs/CONTRACTS.md` for the real contracts and
`src/data/source.ts` to flip a feature to `"real"` when its endpoint lands.

On a LinkedIn job page, the **✦ JobFit** pill now shows a **match %**. Click it:
- **Phase 3** — the badge expands to the 5 sub-score bars (skills / experience /
  location / salary / culture), with skeleton → data → empty/error states.
- **Phase 5** — under the badge, **skill-gap cards** appear, each with a
  "📚 Start Learning Path" action and a "jobs without X" shortcut.
- **Phase 4** — click **🏢 Company** in the badge → a focus-trapped sidebar slides in
  (Glassdoor rating, funding, hiring velocity, your matches, salary range). Esc or the
  scrim closes it.

All feature UI lives in the Shadow DOM with `jf-`-prefixed token classes; the only
inline styles are the score bars' dynamic `width` and the sidebar's z-index.

## Testing Phases 6–8 (P1)

- **Phase 6 — Quick Apply Tracker (popup):** uses the **real** `/applications`
  endpoint (joined with `/jobs/{id}` for titles), so you must be logged in with the
  backend running. It groups your applications into Applied / Interview / Offer
  To preview the UI **without a backend**, set
  `src/data/source.ts` `applications: "mock"`.
- **Phase 7 — Deadlines + notifications:** on a job page, a **⏰ Closes in Nd** chip
  appears next to the badge when the (mocked) deadline is within 14 days. In the
  popup, **Settings → Deadline reminders** toggles opt-in `chrome.notifications`;
  the background `chrome.alarms` job checks every 6h and pings once per job. To test
  a notification immediately, open the worker console (chrome://extensions → service
  worker) and run `chrome.alarms.create("jobfit:deadline-check",{when:Date.now()+1000})`
  after enabling the toggle.
- **Phase 8 — Salary intelligence:** in the expanded badge, a **💰 Salary** section
  shows P25/P50/P75 + total comp + a negotiation tip for that company/role.

## Testing Phase 9 (cover letter)

There are **two entry points**, because most Easy Apply flows have no free-text step
(they're often just Résumé → Review):

**A. Badge panel — works on every job (use this to test):**
1. On any LinkedIn job, click the **✦ JobFit** pill to expand it.
2. Scroll to the **✨ Cover letter** section → click **Generate cover letter**.
3. After ~1.4s (mock latency) the letter appears in a scrollable box with a
   **📋 Copy** button, plus **Regenerate**.

**B. Easy Apply auto-fill — only when the flow has a free-text field:**
1. Start **Easy Apply** and advance through the steps.
2. If a step has a free-text/cover-letter textarea, a **✨ Generate with JobFit AI**
   button appears directly above it.
3. Click → the letter is written into LinkedIn's own textarea and
   "✓ Inserted — review before submitting" appears.

If a flow goes Résumé → Review with no text box, **no button is correct** — use
entry point A and paste.

## Testing Phase 11 (scout alerts)

1. Popup → **Settings** → enable **Job scout alerts**, pick a **minimum match score**.
2. Both alert types are **opt-in** — nothing fires until switched on.
3. To trigger a check immediately instead of waiting for the 3h alarm, open the worker
   console (`chrome://extensions` → JobFit → **service worker**) and run:
   ```js
   chrome.alarms.create("jobfit:scout-check", { when: Date.now() + 1000 })
   ```
4. A notification appears for each new high-match job (max 3 per run, best first).
   **Clicking it opens the job.** A given job is never notified twice.

Scout data is mocked; flip `scout: "real"` in `src/data/source.ts` when
`GET /recommendations/scout` ships.

## Packaging for the Chrome Web Store

```bash
npm run package    # build + zip → release/jobfit-extension-v<version>.zip
```

The script writes a spec-compliant ZIP itself (forward-slash paths — Windows
`Compress-Archive` emits backslashes, which can break the upload) and **warns if
`host_permissions` still points at localhost**.

Submission copy, permission justifications, and the asset checklist are in
[`docs/STORE_LISTING.md`](docs/STORE_LISTING.md). The privacy policy is
[`PRIVACY.md`](PRIVACY.md) — it must be **hosted at a public URL** before submitting.

Icons are generated, not hand-drawn: `npm run icons` regenerates the 16/48/128 PNGs
(rounded brand-gradient tile + ✦ sparkle) via a dependency-free encoder.

**This is the highest-risk DOM surface in the project** — the Easy Apply modal is a
multi-step, dynamically rendered dialog whose markup LinkedIn changes often. Every
lookup is best-effort with fallbacks and wrapped in try/catch: if the modal or the
textarea can't be identified, **no button is injected and the application flow is
completely unaffected**. Selector fallbacks live in `src/content/easyApply.tsx`.

Writing into the field uses the native `HTMLTextAreaElement.value` setter plus
dispatched `input`/`change` events — assigning `.value` directly would be ignored by
React and LinkedIn would submit an empty field.

Generation is mocked (`POST /generate/cover-letter` doesn't exist yet); flip
`coverLetter: "real"` in `src/data/source.ts` when the Qwen 3 endpoint lands.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| **0** | Scaffold + design system (popup shell, tokens, ported Badge) | ✅ |
| **1** | Auth bridge — cookie SSO, popup shows the logged-in user | ✅ |
| **2** | Content-script foundation — Shadow DOM mount, LinkedIn adapter, static chip | ✅ |
| **3** | P0 sub-score radar badge (mock adapter) | ✅ |
| **4** | P0 company intelligence sidebar (mock adapter) | ✅ |
| **5** | P0 skills-gap action cards (mock adapter) | ✅ |
| **6** | P1 Quick Apply Tracker (real /applications + /jobs join) | ✅ |
| **7** | P1 Deadline urgency chip + opt-in notifications (alarms) | ✅ |
| **8** | P1 Salary intelligence panel (mock adapter) | ✅ |
| **9** | P1 Cover letter — badge panel + Easy Apply auto-fill (mock adapter) | ✅ |
| 10 | P2 Retention set (duplicate detector, interview prep, momentum) | ⬜ **skipped** |
| **11** | P3 Scout alerts + ship (icons, privacy policy, store pack, packaging) | ✅ |

## Notes / decisions locked in

- **Auth:** cookie-based SSO — the background worker (Phase 1) calls the API with
  `credentials:"include"` so the httpOnly refresh cookie rides along; **no token is
  stored in the extension**. Fallback (if CORS/cookies fail): an `externally_connectable`
  bridge on jobfit.co. Proven end-to-end in Phase 1 before any feature is built on it.
- **Backend:** the P0 endpoints don't exist yet. From Phase 3, every feature ships
  behind a data-source adapter with a **mock** matching a documented contract
  (`docs/CONTRACTS.md`); one flag flips to the real endpoint when it lands.
- **Privacy / LinkedIn TOS:** never scrape or store job listings — only `externalId`
  + `source` ever leave the page.
- `host_permissions` currently targets `http://localhost:4000/*` (dev API origin — matches
  the web app's `NEXT_PUBLIC_API_URL`). Point it at the deployed API origin before shipping,
  and keep it in sync with `VITE_API_URL` (`src/shared/config.ts`).

## Testing Phase 1 (cookie SSO)

1. Run the JobFit **backend** (default `http://localhost:4000`) and **web app** (`http://localhost:3000`).
2. `npm run build`, then load `dist/` unpacked in `chrome://extensions`.
3. Log in on the web app (`http://localhost:3000/login`).
4. Open the extension popup → it should show your **name / email / role** from `GET /auth/me`.
5. Log out via the popup → the popup returns to the logged-out CTA.

> **✅ CONFIRMED WORKING against the deployed backend** (Cloud Run API + Vercel frontend).
> Note the backend's CORS allowlist does **not** include `chrome-extension://` origins — and it
> doesn't need to: in MV3, **service-worker fetches to origins in `host_permissions` are exempt
> from CORS**. That exemption is exactly why the architecture routes every network call through
> the worker and never fetches from a content script. No backend change was required.

**If step 4 shows "not signed in" while you're logged in on the web app**, cookie SSO isn't
working — the httpOnly refresh cookie isn't riding along on the worker's cross-origin fetch.
This is the decision-2.2 risk this phase exists to surface. Most likely causes / the backend
requirements for cookie SSO:
- The refresh cookie must be `SameSite=None; Secure` to be sent from the extension origin
  cross-site (over HTTPS in prod; on `localhost` `Lax` may work).
- The API must allow the extension origin for CORS **with credentials**
  (`Access-Control-Allow-Origin: chrome-extension://<id>` + `Allow-Credentials: true`).
- `host_permissions` must cover the API origin (it does, for localhost:4000).

**Fallback (option C)** if cookie SSO can't be made to work: a small bridge page on the web app
(`externally_connectable`) hands the access token to the extension. The messaging/worker layer
here is already structured so only the token-acquisition step changes — the rest is untouched.
```
