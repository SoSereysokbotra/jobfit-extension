/**
 * Typed messaging contract between the popup (and, later, content scripts) and
 * the background service worker. The worker is the SOLE owner of network calls,
 * so every UI surface talks to the backend only through these messages.
 */
import type { AuthUser } from "./types";

/** Resolved auth state the worker reports back to any UI surface. */
export type AuthState =
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "error"; message: string; code?: string };

/** Messages the UI can send to the worker (discriminated by `type`). */
export type ExtMessage =
  | { type: "AUTH_GET_STATE" }
  | { type: "AUTH_LOGOUT" };

/** Response shape per message type. */
export interface ExtResponseMap {
  AUTH_GET_STATE: AuthState;
  AUTH_LOGOUT: { ok: boolean };
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
