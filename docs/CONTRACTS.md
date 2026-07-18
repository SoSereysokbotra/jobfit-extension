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

## P0 · Sub-score match — `GET /recommendations/by-job`

Powers the sub-score radar badge (Phase 3).

**Query:** `externalId` (string, the job id from the page URL), `source` (`"linkedin"` | `"indeed"`).

**200 →** `data`:
```jsonc
{
  "externalId": "3901234567",
  "source": "linkedin",
  "overall": 87,               // 0–100, integer
  "subScores": {
    "skills": 82,              // maps to recommendations.skillsMatch
    "experience": 91,          // recommendations.experienceMatch
    "location": 80,            // recommendations.locationMatch
    "salary": 65,              // recommendations.salaryMatch
    "culture": 79              // recommendations.cultureMatch
  }
}
```
**No match computed for this job →** `204 No Content` (or `404`). The adapter maps either
to the UI's **empty** state ("No match data yet").

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
      "learningPath": {          // null for FREE tier (gaps only); object for PREMIUM+
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

> **Tier gating:** the `learningPath` object is populated only for Premium/Professional.
> Tier isn't on `/auth/me` (it lives in `subscriptions`) — see
> [`src/data/tier.ts`](../src/data/tier.ts) for how the extension resolves it (mocked for now).
