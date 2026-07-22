# JobFit Extension — Privacy Policy

**Last updated:** 22 July 2026

The JobFit browser extension shows your existing JobFit match data on job pages you
visit. This policy describes exactly what it does and does not do with your data.

## Summary

- The extension **does not scrape, copy, or store job listings**.
- It **does not store your password or any authentication token**.
- It **does not use analytics, tracking pixels, advertising, or third-party SDKs**.
- It **does not sell or share your data with anyone**.
- The only server it ever contacts is the **JobFit API**.

## What the extension reads from the page

On a supported LinkedIn job page, the extension reads three things from the page you
are already viewing:

| Read from the page | Why | Leaves your browser? |
|---|---|---|
| The job's ID from the URL (e.g. `/jobs/view/3901234567`) | To ask JobFit for your match score for that job | **Yes** — sent to the JobFit API |
| Company name (display text) | To look up company insights and salary data | **Yes** — sent to the JobFit API |
| Job title (display text) | To look up salary data for the role and draft a cover letter | **Yes** — sent to the JobFit API |

**The job description / posting body is never read, stored, or transmitted.** Nothing
else on the page — your feed, messages, connections, or other browsing — is accessed.

## What the extension sends to the JobFit API

Requests are made only to the JobFit API, and only the identifiers above plus your
session. The extension calls these endpoints on your behalf:

- your account (`/auth/me`), your applications (`/applications`), and the jobs they
  refer to (`/jobs/{id}`)
- your match, company, salary, skill-gap, deadline and cover-letter data for the job
  identifiers listed above

## Authentication

The extension has **no login of its own and stores no tokens**. It relies on the
session you already created by signing in at the JobFit website: your browser's
existing httpOnly session cookie is sent with requests to the JobFit API. Because that
cookie is httpOnly, the extension cannot read it — and neither can any web page.

If you are not signed in on the JobFit website, the extension simply shows a "log in"
prompt and fetches nothing.

## What is stored on your device

Stored locally via `chrome.storage.local`, never transmitted anywhere:

- your alert preferences (deadline reminders, job-scout alerts, minimum score)
- a list of job IDs already notified about, so you aren't alerted twice
- the timestamp of the last background scout check

You can erase all of it at any time by removing the extension.

## Notifications

Deadline reminders and job-scout alerts are **off by default** and only run after you
turn them on in the extension popup. When enabled, the extension periodically asks the
JobFit API whether any saved job is closing soon or any new high-scoring job exists,
and shows a browser notification. Turning the settings off stops those checks.

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `storage` | Save your alert preferences and prevent duplicate notifications |
| `activeTab` | Act only on the job tab you are currently viewing |
| `alarms` | Schedule the periodic deadline/scout checks (required for MV3 background work) |
| `notifications` | Show the deadline and job-scout alerts you opted into |
| Host access to the JobFit API | Make the API requests described above |
| Host access to `www.linkedin.com` | Display the JobFit badge on job pages |

The extension requests **no access to any other website**.

## Data retention and deletion

The extension itself retains only the local device data listed above. Data held by
the JobFit service (your profile, résumé, applications) is governed by the JobFit
website's privacy policy and can be deleted through your JobFit account.

## Children

JobFit is not directed at children under 16.

## Changes

Material changes to this policy will be reflected here with an updated date and in the
extension's Web Store listing.

## Contact

Questions about this policy or your data: **soviseth869@gmail.com**
