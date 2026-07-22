# Real-backend integration status

Findings from probing the **deployed** API (`jobfit-backend-…run.app/api/v1`) and reading
`jobfit-backend` + `jobfits-ai-service` locally. Date: 22 July 2026.

**Bottom line: the mocks cannot be switched off yet.** Not because of wiring — because of
two structural gaps described below.

---

## 1. What is already REAL (no mock involved)

| Feature | Endpoint | Status |
|---|---|---|
| Auth / signed-in user (Phase 1) | `GET /auth/me`, `POST /auth/refresh-token` | ✅ live, verified |
| Quick Apply Tracker (Phase 6) | `GET /applications` + `GET /jobs/{id}` | ✅ live, verified |

## 2. What does NOT exist on the deployed backend

Probed with a real body; `404` = route absent (control routes behaved as expected,
e.g. `POST /auth/login` → `400`, confirming the method is sound).

| Extension feature | Expected endpoint | Result |
|---|---|---|
| Sub-score badge | `GET /recommendations/by-job` | **404** |
| Skill gaps | `GET /learning/gap` | **404** |
| Company panel | `GET /companies/by-name` | **404** |
| Salary panel | `GET /salary` | **404** |
| Scout alerts | `GET /recommendations/scout` | **404** |
| Deadline chip | `GET /saved-jobs/deadline` | **404** |
| Cover letter | `POST /generate/cover-letter` | **404** |

The relevant backend *modules* exist (`matching`, `company`, `learning`, `generation`,
`saved-job`) — what's missing is extension-facing routes keyed by `externalId`+`source`.

---

## 3. BLOCKER A — the DB has no LinkedIn jobs

`Job` has `source` + `externalId` with `@@unique([source, externalId])`, so a by-external-id
lookup is *architecturally* fine. But ingestion has exactly **one source: TheMuse**
(`src/modules/ingestion/sources`). There is no LinkedIn or Indeed ingestion — and per the
project's TOS rule there must never be, since that would mean scraping listings.

**Consequence:** the extension runs on LinkedIn and reads LinkedIn job IDs. Those IDs will
never match a `Job` row. Building `GET /recommendations/by-job` as a *lookup* would return
"not found" for effectively **every** LinkedIn job a user views — i.e. switching off the
mocks would make the extension show empty states everywhere. Strictly worse than today.

**Fix required:** match **ad hoc** rather than by lookup — score the job from the
identifiers we're allowed to send (title + company) against the user's profile/résumé,
computed on the fly. The AI service already has `/embed` and `/resume/score`, so semantic
scoring against résumé text is feasible without storing anything.

## 4. BLOCKER B — the AI service requires the job description

`jobfits-ai-service` → `POST /generate/cover-letter` takes:

```py
class CoverLetterRequest(CamelModel):
    resume_summary: str    = Field(..., min_length=1)
    job_title: str         = Field(..., min_length=1)
    company_name: str      = Field(..., min_length=1)
    job_description: str   = Field(..., min_length=1)   # ← REQUIRED, non-empty
    tone: str = "professional"
```

The extension's hard privacy/TOS constraint is that it **never scrapes or transmits the job
description** — only identifiers. These two contracts are directly incompatible.

The backend wrapper is also application-shaped: `POST /applications/:id/cover-letter`
requires an existing JobFit application, so it can't serve an arbitrary LinkedIn job.

**Fix options:**
1. Make `job_description` **optional** in the AI service and let the prompt degrade to
   title + company + résumé. Small, clean change; respects the TOS rule. *(recommended)*
2. Send the description → **violates the stated constraint**; not recommended.
3. Offer cover letters only for jobs applied to through JobFit → works today via the
   existing endpoint, but not on arbitrary LinkedIn pages.

---

## 5. Work required to remove the mocks

Per endpoint, in `jobfit-backend` (all thin routes over existing services):

| Endpoint | Approach |
|---|---|
| `GET /recommendations/by-job` | Ad-hoc score from `title`+`company` vs. user profile (see Blocker A) |
| `GET /learning/gap` | Diff job's inferred skills vs. user skills; reuse `learning` module |
| `GET /companies/by-name` | Lookup `Company` by name (fuzzy); already has the table |
| `GET /salary` | Aggregate over `Job.minSalary/maxSalary` for title+company |
| `GET /saved-jobs/deadline` | Add a deadline field / expose from `saved-job` |
| `GET /recommendations/scout` | Query recent high-score recommendations for the user |
| `POST /generate/cover-letter` | New route accepting `externalId/source/company/role`, calling the AI service (needs Blocker B fixed) |

Once each lands, flip **one flag** in `src/data/source.ts` — no extension UI changes.

---

## 6. Honest note on data quality

Everything except auth and the tracker is currently **deterministic mock data**. It looks
plausible but is fabricated. It must not be shown to real users as if it were real
analysis — see the pre-submission checklist in `STORE_LISTING.md`.
