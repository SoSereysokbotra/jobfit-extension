# Chrome Web Store — submission pack

Everything needed for the listing, plus the review answers Chrome asks for. Copy the
blocks below straight into the developer dashboard.

---

## Listing copy

**Name** (45 char limit)
```
JobFit — Match Score for LinkedIn Jobs
```

**Short description** (132 char limit — currently 117)
```
See your JobFit match score, sub-scores, company insights, salary data and skill gaps directly on LinkedIn job posts.
```

**Category:** Productivity  ·  **Language:** English

**Detailed description**
```
JobFit brings your job-search intelligence to the job post itself.

Instead of switching between LinkedIn and your JobFit dashboard, JobFit adds a compact
badge next to the job title showing how well the role actually fits you — then expands
into the detail behind that number.

WHAT YOU GET

• Match score with a 5-dimension breakdown
  Skills, experience, location, salary and culture — so you know *why* a job scores
  the way it does, not just the headline number.

• Company insights
  Rating, funding stage, hiring velocity, open roles, salary range, and your own best
  matches at that company — in a side panel, without leaving the page.

• Skill gaps that are actionable
  See which skills the role wants that you're missing, how many jobs demand them, and
  jump straight into a learning path.

• Salary intelligence
  P25/P50/P75 bands, average total compensation, and a negotiation tip for the role.

• Cover letter drafting
  Generate a tailored draft in one click, copy it, or auto-fill it into LinkedIn's
  Easy Apply form when the flow has a cover-letter field.

• Application pipeline
  Your Applied / Interview / Offer stages in the popup, synced with your JobFit account.

• Optional alerts
  Get notified when a saved job is about to close, or when a new high-match role
  appears. Both are off until you turn them on.

PRIVACY FIRST

JobFit never scrapes or stores job listings. Only the job's ID, the company name and
the job title are sent to the JobFit API — never the posting text. The extension stores
no password and no login token: it uses the session from your existing JobFit sign-in.
No analytics, no trackers, no third-party SDKs, no data sales.

REQUIREMENTS

A free JobFit account. Sign in at the JobFit website once and the extension picks up
your session automatically.
```

---

## Privacy practices (dashboard questionnaire)

**Single purpose**
```
Display the signed-in user's JobFit job-match data on LinkedIn job pages and in a popup.
```

**Permission justifications** — Chrome requires one per permission:

| Permission | Justification to paste |
|---|---|
| `storage` | Stores the user's alert preferences and the IDs of jobs already notified about, so the same job is never notified twice. No personal data is stored. |
| `activeTab` | Lets the extension act only on the job page the user is currently viewing, rather than requesting broad tab access. |
| `alarms` | Manifest V3 service workers cannot use timers. Alarms schedule the periodic deadline and job-scout checks the user has opted into. |
| `notifications` | Displays the deadline reminders and new-match alerts the user explicitly enabled in the extension settings. |
| Host — JobFit API | The extension's data (match scores, company insights, salary, skill gaps, applications) is fetched from the JobFit API. This is the only server contacted. |
| Host — `www.linkedin.com` | Required to display the JobFit badge next to job titles on LinkedIn job pages. |
| Remote code | **Not used.** All code is bundled in the package; nothing is fetched or eval'd at runtime. |

**Data usage disclosures** — tick only:
- *Personally identifiable information* — collected (name/email shown in the popup, from the user's own account), **not** sold, **not** used for unrelated purposes, **not** used for creditworthiness.
- Everything else: **not collected**.

**Privacy policy URL:** host `PRIVACY.md` at a public URL and paste it here.
The Web Store will not accept a submission without a reachable policy URL.

---

## Assets checklist

| Asset | Spec | Status |
|---|---|---|
| Icon 128×128 | PNG | ✅ generated (`public/icon128.png`) |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ badge expanded on a LinkedIn job |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ company insights side panel |
| Screenshot 3 | 1280×800 or 640×400 | ⬜ popup: signed in + pipeline |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ cover-letter generation |
| Small promo tile | 440×280 PNG | ⬜ optional but improves placement |

**Screenshots must be captured manually** — they have to show the real extension
running in a real browser. Suggested captures, in order of persuasiveness:
1. The expanded badge showing the 5 sub-score bars on a real job post.
2. The company panel open beside a job.
3. The popup with the pipeline populated.
4. The cover-letter section with generated text.

Crop to exactly 1280×800. Avoid showing personal data — use a test account, and blur
your email in the popup shot.

---

## Pre-submission checklist

- [ ] `.env` points at the **production** API/web URLs (not localhost) — `host_permissions`
      is derived from these, and a localhost host permission will fail review.
- [ ] Every `DATA_SOURCE` flag that has a live endpoint is flipped to `"real"`.
- [ ] `npm run build` clean, then `npm run package` → `release/jobfit-extension-v<version>.zip`.
- [ ] Load the **zip's** unpacked contents once more and smoke-test popup + a job page.
- [ ] Privacy policy hosted at a public URL.
- [ ] Version bumped in `package.json` (the manifest reads it).
- [ ] Screenshots captured and cropped.
```
