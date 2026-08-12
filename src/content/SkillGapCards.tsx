/**
 * Phase 5 — Skills Gap action cards. Each gap offers a "Start Learning Path"
 * action when the backend supplies one, plus a "jobs without X" shortcut.
 */
import { sendMessage } from "@/shared/messaging";
import type { JobSource, SkillGap, SkillGapReport } from "@/shared/types";
import { useWorkerData } from "./useWorkerData";
import { openLogin, openWebApp, SkeletonLines, StateNote } from "./ui";

function GapCard({ gap }: { gap: SkillGap }) {
  return (
    <div className="jf-rounded-md jf-border jf-border-border jf-bg-background-secondary jf-p-2">
      <div className="jf-flex jf-items-center jf-gap-1">
        <span className="jf-text-sm jf-font-bold jf-text-content">Gap: {gap.skill}</span>
      </div>
      <p className="jf-mt-1 jf-text-sm jf-text-content-secondary">
        Required by {gap.demandCount.toLocaleString()} jobs you&apos;d fit
      </p>
      <div className="jf-mt-2 jf-flex jf-flex-wrap jf-gap-1">
        {gap.learningPath && (
          <button
            type="button"
            onClick={() => openWebApp("/learning")}
            className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-5 jf-py-2 jf-text-base jf-font-bold jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md"
          >
            Start Learning Path · {gap.learningPath.durationWeeks}w
          </button>
        )}
        <button
          type="button"
          onClick={() => openWebApp("/jobs")}
          className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-4 jf-py-2 jf-text-base jf-font-medium jf-text-content-secondary jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
        >
          {gap.jobsWithoutSkill} jobs without {gap.skill}
        </button>
      </div>
    </div>
  );
}

export function SkillGapCards({
  externalId,
  source,
  role,
}: {
  externalId: string;
  source: JobSource;
  /** Job title — scopes gaps to similar roles server-side. */
  role: string | null;
}) {
  const { state, retry } = useWorkerData<SkillGapReport>(() =>
    sendMessage({ type: "GET_SKILL_GAP", externalId, source, title: role }),
  );

  if (state.status === "loading") return <SkeletonLines rows={2} />;
  if (state.status === "empty")
    return (
      <StateNote text="No skill-gap data for this role yet — JobFit compares against similar roles it has seen, and there aren't enough for this one." />
    );
  if (state.status === "unauthenticated")
    return <StateNote text="Log in to see your skill gaps." actionLabel="Log in" onAction={openLogin} />;
  if (state.status === "error")
    return <StateNote tone="error" text={state.message} actionLabel="Retry" onAction={retry} />;

  return (
    <div className="jf-flex jf-flex-col jf-gap-2">
      {state.data.gaps.map((gap) => (
        <GapCard key={gap.skill} gap={gap} />
      ))}
    </div>
  );
}
