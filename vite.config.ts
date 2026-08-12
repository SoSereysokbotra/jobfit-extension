import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // MV3 extension pages don't benefit from modulepreload, and Chrome logs a
    // harmless "cross-world extension resource mismatch" warning for each one.
    // Disable it so the console stays clean for real debugging.
    modulePreload: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // crxjs uses a websocket for HMR; a fixed port keeps the extension reload stable.
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
