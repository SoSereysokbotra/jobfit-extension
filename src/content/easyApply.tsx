/**
 * Phase 9 — Easy Apply integration. The highest-risk DOM surface in the project:
 * LinkedIn's Easy Apply modal is a multi-step, dynamically rendered dialog whose
 * markup changes often. Every lookup is best-effort with fallbacks, the whole
 * sync is wrapped in try/catch, and a miss simply means no button is injected —
 * the user's application flow is never blocked or altered.
 */
import { createRoot, type Root } from "react-dom/client";
import { createShadowHost } from "./shadow";
import { CoverLetterButton, type JobContext } from "./CoverLetterButton";
import type { SiteAdapter } from "./sites/types";
import type { JobSource } from "@/shared/types";

const HOST_ID = "jobfit-cover-letter-host";

const MODAL_SELECTORS = [
  ".jobs-easy-apply-modal",
  "[data-test-modal][role='dialog']",
  ".artdeco-modal",
  "div[role='dialog']",
];

function findModal(): HTMLElement | null {
  for (const selector of MODAL_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/** Does this textarea look like the cover-letter / "why you" field? */
function looksLikeCoverLetter(modal: HTMLElement, t: HTMLTextAreaElement): boolean {
  let labelText = "";
  try {
    labelText = t.id
      ? (modal.querySelector(`label[for="${CSS.escape(t.id)}"]`)?.textContent ?? "")
      : "";
  } catch {
    // CSS.escape can throw on exotic ids — fall back to the other signals.
  }
  const haystack =
    `${labelText} ${t.getAttribute("aria-label") ?? ""} ${t.name} ${t.placeholder}`.toLowerCase();
  return (
    haystack.includes("cover") || haystack.includes("letter") || haystack.includes("why")
  );
}

/** The best cover-letter target in the modal: a labelled match, else the only textarea. */
function findTextarea(modal: HTMLElement): HTMLTextAreaElement | null {
  const areas = Array.from(modal.querySelectorAll("textarea")).filter(
    (t) => t.getClientRects().length > 0, // visible on the current step only
  );
  if (areas.length === 0) return null;
  return areas.find((t) => looksLikeCoverLetter(modal, t)) ?? areas[0];
}

/**
 * Write into a React-controlled textarea. Assigning `.value` directly is ignored
 * by React, so we go through the native prototype setter and then dispatch the
 * events React listens for — otherwise LinkedIn would submit an empty field.
 */
function setTextareaValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let mountedFor: HTMLTextAreaElement | null = null;

function unmount(): void {
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
  mountedFor = null;
}

/**
 * Idempotent: injects the button once per cover-letter field, re-injects if the
 * modal advances a step or LinkedIn re-renders, and tears down when it closes.
 */
export function syncEasyApply(adapter: SiteAdapter, externalId: string | null): void {
  try {
    const modal = findModal();
    if (!modal || !externalId) {
      unmount();
      return;
    }
    const textarea = findTextarea(modal);
    if (!textarea) {
      unmount();
      return;
    }
    // Already mounted against this exact field → nothing to do.
    if (host?.isConnected && mountedFor === textarea) return;
    unmount();

    const ctx: JobContext = {
      externalId,
      source: adapter.source as JobSource,
      company: adapter.getCompany(),
      role: adapter.getTitle(),
    };

    const { host: created, mountPoint } = createShadowHost("div");
    host = created;
    host.id = HOST_ID;
    // Structural inline styles only (layout) — never color.
    host.style.display = "block";
    host.style.margin = "8px 0";

    textarea.insertAdjacentElement("beforebegin", host);
    root = createRoot(mountPoint);
    root.render(
      <CoverLetterButton ctx={ctx} onInsert={(text) => setTextareaValue(textarea, text)} />,
    );
    mountedFor = textarea;
  } catch {
    // Never break LinkedIn's Easy Apply flow.
  }
}
