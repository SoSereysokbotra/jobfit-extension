/**
 * Phase 10 — "Application Radar". Warns, at the top of the badge panel, that the
 * user likely already applied to this role. Renders nothing unless a prior
 * application is found (the empty/loading/error states are silent — this is an
 * unobtrusive heads-up, not a core surface).
 */
import { sendMessage } from "@/shared/messaging";
import type { DuplicateMatch, JobSource } from "@/shared/types";
import { useWorkerData } from "./useWorkerData";
import { openWebApp } from "./ui";

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function DuplicateWarning({
  externalId,
  source,
  title,
  company,
}: {
  externalId: string;
  source: JobSource;
  title: string | null;
  company: string | null;
}) {
  const { state } = useWorkerData<DuplicateMatch>(() =>
    sendMessage({ type: "GET_DUPLICATE_CHECK", externalId, source, title, company }),
  );
  if (state.status !== "ok") return null;

  const dup = state.data;
  return (
    <div className="jf-mb-3 jf-rounded-md jf-border jf-border-warning-100 jf-bg-warning-50 jf-p-2">
      <p className="jf-text-xs jf-font-semibold jf-text-warning-600">
        ⚠️ You applied to this role {ago(dup.appliedAt)}
      </p>
      <p className="jf-mt-0.5 jf-text-xs jf-text-content-secondary">
        Status: {dup.status.toLowerCase()} · this may be the same role re-listed.
      </p>
      <button
        type="button"
        onClick={() => openWebApp("/applications")}
        className="jf-mt-1.5 jf-rounded-md jf-border jf-border-border jf-bg-surface jf-px-2 jf-py-0.5 jf-text-xs jf-font-medium jf-text-primary-600 jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
      >
        View your application
      </button>
    </div>
  );
}
