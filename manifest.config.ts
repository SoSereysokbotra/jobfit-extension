import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/**
 * MV3 manifest (typed, built by @crxjs/vite-plugin).
 *
 * PHASE 1 scope: popup + background service worker (auth bridge via cookie SSO).
 * No content scripts yet — those arrive in Phase 2 (LinkedIn). Permissions are
 * kept minimal per the plan: `storage` (persist state across MV3 worker sleeps)
 * + `activeTab`.
 *
 * `host_permissions` MUST cover the JobFit API origin so the background worker
 * can call it with `credentials:"include"` and have the httpOnly refresh cookie
 * ride along (cookie SSO). Keep this origin in sync with `API_BASE_URL` in
 * src/shared/config.ts. Dev default: the backend on localhost:4000.
 */
export default defineManifest({
  manifest_version: 3,
  name: "JobFit",
  description:
    "Surface your JobFit match intelligence — sub-scores, company data, salary & skill gaps — right on LinkedIn & Indeed.",
  version: pkg.version,
  action: {
    default_popup: "src/popup/index.html",
    default_title: "JobFit",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "activeTab"],
  host_permissions: ["http://localhost:4000/*"],
});
