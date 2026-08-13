# Extension ↔ Backend API Contracts

These are the endpoints the extension needs that **do not exist on the backend yet**.
Each feature ships behind a data-source **adapter** with a **mock** implementation that
matches the contract below. When the real endpoint lands, flip its flag in
[`src/data/source.ts`](../src/data/source.ts) from `"mock"` to `"real"` — no UI change.

All endpoints:
- Are under the API base (`/api/v1`), authenticated by the same cookie-SSO/bearer flow
  as the rest of the app (the background worker attaches the token + `credentials:"include"`).
- Return the standard envelope `{ success, statusCode, timestamp, data }`; the worker
  unwraps `data`. Errors use the standard `{ statusCode, message, code? }` shape.
- Receive **only** `externalId` + `source` for a job — never scraped page content.

---

## P0 · Sub-score match — `GET /recommendations/by-job` ✅ IMPLEMENTED

Powers the sub-score badge (Phase 3). Built in `jobfit-backend`
(`matching/application/use-cases/match-external-job.use-case.ts`).

**Scored ad hoc, not looked up.** Our DB only ingests TheMuse, and scraping listings is
forbidden — so a LinkedIn `externalId` never matches a `Job` row. The backend instead
scores the identifiers we send against the user's profile with the *same* scorers the
web app uses. Nothing about the posting is stored.

**Query:** `externalId`, `source`, `title` (**required** — nothing to score without it),
`company` (optional), `location` (optional), `remoteType` (optional,
`REMOTE|HYBRID|ON_SITE`).

**200 →** `data`:
```jsonc
{
  "externalId": "3901234567",
  "source": "linkedin",
  "overall": 87,               // weighted total, 0–100
  "subScores": {
    "skills": 82,              // 40% — cosine(profile vector, embedded "title at company")
    "experience": 91,          // 25%
    "location": 80,            // 15%
    "salary": 65,              // 10% — falls back to the company's known salary band
    "other": 79                // 10% — industry alignment (NOT "culture")
  },
  "semantic": true             // false ⇒ skills used a neutral fallback; don't over-trust
}
```
**No profile to match against →** `204 No Content` → UI **empty** state. The endpoint
never fabricates a score.

> `semantic: false` means the candidate had no stored embedding or the AI service was
> unreachable; the deterministic sub-scores still stand and the UI says the skills score
> is approximate.

---

## P0 · Company intelligence — `GET /companies/by-name`

Powers the company fit sidebar (Phase 4).

**Query:** `name` (string, company display name).

**200 →** `data`:
```jsonc
{
  "name": "Google",
  "glassdoorRating": 4.3,      // number | null
  "fundingStage": "IPO",       // string | null  (companies.fundingStage)
  "hiringVelocity": "HIGH",     // "LOW" | "MEDIUM" | "HIGH" | null
  "openRoles": 8,               // integer | null
  "salaryRange": {              // nullable; from salary_data aggregate
    "min": 145000,
    "max": 195000,
    "currency": "USD",
    "dataPoints": 34
  },
  "topMatches": [               // the user's best matches at this company; may be []
    { "title": "Senior Backend", "score": 87 },
    { "title": "Staff Engineer", "score": 72 }
  ]
}
```
**Company not found →** `204`/`404` → UI **empty** state.

---

## P0 · Skills gap — `GET /learning/gap`

Powers the skills-gap action cards (Phase 5).

**Query:** `jobExternalId` (string), `source` (`"linkedin"` | `"indeed"`).

**200 →** `data`:
```jsonc
{
  "jobExternalId": "3901234567",
  "source": "linkedin",
  "gaps": [
    {
      "skill": "Kubernetes",
      "demandCount": 847,        // "required by N jobs you'd fit"
      "jobsWithoutSkill": 12,    // "see N jobs without X"
      "learningPath": {          // null when no path exists for the skill
        "id": "lp_k8s_101",
        "title": "Kubernetes for Backend Engineers",
        "durationWeeks": 3,
        "isFree": true
      }
    }
  ]
}
```
**No gaps (strong match) →** `data.gaps: []` → UI **empty** state ("No skill gaps 🎉").

---

## P1 · Salary intelligence — `GET /salary`

Powers the salary panel (Phase 8).

**Query:** `company` (string), `role` (string, the job title).

**200 →** `data`:
```jsonc
{
  "company": "Google",
  "role": "Senior Backend Engineer",
  "listed": { "min": 145000, "max": 195000, "currency": "USD" },  // nullable
  "market": {
    "p25": 130000,
    "p50": 165000,
    "p75": 200000,
    "totalCompAvg": 235000,
    "currency": "USD",
    "dataPoints": 34
  },
  "fitPercentile": "P50",       // "P25" | "P50" | "P75" — where the user's profile lands
  "tip": "Ask for $182K–$200K based on your P50 fit."
}
```
**No salary data →** `204`/`404` → UI **empty** state.

> **No tier gating.** Every feature is available to all signed-in users.

---

## P1 · Cover letter generation — `POST /generate/cover-letter`

Powers the "✨ Generate with JobFit AI" button injected into LinkedIn Easy Apply
(Phase 9). Backed by Qwen 3 per the feature spec.

**Body:**
```jsonc
{
  "externalId": "3901234567",
  "source": "linkedin",
  "company": "Google",                  // nullable — display name only
  "role": "Senior Backend Engineer"     // nullable — job title only
}
```

> **Privacy:** only these identifiers are sent. The **job description / posting body is
> never scraped or transmitted** — the backend composes the letter from the user's own
> profile + résumé plus the job it resolves from `externalId`. (`company`/`role` are the
> same class of identifier already sent to `GET /companies/by-name`.)

**200 →** `data`:
```jsonc
{
  "text": "Dear Hiring Manager,\n\n…",   // the generated letter, plain text
  "model": "qwen3-32b"                    // nullable, for display/debugging
}
```

**Generation unavailable / no résumé on file →** `204`/`404` → UI **empty** state.
Rate-limited or model failure → normal error body; the UI shows the message with a retry.

---

## P3 · Job scout — `GET /recommendations/scout`

Powers the passive background scout (Phase 11). Called by the service worker on a
`chrome.alarms` schedule (every 3h) **only when the user has opted in**.

**Query:** `minScore` (integer 0–100), `since` (ISO timestamp of the last check, or omitted on first run).

**200 →** `data`: jobs matching the user's profile at/above `minScore`, created since `since`.
```jsonc
[
  {
    "externalId": "3928471056",
    "source": "linkedin",
    "title": "Senior Backend Engineer",
    "company": "Wise",          // nullable
    "score": 91,
    "url": "https://www.linkedin.com/jobs/view/3928471056"
  }
]
```
Return `[]` when there's nothing new — the worker notifies at most **3 per run**,
best-score first, and never re-notifies a job it has already sent.

---

## P2 · Duplicate application detector — `GET /applications/similar`

Powers the "Application Radar" warning (Phase 10). Cross-references the user's
`applications` (fuzzy title + company; backend may use `jobs.embedding` similarity).

**Query:** `externalId`, `source`, `jobTitle`, `companyName`.

**200 →** `data` (or `204`/`null` when there's no prior application):
```jsonc
{
  "applicationId": "app_123",
  "jobTitle": "Senior Backend",
  "companyName": "Google",
  "status": "SUBMITTED",          // ApplicationStatus enum
  "appliedAt": "2026-06-02T10:00:00.000Z"
}
```

---

## P2 · Interview prep — `POST /generate/interview`

Powers the interview-prep panel (Phase 10, Qwen 3). Body: `{ externalId, source, company, role }`
(identifiers only — no page content). The backend composes prep from the user's
profile and the job it already knows by `externalId`.

**200 →** `data`:
```jsonc
{
  "questionTypes": [
    { "label": "System Design", "pct": 40 },
    { "label": "Behavioral",    "pct": 30 },
    { "label": "Coding",        "pct": 30 }
  ],
  "topQuestions": ["…", "…"],
  "model": "qwen3"
}
```

---

## P2 · Momentum score — `GET /analytics/my-stats` *(REAL — already exists)*

Powers the popup momentum widget (Phase 10). This endpoint **already exists**
(`AnalyticsStatsResponseDto`); the extension derives the 0–100 momentum from it
client-side, so no new endpoint is needed — `DATA_SOURCE.momentum` is `"real"`.

```jsonc
{
  "totalApplications": 7, "totalInterviews": 2, "totalOffers": 1,
  "applicationRate": 0.29, "interviewRate": 0.5, "offerRate": 0.14,
  "profileViewCount": 34, "lastProfileViewDate": "2026-08-01T…"
}
```

---

## P4 · Full-page match report — `POST /match-report` + `GET /match-report/{id}`

Powers the badge's **📊 Full Report** button (2026-08-12). The extension POSTs, gets
`{ id }` back, and opens `{WEB_APP_URL}/match-report/{id}` in a new tab; the web app
renders the stored payload. Both routes require auth; the GET is **owner-only** (403).

> **⚠️ The one endpoint that receives page content.** `jobDescription` is the visible
> "About the job" text, read **only on the click** (`SiteAdapter.getDescription`, capped
> at 8000 chars) and sent **once** so the backend can extract the job's requirements.
> The posting is **not** stored as a listing — only the derived report is kept, on the
> user's own row. Every other contract in this file remains identifiers-only.

**POST body** (every field is whitelisted in `CreateMatchReportDto` — the backend's
`forbidNonWhitelisted` rejects anything else):
```jsonc
{
  "externalId": "4207112233",
  "source": "linkedin",
  "title": "Frontend Engineer",     // required — the report is about this role
  "company": "Acme",                // nullable
  "location": "Phnom Penh",         // nullable
  "jobDescription": "About the job…"
}
```

**200 →** `data`: `{ "id": "uuid" }`

**GET → `data`** (the stored payload; `null` when the report doesn't exist). Every
section is nullable on purpose — no profile, no parsed résumé and "the AI service was
down" are three different partial reports, each rendered honestly rather than as a zero:
```jsonc
{
  "job": { "externalId": "…", "source": "linkedin", "title": "…", "company": "…", "location": "…" },
  "matchRate": {                       // null when the user has no profile
    "overall": 74,                     // NULL when semantic:false — see below
    "subScores": { "skills": 70, "experience": 90, "location": 80, "salary": 50, "other": 50 },
    "semantic": true,
    "experience": {                    // what subScores.experience actually measured
      "basis": "REQUIREMENT",          // or "CV_DEPTH" — see below
      "requiredYears": 4, "candidateYears": 3, "met": false
    }
  },
  "searchability": {                   // null when there's no parsed résumé
    "atsScore": 62,
    "breakdown": { "formatting": 70, "keywords": 55, "parsability": 80 },
    "checks": [
      { "label": "Contact info", "status": "pass" },
      { "label": "Education section", "status": "fail", "hint": "…" }
    ]
  },
  "skills": {
    "available": true,                 // false = extraction was unavailable (NOT "no requirements")
    "hard": [ { "skill": "Experience with React", "inResume": true, "count": 3,
                "matchedSkills": ["React"], "matchQuality": "EXACT" } ],
    "soft": [ { "skill": "Communication", "inResume": false, "count": 2 } ],
    "matchedCount": 3, "missingCount": 11
  },
  "recruiterTips": {                   // null when there's no parsed résumé — UNGATED
    "qualityScore": 55,
    "suggestions": ["Add measurable results", "…"]
  },
  "resume": { "id": "…", "fileName": "cv.pdf", "summaryPresent": false },  // null if none
  "needsResume": false,
  "generatedAt": "2026-08-12T09:00:00.000Z"
}
```
`count` is how often the posting mentions the row's subject (a requirement's most-repeated
content word), so the tables rank by what the job actually emphasises.

> **`semantic: false` ⇒ `matchRate.overall: null`** (2026-08-12). Skills is the only
> sub-score that measures fit to THIS role. When the embedding is unavailable (no
> candidate vector, or the AI service is down) there is no honest total to print, so the
> backend emits none and `subScores.skills` is a placeholder to render as "not computed".
> This applies to `GET /recommendations/by-job` too — the badge shows "—" instead of a %.
> Measured reason: the old degraded path substituted a neutral cosine of 0.5, which is
> exactly the remap CEILING, so it scored 100 and put unrelated jobs in the high 80s/90s.

> **`matchRate.experience.basis`** (2026-08-12). The shared experience scorer counts CV
> ENTRIES (0→40, 1→65, 2→80, 3+→90) and never sees the job, so it returns the same number
> for every posting a user opens — measured: 80% "Experience" on a Chemical Engineer role
> asking for 4+ years, identical to what an F&B role got. The REPORT has the posting text,
> so it reads the stated years bar out of the extracted requirements, ages the CV's own
> dates (overlaps counted once), scores the shortfall linearly and **re-blends the total**
> through the scorer's own function — `basis: "REQUIREMENT"`. With no bar stated or no
> datable entries it falls back to the count and says so — `basis: "CV_DEPTH"`, which the
> UI labels "CV depth" rather than "Experience". The badge (`/recommendations/by-job`) has
> no description, so it is always CV depth.

---

## P4 · Save Job — `POST /saved-jobs/external` (+ `GET`, `DELETE`)

Powers the badge's **Save Job** form (2026-08-13): a bookmark of a posting on a site we
don't ingest, with the fields the user can edit before saving.

> **NOT the web app's `/saved-jobs`.** That route keys on an internal `jobId` — a foreign
> key to our own `jobs` table — which a LinkedIn posting will never have. Faking `Job`
> rows would feed invented postings into recommendations and the matching batch, so
> external saves get their own table (`saved_external_jobs`).

> **Privacy.** Like the match report, this carries the posting text — but only what the
> USER chose to save, on their click, onto their own row. Re-saving the same posting
> UPDATES it (unique on `userId + source + externalId`), so Save twice = correct the
> salary, not a duplicate.

**POST body** (all whitelisted in `SaveExternalJobDto`; only `externalId`, `source` and
`title` are required):
```jsonc
{
  "externalId": "4207112233",
  "source": "linkedin",
  "title": "Interpreter — Khmer speaking (Work from home)",
  "company": "TP",
  "description": "About the job…",       // prefilled from the page, editable
  "url": "https://www.linkedin.com/jobs/view/4207112233",
  "salary": "$70k–90k",                  // FREE TEXT — postings write anything
  "notes": "Ask about the night shift"
}
```

**200 →** `data`: the saved job.
```jsonc
{
  "id": "uuid", "source": "linkedin", "externalId": "…",
  "title": "…", "company": "…", "description": "…", "url": "…",
  "salary": null, "notes": null,
  "savedAt": "2026-08-13T09:00:00.000Z"
}
```

Also:
- `GET /saved-jobs/external` → `data`: the user's saved jobs, newest first.
- `GET /saved-jobs/external/lookup?source=&externalId=` → `data`: the saved copy, or
  **`null`** when this posting isn't saved (the form opens blank rather than erroring).
- `DELETE /saved-jobs/external/{id}` → `data`: `{ "removed": true }`. Scoped to the owner
  in the WHERE clause, so a guessed id can't reach another account's row.
