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
const config: Config = {
  prefix: "jf-",
  corePlugins: { preflight: false },
  content: ["./src/content/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: themeExtend,
  },
  plugins: [],
};

export default config;
