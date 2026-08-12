import { useEffect, useState } from "react";
import { sendMessage, type DataResult } from "@/shared/messaging";
import type { MomentumStats } from "@/shared/types";
import { Skeleton } from "@/shared/components/Skeleton";

/**
 * Phase 10 — Momentum score. Uses the real GET /analytics/my-stats. Hides itself
 * when logged out (the AuthPanel owns the login CTA).
 */
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1.5 text-center">
      <p className="text-lg font-bold text-content">{value}</p>
      <p className="text-xs text-content-secondary">{label}</p>
    </div>
  );
}

export function MomentumPanel() {
  const [state, setState] = useState<{ status: "loading" } | DataResult<MomentumStats>>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    sendMessage({ type: "GET_MOMENTUM" })
      .then((r) => {
        if (active) setState(r);
      })
      .catch((e: unknown) => {
        if (active)
          setState({ status: "error", message: e instanceof Error ? e.message : "Failed" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "unauthenticated") return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-content">Your momentum</h2>

      {state.status === "loading" && <Skeleton className="h-16 w-full" />}
      {state.status === "error" && <p className="text-sm text-error-600">{state.message}</p>}
      {state.status === "empty" && (
        <p className="text-sm text-content-secondary">No activity yet.</p>
      )}
      {state.status === "ok" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Applied" value={state.data.totalApplications} />
            <Stat label="Interviews" value={state.data.totalInterviews} />
            <Stat label="Offers" value={state.data.totalOffers} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-content-secondary">Momentum</span>
              <span className="text-xs font-semibold text-content">{state.data.momentum}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700"
                style={{ width: `${state.data.momentum}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-content-tertiary">
            Interview rate {Math.round(state.data.interviewRate * 100)}% ·{" "}
            {state.data.profileViewCount} profile views
          </p>
        </div>
      )}
    </section>
  );
}
