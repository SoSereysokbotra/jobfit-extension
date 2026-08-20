import { defineManifest } from "@crxjs/vite-plugin";
import { loadEnv } from "vite";
import pkg from "./package.json" with { type: "json" };

/**
 * MV3 manifest (typed, built by @crxjs/vite-plugin).
 *
 * `host_permissions` MUST cover the JobFit API origin so the background worker
 * can call it with `credentials:"include"` and have the httpOnly refresh cookie
 * ride along (cookie SSO).
 *
 * That origin is DERIVED from the same `VITE_API_URL` the runtime code uses, so
 * the two can never drift: set the URL once in `.env` and both the manifest and
 * `src/shared/config.ts` follow. Point it at your deployed API for production.
 *
 * The LinkedIn content script needs NO host_permission — a `content_scripts`
 * match grants injection, and we never fetch LinkedIn (only annotate its DOM).
 * Its CSS is inlined into a Shadow DOM at runtime, so nothing lands in the page.
 */
const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "VITE_");

const API_URL = env.VITE_API_URL ?? "http://localhost:4000/api/v1";
const WEB_URL = env.VITE_WEB_URL ?? "http://localhost:3000";

/** `https://api.example.com/api/v1` → `https://api.example.com/*` */
function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

// The API origin is required; the web origin is included so a future
// externally_connectable/bridge fallback works without another manifest edit.
const hostPermissions = [...new Set([originPattern(API_URL), originPattern(WEB_URL)])];
export default defineManifest({
  manifest_version: 3,
  name: "JobFit",
  // Store limit is 132 chars and the Store REJECTS an over-length description. This was
  // 136 until 2026-08-20 — count it, do not eyeball it. Only claim what ships: all five
  // adapters below are implemented (src/content/sites/).
  // Keep identical to the "Short description" block in docs/STORE_LISTING.md.
  description:
    "See your JobFit match score, company insights, salary and skill gaps on job posts — LinkedIn, Indeed, JobNet, Khmer24, BongThom.",
  version: pkg.version,
  icons: {
    16: "icon16.png",
    48: "icon48.png",
    128: "icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "JobFit",
    default_icon: {
      16: "icon16.png",
      48: "icon48.png",
      128: "icon128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      // One entry per supported board (docs/MULTI_SITE_PLAN.md). `*.indeed.com`
      // covers the country domains — kh., uk., sg. — which are separate hosts.
      // `*.host` matches the bare host AND any subdomain, so a user landing on
      // khmer24.com (no www) is covered as well as www.khmer24.com.
      matches: [
        "https://*.linkedin.com/*",
        "https://*.khmer24.com/*",
        "https://*.bongthom.com/*",
        "https://*.jobnet.com.kh/*",
        "https://*.indeed.com/*",
      ],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  // storage: settings + notification dedupe · alarms/notifications: Phase 7 deadlines
  permissions: ["storage", "activeTab", "alarms", "notifications"],
  host_permissions: hostPermissions,
});
