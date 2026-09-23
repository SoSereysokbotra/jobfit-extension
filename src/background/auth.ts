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
import {
  forgetActiveUser,
  getStoredActiveUser,
  handOffDevice,
  setActiveRole,
  setActiveUser,
} from "./account";
import type { AuthState } from "@/shared/messaging";
import type { AuthUser, UserRole } from "@/shared/types";

/**
 * In-flight / already-done marker for the lazy role lookup below.
 *
 * Module-scoped, so it lives exactly as long as this MV3 worker does. That is the right
 * lifetime: it collapses a burst of job pages into ONE `/auth/me`, and a worker restart
 * is a natural moment to ask again.
 */
let roleLookup: Promise<UserRole | null> | null = null;

/**
 * The signed-in user's role, for the content script's "should I inject?" question.
 *
 * Prefers the cache, and RESOLVES IT ONCE if the cache is cold.
 *
 * WHY THE LOOKUP EXISTS: caching alone was not enough. The role is only written when
 * something calls `getAuthState()` — the popup opening, or an alarm firing. A user who
 * installs the extension and goes straight to LinkedIn has an empty cache, so the badge
 * fell back to "show" and an employer got the full panel anyway. Observed in exactly that
 * order, which is the normal order.
 *
 * WHY IT IS STILL CHEAP: at most one `/auth/me` per worker lifetime, shared by every tab
 * through `roleLookup`, and only while the cache is cold. It never becomes per-page —
 * which is the thing that must not happen to this endpoint.
 */
export async function resolveActiveRole(): Promise<UserRole | null> {
  // ONE FRESH LOOKUP PER WORKER LIFETIME — deliberately NOT a storage read.
  //
  // This used to return the cached role when one existed, which was wrong in the most
  // ordinary way possible: sign in as an employer, sign out on the web app, sign back in
  // as a job seeker, and the cache still said EMPLOYER — so the badge stayed hidden from
  // a seeker with no way to recover but a logout inside the extension. A cache that is
  // only written on login and only read forever is not a cache, it is a one-way latch.
  //
  // `roleLookup` still collapses every tab's question into a single `/auth/me`, and an
  // MV3 worker is short-lived, so an account switch self-heals within a wake cycle.
  // Storage stays written by getAuthState for the popup's warm start; it is just not the
  // authority for this decision any more.
  roleLookup ??= getAuthState().then((state) =>
    state.status === "authenticated" ? state.user.role : null,
  );
  return roleLookup;
}

export async function getAuthState(): Promise<AuthState> {
  // User-initiated check (popup open): clear any previous failed-refresh latch
  // so a fresh login on the web app is picked up.
  resetRefreshLatch();
  try {
    const user = await api.get<AuthUser>("/auth/me");
    // Cache the role on the way past. This is the ONLY place the worker learns it, and
    // doing it here means the content script can ask "is this a job seeker?" from storage
    // instead of spending a request per job page. See DEVICE_KEYS.activeRole.
    await setActiveRole(user.role);
    return { status: "authenticated", user };
  } catch (error) {
    if (error instanceof ApiError) {
      // 401/403 → simply not signed in (or session can't be restored).
      if (error.statusCode === 401 || error.statusCode === 403) {
        await setActiveRole(null);
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
