// vite.config.ts
import { defineConfig } from "file:///D:/Year2/Jobfit/jobfit-extension/node_modules/vite/dist/node/index.js";
import { fileURLToPath, URL as URL2 } from "node:url";
import react from "file:///D:/Year2/Jobfit/jobfit-extension/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///D:/Year2/Jobfit/jobfit-extension/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.config.ts
import { defineManifest } from "file:///D:/Year2/Jobfit/jobfit-extension/node_modules/@crxjs/vite-plugin/dist/index.mjs";
import { loadEnv } from "file:///D:/Year2/Jobfit/jobfit-extension/node_modules/vite/dist/node/index.js";

// package.json
var package_default = {
  name: "jobfit-extension",
  version: "0.0.1",
  description: "JobFit Chrome extension (MV3) \u2014 surfaces JobFit match intelligence on LinkedIn/Indeed job pages.",
  type: "module",
  private: true,
  scripts: {
    dev: "vite",
    build: "tsc --noEmit && vite build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    icons: "node scripts/make-icons.mjs",
    package: "npm run build && node scripts/package.mjs"
  },
  dependencies: {
    clsx: "^2.1.1",
    react: "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwind-merge": "^2.6.0"
  },
  devDependencies: {
    "@crxjs/vite-plugin": "^2.0.0-beta.34",
    "@types/chrome": "^0.0.287",
    "@types/node": "^22.20.1",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    autoprefixer: "^10.4.20",
    postcss: "^8.5.1",
    tailwindcss: "^3.4.17",
    typescript: "^5.7.3",
    vite: "^5.4.11"
  }
};

// manifest.config.ts
var env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "VITE_");
var API_URL = env.VITE_API_URL ?? "http://localhost:4000/api/v1";
var WEB_URL = env.VITE_WEB_URL ?? "http://localhost:3000";
function originPattern(url) {
  return `${new URL(url).origin}/*`;
}
var hostPermissions = [.../* @__PURE__ */ new Set([originPattern(API_URL), originPattern(WEB_URL)])];
var manifest_config_default = defineManifest({
  manifest_version: 3,
  name: "JobFit",
  // Store limit is 132 chars and the Store REJECTS an over-length description. This was
  // 136 until 2026-08-20 — count it, do not eyeball it. Only claim what ships: all five
  // adapters below are implemented (src/content/sites/).
  // Keep identical to the "Short description" block in docs/STORE_LISTING.md.
  description: "See your JobFit match score, company insights, salary and skill gaps on job posts \u2014 LinkedIn, Indeed, JobNet, Khmer24, BongThom.",
  version: package_default.version,
  icons: {
    16: "icon16.png",
    48: "icon48.png",
    128: "icon128.png"
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "JobFit",
    default_icon: {
      16: "icon16.png",
      48: "icon48.png",
      128: "icon128.png"
    }
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
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
        "https://*.camhr.com/*",
        "https://*.indeed.com/*"
      ],
      js: ["src/content/index.tsx"],
      run_at: "document_idle"
    }
  ],
  // storage: settings + notification dedupe · alarms/notifications: Phase 7 deadlines
  permissions: ["storage", "activeTab", "alarms", "notifications"],
  host_permissions: hostPermissions
});

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///D:/Year2/Jobfit/jobfit-extension/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [react(), crx({ manifest: manifest_config_default })],
  build: {
    // MV3 extension pages don't benefit from modulepreload, and Chrome logs a
    // harmless "cross-world extension resource mismatch" warning for each one.
    // Disable it so the console stays clean for real debugging.
    modulePreload: false
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL2("./src", __vite_injected_original_import_meta_url))
    }
  },
  server: {
    // crxjs uses a websocket for HMR; a fixed port keeps the extension reload stable.
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuY29uZmlnLnRzIiwgInBhY2thZ2UuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXFllYXIyXFxcXEpvYmZpdFxcXFxqb2JmaXQtZXh0ZW5zaW9uXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxZZWFyMlxcXFxKb2JmaXRcXFxcam9iZml0LWV4dGVuc2lvblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovWWVhcjIvSm9iZml0L2pvYmZpdC1leHRlbnNpb24vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgeyBjcnggfSBmcm9tIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI7XG5pbXBvcnQgbWFuaWZlc3QgZnJvbSBcIi4vbWFuaWZlc3QuY29uZmlnXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBjcngoeyBtYW5pZmVzdCB9KV0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gTVYzIGV4dGVuc2lvbiBwYWdlcyBkb24ndCBiZW5lZml0IGZyb20gbW9kdWxlcHJlbG9hZCwgYW5kIENocm9tZSBsb2dzIGFcbiAgICAvLyBoYXJtbGVzcyBcImNyb3NzLXdvcmxkIGV4dGVuc2lvbiByZXNvdXJjZSBtaXNtYXRjaFwiIHdhcm5pbmcgZm9yIGVhY2ggb25lLlxuICAgIC8vIERpc2FibGUgaXQgc28gdGhlIGNvbnNvbGUgc3RheXMgY2xlYW4gZm9yIHJlYWwgZGVidWdnaW5nLlxuICAgIG1vZHVsZVByZWxvYWQ6IGZhbHNlLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICAvLyBjcnhqcyB1c2VzIGEgd2Vic29ja2V0IGZvciBITVI7IGEgZml4ZWQgcG9ydCBrZWVwcyB0aGUgZXh0ZW5zaW9uIHJlbG9hZCBzdGFibGUuXG4gICAgcG9ydDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhtcjogeyBwb3J0OiA1MTczIH0sXG4gIH0sXG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcWWVhcjJcXFxcSm9iZml0XFxcXGpvYmZpdC1leHRlbnNpb25cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFllYXIyXFxcXEpvYmZpdFxcXFxqb2JmaXQtZXh0ZW5zaW9uXFxcXG1hbmlmZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovWWVhcjIvSm9iZml0L2pvYmZpdC1leHRlbnNpb24vbWFuaWZlc3QuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lTWFuaWZlc3QgfSBmcm9tIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI7XHJcbmltcG9ydCB7IGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcGtnIGZyb20gXCIuL3BhY2thZ2UuanNvblwiIHdpdGggeyB0eXBlOiBcImpzb25cIiB9O1xyXG5cclxuLyoqXHJcbiAqIE1WMyBtYW5pZmVzdCAodHlwZWQsIGJ1aWx0IGJ5IEBjcnhqcy92aXRlLXBsdWdpbikuXHJcbiAqXHJcbiAqIGBob3N0X3Blcm1pc3Npb25zYCBNVVNUIGNvdmVyIHRoZSBKb2JGaXQgQVBJIG9yaWdpbiBzbyB0aGUgYmFja2dyb3VuZCB3b3JrZXJcclxuICogY2FuIGNhbGwgaXQgd2l0aCBgY3JlZGVudGlhbHM6XCJpbmNsdWRlXCJgIGFuZCBoYXZlIHRoZSBodHRwT25seSByZWZyZXNoIGNvb2tpZVxyXG4gKiByaWRlIGFsb25nIChjb29raWUgU1NPKS5cclxuICpcclxuICogVGhhdCBvcmlnaW4gaXMgREVSSVZFRCBmcm9tIHRoZSBzYW1lIGBWSVRFX0FQSV9VUkxgIHRoZSBydW50aW1lIGNvZGUgdXNlcywgc29cclxuICogdGhlIHR3byBjYW4gbmV2ZXIgZHJpZnQ6IHNldCB0aGUgVVJMIG9uY2UgaW4gYC5lbnZgIGFuZCBib3RoIHRoZSBtYW5pZmVzdCBhbmRcclxuICogYHNyYy9zaGFyZWQvY29uZmlnLnRzYCBmb2xsb3cuIFBvaW50IGl0IGF0IHlvdXIgZGVwbG95ZWQgQVBJIGZvciBwcm9kdWN0aW9uLlxyXG4gKlxyXG4gKiBUaGUgTGlua2VkSW4gY29udGVudCBzY3JpcHQgbmVlZHMgTk8gaG9zdF9wZXJtaXNzaW9uIFx1MjAxNCBhIGBjb250ZW50X3NjcmlwdHNgXHJcbiAqIG1hdGNoIGdyYW50cyBpbmplY3Rpb24sIGFuZCB3ZSBuZXZlciBmZXRjaCBMaW5rZWRJbiAob25seSBhbm5vdGF0ZSBpdHMgRE9NKS5cclxuICogSXRzIENTUyBpcyBpbmxpbmVkIGludG8gYSBTaGFkb3cgRE9NIGF0IHJ1bnRpbWUsIHNvIG5vdGhpbmcgbGFuZHMgaW4gdGhlIHBhZ2UuXHJcbiAqL1xyXG5jb25zdCBlbnYgPSBsb2FkRW52KHByb2Nlc3MuZW52Lk5PREVfRU5WID8/IFwicHJvZHVjdGlvblwiLCBwcm9jZXNzLmN3ZCgpLCBcIlZJVEVfXCIpO1xyXG5cclxuY29uc3QgQVBJX1VSTCA9IGVudi5WSVRFX0FQSV9VUkwgPz8gXCJodHRwOi8vbG9jYWxob3N0OjQwMDAvYXBpL3YxXCI7XHJcbmNvbnN0IFdFQl9VUkwgPSBlbnYuVklURV9XRUJfVVJMID8/IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCI7XHJcblxyXG4vKiogYGh0dHBzOi8vYXBpLmV4YW1wbGUuY29tL2FwaS92MWAgXHUyMTkyIGBodHRwczovL2FwaS5leGFtcGxlLmNvbS8qYCAqL1xyXG5mdW5jdGlvbiBvcmlnaW5QYXR0ZXJuKHVybDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYCR7bmV3IFVSTCh1cmwpLm9yaWdpbn0vKmA7XHJcbn1cclxuXHJcbi8vIFRoZSBBUEkgb3JpZ2luIGlzIHJlcXVpcmVkOyB0aGUgd2ViIG9yaWdpbiBpcyBpbmNsdWRlZCBzbyBhIGZ1dHVyZVxyXG4vLyBleHRlcm5hbGx5X2Nvbm5lY3RhYmxlL2JyaWRnZSBmYWxsYmFjayB3b3JrcyB3aXRob3V0IGFub3RoZXIgbWFuaWZlc3QgZWRpdC5cclxuY29uc3QgaG9zdFBlcm1pc3Npb25zID0gWy4uLm5ldyBTZXQoW29yaWdpblBhdHRlcm4oQVBJX1VSTCksIG9yaWdpblBhdHRlcm4oV0VCX1VSTCldKV07XHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZU1hbmlmZXN0KHtcclxuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxyXG4gIG5hbWU6IFwiSm9iRml0XCIsXHJcbiAgLy8gU3RvcmUgbGltaXQgaXMgMTMyIGNoYXJzIGFuZCB0aGUgU3RvcmUgUkVKRUNUUyBhbiBvdmVyLWxlbmd0aCBkZXNjcmlwdGlvbi4gVGhpcyB3YXNcclxuICAvLyAxMzYgdW50aWwgMjAyNi0wOC0yMCBcdTIwMTQgY291bnQgaXQsIGRvIG5vdCBleWViYWxsIGl0LiBPbmx5IGNsYWltIHdoYXQgc2hpcHM6IGFsbCBmaXZlXHJcbiAgLy8gYWRhcHRlcnMgYmVsb3cgYXJlIGltcGxlbWVudGVkIChzcmMvY29udGVudC9zaXRlcy8pLlxyXG4gIC8vIEtlZXAgaWRlbnRpY2FsIHRvIHRoZSBcIlNob3J0IGRlc2NyaXB0aW9uXCIgYmxvY2sgaW4gZG9jcy9TVE9SRV9MSVNUSU5HLm1kLlxyXG4gIGRlc2NyaXB0aW9uOlxyXG4gICAgXCJTZWUgeW91ciBKb2JGaXQgbWF0Y2ggc2NvcmUsIGNvbXBhbnkgaW5zaWdodHMsIHNhbGFyeSBhbmQgc2tpbGwgZ2FwcyBvbiBqb2IgcG9zdHMgXHUyMDE0IExpbmtlZEluLCBJbmRlZWQsIEpvYk5ldCwgS2htZXIyNCwgQm9uZ1Rob20uXCIsXHJcbiAgdmVyc2lvbjogcGtnLnZlcnNpb24sXHJcbiAgaWNvbnM6IHtcclxuICAgIDE2OiBcImljb24xNi5wbmdcIixcclxuICAgIDQ4OiBcImljb240OC5wbmdcIixcclxuICAgIDEyODogXCJpY29uMTI4LnBuZ1wiLFxyXG4gIH0sXHJcbiAgYWN0aW9uOiB7XHJcbiAgICBkZWZhdWx0X3BvcHVwOiBcInNyYy9wb3B1cC9pbmRleC5odG1sXCIsXHJcbiAgICBkZWZhdWx0X3RpdGxlOiBcIkpvYkZpdFwiLFxyXG4gICAgZGVmYXVsdF9pY29uOiB7XHJcbiAgICAgIDE2OiBcImljb24xNi5wbmdcIixcclxuICAgICAgNDg6IFwiaWNvbjQ4LnBuZ1wiLFxyXG4gICAgICAxMjg6IFwiaWNvbjEyOC5wbmdcIixcclxuICAgIH0sXHJcbiAgfSxcclxuICBiYWNrZ3JvdW5kOiB7XHJcbiAgICBzZXJ2aWNlX3dvcmtlcjogXCJzcmMvYmFja2dyb3VuZC9pbmRleC50c1wiLFxyXG4gICAgdHlwZTogXCJtb2R1bGVcIixcclxuICB9LFxyXG4gIGNvbnRlbnRfc2NyaXB0czogW1xyXG4gICAge1xyXG4gICAgICAvLyBPbmUgZW50cnkgcGVyIHN1cHBvcnRlZCBib2FyZCAoZG9jcy9NVUxUSV9TSVRFX1BMQU4ubWQpLiBgKi5pbmRlZWQuY29tYFxyXG4gICAgICAvLyBjb3ZlcnMgdGhlIGNvdW50cnkgZG9tYWlucyBcdTIwMTQga2guLCB1ay4sIHNnLiBcdTIwMTQgd2hpY2ggYXJlIHNlcGFyYXRlIGhvc3RzLlxyXG4gICAgICAvLyBgKi5ob3N0YCBtYXRjaGVzIHRoZSBiYXJlIGhvc3QgQU5EIGFueSBzdWJkb21haW4sIHNvIGEgdXNlciBsYW5kaW5nIG9uXHJcbiAgICAgIC8vIGtobWVyMjQuY29tIChubyB3d3cpIGlzIGNvdmVyZWQgYXMgd2VsbCBhcyB3d3cua2htZXIyNC5jb20uXHJcbiAgICAgIG1hdGNoZXM6IFtcclxuICAgICAgICBcImh0dHBzOi8vKi5saW5rZWRpbi5jb20vKlwiLFxyXG4gICAgICAgIFwiaHR0cHM6Ly8qLmtobWVyMjQuY29tLypcIixcclxuICAgICAgICBcImh0dHBzOi8vKi5ib25ndGhvbS5jb20vKlwiLFxyXG4gICAgICAgIFwiaHR0cHM6Ly8qLmpvYm5ldC5jb20ua2gvKlwiLFxyXG4gICAgICAgIFwiaHR0cHM6Ly8qLmNhbWhyLmNvbS8qXCIsXHJcbiAgICAgICAgXCJodHRwczovLyouaW5kZWVkLmNvbS8qXCIsXHJcbiAgICAgIF0sXHJcbiAgICAgIGpzOiBbXCJzcmMvY29udGVudC9pbmRleC50c3hcIl0sXHJcbiAgICAgIHJ1bl9hdDogXCJkb2N1bWVudF9pZGxlXCIsXHJcbiAgICB9LFxyXG4gIF0sXHJcbiAgLy8gc3RvcmFnZTogc2V0dGluZ3MgKyBub3RpZmljYXRpb24gZGVkdXBlIFx1MDBCNyBhbGFybXMvbm90aWZpY2F0aW9uczogUGhhc2UgNyBkZWFkbGluZXNcclxuICBwZXJtaXNzaW9uczogW1wic3RvcmFnZVwiLCBcImFjdGl2ZVRhYlwiLCBcImFsYXJtc1wiLCBcIm5vdGlmaWNhdGlvbnNcIl0sXHJcbiAgaG9zdF9wZXJtaXNzaW9uczogaG9zdFBlcm1pc3Npb25zLFxyXG59KTtcclxuIiwgIntcbiAgXCJuYW1lXCI6IFwiam9iZml0LWV4dGVuc2lvblwiLFxuICBcInZlcnNpb25cIjogXCIwLjAuMVwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiSm9iRml0IENocm9tZSBleHRlbnNpb24gKE1WMykgXHUyMDE0IHN1cmZhY2VzIEpvYkZpdCBtYXRjaCBpbnRlbGxpZ2VuY2Ugb24gTGlua2VkSW4vSW5kZWVkIGpvYiBwYWdlcy5cIixcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwiZGV2XCI6IFwidml0ZVwiLFxuICAgIFwiYnVpbGRcIjogXCJ0c2MgLS1ub0VtaXQgJiYgdml0ZSBidWlsZFwiLFxuICAgIFwicHJldmlld1wiOiBcInZpdGUgcHJldmlld1wiLFxuICAgIFwidHlwZWNoZWNrXCI6IFwidHNjIC0tbm9FbWl0XCIsXG4gICAgXCJpY29uc1wiOiBcIm5vZGUgc2NyaXB0cy9tYWtlLWljb25zLm1qc1wiLFxuICAgIFwicGFja2FnZVwiOiBcIm5wbSBydW4gYnVpbGQgJiYgbm9kZSBzY3JpcHRzL3BhY2thZ2UubWpzXCJcbiAgfSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiY2xzeFwiOiBcIl4yLjEuMVwiLFxuICAgIFwicmVhY3RcIjogXCJeMTkuMS4wXCIsXG4gICAgXCJyZWFjdC1kb21cIjogXCJeMTkuMS4wXCIsXG4gICAgXCJ0YWlsd2luZC1tZXJnZVwiOiBcIl4yLjYuMFwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjM0XCIsXG4gICAgXCJAdHlwZXMvY2hyb21lXCI6IFwiXjAuMC4yODdcIixcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjIyLjIwLjFcIixcbiAgICBcIkB0eXBlcy9yZWFjdFwiOiBcIl4xOS4xLjBcIixcbiAgICBcIkB0eXBlcy9yZWFjdC1kb21cIjogXCJeMTkuMS4wXCIsXG4gICAgXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiOiBcIl40LjMuNFwiLFxuICAgIFwiYXV0b3ByZWZpeGVyXCI6IFwiXjEwLjQuMjBcIixcbiAgICBcInBvc3Rjc3NcIjogXCJeOC41LjFcIixcbiAgICBcInRhaWx3aW5kY3NzXCI6IFwiXjMuNC4xN1wiLFxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjcuM1wiLFxuICAgIFwidml0ZVwiOiBc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
