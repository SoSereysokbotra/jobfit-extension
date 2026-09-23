import { useCallback, useEffect, useState } from "react";
import { sendMessage, type AuthState } from "@/shared/messaging";

type Loadable = { status: "loading" } | AuthState;

/**
 * Popup-side hook: asks the background worker for the current auth state and
 * exposes a `refetch` for the "I've logged in — refresh" action. The popup never
 * touches the network itself — only the worker does.
 */
/**
 * Is the signed-in user someone this product is FOR?
 *
 * JobFit for Chrome scores jobs against a JOB SEEKER profile. An employer or admin is
 * authenticated but has no such profile, so every panel rendered blank for them. Each
 * panel used to guard on `status === "unauthenticated"` alone, which let that through.
 *
 * Deliberately false while LOADING too: a panel should not flash real chrome before it
 * knows who is looking. AuthPanel owns the explanation, so the others simply stay away.
 */
export function isSeeker(state: Loadable): boolean {
  return state.status === "authenticated" && state.user.role === "JOB_SEEKER";
}

/**
 * Is the signed-in user a JOB SEEKER, from the worker's CACHED role?
 *
 * For panels that do not otherwise need auth. It reads `chrome.storage` through the
 * worker rather than calling `/auth/me`: AuthPanel already makes that request once per
 * popup open, and repeating it per panel would put four calls on the endpoint whose rate
 * limiting has already locked users out once.
 *
 * DEFAULTS TO TRUE while unknown, for the same reason the content script does: showing a
 * panel to an employer is a much smaller failure than hiding the product from a seeker
 * whose role has not been cached yet.
 */
export function useIsSeeker(): boolean {
  const [isSeekerRole, setIsSeekerRole] = useState(true);

  useEffect(() => {
    let active = true;
    void sendMessage({ type: "GET_ACTIVE_ROLE" })
      .then((role) => {
        if (active && role !== null && role !== "JOB_SEEKER") setIsSeekerRole(false);
      })
      .catch(() => {
        /* worker unreachable — keep showing */
      });
    return () => {
      active = false;
    };
  }, []);

  return isSeekerRole;
}

export function useAuthState() {
  const [state, setState] = useState<Loadable>({ status: "loading" });

  const refetch = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const next = await sendMessage({ type: "AUTH_GET_STATE" });
      setState(next);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Couldn't reach the extension worker",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    await sendMessage({ type: "AUTH_LOGOUT" });
    setState({ status: "unauthenticated" });
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { state, refetch, logout };
}
