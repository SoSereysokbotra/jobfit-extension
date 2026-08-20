/**
 * A viewport-level layer for anything that must escape the host page's layout.
 *
 * MEASURED NEED (2026-08-13): the badge mounts *inside* the page's own job card, so the
 * dropdown panel inherits whatever that card does — and on Khmer24 the card clips its
 * overflow, so the panel was sliced off a few rows down. LinkedIn happened not to clip,
 * which is why this survived one site. Any absolutely-positioned panel rendered inside
 * someone else's container is at the mercy of that container.
 *
 * So overlays render into a SEPARATE shadow host attached to `document.body`, positioned
 * from the badge's bounding rect. It carries the same constructable stylesheet, so the
 * `jf-` utilities and tokens work identically, and nothing leaks into the page's DOM.
 *
 * `pointer-events: none` on the host with `auto` on the content: the layer covers the
 * whole viewport, and without that it would swallow every click on the page underneath.
 */
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createShadowHost } from "./shadow";

/** Gap between the badge and the panel, and the minimum margin to a viewport edge. */
const GAP = 8;
const EDGE = 8;
/** Below this much room underneath, the panel flips above the badge instead. */
const MIN_ROOM_BELOW = 260;

/** Create the body-level host once per overlay, and remove it on unmount. */
function useOverlayHost(): HTMLElement | null {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const { host, mountPoint } = createShadowHost("div");
    host.style.position = "fixed";
    host.style.inset = "0";
    // Above the host page's own stacking contexts. Structural, never colour.
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
    setMount(mountPoint);
    return () => host.remove();
  }, []);

  return mount;
}

export interface OverlayPosition {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Where to put a panel of `width` px anchored under `anchor`, kept on screen.
 *
 * Recomputed on scroll and resize because the anchor is a normal element in someone
 * else's document — it moves whenever they do.
 */
function usePosition(anchor: HTMLElement | null, width: number): OverlayPosition | null {
  const [position, setPosition] = useState<OverlayPosition | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;

    const place = (): void => {
      const rect = anchor.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
      const flipAbove = roomBelow < MIN_ROOM_BELOW && rect.top > roomBelow;

      setPosition({
        // Clamped so a badge near the right edge doesn't push the panel off screen.
        left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE)),
        top: flipAbove ? EDGE : rect.bottom + GAP,
        maxHeight: flipAbove ? rect.top - GAP - EDGE : roomBelow,
      });
    };

    place();
    // `true` — capture phase, so scrolling of any ancestor container is caught, not just
    // the window. The badge lives inside the page's own scrollable panes.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, width]);

  return position;
}

/**
 * Render `children` in a panel anchored under `anchor`, above the page and immune to its
 * overflow. Renders nothing until the position is known, so it can't flash in the corner.
 */
export function AnchoredOverlay({
  anchor,
  width,
  children,
}: {
  anchor: HTMLElement | null;
  width: number;
  children: ReactNode;
}) {
  const mount = useOverlayHost();
  const position = usePosition(anchor, width);
  if (!mount || !position) return null;

  return createPortal(
    <div
      // Every value here is computed from the viewport — the one kind of inline style
      // the content-UI rules allow.
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${width}px`,
        maxHeight: `${position.maxHeight}px`,
        pointerEvents: "auto",
      }}
      className="jf-overflow-y-auto jf-rounded-xl jf-border jf-border-border jf-bg-card jf-p-4 jf-font-sans jf-shadow-2xl"
    >
      {children}
    </div>,
    mount,
  );
}

/** A full-viewport overlay for drawers and modals (the company sidebar). */
export function FullscreenOverlay({ children }: { children: ReactNode }) {
  const mount = useOverlayHost();
  if (!mount) return null;
  return createPortal(
    <div style={{ pointerEvents: "auto" }} className="jf-font-sans">
      {children}
    </div>,
    mount,
  );
}
