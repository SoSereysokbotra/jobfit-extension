/**
 * The site registry — the one place that maps a hostname to its adapter.
 *
 * Adding a job board is: write the adapter, add a line here, add the host to
 * `manifest.config.ts` (the content script only loads where the manifest says), and add
 * the name to `JobSource`. See docs/MULTI_SITE_PLAN.md §3.
 */
import type { SiteAdapter } from "./types";
import { linkedin } from "./linkedin";
import { khmer24 } from "./khmer24";
import { bongthom } from "./bongthom";
import { indeed } from "./indeed";
import { jobnet } from "./jobnet";

/**
 * `host` is matched as an exact hostname OR as a suffix (".linkedin.com"), so country
 * domains and subdomains resolve without a line each — Indeed alone has dozens
 * (kh.indeed.com, uk.indeed.com, …).
 */
const REGISTRY: ReadonlyArray<{ suffix: string; adapter: SiteAdapter }> = [
  { suffix: "linkedin.com", adapter: linkedin },
  { suffix: "khmer24.com", adapter: khmer24 },
  { suffix: "bongthom.com", adapter: bongthom },
  { suffix: "jobnet.com.kh", adapter: jobnet },
  { suffix: "indeed.com", adapter: indeed },
];

export function pickAdapter(hostname: string): SiteAdapter | null {
  const host = hostname.toLowerCase();
  for (const { suffix, adapter } of REGISTRY) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return adapter;
  }
  return null;
}
