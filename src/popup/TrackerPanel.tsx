import { useEffect, useState } from "react";
import { sendMessage, type DataResult } from "@/shared/messaging";
import type { PipelineStage, TrackedApplication } from "@/shared/types";
import { Skeleton } from "@/shared/components/Skeleton";
import { Badge } from "@/shared/components/Badge";

/**
 * Phase 6 — Quick Apply Tracker. Groups the user's real applications
 * (GET /applications, joined with job titles) into the three pipeline stages.
 */
const LIMIT = 50;

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function StageGroup({ label, items }: { label: string; items: TrackedApplication[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          {label}
        </span>
        <Badge variant="neutral" size="sm">
          {items.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-border bg-surface px-2 py-1.5"
          >
            <p className="truncate text-sm font-medium text-content" title={a.jobTitle}>
              {a.jobTitle}
            </p>
            <p className="truncate text-xs text-content-secondary">
              {a.companyName ?? "—"} · {ago(a.appliedAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackerPanel() {
  const [state, setState] = useState<
    { status: "loading" } | DataResult<TrackedApplication[]>
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await sendMessage({ type: "GET_APPLICATIONS", limit: LIMIT });
      if (active) setState(result);
    })().catch((e: unknown) => {
      if (active)
        setState({ status: "error", message: e instanceof Error ? e.message : "Failed" });
    });
    return () => {
      active = false;
    };
  }, []);

  // Hidden when logged out — the AuthPanel already owns the login CTA.
  if (state.status === "unauthenticated") return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-content">Your pipeline</h2>

      {state.status === "loading" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {state.status === "empty" && (
        <p className="text-sm text-content-secondary">No applications yet.</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-error-600">{state.message}</p>
      )}
      {state.status === "ok" && (
        <div className="flex flex-col gap-3">
          {STAGES.map(({ key, label }) => (
            <StageGroup
              key={key}
              label={label}
              items={state.data.filter((a) => a.stage === key)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
