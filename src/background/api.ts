/**
 * Background-worker fetch wrapper. Mirrors the web app's `src/lib/api/client.ts`
 * contract so behaviour is identical:
 *  - Success bodies are unwrapped from the TransformInterceptor envelope
 *    ({ success, statusCode, timestamp, data } → data).
 *  - Errors become `ApiError` (statusCode + messages + optional code).
 *  - Auth: access token in memory + httpOnly refresh cookie via
 *    credentials:"include". A 401 triggers exactly one silent refresh + retry.
 *
 * Difference from the web client: there is no AuthBridge indirection — the worker
 * IS the single owner of the token, so it holds it in a module variable.
 * Cookie-based SSO: the extension never logs in; the refresh cookie set by the
 * web app rides along on the cross-origin fetch (needs host_permissions for the
 * API origin + the cookie being SameSite=None; Secure in prod).
 */
import { API_BASE_URL } from "@/shared/config";

interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  code?: string;
  path?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly path?: string;
  readonly messages: string[];

  constructor(statusCode: number, messages: string[], code?: string, path?: string) {
    super(messages[0] ?? "Request failed");
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.messages = messages;
    this.code = code;
    this.path = path;
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

export interface RequestOptions {
  query?: QueryParams;
  /** Skip the Authorization header (public endpoints, e.g. refresh). */
  skipAuth?: boolean;
  /** Skip the silent-refresh-on-401 dance (the auth endpoints themselves). */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

// ─── Token ownership (this worker is the single owner) ──────────────────────
let accessToken: string | null = null;
export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((v) => search.append(key, String(v)));
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function toMessages(message: string | string[] | undefined): string[] {
  if (Array.isArray(message)) return message;
  if (typeof message === "string") return [message];
  return [];
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (proxy error, backend down mid-request).
  }
  const messages = toMessages(body.message);
  if (messages.length === 0) messages.push(response.statusText || "Request failed");
  return new ApiError(body.statusCode ?? response.status, messages, body.code, body.path);
}

/** Unwrap the TransformInterceptor envelope, tolerating non-enveloped bodies. */
function unwrap<T>(body: unknown): T {
  if (body !== null && typeof body === "object" && "success" in body && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// ─── Single-flight refresh (mirrors the web client's semantics) ─────────────
let refreshInFlight: Promise<string | null> | null = null;
let refreshFailed = false;

/** Clear the failed-refresh latch so a user-initiated check re-attempts. */
export function resetRefreshLatch(): void {
  refreshFailed = false;
}

function refreshAccessToken(): Promise<string | null> {
  if (refreshFailed) return Promise.resolve(null);

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh-token"), {
        method: "POST",
        credentials: "include", // sends the httpOnly refresh cookie (cookie SSO)
      });
      if (!response.ok) {
        refreshFailed = true;
        return null;
      }
      const body = unwrap<{ accessToken?: string }>(await response.json());
      if (!body?.accessToken) {
        refreshFailed = true;
        return null;
      }
      refreshFailed = false;
      return body.accessToken;
    } catch {
      refreshFailed = true;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function send(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
  isRetry = false,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  if (!options.skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status !== 401 || options.skipRefresh || isRetry) return response;

  // Exactly one silent refresh attempt, then one retry.
  const token = await refreshAccessToken();
  if (!token) {
    setAccessToken(null);
    return response;
  }
  setAccessToken(token);
  return send(method, path, body, options, true);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(method, path, body, options);
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return unwrap<T>(await response.json());
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
