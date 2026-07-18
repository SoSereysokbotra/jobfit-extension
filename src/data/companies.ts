import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { CompanyIntel, HiringVelocity } from "@/shared/types";

/** GET /companies/by-name — see docs/CONTRACTS.md. Returns null = not found. */

const VELOCITY: HiringVelocity[] = ["LOW", "MEDIUM", "HIGH"];
const SAMPLE_ROLES = ["Senior Backend", "Staff Engineer", "Tech Lead", "Platform Engineer"];

async function mock(name: string): Promise<CompanyIntel | null> {
  await mockDelay();
  const trimmed = name.trim();
  if (!trimmed) return null;
  const h = hashString(trimmed.toLowerCase());

  const topMatches = SAMPLE_ROLES.slice(0, scaled(h >> 3, 2, 3)).map((title, i) => ({
    title,
    score: scaled(h >> (i + 2), 62, 90),
  }));

  return {
    name: trimmed,
    glassdoorRating: Math.round(scaled(h, 33, 48)) / 10, // 3.3–4.8
    fundingStage: ["Seed", "Series B", "Series D", "IPO"][scaled(h >> 5, 0, 3)],
    hiringVelocity: VELOCITY[scaled(h >> 7, 0, 2)],
    openRoles: scaled(h >> 9, 2, 24),
    salaryRange: {
      min: scaled(h >> 1, 90, 150) * 1000,
      max: scaled(h >> 1, 160, 220) * 1000,
      currency: "USD",
      dataPoints: scaled(h >> 11, 6, 60),
    },
    topMatches,
  };
}

function real(name: string): Promise<CompanyIntel | null> {
  return api.get<CompanyIntel | null>("/companies/by-name", { query: { name } });
}

export function getCompanyByName(name: string): Promise<CompanyIntel | null> {
  return DATA_SOURCE.companies === "mock" ? mock(name) : real(name);
}
