/**
 * Shared Shadow-DOM plumbing for every content-script mount point (the job-title
 * badge and the Easy Apply cover-letter button).
 *
 * tokens.css declares the design tokens on `:host`; content.css holds the
 * `jf-`-prefixed utilities (Preflight OFF). Both are inlined as strings
 * (`?inline`) and adopted as a constructable stylesheet, so nothing is ever
 * injected into LinkedIn's light DOM.
 */
import tokensCss from "@/styles/tokens.css?inline";
import contentCss from "./content.css?inline";

let sheet: CSSStyleSheet | null = null;

export function styleSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(`${tokensCss}\n${contentCss}`);
  }
  return sheet;
}

/** Create a host element with an open shadow root and our stylesheet attached. */
export function createShadowHost(
  tag: "span" | "div" = "span",
): { host: HTMLElement; mountPoint: HTMLElement } {
  const host = document.createElement(tag);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [styleSheet()];
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);
  return { host, mountPoint };
}
