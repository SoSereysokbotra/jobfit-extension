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
        <span aria-hidden="true">⚠️</span>
        <span className="jf-text-xs jf-font-semibold jf-text-content">Gap: {gap.skill}</span>
      </div>
      <p className="jf-mt-1 jf-text-xs jf-text-content-secondary">
        Required by {gap.demandCount.toLocaleString()} jobs you&apos;d fit
      </p>
      <div className="jf-mt-2 jf-flex jf-flex-wrap jf-gap-1">
        {gap.learningPath && (
          <button
            type="button"
            onClick={() => openWebApp("/learning")}
            className="jf-rounded-md jf-bg-primary-600 jf-px-2 jf-py-1 jf-text-xs jf-font-medium jf-text-on-primary jf-transition-all jf-duration-200 hover:jf-bg-primary-700"
          >
            📚 Start Learning Path · {gap.learningPath.durationWeeks}w
          </button>
        )}
        <button
          type="button"
          onClick={() => openWebApp("/jobs")}
          className="jf-rounded-md jf-border jf-border-border jf-px-2 jf-py-1 jf-text-xs jf-font-medium jf-text-content-secondary jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
        >
          🎯 {gap.jobsWithoutSkill} jobs without {gap.skill}
        </button>
      </div>
    </div>
  );
}

export function SkillGapCards({
  externalId,
  source,
}: {
  externalId: string;
  source: JobSource;
}) {
  const { state, retry } = useWorkerData<SkillGapReport>(() =>
    sendMessage({ type: "GET_SKILL_GAP", externalId, source }),
  );

  if (state.status === "loading") return <SkeletonLines rows={2} />;
  if (state.status === "empty")
    return <StateNote text="No skill gaps for this role 🎉" />;
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
