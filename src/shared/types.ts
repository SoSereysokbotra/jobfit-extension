/**
 * Backend types, mirrored VERBATIM from the web app so the extension speaks the
 * exact same contract. Source of truth: web repo
 * `src/providers/auth-provider.tsx` (`AuthUser` = the `GET /auth/me` shape).
 */

/** Backend roles (SafeUser.role). */
export type UserRole = "JOB_SEEKER" | "EMPLOYER" | "ADMIN";

/**
 * `GET /auth/me` → User.toSafe(). Backend shape verbatim: a single `name`
 * (not firstName/lastName). NOTE: there is deliberately no subscription/tier
 * here — tier lives in a separate `subscriptions` table/endpoint, so the popup
 * must not invent one.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  deletedAt: string | null;
}
