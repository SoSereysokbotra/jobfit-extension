/**
 * Phase 8 — Salary intelligence panel: P25/P50/P75 + total comp + a negotiation
 * tip for this company/role.
 */
import { sendMessage } from "@/shared/messaging";
import type { SalaryIntel } from "@/shared/types";
import { useWorkerData } from "./useWorkerData";
import { openLogin, SkeletonLines, StateNote } from "./ui";

const k = (n: number) => `$${Math.round(n / 1000)}K`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="jf-rounded-md jf-bg-background-secondary jf-py-1">
      <p className="jf-text-xs jf-text-content-tertiary">{label}</p>
      <p className="jf-text-xs jf-font-semibold jf-text-content">{value}</p>
    </div>
  );
}

export function SalaryPanel({ company, role }: { company: string; role: string }) {
  const { state } = useWorkerData<SalaryIntel>(() =>
    sendMessage({ type: "GET_SALARY_INTEL", company, role }),
  );

  if (state.status === "loading") return <SkeletonLines rows={3} />;
  if (state.status === "empty") return <StateNote text="No salary data for this role." />;
  if (state.status === "unauthenticated")
    return <StateNote text="Log in to see salary data." actionLabel="Log in" onAction={openLogin} />;
  if (state.status === "error") return <StateNote tone="error" text={state.message} />;

  const s = state.data;
  return (
    <div className="jf-flex jf-flex-col jf-gap-1.5">
      {s.listed && (
        <p className="jf-text-xs jf-text-content-secondary">
          Listed: {k(s.listed.min)} – {k(s.listed.max)}
        </p>
      )}
      <div className="jf-grid jf-grid-cols-3 jf-gap-1 jf-text-center">
        <Stat label="P25" value={k(s.market.p25)} />
        <Stat label="P50" value={k(s.market.p50)} />
        <Stat label="P75" value={k(s.market.p75)} />
      </div>
      <p className="jf-text-xs jf-text-content-secondary">
        Total comp avg:{" "}
        <span className="jf-font-semibold jf-text-content">{k(s.market.totalCompAvg)}</span>
      </p>
      <p className="jf-rounded-md jf-bg-primary-50 jf-p-2 jf-text-xs jf-text-primary-700">
        💡 {s.tip}
      </p>
      <p className="jf-text-xs jf-text-content-tertiary">
        Based on {s.market.dataPoints} data points · you fit {s.fitPercentile}
      </p>
    </div>
  );
}
