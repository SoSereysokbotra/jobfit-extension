/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  /** JobFit API base, including /api/v1. Dev default: http://localhost:4000/api/v1 */
  readonly VITE_API_URL?: string;
  /** JobFit web app origin (for the login CTA). Dev default: http://localhost:3000 */
  readonly VITE_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** CSS imported with ?inline is returned as a string (for Shadow DOM injection). */
declare module "*.css?inline" {
  const css: string;
  export default css;
}
