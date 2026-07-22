/**
 * Typed messaging contract between the popup (and, later, content scripts) and
 * the background service worker. The worker is the SOLE owner of network calls,
 * so every UI surface talks to the backend only through these messages.
 */
import type {
  AuthUser,
  CompanyIntel,
  CoverLetter,
  JobDeadline,
  JobMatch,
  JobSource,
  SalaryIntel,
  SkillGapReport,
  TrackedApplication,
} from "./types";

/** Resolved auth state the worker reports back to any UI surface. */
export type AuthState =
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "error"; message: string; code?: string };

/**
 * Standard result envelope for any data the worker fetches (mock or real). Gives
 * every UI surface the same explicit states — including `empty` (rule §4.2) and
 * `unauthenticated` (show a log-in CTA) — with no `any`.
 */
export type DataResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/** Messages the UI can send to the worker (discriminated by `type`). */
export type ExtMessage =
  | { type: "AUTH_GET_STATE" }
  | { type: "AUTH_LOGOUT" }
  | {
      type: "GET_JOB_MATCH";
      externalId: string;
      source: JobSource;
      /** Identifiers only — the posting body is never sent. */
      title: string | null;
      company: string | null;
      location: string | null;
    }
  | { type: "GET_COMPANY_INTEL"; name: string }
  | { type: "GET_SKILL_GAP"; externalId: string; source: JobSource }
  | { type: "GET_APPLICATIONS"; limit?: number }
  | { type: "GET_SALARY_INTEL"; company: string; role: string }
  | { type: "GET_JOB_DEADLINE"; externalId: string; source: JobSource }
  | {
      type: "GENERATE_COVER_LETTER";
      externalId: string;
      source: JobSource;
      /** Display name only — the job description is never sent. */
      company: string | null;
      role: string | null;
    };

/** Response shape per message type. */
export interface ExtResponseMap {
  AUTH_GET_STATE: AuthState;
  AUTH_LOGOUT: { ok: boolean };
  GET_JOB_MATCH: DataResult<JobMatch>;
  GET_COMPANY_INTEL: DataResult<CompanyIntel>;
  GET_SKILL_GAP: DataResult<SkillGapReport>;
  GET_APPLICATIONS: DataResult<TrackedApplication[]>;
  GET_SALARY_INTEL: DataResult<SalaryIntel>;
  GET_JOB_DEADLINE: DataResult<JobDeadline>;
  GENERATE_COVER_LETTER: DataResult<CoverLetter>;
}

type MessageOf<T extends ExtMessage["type"]> = Extract<ExtMessage, { type: T }>;

/**
 * Typed wrapper over `chrome.runtime.sendMessage`. Callers get an exact response
 * type for the message they sent — no `any`, no manual casting.
 */
export function sendMessage<T extends ExtMessage["type"]>(
  message: MessageOf<T>,
): Promise<ExtResponseMap[T]> {
  return chrome.runtime.sendMessage(message) as Promise<ExtResponseMap[T]>;
}
