import { useEffect, useState } from "react";
import { getSettings, setSettings } from "@/shared/settings";
import type { ExtSettings } from "@/shared/types";
import { isMock, isSafeToShow } from "@/data/source";
import { useAuthState } from "./useAuthState";

/**
 * Opt-in alert settings. Read by the background alarms (via
 * chrome.storage.local, @/shared/settings) — nothing notifies until enabled.
 *
 * HIDDEN WHEN SIGNED OUT, like the tracker and momentum panels. These
 * preferences belong to an account rather than to this browser profile (see
 * @/shared/storageKeys), so with nobody signed in there is no one to save them
 * for — and the alert needs an authenticated backend call to produce anything
 * anyway. This also removes the old trap where a signed-out visitor could arm
 * alerts that then attached to whoever signed in next.
 *
 * ALSO HIDDEN WHEN EMPTY: deadline reminders are the only setting left, and
 * they are themselves gated on `isSafeToShow`, so in a release build this panel
 * has nothing to offer — render nothing rather than a bare "Settings" heading.
 */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-content-secondary">
        {label}
        <span className="block text-xs text-content-tertiary">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-primary-600"
      />
    </label>
  );
}

export function SettingsPanel() {
  const { state } = useAuthState();
  const userId = state.status === "authenticated" ? state.user.id : null;
  const [settings, setLocal] = useState<ExtSettings | null>(null);

  useEffect(() => {
    if (!userId) {
      setLocal(null);
      return;
    }
    let active = true;
    void getSettings(userId).then((s) => {
      if (active) setLocal(s);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function update(patch: Partial<ExtSettings>) {
    if (!userId) return;
    setLocal((s) => (s ? { ...s, ...patch } : s));
    setLocal(await setSettings(userId, patch));
  }

  if (!userId || !settings) return null;

  // Hidden while the deadline endpoint is mocked: offering the switch would
  // promise reminders that either never arrive or, worse, arrive invented.
  // See data/source.ts `isSafeToShow`. It is the panel's last setting, so when
  // it goes, the panel goes with it.
  if (!isSafeToShow("deadlines")) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-content">Settings</h2>

      <Toggle
        label={isMock("deadlines") ? "Deadline reminders (sample data)" : "Deadline reminders"}
        hint={
          isMock("deadlines")
            ? "Dev build only — dates are fixtures, not real closing dates"
            : "Notify me when a saved job closes soon"
        }
        checked={settings.deadlineNotifications}
        onChange={(next) => void update({ deadlineNotifications: next })}
      />
    </section>
  );
}
