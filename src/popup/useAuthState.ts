import { useCallback, useEffect, useState } from "react";
import { sendMessage, type AuthState } from "@/shared/messaging";

type Loadable = { status: "loading" } | AuthState;

/**
 * Popup-side hook: asks the background worker for the current auth state and
 * exposes a `refetch` for the "I've logged in — refresh" action. The popup never
 * touches the network itself — only the worker does.
 */
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
