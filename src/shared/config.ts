/**
 * Runtime configuration. Values come from Vite env vars at build time
 * (`.env` → `VITE_*`), with dev defaults matching the web app's local setup:
 *   - API on http://localhost:4000/api/v1  (web app's NEXT_PUBLIC_API_URL)
 *   - Web app on http://localhost:3000
 *
 * IMPORTANT: `API_BASE_URL`'s origin must be covered by `host_permissions` in
 * manifest.config.ts, or the background worker's cross-origin fetch (and the
 * cookie that rides with it) will be blocked. Keep the two in sync.
 */
/** Drop any trailing slash so `${BASE}/path` never produces a double slash. */
const trimSlash = (url: string): string => url.replace(/\/+$/, "");

export const API_BASE_URL: string = trimSlash(
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1",
);

export const WEB_APP_URL: string = trimSlash(
  import.meta.env.VITE_WEB_URL ?? "http://localhost:3000",
);

/** Where the logged-out CTA sends the user to authenticate. */
export const LOGIN_URL = `${WEB_APP_URL}/login`;
