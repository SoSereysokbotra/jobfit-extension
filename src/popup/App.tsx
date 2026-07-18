import { Badge } from "@/shared/components/Badge";

/**
 * Phase 0 popup shell. Purpose: prove the extension loads and the ported purple
 * design system renders here exactly as on the web app — using only token-backed
 * Tailwind classes. No features, no network. Features begin in Phase 1 (auth).
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
        {/* Status card */}
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content">Phase 0</h2>
            <Badge variant="success" size="sm">
              Scaffold ready
            </Badge>
          </div>
          <p className="text-sm text-content-secondary">
            Extension loads, popup renders in the JobFit purple system. No features
            wired yet — sign-in arrives in Phase&nbsp;1.
          </p>
        </section>

        {/* Design-token proof: the ported Badge in every variant */}
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-content">Design tokens</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">Primary</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>
          <p className="mt-3 text-xs text-content-tertiary">
            Same token classes as the web app — bg-card, text-content, border-border,
            bg-primary-600. Zero inline color, zero hex, zero arbitrary values.
          </p>
        </section>

        {/* Logged-out placeholder (real auth CTA lands in Phase 1) */}
        <section className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-sm text-content-secondary">
            Not signed in.
          </p>
          <button
            type="button"
            disabled
            className="mt-2 w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-on-primary opacity-60 transition-all duration-200"
          >
            Log in on jobfit.co (Phase&nbsp;1)
          </button>
        </section>
      </main>
    </div>
  );
}
