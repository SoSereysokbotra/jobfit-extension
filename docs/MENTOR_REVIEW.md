# Mentor Review — Hidden Product and System Assumptions

_Review date: 24 August 2026. Scope: all project Markdown documentation plus the
extension implementation. This is a design review, not a claim that every item is
already a production bug._

## 1. “Default résumé” is an implementation detail, not a user decision

**Problem.** `MATCH_REPORT_SPEC.md` says the backend uses the default résumé and then
falls back to the newest successfully parsed résumé. The extension never tells the user
which CV was chosen, lets them change it for a job, or records a clear selection rule in
the product UI. A user with a software CV and a marketing CV can therefore receive a
confident result for the wrong document.

**Why it matters.** This changes every match, skill gap, cover letter, interview-prep
answer, and report. It makes the output hard to trust and impossible for the user to
reproduce without knowing backend internals.

**Possible solution.** Make exactly one active résumé mandatory for matching, show its
file name and “Change résumé” action in the extension/report, and pass a `resumeId` on
user-selected, per-job analyses. Store `resumeId`, parsed-version/hash, and model/prompt
version on generated artifacts.

**Mentor question.** “A user has three CVs. Which one generated this 87% score, and how
can they deliberately analyse this job using another one?”

## 2. Generated results do not state whether they are stale

**Problem.** Reports persist a rendered payload, while a résumé can be re-uploaded,
reparsed, edited, or changed as default. Existing match badges, saved reports, letters,
and alerts have no explicit freshness rule or invalidation policy.

**Why it matters.** Two outputs for the same job can disagree, or an old report can look
current after the user fixes the CV. Recruiters and mentors will reasonably ask why.

**Possible solution.** Treat a parsed CV version as immutable input. Persist its ID/hash
and `generatedAt`; label old reports as based on that version; offer “Re-run with active
CV.” Invalidate/cache-key cheap outputs by `(user, resumeVersion, job fingerprint,
scorer version)`.

**Mentor question.** “You improved your CV after this report was created. Which parts
refresh automatically, which remain historical, and why?”

## 3. The small badge can look more job-specific than its evidence supports

**Problem.** The normal match request sends title, company, and location—not the job
description. The “CV depth” score is explicitly the same for every job, salary can fall
back to a company band, and skills are title-level semantic similarity. Yet the primary
surface is a single job-level percentage beside a real posting.

**Why it matters.** A title such as “Software Engineer” covers radically different
requirements. Users may use the number to decide whether to apply, although it may not
reflect required skills, seniority, visa, language, or responsibilities.

**Possible solution.** Label the badge “quick title-based estimate,” show a confidence /
evidence indicator, avoid totals when key evidence is absent, and make Full Report the
only result described as description-aware. Validate server-side lengths and normalize
title/company text before scoring.

**Mentor question.** “What evidence makes this 82% specific to this posting rather than
to every job with the same title?”

## 4. The product privacy story contradicts its stored-report design

**Problem.** `PRIVACY.md` and `CONTRACTS.md` say Full Report stores a derived report, not
the posting text. But `MATCH_REPORT_SPEC.md` §3 says `jobDescription` is stored inside
the report payload “for display.” These are materially different retention claims.

**Why it matters.** This is a consent, compliance, Web Store review, and user-trust
issue—not wording polish. A user cannot give informed consent if the documentation is
internally inconsistent.

**Possible solution.** Decide whether raw description is retained. Prefer not retaining
it: extract requirements, discard raw text, and persist only bounded derived fields. If
retention is necessary, state it plainly, give a deletion mechanism, document retention
periods, and ensure backend payload/logs/backups follow it.

**Mentor question.** “Show me exactly where the job description is stored after I click
Full Report—including JSON payloads, logs, backups, and deletion paths.”

## 5. A user-edited saved job can silently overwrite the source of truth

**Problem.** Save Job uses `(userId, source, externalId)` as an upsert key. The form
prefills page data but allows title, URL, description, salary, and notes to be edited;
the next save overwrites the existing record. There is no capture timestamp, page-content
hash, update warning, or immutable original snapshot.

**Why it matters.** A job board can reuse/alter a posting, an adapter can extract the
wrong text, or a user can accidentally replace their historical bookmark. The saved job
then cannot prove what was originally saved.

**Possible solution.** Store `capturedAt`, `lastUpdatedAt`, source URL, and content hash.
Offer “update saved copy” vs “save as new version,” and show a diff/warning when source
content changes. Enforce the documented size cap in the client as well as backend.

**Mentor question.** “If the employer changes or reuses the same external job ID, how do
you preserve what the user originally chose to save?”

## 6. Alert state is shared by browser profile, not JobFit user

**Problem.** Settings, notified ID sets, notification URLs, and scout `since` cursor use
fixed `chrome.storage.local` keys. If Alice signs out and Bob signs in on the same Chrome
profile, Bob inherits Alice’s alert preferences/cursor and may miss alerts already marked
as notified; stale notification clicks can also open Alice’s saved-job destination.

**Why it matters.** This is both a privacy boundary and correctness failure on shared
computers, demos, and test accounts.

**Possible solution.** Namespace every account-derived key by authenticated `user.id`,
clear/rotate notification state on account changes, and re-check auth before running an
alarm. Keep device-level settings deliberately separate only if that is the product rule.

**Mentor question.** “What happens to stored notification state when a different JobFit
user logs in to the same Chrome profile?”

## 7. Scout pagination loses valid notifications

**Problem.** `runScoutCheck` fetches every result since the previous cursor, keeps only
the best three, then immediately advances `SCOUT_LAST_RUN` to now. Any fourth-and-later
result is neither notified nor eligible for the next request.

**Why it matters.** The “max 3 per run” safety limit becomes silent permanent data loss,
not deferred delivery.

**Possible solution.** Have the API return a stable cursor plus paginated, deterministic
ordering. Advance the cursor only through delivered/queued items, or persist the excess
locally and drain it in later runs. Mark delivery only after `chrome.notifications.create`
succeeds.

**Mentor question.** “If seven high-match jobs arrive in one interval, prove that the
fourth through seventh will eventually be shown.”

## 8. Deadline functionality is knowingly fabricated and has a cross-site link bug

**Problem.** `DATA_SOURCE.deadlines` is `mock`, but the extension renders “Closes in Nd”
and can notify users. The mock returns a sample even for real accounts. In addition,
`runDeadlineCheck` always constructs a LinkedIn URL, regardless of the saved job’s
`source`.

**Why it matters.** A fabricated closing date can cause a user to rush, abandon, or miss
an application. The notification can also take a user to the wrong site. This is too
high-impact to present as ordinary product data.

**Possible solution.** Do not ship/show deadline UI until a real, provenance-bearing
deadline exists; in development, visibly label mock fixtures. Persist each saved job’s
canonical URL and use it for notifications, with a source-aware fallback.

**Mentor question.** “Where did this deadline come from, how accurate is it, and why does
a JobNet reminder open LinkedIn?”

## 9. Documentation and release reality drift in contradictory directions

**Problem.** `README.md` still says most P0 features, scout, and cover letters are mock
and says only ID/source leave the page. `src/data/source.ts` now enables most of these as
real, and Full Report/Save Job send descriptions. `PROGRESS.md` also contains obsolete
“not built” entries for Indeed despite the adapter and manifest entry existing. Some
status documents identify only a date rather than a backend commit/deployment.

**Why it matters.** Developers, reviewers, and Store reviewers will make decisions from
the wrong operational truth. A mock/real switch can become an undeclared release change.

**Possible solution.** Establish one generated release-readiness matrix from the actual
flags, manifest, API deployment SHA, and privacy facts. Mark historical plans as archived
and add CI checks for contradictions such as a mock-enabled user feature or documentation
claim that no longer matches the manifest/data paths.

**Mentor question.** “Which document is authoritative today, and how do you prevent your
privacy policy and Store listing from drifting after a feature flag changes?”

## 10. Extraction is best-effort, but output provenance is invisible

**Problem.** Site adapters use fallbacks such as broad containers and Khmer24’s longest
paragraph. They correctly fail softly when they cannot find content, but an incorrect
long text can still pass the 80-character threshold and be sent as a report/saved-job
description. The user cannot inspect what the system extracted before analysis.

**Why it matters.** A polished AI report based on “Safety Tips,” navigation, or stale SPA
content is worse than no report; it creates false confidence and is difficult to debug.

**Possible solution.** Display an editable extraction preview with source/site and
character count before transmission; add per-adapter extraction tests using saved page
fixtures and a confidence threshold; persist source/extraction version with reports.

**Mentor question.** “How do you know the text you sent to the AI is the job description
the user saw, rather than another long block on the page?”

## Recommended next order

1. Resolve CV-selection/version provenance and account-scoped local storage.
2. Remove or clearly gate mock deadlines; fix notification URLs and scout cursoring.
3. Reconcile raw-description retention, then update `PRIVACY.md`, the Store listing, and
   contracts together.
4. Introduce extraction/match evidence labels before treating the score as decision-grade.
5. Replace the stale status documentation with a release-verified source of truth.
