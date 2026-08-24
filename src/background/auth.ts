/**
 * Auth bootstrap for the extension — the whole point of Phase 1.
 *
 * The extension has NO login of its own. It relies entirely on the session the
 * user already established on the web app: the httpOnly refresh cookie. The flow
 * (identical to the web app's bootstrap):
 *   1. GET /auth/me with whatever access token we hold (none on a cold worker).
 *   2. A 401 makes the api layer POST /auth/refresh-token, which the httpOnly
 *      refresh cookie authenticates → new access token → the /auth/me is retried.
 *   3. No cookie / expired session → 401 all the way → unauthenticated.
 *
 * If this returns `unauthenticated` even though the user is logged in on the web
 * app, cookie SSO is not working (the refresh cookie isn't riding along) — that
 * is the decision-2.2 risk this phase exists to surface, and the trigger to fall
 * back to the externally_connectable bridge (option C).
 */
import { api, ApiError, resetRefreshLatch, setAccessToken } from "./api";
import { forgetActiveUser, getStoredActiveUser, handOffDevice, setActiveUser } from "./account";
import type { AuthState } from "@/shared/messaging";
import type { AuthUser } from "@/shared/types";

export async function getAuthState(): Promise<AuthState> {
  // User-initiated check (popup open): clear any previous failed-refresh latch
  // so a fresh login on the web app is picked up.
  resetRefreshLatch();
  try {
    const user = await api.get<AuthUser>("/auth/me");
    return { status: "authenticated", user };
  } catch (error) {
    if (error instanceof ApiError) {
      // 401/403 → simply not signed in (or session can't be restored).
      if (error.statusCode === 401 || error.statusCode === 403) {
        return { status: "unauthenticated" };
      }
      return { status: "error", message: error.message, code: error.code };
    }
    // Network failure — most likely host_permissions/CORS or the API being down.
    return {
      status: "error",
      message:
        "Couldn't reach the JobFit API. Check that the backend is running and that host_permissions covers its origin.",
    };
  }
}

/**
 * The signed-in user's id, or null when nobody is — performing the device
 * handoff on the way through if the account changed since the last check.
 *
 * This is what every background alarm must call first. An alarm is a timer, and
 * a timer knows nothing about sign-outs: six hours after Alice signs out her
 * deadline alarm still fires. Null means "notify nobody".
 *
 * An unreachable API is NOT treated as a sign-out. It returns null so callers
 * stay quiet, but leaves the recorded account untouched, so a flaky network
 * can't trigger a handoff and wipe the wrong person's click-targets.
 */
export async function resolveActiveUser(): Promise<string | null> {
  const auth = await getAuthState();
  if (auth.status === "error") return null;

  const current = auth.status === "authenticated" ? auth.user.id : null;
  const previous = await getStoredActiveUser();
  if (current === previous) return current;

  await handOffDevice(previous);
  await setActiveUser(current);
  return current;
}

export async function logout(): Promise<{ ok: boolean }> {
  try {
    await api.post("/auth/logout", undefined, { skipRefresh: true });
  } catch {
    // Already-expired token: the local session still has to go.
  }
  setAccessToken(null);
  // Signing out has to take the account's device-visible traces with it: the
  // notification click-targets and any toast still sitting in the tray. Without
  // this, a leftover notification navigates for whoever uses the profile next.
  await forgetActiveUser();
  return { ok: true };
}
