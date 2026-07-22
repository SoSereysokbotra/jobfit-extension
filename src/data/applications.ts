import { api } from "@/background/api";
import { DATA_SOURCE, mockDelay } from "./source";
import type {
  ApplicationStatus,
  PipelineStage,
  TrackedApplication,
} from "@/shared/types";

/**
 * Quick Apply Tracker data. Uses the REAL, existing endpoints:
 *   GET /applications        → ApplicationResponseDto[] (only carries jobId)
 *   GET /jobs/{id}           → title + companyName (joined client-side, as the web app does)
 * A mock is provided for offline UI preview (flip DATA_SOURCE.applications).
 */

interface ApplicationDto {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
}
interface JobDto {
  id: string;
  title: string;
  companyName?: string;
}

/** Map the 10 backend statuses to the 3 pipeline columns; null = not shown. */
function statusToStage(status: ApplicationStatus): PipelineStage | null {
  switch (status) {
    case "DRAFT":
    case "SUBMITTED":
    case "SCREENING":
      return "applied";
    case "INTERVIEW":
      return "interview";
    case "OFFER":
    case "ACCEPTED":
    case "NEGOTIATING":
      return "offer";
    default:
      return null; // REJECTED / WITHDRAWN / ARCHIVED
  }
}

async function real(limit: number): Promise<TrackedApplication[]> {
  const apps = await api.get<ApplicationDto[]>("/applications");
  const relevant = apps
    .map((a) => ({ a, stage: statusToStage(a.status) }))
    .filter((x): x is { a: ApplicationDto; stage: PipelineStage } => x.stage !== null)
    .sort((x, y) => +new Date(y.a.appliedAt) - +new Date(x.a.appliedAt))
    .slice(0, limit);

  // Join job titles; tolerate individual failures (title falls back gracefully).
  const jobs = await Promise.allSettled(
    relevant.map((x) => api.get<JobDto>(`/jobs/${x.a.jobId}`, { skipAuth: true })),
  );

  return relevant.map((x, i) => {
    const settled = jobs[i];
    const job = settled.status === "fulfilled" ? settled.value : null;
    return {
      id: x.a.id,
      stage: x.stage,
      status: x.a.status,
      appliedAt: x.a.appliedAt,
      jobTitle: job?.title ?? "Job",
      companyName: job?.companyName ?? null,
    };
  });
}

const MOCK_ROWS: Array<{ company: string; title: string; status: ApplicationStatus; daysAgo: number }> = [
  { company: "Google", title: "Senior Backend", status: "SUBMITTED", daysAgo: 3 },
  { company: "Stripe", title: "Platform Engineer", status: "INTERVIEW", daysAgo: 6 },
  { company: "Meta", title: "Staff Engineer", status: "OFFER", daysAgo: 9 },
  { company: "Airbnb", title: "Backend Engineer", status: "SCREENING", daysAgo: 12 },
  { company: "Netflix", title: "Senior SWE", status: "SUBMITTED", daysAgo: 14 },
  { company: "Datadog", title: "Site Reliability", status: "INTERVIEW", daysAgo: 18 },
];

async function mock(limit: number): Promise<TrackedApplication[]> {
  await mockDelay();
  const now = Date.now();
  return MOCK_ROWS.slice(0, limit).map((r, i) => ({
    id: `mock_${i}`,
    stage: statusToStage(r.status)!,
    status: r.status,
    appliedAt: new Date(now - r.daysAgo * 86_400_000).toISOString(),
    jobTitle: r.title,
    companyName: r.company,
  }));
}

export function getApplications(limit: number): Promise<TrackedApplication[]> {
  return DATA_SOURCE.applications === "mock" ? mock(limit) : real(limit);
}
