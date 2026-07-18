# JobFit Chrome Extension — Build Plan

**Status:** 🟡 Awaiting approval — no code written yet
**Author:** Claude · **Date:** July 2026
**Source spec:** [`jobfit_extension_features.md`](./jobfit_extension_features.md)
**Governing rules:** [`rule_for_develop_frontend.md`](./rule_for_develop_frontend.md)

---

## 1. Goal

Build a Chrome (MV3) extension that surfaces JobFit's existing backend intelligence — match sub-scores, company data, salary data, skill gaps, application pipeline — directly inside LinkedIn / Indeed job pages, plus a popup that acts as the user's job-search command center.

Per the spec's own recommendation, the **Day 1 differentiator** is the *Sub-Score Radar Badge + Company Intelligence Sidebar* — both are pure data-surfacing, zero new AI work.

---

## 2. Decisions I need from you before Phase 0

> [!IMPORTANT]
> These change the architecture. I've proposed a default for each — tell me if you disagree, otherwise I'll proceed with the ✅ option.

### 2.1 Where does the extension live?
| Option | Notes |
|---|---|
| ✅ **A. `jobfit-extension/` as a sibling repo/folder** | Clean separation. Extension has its own `package.json`, Vite build, Tailwind config. Shares tokens by copying `globals.css` token block (or a small published `tokens.css`). |
| B. Folder inside this Next.js repo (`extension/`) | Easier token sharing, but Next's build/lint/tsconfig would need carve-outs and could break Vercel deploys. |

**Recommendation: A.** The Next app deploys to Vercel; an extension folder inside it risks breaking that build (we already hit `.next` and route-collision issues). I'd create it at `D:\Year2\Jobfit\jobfit-extension`.

### 2.2 How does the extension authenticate? ⚠️ **Biggest risk**
Your web app currently uses: **access token in memory** (`authBridge.setAccessToken`) + **refresh token in an httpOnly cookie**, with `credentials: "include"` (verified in `src/lib/api/client.ts`).

An extension **cannot** read that in-memory token, and the spec's suggestion ("JWT in `chrome.storage.local`") conflicts with the httpOnly-cookie design.

| Option | How it works | Trade-off |
|---|---|---|
| ✅ **A. Cookie-based SSO via host_permissions** | Extension calls the API with `credentials:"include"`; the httpOnly refresh cookie rides along. User logs in once on the JobFit site, extension is authed. | No token ever stored in the extension (most secure). Requires `host_permissions` for the API origin + cookie `SameSite=None; Secure`. **Needs backend/CORS confirmation.** |
| B. Extension login form → store tokens in `chrome.storage.local` | Extension has its own login, stores access+refresh. | Duplicate login UX; refresh token in extension storage is a real security downgrade. |
| C. Web app hands token to extension via `externally_connectable` | Content script on jobfit.co posts the token to the extension. | Middle ground; needs a bridge page in the Next app. |

**Recommendation: A**, with **C as fallback** if CORS/cookies can't be made to work. **Phase 1 is scoped to prove this before anything else is built.**

### 2.3 Backend gap — the P0 endpoints don't exist yet
Verified against the frontend's live API calls. Current endpoints include `/jobs`, `/applications`, `/auth/*`, `/employer/*`, `/admin/*`, `/analytics/my-stats`.

**Missing (spec §"New Backend Endpoints Needed"):**
| Needed for | Endpoint | Exists? |
|---|---|---|
| Sub-score badge | `GET /recommendations/by-job?externalId=&source=` | ❌ |
| Skills gap cards | `GET /learning/gap?jobExternalId=` | ❌ |
| Company sidebar | `GET /companies/by-name?name=` | ❌ |
| Salary panel | `GET /salary?company=&role=` | ❌ |
| Duplicate detector | `GET /applications/similar?...` | ❌ |
| Cover letter / interview | `POST /generate/*` (Qwen 3) | ❌ (planned) |

**Proposal:** each feature phase ships behind a **data-source adapter** with a mock implementation that matches the agreed response contract. Flip one flag per endpoint when the backend lands — no UI rewrite. I'll also write the exact request/response contract into this doc as we go, so backend has a spec to build against.

**Question for you:** do you own the backend too (can these be added), or should I assume mock-only for now?

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LinkedIn / Indeed page                                       │
│  ┌──────────────────────────────────────────────┐            │
│  │ Content Script (isolated world)              │            │
│  │  • site adapter → extract externalId, title  │            │
│  │  • mounts React UI inside SHADOW DOM         │            │
│  └───────────────┬──────────────────────────────┘            │
└──────────────────┼───────────────────────────────────────────┘
                   │ chrome.runtime.sendMessage
┌──────────────────▼───────────────────────────────────────────┐
│ Background Service Worker (MV3)                              │
│  • single owner of all network calls + caching               │
│  • chrome.alarms (deadline checks) · chrome.notifications    │
└──────────────────┬───────────────────────────────────────────┘
                   │ fetch (credentials: include)
┌──────────────────▼───────────────────────────────────────────┐
│ JobFit Backend  /api/v1                                       │
└───────────────────────────────────────────────────────────────┘
```

**Key architectural rules:**
1. **All network calls go through the service worker** — content scripts never fetch directly. Avoids CORS-per-origin pain and centralizes auth/caching.
2. **Content-script UI is mounted in a Shadow DOM.** Non-negotiable: LinkedIn's global CSS would otherwise destroy our styles (and Tailwind Preflight would destroy LinkedIn's).
3. **Never scrape/store job content.** Only `externalId` + `source` leave the page — per spec's TOS/privacy warning.
4. **Site adapters are isolated** (`sites/linkedin.ts`, `sites/indeed.ts`) so DOM breakage is contained to one file.

### Stack
- **Vite + `@crxjs/vite-plugin`** (MV3 + HMR), React 19, TypeScript
- **Tailwind CSS** — reusing your exact token layer
- **React Query** — same caching model as the web app
- No inline color styles (see §4)

---

## 4. Styling rules (your constraint: NO inline colour styling)

This extension will be **pure Tailwind classes** from day one — the standard we just converted the admin/employer dashboards to.

1. **Copy the `:root` token block** from `globals.css` into the extension's `tokens.css`. Single source of truth for the purple system.
2. **Port the semantic aliases** we added to `tailwind.config.ts` so the same classes exist:
   `bg-card`, `bg-background(-secondary)`, `border-border`, `text-content(-secondary/-tertiary/-disabled)`, plus `primary/neutral/success/warning/error/info` scales.
3. **Shadow DOM token injection:** CSS custom properties inherit *through* the shadow boundary, but LinkedIn's `:root` won't have ours — so tokens are declared on `:host` inside the shadow stylesheet.
4. **Tailwind Preflight disabled** (`corePlugins: { preflight: false }`) in the content-script build so we never restyle LinkedIn's page. The popup build keeps Preflight.
5. **Prefix Tailwind classes** (e.g. `jf-`) in the content-script build to guarantee zero collision with LinkedIn's own utility classes.
6. **No arbitrary values** (`text-[13px]`, `w-[312px]`) — standard scale only, per rule §1.1.

> The only permitted non-class styling is genuinely dynamic/computed values (e.g. a radar chart's `width: ${score}%`) — same exception as the dashboards.

---

## 5. Proposed folder layout

```
jobfit-extension/
├─ manifest.config.ts          # MV3 manifest (typed, via crxjs)
├─ vite.config.ts
├─ tailwind.config.ts          # tokens + semantic aliases (mirrors web)
├─ src/
│  ├─ styles/tokens.css        # copied :root token block
│  ├─ background/
│  │  ├─ index.ts              # service worker entry, message router
│  │  ├─ api.ts                # fetch wrapper (mirrors web client contract)
│  │  └─ alarms.ts             # deadline checks
│  ├─ content/
│  │  ├─ index.tsx             # bootstrap + shadow root mount
│  │  ├─ sites/                # linkedin.ts | indeed.ts adapters
│  │  └─ features/             # badge, sidebar, gap-cards, cover-letter
│  ├─ popup/                   # tracker, momentum, settings
│  ├─ shared/
│  │  ├─ components/           # Badge, StatTile, MetricBar (ported)
│  │  ├─ messaging.ts          # typed sendMessage contracts
│  │  └─ types.ts
│  └─ data/                    # adapters: real | mock per endpoint
└─ docs/CONTRACTS.md           # request/response spec for backend
```

---

## 6. Phases

> Each phase ends with a **reviewable checkpoint**: loadable in `chrome://extensions` and something you can see. I build **one phase at a time and stop for your review** — no jumping ahead.

### Phase 0 — Scaffold & design system
**Deliverable:** extension loads in Chrome, popup opens showing a token-styled "JobFit" shell. No features.
- Vite + crxjs + React + TS + Tailwind
- `tokens.css` + `tailwind.config.ts` (semantic aliases, prefix, preflight rules)
- Manifest v3: permissions (`storage`, `activeTab`), host permissions
- Popup shell + brand header, ported `Badge` component as proof of styling
- README: how to build + load unpacked

**Acceptance:** `npm run build` → load unpacked → popup renders in JobFit purple, zero inline color styles.

---

### Phase 1 — Auth bridge ⚠️ *de-risks everything*
**Deliverable:** popup shows the real logged-in user (name/email/tier) from `/auth/me`.
- Service worker `api.ts` mirroring the web client's contract (unwrap `data`, `ApiError`, 401 → `/auth/refresh-token` retry)
- Prove **decision 2.2** end-to-end against the real backend
- Logged-out state → "Log in on jobfit.co" CTA
- Typed messaging contract between popup ⇄ worker

**Acceptance:** log in on the web app → popup shows your account. If cookie SSO fails, we fall back to option C here — *before* any feature is built on top.

---

### Phase 2 — Content-script foundation
**Deliverable:** on a LinkedIn job page, a JobFit chip appears next to the title (static "JobFit" pill, no data).
- Shadow-DOM mount + scoped Tailwind stylesheet
- LinkedIn adapter: detect job page, extract `externalId` + title + company
- SPA-navigation handling (LinkedIn is client-routed — `MutationObserver` / history patch)
- Mount/unmount lifecycle, no duplicate injection

**Acceptance:** navigate LinkedIn job→job; chip appears/updates every time, LinkedIn's own styles unaffected.

---

### Phase 3 — P0: Sub-score radar badge
**Deliverable:** the spec's 5-dimension breakdown (skills/experience/location/salary/culture) in an expandable badge.
- `GET /recommendations/by-job` adapter (mock → real)
- Collapsed pill `JobFit: 87% ⭐` → expands to sub-score bars
- Loading skeleton + "no match data" empty state (rule §4.2)

**Acceptance:** badge shows 5 sub-scores; graceful when no data.

---

### Phase 4 — P0: Company Fit Intelligence sidebar
**Deliverable:** hover/click company → panel with Glassdoor rating, funding, hiring velocity, your matches, salary range.
- `GET /companies/by-name` adapter
- Slide-in shadow-DOM panel, focus-trapped, Esc to close

---

### Phase 5 — P0: Skills Gap action cards
**Deliverable:** gap cards under the badge with "Start Learning Path" / "See jobs without X".
- `GET /learning/gap` adapter
- Free tier: gaps only · Premium: + learning paths (tier gate begins here)

---

### Phase 6 — P1: Popup Quick Apply Tracker
**Deliverable:** popup pipeline (Applied/Interview/Offer) from the **real, existing** `/applications` endpoint.
- Reuses the Kanban patterns from the employer dashboard
- Free: last 5 · Premium: unlimited

---

### Phase 7 — P1: Deadline urgency + notifications
**Deliverable:** `⏰ Closes in 3 days` chip + opt-in browser notification.
- `chrome.alarms` + `chrome.notifications`, opt-in settings panel

---

### Phase 8 — P1: Salary intelligence panel
**Deliverable:** P25/P50/P75 + total comp + negotiation tip. Premium-gated.

---

### Phase 9 — P1: One-click cover letter injection (Premium)
**Deliverable:** "✨ Generate with JobFit AI" injected into LinkedIn Easy Apply.
- **Depends on** `/generate/cover-letter` (Qwen 3). Highest-risk DOM work (Easy Apply modal is dynamic).

---

### Phase 10 — P2: Retention set
Duplicate application detector · Interview prep trigger · Momentum score.

---

### Phase 11 — P3: Scout alerts + ship
Passive job-scout alerts · settings · icons/screenshots · privacy policy · Web Store packaging.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Auth (2.2) doesn't work with cookies** | Blocks everything | Phase 1 proves it first; fallback option C |
| **P0 endpoints don't exist** | Features can't show real data | Adapter + mock; contracts documented for backend |
| **LinkedIn DOM changes** | Badge silently disappears | Adapters isolated per site; fail silently, never break the host page |
| **LinkedIn TOS** | Store rejection / user risk | Never scrape or store listings; only `externalId` leaves the page (per spec) |
| **Tailwind ↔ LinkedIn CSS collision** | Visual breakage both ways | Shadow DOM + prefix + preflight off |
| **MV3 service-worker sleep** | Lost state | Stateless worker; persist to `chrome.storage`; alarms not timers |

---

## 8. What I need from you to start

1. **Approve §2.1** — separate `jobfit-extension/` folder? (my rec: yes)
2. **Approve §2.2** — cookie SSO first, fallback if it fails? (my rec: yes)
3. **Answer §2.3** — can the backend add the P0 endpoints, or mock-only for now?
4. **Confirm phase order** — or tell me to reorder (e.g. popup-first if you want a demo without LinkedIn DOM risk).

Once approved, I build **Phase 0 only**, then stop for your review.
