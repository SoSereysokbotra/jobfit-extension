import { useEffect, useRef, useState } from "react";
import type { DataResult } from "@/shared/messaging";

export type Loadable<T> = { status: "loading" } | DataResult<T>;

/**
 * Fetch a `DataResult` from the background worker. The whole content tree is
 * remounted when the job changes (see content/index.tsx), so this runs on mount
 * and on explicit `retry()` — no dependency array needed.
 */
export function useWorkerData<T>(load: () => Promise<DataResult<T>>): {
  state: Loadable<T>;
  retry: () => void;
} {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadRef
      .current()
      .then((result) => {
        if (active) setState(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Request failed",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  return { state, retry: () => setNonce((n) => n + 1) };
}
