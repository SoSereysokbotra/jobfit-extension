# JobFit Chrome Extension — Feature Upgrade Strategy

> Based on deep review of `jobfits-backend/docs/` — including the AI integration plan (Qwen 3 / BGE-M3), ER diagram, API reference, user flows, and observability stack.

---

## What You Already Have (Backend-Confirmed)

| Capability | Status | Where |
|---|---|---|
| Resume parsing (Qwen 3) | Planned Phase 1 | `resume-parser.service.ts` |
| Semantic job matching (BGE-M3 embeddings + pgvector) | Planned Phase 3 | `matching/domain/scoring/*` |
| AI cover letter generation | Planned Phase 4 | `/generate/cover-letter` |
| AI interview coaching | Planned Phase 4 | `/generate/interview` |
| Application tracking pipeline | Built | `applications` + `application_timeline` tables |
| Learning paths + skill gap detection | Built | `learning_paths` + `learning_progress` tables |
| Salary data per company/role | Built | `salary_data` table |
| Subscription tiers (Free/Premium/Professional) | Built | `subscriptions` table (Stripe) |
| Company data (Glassdoor rating, funding, hiring velocity) | Built | `companies` table |
| Referral program | Built | `referrals` table |

> [!IMPORTANT]
> Every feature below maps directly to an **already-designed backend entity or planned AI endpoint** — you're not starting from scratch. This is about surfacing existing power through the extension UI.

---

## Feature Suggestions — Grouped by Tier

---

### 🏆 Tier 1: MUST-HAVE Differentiators (High impact, unique to JobFit)

---

#### 1. Real-Time Semantic Match Score with Sub-Score Breakdown

**What it does:**
Instead of a single `87%` number, the badge expands into a radar/spider chart with 5 dimensions based on your **actual DB schema**:

```
┌──────────────────────────────────────────────┐
│  JobFit Match: 87%  ⭐  [Senior Backend @ Google]
│                                              │
│  Skills Match    ████████░░  82%             │
│  Experience      █████████░  91%             │
│  Location        ████████░░  80%             │
│  Salary Range    ██████░░░░  65%  ⚠️          │
│  Culture Fit     ████████░░  79%             │
└──────────────────────────────────────────────┘
```

**Why unique:** Competitors show a single score. Your backend already stores **5 separate sub-scores** per recommendation (`skillsMatch`, `experienceMatch`, `locationMatch`, `salaryMatch`, `cultureMatch`). The extension just needs to visualize them.

**Backend mapping:** `recommendations` table — all 5 sub-score columns already exist.

---

#### 2. "Skills Gap" Instant Action Cards

**What it does:**
Below the match explanation, show **actionable gap cards** tied to your `learning_paths` table:

```
┌──────────────────────────────────────────────────┐
│ ⚠️ Gap: Kubernetes                                │
│    Required by 847 jobs you'd be a fit for        │
│                                                  │
│    📚 [Start Learning Path]  →  3 weeks, free     │
│    🎯 [See 12 jobs without Kubernetes required]   │
└──────────────────────────────────────────────────┘
```

**Why unique:** No extension does this. You're not just telling users they're missing a skill — you're solving the problem in-context with your own learning infrastructure.

**Backend mapping:** `learning_paths` + `learning_progress` already in DB.

---

#### 3. Company "Fit Intelligence" Sidebar

**What it does:**
When hovering over a company name on LinkedIn/Indeed, a sidebar panel appears showing JobFit-enriched data from your backend:

```
┌─────────────────────────────────────┐
│  Google                    [Follow] │
│  ⭐ 4.3 Glassdoor  •  IPO           │
│  Hiring Velocity: 🔥 HIGH           │
│                                     │
│  Your matches at Google:            │
│  ├─ Senior Backend  87% ✅          │
│  ├─ Staff Engineer  72%             │
│  └─ Tech Lead       68%             │
│                                     │
│  Salary range for this role:        │
│  $145K – $195K + equity             │
│  (Based on 34 verified data points) │
│                                     │
│  [View 8 open roles at Google]      │
└─────────────────────────────────────┘
```

**Why unique:** Users currently have to Google each company separately. You already have `glassdoorRating`, `fundingStage`, `hiringVelocity`, and `salary_data` in your schema.

**Backend mapping:** `companies` + `salary_data` tables.

---

#### 4. Application Deadline Urgency Layer

**What it does:**
Jobs with approaching deadlines get a countdown indicator injected next to the match badge:

```
[JobFit: 87% ⭐]  [⏰ Closes in 3 days]
```

And the extension sends a browser notification (opt-in):
> "🔔 A job you saved at Google closes in 48 hours. You have an 87% match."

**Why unique:** LinkedIn doesn't do this well. Users forget saved jobs. You have `deadline` in `saved_jobs` and `jobs` tables.

**Backend mapping:** `saved_jobs.deadline` + `notifications` table + existing notification preference system.

---

#### 5. One-Click Cover Letter Injection (Premium)

**What it does:**
When user opens LinkedIn's "Easy Apply" modal, the extension detects the form and injects a "Generate Cover Letter" button using Qwen 3:

```
LinkedIn Easy Apply Modal:
┌─────────────────────────────────────────┐
│ Cover Letter (optional)                 │
│ ┌─────────────────────────────────────┐ │
│ │ [✨ Generate with JobFit AI]         │ │  ← Injected
│ │                                     │ │
│ │ Generating...                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│   [Next] [Back]                         │
└─────────────────────────────────────────┘
```

The cover letter is tailored using your AI service: `POST /api/v1/generate/cover-letter` with resume summary + job details extracted from the page.

**Why unique:** This is the most direct ROI feature for job seekers. A tailored cover letter in 2 clicks inside LinkedIn's own apply flow.

**Backend mapping:** `AiModule` → `/api/v1/generate/cover-letter` (Qwen 3). **Tier-gated: Premium+**.

---

### 🥇 Tier 2: STRONG Differentiators (Medium lift, high retention)

---

#### 6. "Application Radar" — Duplicate Application Detector

**What it does:**
Before user applies, the extension cross-references against `applications` table and shows:

```
┌────────────────────────────────────────────────┐
│ ⚠️  You applied to this role 45 days ago       │
│                                                │
│  Status: Waiting (no response)                 │
│  Applied: June 2, 2026                         │
│                                                │
│  This may be the same role re-listed.          │
│  [View your original application]              │
│  [Apply again anyway]                          │
└────────────────────────────────────────────────┘
```

Matching is done by `companyId` + fuzzy job title (using your BGE-M3 embedding similarity — the job embedding already exists in `jobs.embedding`).

**Why unique:** A small but incredibly useful quality-of-life feature that no competitor has. Prevents embarrassment and saves time.

**Backend mapping:** `applications` table + `jobs.embedding` cosine similarity.

---

#### 7. Salary Negotiation Intelligence Panel

**What it does:**
When a job shows a salary range (or doesn't), the extension enriches it:

```
┌────────────────────────────────────────────────┐
│ 💰 Salary Intelligence                         │
│                                                │
│ Job listed: $130K – $160K                      │
│                                                │
│ JobFit market data:                            │
│ ├─ P25 (entry):    $128K                       │
│ ├─ P50 (median):   $155K                       │
│ ├─ P75 (senior):   $178K                       │
│ └─ Total comp avg: $195K (with equity)         │
│                                                │
│ Your profile fits P75 range                    │
│ 💡 Negotiation tip: Ask for $168K–$175K        │
│                                                │
│ (Based on 34 verified data points at Google)   │
└────────────────────────────────────────────────┘
```

**Backend mapping:** `salary_data` table (already has `salaryMin`, `salaryMax`, `bonus`, `equity`, `dataPoints` per company+role).

---

#### 8. "Quick Apply Tracker" — Application State Machine in Popup

**What it does:**
The popup's main tab becomes a Kanban-style tracker for recent applications — updated in real-time from your `application_timeline` table:

```
Popup → Applications Tab:
┌──────────────────────────────────────────────┐
│ YOUR PIPELINE                    [+ Add]     │
│                                              │
│ Applied (4)   Interview (2)   Offer (1)      │
│ ─────────────────────────────────────────── │
│ ● Google     ● Stripe        ★ Meta          │
│   Backend      Tomorrow        $185K offer   │
│   3 days ago   2:00 PM         Decide by Fri │
│                [Prep Now →]    [Respond →]   │
└──────────────────────────────────────────────┘
```

**Why unique:** Users don't need to open the full web dashboard for daily status updates. The extension popup becomes their job search command center.

**Backend mapping:** `applications` + `application_timeline` + `contact_persons` tables.

---

#### 9. Interview Prep Trigger (Contextual)

**What it does:**
When the user's application moves to "interview" status (detected by user update or email parsing), the extension badge on that company's LinkedIn page changes:

```
[JobFit: 87% ⭐]  →  [🎯 Interview Next Week — Prep?]
```

Clicking opens a tailored interview prep panel generated by Qwen 3:

```
┌──────────────────────────────────────────────────────┐
│ Interview Prep: Senior Backend @ Google               │
│                                                      │
│ Expected question types:                             │
│ ├─ System Design (40%) — based on job description    │
│ ├─ Behavioral (30%) — STAR format recommended        │
│ └─ Coding (30%) — Python/Go focus                    │
│                                                      │
│ Top 5 questions for YOU specifically:                │
│ 1. "Describe a distributed system you've built..."   │
│ 2. "How do you handle database schema migrations..." │
│                                                      │
│ [Start Mock Session →]  [Open Full Prep]             │
└──────────────────────────────────────────────────────┘
```

**Backend mapping:** `interview_questions` + `interview_tips` + `AiModule → /api/v1/generate/interview` (Qwen 3). **Tier-gated: Premium+**.

---

### 🥈 Tier 3: RETENTION & GROWTH Features (Lower lift, high stickiness)

---

#### 10. Job Search Momentum Score (Gamification)

**What it does:**
A persistent mini-widget in the extension popup shows the user's weekly job search "momentum":

```
┌─────────────────────────────────────┐
│ Your Week                           │
│                                     │
│ 🔍 Jobs viewed:      24             │
│ 💾 Jobs saved:        6             │
│ ✅ Applications:      3   [+1 today] │
│                                     │
│ Momentum: ██████████ 🔥 On fire!    │
│                                     │
│ Top suggestion: Apply to 2 more     │
│ jobs today to maintain streak 🎯    │
└─────────────────────────────────────┘
```

**Backend mapping:** `user_analytics` table (`totalApplications`, `totalInterviews`, etc.) already tracks this data.

---

#### 11. "Recruiter Radar" — Contact Intelligence

**What it does:**
When browsing a job on LinkedIn, the extension identifies if any of the `contact_persons` in the user's database work at that company:

```
[JobFit: 87% ⭐]  [👤 You know someone here!]

Popup:
┌────────────────────────────────────────────┐
│ 🤝 Connection at Google                    │
│                                            │
│ Sarah Chen — Engineering Manager           │
│ Last contact: 45 days ago                  │
│ Linked to: 2 applications                  │
│                                            │
│ [Message on LinkedIn]  [Update Contact]    │
└────────────────────────────────────────────┘
```

**Backend mapping:** `contact_persons` table (already has `companyId`, `linkedinUrl`, `lastContactAt`).

---

#### 12. Passive Mode — "Job Scout" Alerts

**What it does:**
User sets up "Job Scout" criteria in the extension (or syncs from their profile preferences), and the extension runs a background check whenever LinkedIn is open:

```
Passive alert (badge notification):
🔔 "3 new jobs match your 80%+ threshold since yesterday"

Settings panel:
[Notify me when]
  □ A job matches 80%+ on LinkedIn
  □ A company on my watchlist posts new roles  
  □ A saved job's deadline is < 72 hours away
  □ A company I applied to posts a similar role
```

**Backend mapping:** `notification_preferences` table + `recommendations` nightly batch + `saved_jobs.deadline`.

---

## Feature Prioritization Matrix

| Feature | Impact | Effort | Tier Gate | Build Priority |
|---|---|---|---|---|
| Sub-score radar badge | 🔴 Very High | Low | Free | **P0** |
| Skills gap action cards | 🔴 Very High | Medium | Free | **P0** |
| Company fit intelligence sidebar | 🔴 Very High | Medium | Free | **P0** |
| One-click cover letter injection | 🔴 Very High | Medium | Premium | **P1** |
| Application deadline urgency | 🟠 High | Low | Free | **P1** |
| Quick apply tracker popup | 🟠 High | Low | Free | **P1** |
| Salary negotiation intelligence | 🟠 High | Low | Free | **P1** |
| Duplicate application detector | 🟠 High | Medium | Free | **P2** |
| Interview prep trigger | 🟡 Medium | High | Premium | **P2** |
| Job search momentum score | 🟡 Medium | Low | Free | **P2** |
| Recruiter radar | 🟡 Medium | Low | Free | **P3** |
| Passive job scout alerts | 🟡 Medium | Medium | Premium | **P3** |
| Referral network tracker | 🟡 Medium | Low | Free | **P3** |

---

## Architecture Notes for Extension Implementation

### Extension → Backend API calls

All features map to **existing or planned** backend endpoints:

```
Extension content script / popup
    ↓ JWT (stored in chrome.storage.local)
Backend (NestJS) /api/v1/
    ↓
AI Service (FastAPI) — for cover letter, interview, explanation generation
    ↓
Postgres (with pgvector) — for match scores, salary data, application tracking
```

### New Backend Endpoints Needed for Extension

| Feature | New Endpoint | Priority |
|---|---|---|
| Sub-score badge | `GET /api/v1/recommendations/by-job?externalId=&source=linkedin` | P0 |
| Skills gap cards | `GET /api/v1/learning/gap?jobExternalId=` | P0 |
| Company sidebar | `GET /api/v1/companies/by-name?name=` | P0 |
| Salary intelligence | `GET /api/v1/salary?company=&role=` | P1 |
| Duplicate detector | `GET /api/v1/applications/similar?jobTitle=&companyName=` | P2 |
| Scout alerts | `GET /api/v1/recommendations/recent?since=&minScore=` | P3 |

### Privacy & LinkedIn TOS Considerations

> [!WARNING]
> Your backend already handles this correctly (per your plan):
> - Only send `externalId` (job ID from URL) + `userId` to backend — never scrape and store full job listings
> - Raw resume never re-sent after initial parse (stored as structured profile)
> - All matching happens server-side — extension only receives pre-computed scores

---

## Monetization Layer (Aligned with Your Stripe Subscription Tiers)

| Feature | FREE | PREMIUM ($4.99/mo) | PROFESSIONAL |
|---|---|---|---|
| Match score badge (5 sub-scores) | ✅ | ✅ | ✅ |
| Skills gap cards | ✅ (see gaps only) | ✅ (+ learning paths) | ✅ |
| Company intelligence sidebar | ✅ (basic) | ✅ (salary data) | ✅ |
| Application tracker popup | ✅ (last 5) | ✅ (unlimited) | ✅ |
| Deadline urgency alerts | ✅ | ✅ | ✅ |
| One-click AI cover letter | ❌ | ✅ (5/month) | ✅ (unlimited) |
| Interview prep trigger | ❌ | ✅ | ✅ |
| Salary negotiation tips | ❌ | ✅ | ✅ |
| Passive job scout alerts | ❌ | ✅ | ✅ |
| Recruiter radar | ❌ | ✅ | ✅ |

---

## The Single Most Impactful Feature to Build First

> [!TIP]
> **Build the Company Intelligence Sidebar + Sub-Score Radar** as your Day 1 differentiator.
>
> Why: Your backend already has ALL the data (Glassdoor rating, hiring velocity, funding stage, salary data, 5 match sub-scores). This requires **zero new AI work**. It's purely surfacing existing structured data through a beautiful extension UI. It will make every power user say "how did I live without this?" and spread organically via LinkedIn screenshots.
