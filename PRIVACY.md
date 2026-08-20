# JobFit Extension — Privacy Policy

**Last updated:** 20 August 2026

The JobFit browser extension shows your JobFit match data on job pages you visit, and —
only when you ask it to — builds a detailed report or saves a posting for you. This policy
describes exactly what it does and does not do with your data.

## Summary

- The extension **does not read the posting body while you browse**. It reads it only when
  you click **Full Report** or **Save Job** (see below).
- It **does not build a job-listing database** from the pages you visit. Nothing you view
  is uploaded in the background, and nothing you view is shared with other users.
- It **does not store your password or any authentication token**.
- It **does not use analytics, tracking pixels, advertising, or third-party SDKs**.
- It **does not sell your data**.
- The only server the extension itself contacts is the **JobFit API**. One feature causes
  JobFit to pass posting text onward to an AI provider — named explicitly under
  *Where your text is processed*.

## Where the extension runs

Content is only injected on job sites the extension supports:

`linkedin.com` · `indeed.com` (and its country domains) · `jobnet.com.kh` ·
`khmer24.com` · `bongthom.com`

It does nothing on any other website.

## What the extension reads from the page

### While you are browsing — identifiers only

On a supported job page the extension reads the job's identifying details so it can show
you a match score:

| Read from the page | Why | Leaves your browser? |
|---|---|---|
| The site's own job ID (e.g. `/jobs/view/3901234567`) | To tie the score to that specific posting | **Yes** — sent to the JobFit API |
| Company name (display text) | To look up company insights | **Yes** — sent to the JobFit API |
| Job title (display text) | To score the role against your profile | **Yes** — sent to the JobFit API |
| Location (display text) | To score location fit | **Yes** — sent to the JobFit API |

Nothing else on the page — your feed, messages, connections, or other browsing — is
accessed, and no posting text is read at this stage.

### Only when you click — the posting body

Two buttons cause the visible posting text to be read and sent. Neither runs on its own.

**Full Report.** The visible posting text (up to 8,000 characters) is sent once to the
JobFit API, which works out what the role requires and compares it against your résumé.

- **The posting text itself is not stored.**
- What *is* saved to your JobFit account is the resulting report: the requirement phrases
  extracted from the posting, your match scores, and which of your skills matched. Those
  requirement phrases are derived from the posting and are often close to its original
  wording — so what is kept is a **derived summary of the posting**, not nothing at all.
- This is the one feature that involves a third-party AI provider — see
  *Where your text is processed*.

**Save Job.** The posting text (up to 8,000 characters) **is stored, deliberately.** It is
your bookmark — it is what you read when you come back to the job later, and job sites
frequently delete postings.

- It is stored against your account only, is never shown to any other user, and is deleted
  when you delete the saved job.
- It is **not** sent to any AI provider.

The JobFit API accepts at most 20,000 characters of posting text on either route,
regardless of what sends it.

## Where your text is processed

JobFit runs its own AI service. Most work — reading your résumé, scoring it, generating
embeddings, ranking your matches — happens on **models JobFit runs itself**, and that data
never leaves JobFit's infrastructure.

**One exception applies to the Full Report feature.** Extracting requirements from a job
posting may be handled by **DeepSeek** (`api.deepseek.com`), a third-party AI provider,
depending on JobFit's server configuration. When it is:

- What is sent is **the job posting's title and body** — the employer's public text.
- **Your résumé, your name, your email and your profile are never sent to DeepSeek.** The
  services that handle those are wired to JobFit's own models and have no route to any
  external provider.

Interview-question generation may also use DeepSeek. It sends only the job title and
seniority level, and nothing about you.

## What the extension sends to the JobFit API

Requests go only to the JobFit API, carrying your session plus the data described above.
The extension calls:

- **Your account** — `/auth/me`, `/auth/refresh-token`, `/auth/logout`
- **Your applications** — `/applications`, `/applications/similar`, and the jobs they
  refer to (`/jobs/...`)
- **Match scores** — `/recommendations/by-job` for the job you are viewing, and
  `/recommendations/scout` for the optional background alert described under
  *Notifications*
- **Saved jobs** — `/saved-jobs`, `/saved-jobs/external`, and deadline lookups
- **Full Report** — `/match-report`
- **Cover letters and interview prep** — `/generate/cover-letter`,
  `/generate/interview-prep` (these require a paid JobFit plan)

## Authentication

The extension has **no login of its own and stores no tokens**. It relies on the session
you already created by signing in at the JobFit website: your browser's existing httpOnly
session cookie is sent with requests to the JobFit API. Because that cookie is httpOnly,
the extension cannot read it — and neither can any web page.

If you are not signed in on the JobFit website, the extension shows a "log in" prompt and
fetches nothing.

## What is stored on your device

Stored locally via `chrome.storage.local`, never transmitted anywhere:

- your alert preferences (deadline reminders, job-scout alerts, minimum score)
- a list of job IDs already notified about, so you are not alerted twice
- the timestamp of the last background scout check

You can erase all of it at any time by removing the extension.

## Notifications

Deadline reminders and job-scout alerts are **off by default** and only run after you turn
them on in the extension popup. When enabled, the extension periodically asks the JobFit
API whether any saved job is closing soon or any new high-scoring job exists, and shows a
browser notification. These checks send no page content — only your session. Turning the
settings off stops them.

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `storage` | Save your alert preferences and prevent duplicate notifications |
| `activeTab` | Act only on the job tab you are currently viewing |
| `alarms` | Schedule the periodic deadline/scout checks (required for MV3 background work) |
| `notifications` | Show the deadline and job-scout alerts you opted into |
| Host access to the JobFit API | Make the API requests described above |
| Host access to the JobFit website | Reserved for signing you in from the extension; no page content is read |
| Page access to `linkedin.com`, `indeed.com`, `jobnet.com.kh`, `khmer24.com`, `bongthom.com` | Display the JobFit badge and panels on job pages of those sites |

The extension requests **no access to any other website**.

## Data retention and deletion

On your device: the settings listed above, removed when you uninstall the extension.

In your JobFit account:

- **Match reports** are kept until you delete them, and contain the derived summary
  described above — not the original posting text.
- **Saved jobs** are kept, including the posting text you saved, until you delete the saved
  job.

Everything else (your profile, résumé, applications) is governed by the JobFit website's
privacy policy and can be deleted through your JobFit account.

## Children

JobFit is not directed at children under 16.

## Changes

Material changes to this policy will be reflected here with an updated date and in the
extension's Web Store listing.

## Contact

Questions about this policy or your data: **soviseth869@gmail.com**
