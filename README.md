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

Folders arriving in later phases (per the build plan): `src/background/` (service
worker — Phase 1), `src/content/` + `src/content/sites/` (LinkedIn adapter + Shadow
DOM mount — Phase 2), `src/data/` (mock/real endpoint adapters — Phase 3+).

## Phase status

| Phase | Scope | Status |
|---|---|---|
| **0** | Scaffold + design system (popup shell, tokens, ported Badge) | ✅ |
| **1** | Auth bridge — cookie SSO, popup shows the logged-in user | ✅ this build |
| 2 | Content-script foundation — Shadow DOM mount, LinkedIn adapter, static chip | ⬜ next |
| 3 | P0 sub-score radar badge | ⬜ |
| 4 | P0 company intelligence sidebar | ⬜ |
| 5 | P0 skills-gap action cards | ⬜ |
| 6–11 | Tracker, deadlines, salary, cover-letter, retention, ship | ⬜ |

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
