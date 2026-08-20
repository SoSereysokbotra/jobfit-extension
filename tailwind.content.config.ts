import type { Config } from "tailwindcss";
import { themeExtend } from "./tailwind.theme";

/**
 * CONTENT-SCRIPT Tailwind config. Selected per-file via the `@config` directive
 * at the top of `src/content/content.css`. Two hard rules from the build plan §4:
 *
 *   - `corePlugins.preflight: false` — never emit a global reset. Combined with
 *     the Shadow-DOM mount, our CSS cannot restyle LinkedIn's page.
 *   - `prefix: "jf-"` — every utility becomes `.jf-…` (e.g. `jf-bg-primary-600`),
 *     guaranteeing zero collision with LinkedIn's own utility classes.
 *
 * Same token → class map as the popup (via `tailwind.theme.ts`); the token values
 * are declared on `:host` inside the shadow root (see `content.css`).
 */
/**
 * PX, NOT REM — the whole scale, deliberately.
 *
 * `rem` resolves against the HOST PAGE's <html> font-size. The Shadow DOM isolates
 * selectors, not the rem reference, so a site that sets `html { font-size: 62.5% }` (a
 * common trick for easier rem math) silently shrinks every size in this UI to ~62% —
 * text, padding, gaps and all. The user's browser font-size setting does the same thing.
 * Reported 2026-08-13 as "the text is very small"; bumping individual classes would only
 * have papered over a scale that any host page can still move.
 *
 * In px, LinkedIn cannot resize our panel, and one class means one number forever.
 *
 * These are Tailwind's own default steps converted at 16px = 1rem, so no existing class
 * changes meaning — `jf-p-4` was 1rem and is now 16px. Only `fontSize` is deliberately
 * larger than default (see below).
 */
const px = (rem: number): string => `${rem * 16}px`;

/** Tailwind's default spacing scale, in px. */
const spacing: Record<string, string> = {
  px: "1px",
  0: "0px",
  0.5: px(0.125),
  1: px(0.25),
  1.5: px(0.375),
  2: px(0.5),
  2.5: px(0.625),
  3: px(0.75),
  3.5: px(0.875),
  4: px(1),
  5: px(1.25),
  6: px(1.5),
  7: px(1.75),
  8: px(2),
  9: px(2.25),
  10: px(2.5),
  11: px(2.75),
  12: px(3),
  14: px(3.5),
  16: px(4),
  20: px(5),
  24: px(6),
  28: px(7),
  32: px(8),
  36: px(9),
  40: px(10),
  44: px(11),
  48: px(12),
  52: px(13),
  56: px(14),
  60: px(15),
  64: px(16),
  72: px(18),
  80: px(20),
  96: px(24),
};

/**
 * Type scale: Tailwind's default numbers, pinned to px.
 *
 * The px is the whole point (see above) — the SIZES are standard. Two rounds of
 * calibration got here: the rem-based original rendered too small because the host page
 * scaled it, and a scale one step above default then rendered too large in a 480px panel.
 * Standard sizes that no page can move is the stable answer; adjust here and nowhere else.
 */
const fontSize: Record<string, [string, string]> = {
  xs: ["12px", "16px"],
  sm: ["14px", "20px"],
  base: ["16px", "24px"],
  lg: ["18px", "28px"],
  xl: ["20px", "28px"],
  "2xl": ["24px", "32px"],
  "3xl": ["30px", "36px"],
};

/** Radii in px for the same reason as spacing. */
const borderRadius: Record<string, string> = {
  none: "0px",
  sm: "2px",
  DEFAULT: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  "3xl": "24px",
  full: "9999px",
};

const config: Config = {
  prefix: "jf-",
  corePlugins: { preflight: false },
  content: ["./src/content/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    // Overrides (not `extend`) — the rem-based defaults must be REPLACED, not
    // supplemented, or the host page can still shrink whatever still uses them.
    spacing,
    fontSize,
    borderRadius,
    extend: themeExtend,
  },
  plugins: [],
};

export default config;
