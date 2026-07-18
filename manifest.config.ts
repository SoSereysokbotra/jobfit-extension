import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/**
 * MV3 manifest (typed, built by @crxjs/vite-plugin).
 *
 * PHASE 2 scope: popup + background worker + LinkedIn content script.
 * Permissions stay minimal per the plan: `storage` + `activeTab`.
 *
 * `host_permissions` MUST cover the JobFit API origin so the background worker
 * can call it with `credentials:"include"` and have the httpOnly refresh cookie
 * ride along (cookie SSO). Keep this origin in sync with `API_BASE_URL` in
 * src/shared/config.ts. Dev default: the backend on localhost:4000.
 *
 * The LinkedIn content script needs NO host_permission — a `content_scripts`
 * match grants injection, and we never fetch LinkedIn (only annotate its DOM).
 * Its CSS is inlined into a Shadow DOM at runtime, so nothing lands in the page.
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
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "activeTab"],
  host_permissions: ["http://localhost:4000/*"],
});
