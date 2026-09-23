/**
 * Background service worker (MV3) — the message router and the single owner of
 * all network calls. UI surfaces (popup now; content scripts later) never fetch
 * directly; they send typed messages defined in `@/shared/messaging`.
 *
 * MV3 note: this worker is stateless-by-design and may be terminated between
 * messages. The only in-memory state is the access token; if the worker sleeps
 * and loses it, the next request simply re-derives it from the refresh cookie.
 */
import type { ExtMessage } from "@/shared/messaging";
import { getAuthState, logout, resolveActiveRole } from "./auth";
import {
  createMatchReportFor,
  generateCoverLetterFor,
  generateInterviewPrepFor,
  getApplicationsPipeline,
  getCompanyIntel,
  getDeadline,
  getDuplicateCheck,
  getJobMatch,
  getMomentumStats,
  getSalary,
  getSavedJobFor,
  getSkillGapReport,
  saveJobFor,
} from "./features";
import { registerAlarmHandlers, setupAlarms } from "./alarms";
import { WEB_APP_URL } from "@/shared/config";
import { purgeLegacyUnscopedState, purgeRetiredState } from "./account";

async function handle(message: ExtMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_ACTIVE_ROLE":
      // Cache first; one shared /auth/me per worker lifetime if it is cold. Never a
      // request per job page — see resolveActiveRole.
      return resolveActiveRole();
    case "AUTH_GET_STATE":
      return getAuthState();
    case "AUTH_LOGOUT":
      return logout();
    case "GET_JOB_MATCH":
      return getJobMatch({
        externalId: message.externalId,
        source: message.source,
        title: message.title,
        company: message.company,
        location: message.location,
      });
    case "GET_COMPANY_INTEL":
      return getCompanyIntel(message.name);
    case "GET_SKILL_GAP":
      return getSkillGapReport(message.externalId, message.source, message.title);
    case "GET_APPLICATIONS":
      return getApplicationsPipeline(message.limit ?? 5);
    case "GET_SALARY_INTEL":
      return getSalary(message.company, message.role);
    case "GET_JOB_DEADLINE":
      return getDeadline(message.externalId, message.source);
    case "GENERATE_COVER_LETTER":
      return generateCoverLetterFor({
        externalId: message.externalId,
        source: message.source,
        company: message.company,
        role: message.role,
      });
    case "GET_DUPLICATE_CHECK":
      return getDuplicateCheck({
        externalId: message.externalId,
        source: message.source,
        title: message.title,
        company: message.company,
      });
    case "GENERATE_INTERVIEW_PREP":
      return generateInterviewPrepFor({
        externalId: message.externalId,
        source: message.source,
        company: message.company,
        role: message.role,
      });
    case "GET_MOMENTUM":
      return getMomentumStats();
    case "SAVE_JOB":
      return saveJobFor({
        externalId: message.externalId,
        source: message.source,
        title: message.title,
        company: message.company,
        description: message.description,
        url: message.url,
        salary: message.salary,
        notes: message.notes,
      });
    case "GET_SAVED_JOB":
      return getSavedJobFor(message.externalId, message.source);
    case "CREATE_MATCH_REPORT":
      return createMatchReportFor({
        externalId: message.externalId,
        source: message.source,
        title: message.title,
        company: message.company,
        location: message.location,
        jobDescription: message.jobDescription,
        extraction: message.extraction,
        requiredMonths: message.requiredMonths,
        postedSalary: message.postedSalary,
      });
    default: {
      // Exhaustiveness guard — a new ExtMessage without a case fails to compile.
      const _never: never = message;
      return _never;
    }
  }
}

// Deadline-reminder alarm lifecycle (Phase 7) + first-run welcome.
chrome.runtime.onInstalled.addListener((details) => {
  // FIRST INSTALL ONLY — open the site so the user knows what to do next.
  //
  // Without this, installing the extension produced no visible result at all: the user
  // went to LinkedIn, got a badge with nothing in it, and had no way to learn that a
  // JobFit account and a résumé are what make it work. Every comparable extension opens
  // a page at this moment (Teal and Simplify both do).
  //
  // `details.reason` MUST be checked. This listener also fires on "update" and
  // "chrome_update", so opening unconditionally would hijack a tab on every single
  // version bump the Web Store pushes.
  //
  // It opens the LANDING page, not /onboarding/resume: onboarding has no auth guard —
  // a logged-out visitor reaches the wizard and only discovers it cannot save when the
  // request 401s. The landing page works signed in or out, and carries both sign-up and
  // log-in. `tabs.create` needs no permission (see manifest.config.ts).
  if (details.reason === "install") {
    void chrome.tabs.create({ url: WEB_APP_URL });
  }

  setupAlarms();
  // One-time cleanup for profiles upgraded from a build whose alert state was
  // shared across every JobFit account on this browser. See
  // @/shared/storageKeys `LEGACY_UNSCOPED_KEYS` for why it is dropped, not
  // migrated.
  void purgeLegacyUnscopedState();
  // Likewise for state belonging to features that no longer exist — currently
  // the removed job-scout alerts. See `RETIRED_KEY_PREFIXES`.
  void purgeRetiredState();
});
chrome.runtime.onStartup.addListener(() => setupAlarms());
registerAlarmHandlers();

chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      // Never leave the port hanging; surface a structured error to the caller.
      sendResponse({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown worker error",
      });
    });
  // Returning true keeps the message channel open for the async sendResponse.
  return true;
});
