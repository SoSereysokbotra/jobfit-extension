import { Badge } from "@/shared/components/Badge";
import { AuthPanel } from "./AuthPanel";

/**
 * Popup shell. Phase 1 wires the AuthPanel to the background worker so it shows
 * the real logged-in user (cookie SSO) — or a logged-out CTA. Still pure
 * token-backed Tailwind classes; no inline color.
 */
export function App() {
  return (
    <div className="w-80 bg-background text-content">
      {/* Brand header — gradient built from primary tokens, no hardcoded color */}
      <header className="bg-gradient-to-br from-primary-800 to-primary-600 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-on-primary">
              JobFit
            </h1>
            <p className="text-xs text-on-primary-muted">
              Your job-search command center
            </p>
          </div>
          <Badge variant="neutral" size="sm" className="bg-on-primary-surface text-on-primary">
            v0.0.1
          </Badge>
        </div>
      </header>

      <main className="flex flex-col gap-3 p-4">
        {/* Live auth state from the service worker (Phase 1) */}
        <AuthPanel />
      </main>
    </div>
  );
}
