# Chrome Web Store — submission pack

Everything needed for the listing, plus the review answers Chrome asks for. Copy the
blocks below straight into the developer dashboard.

---

## Listing copy

**Name** (45 char limit — currently 30)
```
JobFit — Job Match Score
```

**Short description** (132 char limit — currently 128. This copy MUST stay identical to
`manifest.config.ts`'s `description` field, because the Store reads the manifest, not this
file. It was 136 — over the limit — until 2026-08-20.)
```
See your JobFit match score, company insights, salary and skill gaps on job posts — LinkedIn, Indeed, JobNet, Khmer24, BongThom.
```

**Category:** Productivity  ·  **Language:** English

**Detailed description**
```
JobFit brings your job-search intelligence to the job post itself.

Instead of switching between the job board and your JobFit dashboard, JobFit adds a
compact badge next to the job title showing how well the role actually fits you — then
expands into the detail behind that number.

Works on LinkedIn, Indeed, JobNet, Khmer24 and BongThom.

WHAT YOU GET

• Match score with a 5-dimension breakdown
  Skills, experience, location, salary and culture — so you know *why* a job scores
  the way it does, not just the headline number.

• Full Report, on request
  Click through for a deeper read of one posting: what the role actually requires,
  which of those requirements your résumé evidences, and how it scores for ATS.

• Save Job
  Keep a posting — text and all — in your JobFit account, so it is still there after
  the board takes it down.

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

While you browse, JobFit reads only the job's ID, company, title and location — enough
to score the match. The posting text is read only when you click Full Report or Save
Job, never in the background, and JobFit builds no shared listing database from the
pages you visit. The extension stores no password and no login token: it uses the
session from your existing JobFit sign-in. No analytics, no trackers, no third-party
SDKs, no data sales.

Full details, including which AI providers process what, are in the privacy policy.

REQUIREMENTS

A free JobFit account. Sign in at the JobFit website once and the extension picks up
your session automatically.
```

---

## Privacy practices (dashboard questionnaire)

**Single purpose**
```
Display the signed-in user's JobFit job-match data on job pages at supported job boards
(LinkedIn, Indeed, JobNet, Khmer24, BongThom) and in a popup.
```

**Permission justifications** — Chrome requires one per permission:

| Permission | Justification to paste |
|---|---|
| `storage` | Stores the user's alert preferences and the IDs of jobs already notified about, so the same job is never notified twice. No personal data is stored. |
| `activeTab` | Lets the extension act only on the job page the user is currently viewing, rather than requesting broad tab access. |
| `alarms` | Manifest V3 service workers cannot use timers. Alarms schedule the periodic deadline and job-scout checks the user has opted into. |
| `notifications` | Displays the deadline reminders and new-match alerts the user explicitly enabled in the extension settings. |
| Host — JobFit API | The extension's data (match scores, company insights, salary, skill gaps, applications) is fetched from the JobFit API. This is the only server the extension contacts. |
| Host — JobFit website | Reserved for signing the user in from the extension. No page content is read from it. |
| Content scripts — `linkedin.com`, `indeed.com`, `jobnet.com.kh`, `khmer24.com`, `bongthom.com` | Required to display the JobFit badge and panels on job pages of the five supported job boards. The extension reads only the job's identifying details, plus the posting text when the user clicks Full Report or Save Job. |
| Remote code | **Not used.** All code is bundled in the package; nothing is fetched or eval'd at runtime. |

> ⚠️ These five hosts must match `content_scripts.matches` in `manifest.config.ts`
> exactly. Chrome compares the justification list against the manifest, and an
> under-declared host is a rejection.

**Data usage disclosures** — tick:

- *Personally identifiable information* — **collected** (name/email shown in the popup,
  from the user's own account).
- *Website content* — **collected**. This one is mandatory and easy to get wrong. The
  posting title, company, location and — on Full Report / Save Job — the posting body are
  page content sent off-device. Ticking "not collected" here is exactly the
  under-declaration that gets an extension pulled after publication.

For both: **not** sold, **not** used for unrelated purposes, **not** used for
creditworthiness.

Everything else (health, financial, authentication information, personal communications,
location, web history, user activity): **not collected.**

> **Note on `activeTab`.** It is declared and justified above, but the five
> `content_scripts` entries are what actually grant page access — `activeTab` is not
> carrying the badge. If a reviewer asks why both exist, the honest answer is that
> `activeTab` covers popup-initiated actions on the current tab. Consider dropping it if
> nothing uses it by submission time; an unused permission is a review question you do not
> need to invite.

**Privacy policy URL:** host `PRIVACY.md` at a public URL and paste it here.
The Web Store will not accept a submission without a reachable policy URL.

---

## Assets checklist

| Asset | Spec | Status |
|---|---|---|
| Icon 128×128 | PNG | ✅ generated (`public/icon128.png`) |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ badge expanded on a LinkedIn job |
| Screenshot 5 | 1280×800 or 640×400 | ⬜ badge on a Cambodian board (BongThom or Khmer24) — the listing now claims five sites, so show more than one |
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

**Truthfulness — do these first.** Every item here corresponds to a false statement that
was actually shipped in this file or `PRIVACY.md` and had to be corrected on 2026-08-20
(`jobfit-backend/docs/MENTOR_REVIEW_2026-08-18.md` §8). They are not hypothetical.

- [ ] `PRIVACY.md` host table == `manifest.config.ts` `content_scripts.matches` +
      `host_permissions`. Diff them; do not trust `MULTI_SITE_PLAN.md`, which is a plan.
- [ ] `PRIVACY.md` data claims == what the API actually stores. Ground truth is
      `jobfit-backend/docs/EXTENSION_PRIVACY_FACTS.md`, re-verified at the release SHA —
      the receiver knows what it keeps, the extension only knows what it sent.
- [ ] The listing copy above == `PRIVACY.md`. They drifted once because they were edited
      in different commits; change both together or not at all.
- [ ] *Website content* is ticked as collected in the dashboard questionnaire.
- [ ] Which AI provider sees posting text is still what `PRIVACY.md` says. Check
      `DEEPSEEK_TASKS` in the deployed `jobfits-ai-service` config — if
      `job_requirements` is on that list, posting text goes to DeepSeek and the policy
      must keep saying so. A config change silently rewrites the privacy story.
- [ ] `manifest.config.ts` `description` is ≤ 132 characters. Count it in code, do not
      eyeball it — it shipped at 136.
- [ ] `PRIVACY.md` re-dated, and publicly hosted at the URL pasted into the dashboard.

**Build and release**

- [ ] `.env` points at the **production** API/web URLs (not localhost) — `host_permissions`
      is derived from these, and a localhost host permission will fail review.
- [ ] Every `DATA_SOURCE` flag that has a live endpoint is flipped to `"real"`.
- [ ] `npm run build` clean, then `npm run package` → `release/jobfit-extension-v<version>.zip`.
- [ ] Load the **zip's** unpacked contents once more and smoke-test popup + a job page.
- [ ] Privacy policy hosted at a public URL.
- [ ] Version bumped in `package.json` (the manifest reads it).
- [ ] Screenshots captured and cropped.
```
