import { Badge } from "@/shared/components/Badge";
import { Skeleton } from "@/shared/components/Skeleton";
import { LOGIN_URL } from "@/shared/config";
import type { UserRole } from "@/shared/types";
import { useAuthState } from "./useAuthState";

const roleLabel: Record<UserRole, string> = {
  JOB_SEEKER: "Job Seeker",
  EMPLOYER: "Employer",
  ADMIN: "Admin",
};

function openLogin() {
  void chrome.tabs.create({ url: LOGIN_URL });
}

/**
 * Phase 1 deliverable: shows the real logged-in user (name / email / role) from
 * GET /auth/me — proving cookie SSO works end-to-end — or a logged-out CTA.
 */
export function AuthPanel() {
  const { state, refetch, logout } = useAuthState();

  if (state.status === "loading") {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-3 w-40" />
        <Skeleton className="mt-2 h-3 w-32" />
      </section>
    );
  }

  if (state.status === "authenticated") {
    const { user } = state;
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
            Signed in
          </span>
          <Badge variant="success" size="sm">
            {roleLabel[user.role]}
          </Badge>
        </div>
        <p className="mt-2 truncate text-base font-semibold text-content" title={user.name}>
          {user.name || "Your account"}
        </p>
        <p className="truncate text-sm text-content-secondary" title={user.email}>
          {user.email}
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 w-full rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-content-secondary transition-all duration-200 hover:bg-surface-hover"
        >
          Log out
        </button>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-error-100 bg-error-50 p-4">
        <p className="text-sm font-medium text-error-600">Something went wrong</p>
        <p className="mt-1 text-sm text-content-secondary">{state.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-on-primary transition-all duration-200 hover:bg-primary-700"
        >
          Try again
        </button>
      </section>
    );
  }

  // Unauthenticated
  return (
    <section className="rounded-lg border border-border bg-background-secondary p-4">
      <p className="text-sm text-content-secondary">
        You&apos;re not signed in. Log in on the JobFit web app, then come back.
      </p>
      <button
        type="button"
        onClick={openLogin}
        className="mt-3 w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-on-primary transition-all duration-200 hover:bg-primary-700"
      >
        Log in on jobfit.co
      </button>
      <button
        type="button"
        onClick={() => void refetch()}
        className="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium text-primary-600 transition-all duration-200 hover:text-primary-700"
      >
        I&apos;ve logged in — refresh
      </button>
    </section>
  );
}
