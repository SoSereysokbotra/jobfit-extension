# Full-Page Match Report (Jobscan-style) — Design for Review

> **Status: PROPOSAL — no code written yet.** You asked me to describe it first.
> Goal: a clean, professional, full-page résumé↔job report (like Jobscan's
> `app.jobscan.co/match-report/…`), opened from the extension's badge, **with no
> paywall** — every section unlocked.
>
> _Date: 2026-08-10_

---

## 1. Is it feasible? YES — and most of it is already built.

Your backend already computes, per résumé:
- **`atsScore`** (0–100) = 20% formatting + 30% keywords + 20% parsing + 15% length + 15% contact
- **`qualityScore`** (0–100) = 30% content + 25% completeness + 20% grammar + 25% keyword quality
- a **`breakdown`** (sub-scores) + **`suggestions`** (actionable fixes)
- endpoints: `/resumes/:id/ats-score`, `/quality-score`, `/scores`, `POST /score`

It also has:
- **Résumé parsing** (skills, experience, education, summary, contact) — already working
- **Match scoring** — the improved, discriminating one we just built
- **`extractJobRequirements(description)`** on the AI service (`/job/requirements`) — pulls the checkable skills/requirements out of a job description
- **Skill-gap** comparison (résumé skills vs job requirements)

So the report is mostly **composition of things that already exist**, not new ML.

---

## 2. The flow (mirrors what you saw on Jobscan)

```
Extension badge ──[ 📊 Full Report ]──► content script gathers job data
      │
      ▼
  POST /match-report  { externalId, source, title, company, [jobDescription] }
      │  backend: run résumé scores + match + (skills vs requirements) → store → returns { id }
      ▼
  Extension opens  {WEB_APP}/match-report/{id}  in a new tab
      │
      ▼
  Web page GET /match-report/{id} → renders the full, clean report
```

This matches Jobscan exactly: a **Scan** button → a **full report page** on the web app (roomy, professional, trustworthy — not the cramped in-page badge).

---

## 3. Sections (Jobscan → JobFit mapping)

| Jobscan section | JobFit source | Needs job description? | Status |
|---|---|---|---|
| **Match Rate** | the improved match score + sub-scores | no | ✅ built |
| **Searchability / ATS** | résumé `atsScore` + breakdown + suggestions (contact info, section headings, length, parseability, job-title presence) | no | ✅ built |
| **Recruiter Tips** | résumé `qualityScore` breakdown + suggestions (summary present, measurable results, tone, web presence, word count) | no | ✅ mostly built |
| **Formatting** | ATS formatting sub-score + suggestions | no | ✅ built |
| **Hard / Soft Skills table** | `extractJobRequirements(description)` → compare vs résumé skills | **YES** | ⚠️ needs the description |

**Takeaway:** everything except the skills-comparison table is **résumé-only** and already computed. That table is the one part that needs the job description.

---

## 4. The ONE real decision: the job description ⚠️

Jobscan's skills tables work because it reads the **job description you're viewing**.
JobFit's extension, by original design, sends **only `externalId` + `source` + `title`**
— the hard constraint from the build plan was *"never scrape or store job listings"*
(LinkedIn TOS).

To get the **Hard/Soft Skills matching table** (the most impressive, trust-building
part), the backend needs the description text. Two options:

- **Option A — full Jobscan parity.** Capture the **visible** description client-side
  when the user clicks *Full Report*, send it for a **one-time** analysis, and **don't
  store the listing** (keep only the derived report). This is exactly what Jobscan does.
  → Unlocks the skills tables.
  → ⚠️ It's a deliberate shift from "only externalId+source." It's **user-initiated and
    ephemeral** (not bulk scraping), which is lower-risk, but for a **published** Web
    Store extension, sending LinkedIn job text to a server still carries some TOS /
    store-review risk. Your call.

- **Option B — stay conservative.** Don't send the description. The report still has
  **Match Rate + Searchability + Recruiter Tips + Formatting** (all résumé-driven and
  genuinely useful), just **no skills-comparison table**. Zero new TOS exposure.

**My recommendation:** **Option A** — it's what makes it feel like Jobscan and gives the
"more information the user can trust" quality you liked. But if the TOS risk isn't worth
it for the store, **Option B** is still a large upgrade over the tiny badge.

---

## 5. What's NEW to build

1. **Backend**
   - `POST /match-report` — compose {résumé ats/quality scores + breakdown + suggestions}
     + {match score + sub-scores} + (Option A) {skills extracted from the description vs
     résumé skills}. Store as a `MatchReport` row → return `{ id }`.
   - `GET /match-report/:id` — fetch a stored report (owner-only).
   - A `match_reports` table (id, userId, externalId, source, title, company, payload JSON, createdAt).
2. **Web app** (`jobfit-frontend`)
   - A full page `/match-report/[id]` — clean, sectioned, JobFit purple, **no locked/blurred
     rows, no upgrade CTA** (opposite of Jobscan). Sections: Match Rate, Searchability,
     Skills (A only), Recruiter Tips, Formatting.
3. **Extension**
   - A **"📊 Full Report"** button on the badge (next to Company) that POSTs the report and
     opens `{WEB_APP}/match-report/{id}`.

## 6. What's REUSED (already built — no rework)
Résumé parsing · `atsScore`/`qualityScore` + breakdown + suggestions · match scoring ·
`extractJobRequirements` + skill-gap.

---

## 7. Open questions for you

1. **Option A or B** for the job description? (Decides whether we get the skills tables.)
2. **Persist reports** (a stored `/match-report/{id}` link you can revisit + a "scan
   history" in the web app) or **generate on the fly** (ephemeral, no storage)?
3. **Button placement** — a "Full Report" button on the badge (my default), and/or also
   reachable from the web app?
4. The extension **must be logged in** for this (needs your résumé + identity) — fine?

Tell me 1–4 and I'll build it. Nothing is coded yet.
