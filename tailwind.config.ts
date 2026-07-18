import type { Config } from "tailwindcss";
import { themeExtend } from "./tailwind.theme";

/**
 * POPUP Tailwind config. Preflight ON, no class prefix — the popup owns its whole
 * document. Token values live in `src/styles/tokens.css`; the token → class map is
 * shared with the content build via `tailwind.theme.ts`.
 *
 * The content script uses a SEPARATE config (`tailwind.content.config.ts`,
 * Preflight OFF + `jf-` prefix), selected per-file by an `@config` directive at
 * the top of `src/content/content.css`.
 */
const config: Config = {
  content: ["./src/popup/**/*.{js,ts,jsx,tsx,html}", "./src/shared/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: themeExtend,
  },
  plugins: [],
};

export default config;
