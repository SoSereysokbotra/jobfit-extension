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
import { getAuthState, logout } from "./auth";
import {
  getCompanyIntel,
  getJobMatch,
  getSkillGapReport,
  getSubscriptionTier,
} from "./features";

async function handle(message: ExtMessage): Promise<unknown> {
  switch (message.type) {
    case "AUTH_GET_STATE":
      return getAuthState();
    case "AUTH_LOGOUT":
      return logout();
    case "GET_TIER":
      return getSubscriptionTier();
    case "GET_JOB_MATCH":
      return getJobMatch(message.externalId, message.source);
    case "GET_COMPANY_INTEL":
      return getCompanyIntel(message.name);
    case "GET_SKILL_GAP":
      return getSkillGapReport(message.externalId, message.source);
    default: {
      // Exhaustiveness guard — a new ExtMessage without a case fails to compile.
      const _never: never = message;
      return _never;
    }
  }
}

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
