import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { InterviewPrep, JobSource } from "@/shared/types";

/**
 * POST /generate/interview — tailored interview prep (Qwen 3). See docs/CONTRACTS.md.
 * PRIVACY: only identifiers + display company/role are sent; the backend builds
 * prep from the user's profile and the job it already knows by externalId.
 */
export interface InterviewInput {
  externalId: string;
  source: JobSource;
  company: string | null;
  role: string | null;
}

async function mock(input: InterviewInput): Promise<InterviewPrep> {
  // Longer delay — this is a real model call in production.
  await mockDelay(1200);
  const role = input.role?.trim() || "this role";
  const company = input.company?.trim();
  const h = hashString(`${input.source}:iv:${input.externalId}`);
  const sys = scaled(h, 25, 45);
  const behavioral = scaled(h >> 3, 20, 35);
  const coding = Math.max(10, 100 - sys - behavioral);
  return {
    questionTypes: [
      { label: "System Design", pct: sys },
      { label: "Behavioral", pct: behavioral },
      { label: "Coding", pct: coding },
    ],
    topQuestions: [
      `Walk me through a system you designed${company ? ` relevant to ${company}` : ""}.`,
      "Describe a time you disagreed with a teammate and how you resolved it.",
      `What trade-offs would you weigh building ${role}-critical infrastructure?`,
      "How do you handle database schema migrations with zero downtime?",
      "Tell me about a production incident you owned end to end.",
    ],
    model: "mock-generator",
  };
}

function real(input: InterviewInput): Promise<InterviewPrep | null> {
  // Ungated, extension-specific route (the plain /generate/interview is the web
  // app's premium, jobId-based endpoint).
  return api.post<InterviewPrep | null>("/generate/interview-prep", input);
}

export function generateInterviewPrep(input: InterviewInput): Promise<InterviewPrep | null> {
  return DATA_SOURCE.interview === "mock" ? mock(input) : real(input);
}
