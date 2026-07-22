import { api } from "@/background/api";
import { DATA_SOURCE, mockDelay } from "./source";
import type { CoverLetter, JobSource } from "@/shared/types";

/**
 * POST /generate/cover-letter — see docs/CONTRACTS.md.
 *
 * PRIVACY: only identifiers are sent (externalId, source, company/role display
 * names). The job description is never scraped or transmitted — the backend
 * composes the letter from the user's own profile/résumé.
 */

export interface CoverLetterInput {
  externalId: string;
  source: JobSource;
  company: string | null;
  role: string | null;
}

async function mock(input: CoverLetterInput): Promise<CoverLetter> {
  // Longer delay than other mocks — generation is a real model call.
  await mockDelay(1400);
  const company = input.company?.trim() || "your team";
  const role = input.role?.trim() || "this role";
  const text = [
    "Dear Hiring Manager,",
    "",
    `I'm excited to apply for the ${role} position at ${company}. Having followed ${company}'s work closely, I'm drawn to the scale and craft of the problems your team takes on.`,
    "",
    `In my current role I've shipped production systems end to end — designing the services, owning their reliability, and working directly with product to get the details right. That mix of depth and ownership maps closely to what ${role} calls for.`,
    "",
    `What draws me to ${company} specifically is the chance to do that same work with far greater reach. I'd welcome the opportunity to discuss how my background fits your team's roadmap.`,
    "",
    "Thank you for your time and consideration.",
    "",
    "Sincerely,",
  ].join("\n");
  return { text, model: "mock-generator" };
}

function real(input: CoverLetterInput): Promise<CoverLetter | null> {
  return api.post<CoverLetter | null>("/generate/cover-letter", input);
}

export function generateCoverLetter(input: CoverLetterInput): Promise<CoverLetter | null> {
  return DATA_SOURCE.coverLetter === "mock" ? mock(input) : real(input);
}
