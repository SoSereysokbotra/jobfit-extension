import { useEffect, useState } from "react";
import { getSettings, setSettings } from "@/shared/settings";
import type { ExtSettings } from "@/shared/types";

/**
 * Opt-in alert settings. Read by the background alarms (both use
 * chrome.storage.local via @/shared/settings) — nothing notifies until enabled.
 */
const SCORE_OPTIONS = [75, 80, 85, 90];

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
  const [settings, setLocal] = useState<ExtSettings | null>(null);

  useEffect(() => {
    void getSettings().then(setLocal);
  }, []);

  async function update(patch: Partial<ExtSettings>) {
    setLocal((s) => (s ? { ...s, ...patch } : s));
    setLocal(await setSettings(patch));
  }

  if (!settings) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-content">Settings</h2>

      <Toggle
        label="Deadline reminders"
        hint="Notify me when a saved job closes soon"
        checked={settings.deadlineNotifications}
        onChange={(next) => void update({ deadlineNotifications: next })}
      />

      <Toggle
        label="Job scout alerts"
        hint="Notify me when a new high-match job appears"
        checked={settings.scoutAlerts}
        onChange={(next) => void update({ scoutAlerts: next })}
      />

      {settings.scoutAlerts && (
        <label className="flex items-center justify-between gap-3 pl-1">
          <span className="text-xs text-content-tertiary">Minimum match score</span>
          <select
            value={settings.scoutMinScore}
            onChange={(e) => void update({ scoutMinScore: Number(e.target.value) })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content"
          >
            {SCORE_OPTIONS.map((score) => (
              <option key={score} value={score}>
                {score}%
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
