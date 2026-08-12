# Feature Spec: Full-Page Match Report (Jobscan-style) — Implementation Handoff

> **Audience:** a fresh AI/dev session with NO prior context. This document is
> self-contained: read it top to bottom before writing code.
>
> **Feature in one line:** a clean, full-page résumé↔job "match report" (like
> `app.jobscan.co/match-report/…`) opened from the JobFit browser-extension badge,
> rendered on the JobFit web app, **with NO paywall** (every section unlocked).
>
> **Decision already made: OPTION A** — the extension captures the visible job
> description and sends it for a one-time analysis (needed for the skills table).
>
> _Created 2026-08-10._

---

## 0. The three repos (all under `D:\Year2\Jobfit\`)

| Repo | What it is | Stack |
|---|---|---|
| `jobfit-extension` | The Chrome MV3 extension (this repo) | Vite + @crxjs + React + TS + Tailwind |
| `jobfit-backend` | REST API | NestJS (DDD), Prisma → Supabase Postgres |
| `jobfit-frontend` | The web app (where the report page lives) | Next.js (App Router), React, Tailwind |
| `jobfits-ai-service` | AI microservice (FastAPI) | Python, Ollama (qwen3, bge-m3, …) |

**You will edit all three of extension + backend + frontend.**

---

## 1. Runtime facts you MUST know (learned the hard way)

- **Backend**: `http://localhost:4000`, global prefix `/api/v1`. Run `npm run start:dev`.
- **AI service**: `http://127.0.0.1:8000/api/v1`. **Use `127.0.0.1`, NOT `localhost`** —
  on Windows `localhost`→IPv6 hits an unrelated Docker/Django container on :8000.
  Backend reaches it via `AI_SERVICE_URL` + header `X-AI-Service-Key`.
- **Redis** required (BullMQ résumé-parsing). Start with `cd jobfit-backend && docker compose up -d`.
- **Auth = cookie SSO.** The extension's background worker calls the API with
  `credentials:"include"`; a 401 triggers `/auth/refresh-token`. You must be logged in
  on the web app whose origin matches `VITE_API_URL`. (Local dev: log in on `localhost:3000`.)
- **Response envelope**: `TransformInterceptor` wraps every success as
  `{ success, statusCode, timestamp, data }`; the extension/web `apiClient` unwraps `data`.
  **A handler that returns `undefined` drops the `data` key and the extension's
  `unwrap()` then returns the whole envelope → crash. ALWAYS return `null` (never
  `undefined`) for empty/not-found.**
- **Global `ValidationPipe` has `forbidNonWhitelisted: true`** — every query/body field
  the extension sends MUST be declared in the DTO, or the request 400s.
- **Auth guard is global** (`JwtAuthGuard`); routes are protected by default, `@Public()` opts out.
- **The extension has NO premium tier** (locked decision). Surface everything ungated,
  even scorer `suggestions` (which the web app normally gates by tier).
- **Extension config**: `jobfit-extension/.env` → `VITE_API_URL`, `VITE_WEB_URL`.
  `host_permissions` is auto-derived from `VITE_API_URL` in `manifest.config.ts`.
  For local testing both are `localhost`; for prod they're the Cloud Run + Vercel URLs.

---

## 2. Reusable building blocks (already built — do NOT rebuild)

All in `jobfit-backend`:

1. **Résumé scores** — `ResumeScorerService` (`src/modules/resume/application/services/resume-scorer.service.ts`):
   ```ts
   scoreResume(resumeId, opts?): Promise<ResumeScoreResult>
   interface ResumeScoreResult {
     atsScore: number;            // 0–100 (20% formatting +30% keywords +20% parsing +15% length +15% contact)
     qualityScore: number;        // 0–100 (30% content +25% completeness +20% grammar +25% keyword quality)
     breakdown: Record<string, number>;  // sub-scores by name
     suggestions: string[];       // actionable fixes
     scoredBy: 'ai' | 'heuristic';
   }
   ```
   Existing endpoints: `GET /resumes/:id/scores`, `/ats-score`, `/quality-score`, `POST /resumes/:id/score`.
2. **The user's résumé** — `ResumeRepository.findDefaultByUserId(userId)`
   (`src/modules/resume/infrastructure/repositories/resume.repository.ts`). Use the
   default résumé; if none, fall back to the latest `parsingStatus: 'SUCCESS'`.
3. **Parsed résumé data** — `parsedResumeData` (skills[], experiences, educations, summary,
   fullName, email, phone, location, rawText). Read via the parsed-resume repository.
4. **Match score** — `MatchExternalJobUseCase.execute(userId, {title, company, location, remoteType})`
   (`src/modules/matching/application/use-cases/match-external-job.use-case.ts`) →
   `{ score, breakdown: {skills,experience,location,salary,other}, semantic } | null`.
   (This is the improved, discriminating external scorer.)
5. **Job requirement extraction** (needs the description) — `AiClient.extractJobRequirements`
   (`src/infra/ai/ai.client.ts`):
   ```ts
   extractJobRequirements({ jobTitle, jobDescription }): Promise<{ requirements: string[]; groundedness: number; droppedUngrounded: number; promptVersion: string }>
   ```
6. **Requirement ↔ résumé matching** — `SkillGapService`
   (`src/modules/matching/application/services/skill-gap.service.ts`) produces
   `RequirementMatch { text, matchedSkills: string[], matchQuality?: 'EXACT'|'PARTIAL' }`.
   Reuse this matching logic against the EXTRACTED requirements (step 5) to build the
   hard/soft skills table (matched vs missing).

**The report is composition of 1–6.** Only the wiring + storage + UI is new.

---

## 3. Data flow

```
[Extension badge]  user clicks "📊 Full Report"
   │  content script (LinkedIn adapter) collects: externalId, source, title, company,
   │  location, AND the visible "About the job" description text (Option A)
   ▼
[Background worker]  POST /match-report  (credentials: include)
   │      body: { externalId, source, title, company, location, jobDescription }
   ▼
[Backend]  MatchReportService.generate(userId, body):
   │    a. résumé = findDefaultByUserId(userId)  (404→null "no résumé" report)
   │    b. resumeScores = ResumeScorerService.scoreResume(résumé.id)   // ats/quality/breakdown/suggestions
   │    c. match = MatchExternalJobUseCase.execute(userId, {title,company,location})
   │    d. reqs = AiClient.extractJobRequirements({jobTitle:title, jobDescription})
   │    e. skills = match reqs vs résumé skills (SkillGapService logic) → matched/missing
   │    f. persist a MatchReport row (payload JSON), return { id }
   ▼
[Extension]  opens  {VITE_WEB_URL}/match-report/{id}  in a new tab
   ▼
[Web app]  GET /match-report/{id}  → renders the full report (all sections, no paywall)
```

**Privacy note (Option A):** `jobDescription` is used to extract requirements and is
stored inside the report payload for display. Do NOT create a general job-listing store;
it lives only on the user's own report row. Keep the "only the user's report" scoping.

---

## 4. Backend work (`jobfit-backend`)

### 4.1 Prisma model + migration
```prisma
model MatchReport {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  externalId String
  source     String
  title      String
  company    String?
  payload    Json     // the full rendered report (see §5)
  createdAt  DateTime @default(now())
  @@index([userId])
  @@map("match_reports")
}
```
Run `npx prisma migrate dev`. (Supabase DATABASE_URL is single-quoted in `.env`.)

### 4.2 Module `src/modules/match-report/`
- `match-report.module.ts` (register in `app.module.ts`), controller, service, repository, DTOs.
- Inject: `ResumeScorerService`, `ResumeRepository`, `MatchExternalJobUseCase`, `AiClient`,
  `SkillGapService` (or its matching helper), `PrismaService`. Ensure these are exported by
  their own modules or provided here.

### 4.3 Endpoints (auth-protected by the global guard)
- `POST /match-report` — body DTO `CreateMatchReportDto` (whitelist ALL fields the
  extension sends: `externalId, source, title, company?, location?, jobDescription`).
  Returns `{ id: string }`.
- `GET /match-report/:id` — owner-only (403 if `report.userId !== user.id`). Returns the
  stored `payload`. Return **`null`** (not undefined) if not found.

### 4.4 Composition rules
- If the user has no parsed résumé → still return a report with `resume: null` and a clear
  "upload a résumé" flag (don't 500).
- If the AI service is down → `extractJobRequirements` throws; catch it and set
  `skills: { available: false }` (the rest of the report still renders).
- Surface `suggestions` ungated (no tier gate — see §1).

---

## 5. Report payload contract (`payload` JSON — the web page renders this)

```jsonc
{
  "job": { "externalId": "…", "source": "linkedin", "title": "…", "company": "…", "location": "…" },
  "matchRate": {
    "overall": 74,
    "subScores": { "skills": 70, "experience": 90, "location": 80, "salary": 50, "other": 50 },
    "semantic": true
  },
  "searchability": {              // from résumé ATS score
    "atsScore": 62,
    "breakdown": { "formatting": 70, "keywords": 55, "parsing": 80, "length": 60, "contact": 90 },
    "checks": [                   // derive from parsed résumé (present/absent)
      { "label": "Contact info", "status": "pass" },
      { "label": "Education section", "status": "fail" },
      { "label": "Work experience section", "status": "warn" },
      { "label": "Job title present in résumé", "status": "fail" }
    ]
  },
  "skills": {                     // OPTION A — from extractJobRequirements + matching
    "available": true,
    "hard": [ { "skill": "Fermentation", "inResume": false, "count": 1 } ],
    "soft": [ { "skill": "Communication skills", "inResume": true, "count": 1 } ],
    "matchedCount": 3, "missingCount": 11
  },
  "recruiterTips": {              // from quality score + suggestions
    "qualityScore": 55,
    "suggestions": ["Add a summary section", "Add measurable results", "…"]
  },
  "resume": { "id": "…", "fileName": "…", "summaryPresent": false }
}
```
Keep the field names stable — the web page and any future consumers depend on them.

---

## 6. Extension work (`jobfit-extension`)

Follow the established patterns (see existing features for reference):
- **Capture the description** — in `src/content/sites/linkedin.ts` add `getDescription():
  string | null` reading the "About the job" container (resilient selectors, fail-silent).
  Cap length (e.g. 8000 chars). Add it to the `SiteAdapter` interface (`sites/types.ts`).
- **Message** — `src/shared/messaging.ts`: add
  `{ type: "CREATE_MATCH_REPORT"; externalId; source; title; company; location; jobDescription }`
  → response `DataResult<{ id: string }>`.
- **Data adapter** — `src/data/matchReport.ts`: `real()` = `api.post("/match-report", body)`;
  add a `source.ts` flag (`matchReport: "real"`). (A mock is optional.)
- **Worker handler** — `src/background/features.ts` + route in `src/background/index.ts`.
- **Button** — in `src/content/JobFitApp.tsx` add a "📊 Full Report" button (jf- prefixed,
  token classes). On click: send `CREATE_MATCH_REPORT`; on `{ok, data:{id}}` →
  `window.open(`${WEB_APP_URL}/match-report/${id}`, "_blank", "noopener")`. `WEB_APP_URL`
  is in `src/shared/config.ts`. Show a loading + error state on the button.
- **Constraints**: content UI = Shadow DOM, `jf-` prefixed Tailwind, token colors only,
  the only inline styles allowed are dynamic (width) — see other content components.

---

## 7. Web app work (`jobfit-frontend`)

- New page `src/app/(seeker)/match-report/[id]/page.tsx` (App Router). Auth-gated like
  other seeker pages.
- Fetch with the existing `apiClient` (`src/lib/api/client.ts`) → `GET /match-report/:id`.
- Render the §5 payload as clean sections using the **existing purple design tokens**
  (`bg-card`, `text-content`, `border-border`, `bg-primary-600`, semantic aliases) — match
  the web app's look. **No blurred/locked rows, no upgrade CTA** (the opposite of Jobscan).
- Sections in order: **Match Rate** (big % + sub-score bars) → **Searchability** (ATS score
  + checks) → **Skills** (hard/soft tables, matched vs missing) → **Recruiter Tips**
  (quality score + suggestions) → **Formatting** (from ATS formatting sub-score).
- Handle: report not found (404), report with `resume: null` (prompt to upload),
  `skills.available: false` (AI was down — show a soft notice).

---

## 8. Implementation order (do in this sequence, verify each)

1. **Backend model + migration** (`MatchReport`).
2. **Backend `MatchReportService.generate`** composing résumé scores + match + requirement
   extraction + skill matching. Unit-test the composition with a known user.
3. **Backend endpoints** `POST/GET /match-report` (+ DTO whitelisting, owner scoping, null-not-undefined).
4. **Verify backend directly** (curl/Swagger, logged-in token): POST a report with a sample
   description → 200 `{id}`; GET it → full payload. Confirm skills table populates.
5. **Web app report page** — render the payload; verify with the id from step 4.
6. **Extension** — description capture + message + worker + "Full Report" button → open page.
7. **End-to-end**: on a real LinkedIn job, click Full Report → new tab shows the report.

---

## 9. Testing / verification

- Backend running (`:4000`) + Redis (`docker compose up -d`) + AI service (`:8000`, IPv4) +
  web app (`:3000`); logged in on `localhost:3000`; extension `.env` on localhost, rebuilt.
- There is a real test account with a parsed résumé: **`soviseth869@gmail.com`** (ask the
  user for the password; do not hardcode it). Its default résumé is parsed `SUCCESS`.
- Confirm empty/edge states: no résumé → graceful; AI down → skills section soft-fails;
  not-owner GET → 403; missing report → clean 404.

---

## 10. Conventions checklist (don't regress these)

- [ ] Return `null` (never `undefined`) for empty/not-found on any extension-facing route.
- [ ] Whitelist EVERY field the extension sends in the DTO (`forbidNonWhitelisted`).
- [ ] AI service URL uses `127.0.0.1`, not `localhost`.
- [ ] No premium/tier gating anywhere in the extension or its report (all free).
- [ ] Extension content UI: Shadow DOM, `jf-` prefix, token colors, no hardcoded hex.
- [ ] Web page: existing purple tokens, no locked/blurred rows, no upsell.
- [ ] Scope everything to the current user (owner-only reports).
- [ ] All three repos must typecheck/build green before calling it done.

---

## 11. Context you may want (prior work, for background)

- `docs/PROGRESS.md` — extension phase/status tracker; which data features are real vs mock.
- `docs/CONTRACTS.md` — existing extension↔backend contracts.
- `docs/RESUME_PIPELINE_FIX.md` — the résumé-parsing infra fixes (AI IPv4, Redis).
- `docs/MATCH_REPORT_PLAN.md` — the higher-level proposal this spec implements (Option A chosen).
- The match scorer was recently tuned for discrimination (skills-dominant, external path
  only) in `match-external-job.use-case.ts` — don't undo that.
