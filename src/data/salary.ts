import { api } from "@/background/api";
import { DATA_SOURCE, hashString, mockDelay, scaled } from "./source";
import type { SalaryIntel } from "@/shared/types";

/** GET /salary?company=&role= — see docs/CONTRACTS.md. */

async function mock(company: string, role: string): Promise<SalaryIntel | null> {
  await mockDelay();
  if (!company.trim()) return null;
  const h = hashString(`${company}:${role}`.toLowerCase());
  const p25 = scaled(h, 95, 135) * 1000;
  const p50 = p25 + scaled(h >> 2, 15, 40) * 1000;
  const p75 = p50 + scaled(h >> 4, 15, 45) * 1000;
  const totalCompAvg = p75 + scaled(h >> 6, 10, 60) * 1000;
  const band = (["P25", "P50", "P75"] as const)[scaled(h >> 8, 0, 2)];
  const targetLow = Math.round((p50 + p75) / 2 / 1000);
  const targetHigh = Math.round(p75 / 1000);
  return {
    company,
    role,
    listed: { min: p25, max: p75, currency: "USD" },
    market: { p25, p50, p75, totalCompAvg, currency: "USD", dataPoints: scaled(h >> 10, 8, 60) },
    fitPercentile: band,
    tip: `Ask for $${targetLow}K–$${targetHigh}K based on your ${band} fit.`,
  };
}

function real(company: string, role: string): Promise<SalaryIntel | null> {
  return api.get<SalaryIntel | null>("/salary", { query: { company, role } });
}

export function getSalaryIntel(company: string, role: string): Promise<SalaryIntel | null> {
  return DATA_SOURCE.salary === "mock" ? mock(company, role) : real(company, role);
}
