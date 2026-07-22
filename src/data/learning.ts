import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { JobSource, SkillGap, SkillGapReport } from "@/shared/types";

/** GET /learning/gap — see docs/CONTRACTS.md. gaps:[] = no gaps (strong match). */

const SKILL_POOL = ["Kubernetes", "GraphQL", "Rust", "System Design", "Terraform", "gRPC"];

async function mock(externalId: string, source: JobSource): Promise<SkillGapReport> {
  await mockDelay();
  const h = hashString(`${source}:gap:${externalId}`);
  const count = scaled(h, 0, 3); // 0 → empty state

  const gaps: SkillGap[] = Array.from({ length: count }, (_, i) => {
    const skill = SKILL_POOL[(h >> (i + 1)) % SKILL_POOL.length];
    return {
      skill,
      demandCount: scaled(h >> (i + 2), 120, 900),
      jobsWithoutSkill: scaled(h >> (i + 3), 3, 20),
      learningPath: {
        id: `lp_${skill.toLowerCase().replace(/\s+/g, "_")}`,
        title: `${skill} for Engineers`,
        durationWeeks: scaled(h >> (i + 4), 2, 6),
        isFree: true,
      },
    };
  });

  return { jobExternalId: externalId, source, gaps };
}

function real(externalId: string, source: JobSource): Promise<SkillGapReport> {
  return api.get<SkillGapReport>("/learning/gap", {
    query: { jobExternalId: externalId, source },
  });
}

export function getSkillGap(externalId: string, source: JobSource): Promise<SkillGapReport> {
  return DATA_SOURCE.learningGap === "mock"
    ? mock(externalId, source)
    : real(externalId, source);
}
