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
