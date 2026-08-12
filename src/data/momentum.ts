import { api } from "@/background/api";
import { DATA_SOURCE, mockDelay } from "./source";
import type { MomentumStats } from "@/shared/types";

/**
 * Momentum score — uses the REAL, existing endpoint GET /analytics/my-stats
 * (AnalyticsStatsResponseDto). The gamified 0–100 momentum is derived here from
 * the returned counts. A mock is provided for offline preview.
 */
interface MyStatsDto {
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
  applicationRate: number;
  interviewRate: number;
  offerRate: number;
  profileViewCount: number;
  lastProfileViewDate?: string;
}

/** Simple gamified blend: activity + progression, capped at 100. */
function toMomentum(s: MyStatsDto): MomentumStats {
  const appPoints = Math.min(s.totalApplications, 20) * 3; // ≤ 60
  const interviewPoints = Math.min(s.totalInterviews, 8) * 3; // ≤ 24
  const offerPoints = Math.min(s.totalOffers, 4) * 4; // ≤ 16
  return {
    totalApplications: s.totalApplications,
    totalInterviews: s.totalInterviews,
    totalOffers: s.totalOffers,
    interviewRate: s.interviewRate,
    offerRate: s.offerRate,
    profileViewCount: s.profileViewCount,
    momentum: Math.min(100, Math.round(appPoints + interviewPoints + offerPoints)),
  };
}

async function mock(): Promise<MomentumStats> {
  await mockDelay();
  return toMomentum({
    totalApplications: 7,
    totalInterviews: 2,
    totalOffers: 1,
    applicationRate: 0.29,
    interviewRate: 0.5,
    offerRate: 0.14,
    profileViewCount: 34,
  });
}

async function real(): Promise<MomentumStats> {
  return toMomentum(await api.get<MyStatsDto>("/analytics/my-stats"));
}

export function getMomentum(): Promise<MomentumStats> {
  return DATA_SOURCE.momentum === "mock" ? mock() : real();
}
