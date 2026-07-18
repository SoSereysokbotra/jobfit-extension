import { DATA_SOURCE } from "./source";
import type { SubscriptionTier } from "@/shared/types";

/**
 * Resolve the user's subscription tier. Tier is NOT on /auth/me (it lives in the
 * `subscriptions` table), and no extension endpoint is wired yet — so this is
 * mocked to FREE for now. When a `GET /subscriptions/me` (or similar) endpoint
 * exists, implement `real()` and flip `DATA_SOURCE.tier`.
 *
 * Gating rule (per the feature spec's monetization table): FREE sees gaps only;
 * PREMIUM/PROFESSIONAL additionally see learning paths, salary data, etc.
 */
async function mock(): Promise<SubscriptionTier> {
  return "FREE";
}

async function real(): Promise<SubscriptionTier> {
  // TODO: implement against the real subscription endpoint when it exists.
  return "FREE";
}

export function getTier(): Promise<SubscriptionTier> {
  return DATA_SOURCE.tier === "mock" ? mock() : real();
}
