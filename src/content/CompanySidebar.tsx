/**
 * Phase 4 — Company Fit Intelligence sidebar. A slide-in panel (inside the same
 * Shadow DOM) showing Glassdoor rating, funding, hiring velocity, the user's top
 * matches, and salary range. Focus-trapped, Esc to close, scrim click to close.
 */
import { useEffect, useRef } from "react";
import { sendMessage } from "@/shared/messaging";
import type { CompanyIntel, HiringVelocity } from "@/shared/types";
import { useWorkerData } from "./useWorkerData";
import { openLogin, SkeletonLines, StateNote } from "./ui";

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

const VELOCITY_LABEL: Record<HiringVelocity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="jf-flex jf-items-center jf-justify-between jf-py-1">
      <span className="jf-text-sm jf-text-content-secondary">{label}</span>
      <span className="jf-text-sm jf-font-semibold jf-text-content">{value}</span>
    </div>
  );
}

function Body({ data }: { data: CompanyIntel }) {
  const money = (n: number, currency: string) =>
    `${currency === "USD" ? "$" : ""}${Math.round(n / 1000)}K`;
  return (
    <div className="jf-flex jf-flex-col jf-gap-3">
      <div className="jf-rounded-md jf-border jf-border-border jf-p-3">
        {data.glassdoorRating != null && (
          <Row label="Glassdoor" value={`${data.glassdoorRating.toFixed(1)}`} />
        )}
        {data.fundingStage && <Row label="Funding" value={data.fundingStage} />}
        {data.hiringVelocity && (
          <Row label="Hiring velocity" value={VELOCITY_LABEL[data.hiringVelocity]} />
        )}
        {data.openRoles != null && <Row label="Open roles" value={String(data.openRoles)} />}
      </div>

      {data.topMatches.length > 0 && (
        <div>
          <h3 className="jf-mb-2 jf-text-sm jf-font-bold jf-text-content">Your matches</h3>
          <div className="jf-flex jf-flex-col jf-gap-1">
            {data.topMatches.map((m) => (
              <div key={m.title} className="jf-flex jf-items-center jf-justify-between">
                <span className="jf-text-sm jf-text-content-secondary">{m.title}</span>
                <span className="jf-text-sm jf-font-semibold jf-text-primary-600">{m.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.salaryRange && (
        <div className="jf-rounded-md jf-bg-background-secondary jf-p-3">
          <p className="jf-text-sm jf-text-content-secondary">Salary range for this role</p>
          <p className="jf-text-base jf-font-semibold jf-text-content">
            {money(data.salaryRange.min, data.salaryRange.currency)} –{" "}
            {money(data.salaryRange.max, data.salaryRange.currency)}
          </p>
          <p className="jf-text-sm jf-text-content-tertiary">
            Based on {data.salaryRange.dataPoints} data points
          </p>
        </div>
      )}
    </div>
  );
}

export function CompanySidebar({ name, onClose }: { name: string; onClose: () => void }) {
  const { state, retry } = useWorkerData<CompanyIntel>(() =>
    sendMessage({ type: "GET_COMPANY_INTEL", name }),
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const root = panelRef.current.getRootNode() as ShadowRoot;
      const active = root.activeElement as HTMLElement | null;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Capture phase so we intercept before LinkedIn's own handlers.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div
        className="jf-fixed jf-inset-0 jf-bg-scrim"
        style={{ zIndex: 2147483646 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Company intel for ${name}`}
        style={{ zIndex: 2147483647 }}
        className="jf-fixed jf-right-0 jf-top-0 jf-flex jf-h-screen jf-w-96 jf-flex-col jf-gap-3 jf-overflow-y-auto jf-bg-card jf-p-4 jf-font-sans jf-shadow-xl"
      >
        <div className="jf-flex jf-items-center jf-justify-between">
          <h2 className="jf-truncate jf-text-base jf-font-bold jf-text-content" title={name}>
            {name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="jf-rounded-md jf-px-2 jf-py-1 jf-text-content-secondary jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {state.status === "loading" && <SkeletonLines rows={5} />}
        {state.status === "empty" && <StateNote text="No company data found." />}
        {state.status === "unauthenticated" && (
          <StateNote text="Log in to see company intel." actionLabel="Log in" onAction={openLogin} />
        )}
        {state.status === "error" && (
          <StateNote tone="error" text={state.message} actionLabel="Retry" onAction={retry} />
        )}
        {state.status === "ok" && <Body data={state.data} />}
      </aside>
    </>
  );
}
