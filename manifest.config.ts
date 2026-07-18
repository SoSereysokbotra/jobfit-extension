import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/**
 * MV3 manifest (typed, built by @crxjs/vite-plugin).
 *
 * PHASE 0 scope: popup only. No content scripts, no background worker yet —
 * those arrive in Phase 1 (auth bridge / service worker) and Phase 2
 * (LinkedIn content script). Permissions are kept minimal per the plan:
 * `storage` (persist state across MV3 worker sleeps) + `activeTab`.
 *
 * `host_permissions` points at the JobFit API origin so that — from Phase 1 —
 * the background worker can call it with `credentials:"include"` (cookie SSO).
 * Update the origin below to your deployed API when it is known; the dev
 * default assumes the backend runs on localhost:3000. No network calls happen
 * in Phase 0.
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
  permissions: ["storage", "activeTab"],
  host_permissions: ["http://localhost:3000/*"],
});
