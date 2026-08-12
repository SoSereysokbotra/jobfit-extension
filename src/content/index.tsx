/**
 * Content-script bootstrap.
 *
 * Responsibilities:
 *  1. Mount React UI inside a Shadow DOM so LinkedIn's CSS can't reach us and
 *     our CSS (tokens + `jf-`-prefixed utilities, Preflight OFF) can't reach it.
 *  2. Use the site adapter to detect a job page and find the title to anchor to.
 *  3. Survive LinkedIn's SPA navigation (client-side routing) and re-renders:
 *     (re)mount whenever the job changes or LinkedIn removes our chip.
 *  4. Drive the Easy Apply cover-letter injection (Phase 9) off the same tick.
 *
 * Everything runs behind try/catch and fails silently — a DOM change on
 * LinkedIn's side must never throw into their page.
 */
import { createRoot, type Root } from "react-dom/client";
import { createShadowHost } from "./shadow";
import { linkedin } from "./sites/linkedin";
import type { SiteAdapter } from "./sites/types";
import type { JobSource } from "@/shared/types";
import { JobFitApp } from "./JobFitApp";
import { syncEasyApply } from "./easyApply";

const HOST_ID = "jobfit-chip-host";

function pickAdapter(hostname: string): SiteAdapter | null {
  if (hostname === "www.linkedin.com" || hostname.endsWith(".linkedin.com")) {
    return linkedin;
  }
  return null;
}

const adapter = pickAdapter(location.hostname);

// ─── Mount lifecycle ────────────────────────────────────────────────────────
let root: Root | null = null;
let host: HTMLElement | null = null;
let mountedJobId: string | null = null;

function unmount(): void {
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
  mountedJobId = null;
}

function mount(anchor: HTMLElement, jobId: string): void {
  // Idempotent: correct chip already in place → do nothing.
  if (host?.isConnected && mountedJobId === jobId) return;
  unmount();

  const { host: created, mountPoint } = createShadowHost("span");
  host = created;
  host.id = HOST_ID;
  // Structural inline styles only (layout/position) — never color.
  host.style.display = "inline-flex";
  host.style.verticalAlign = "middle";
  host.style.marginLeft = "8px";

  anchor.insertAdjacentElement("afterend", host);
  root = createRoot(mountPoint);
  // Company + title are read once at mount for LOCAL use (sidebar/salary) — never sent.
  const company = adapter?.getCompany() ?? null;
  const role = adapter?.getTitle() ?? null;
  const location = adapter?.getLocation() ?? null;
  root.render(
    <JobFitApp
      externalId={jobId}
      source={adapter!.source as JobSource}
      company={company}
      role={role}
      location={location}
      // Passed as a callback, not a value: the description is read only if the
      // user clicks "Full Report", never at mount.
      getDescription={() => adapter?.getDescription() ?? null}
    />,
  );
  mountedJobId = jobId;
}

function sync(): void {
  if (!adapter) return;
  try {
    const url = location.href;
    const jobId = adapter.getExternalId(url);

    // Easy Apply cover-letter button (Phase 9) — independent of the badge mount,
    // since the modal can be open with or without the title anchor present.
    syncEasyApply(adapter, jobId);

    if (!jobId) {
      unmount();
      return;
    }
    const anchor = adapter.getTitleAnchor();
    if (!anchor) return; // title not rendered yet — the observer will retry.
    mount(anchor, jobId);
  } catch {
    // Never break the host page.
  }
}

// ─── Scheduling: coalesce bursts of mutations into one sync ──────────────────
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sync, 150);
}

// ─── SPA navigation: LinkedIn routes client-side, so patch history + popstate ─
function watchNavigation(): void {
  const origPush = history.pushState;
  history.pushState = function (this: History, ...args) {
    const result = origPush.apply(this, args);
    scheduleSync();
    return result;
  };
  const origReplace = history.replaceState;
  history.replaceState = function (this: History, ...args) {
    const result = origReplace.apply(this, args);
    scheduleSync();
    return result;
  };
  window.addEventListener("popstate", scheduleSync);
}

if (adapter) {
  watchNavigation();
  // Re-check on any DOM churn: catches async title render and LinkedIn removing
  // our chip during a re-render. Debounced, and sync() is cheap + idempotent.
  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  sync(); // initial pass
}
