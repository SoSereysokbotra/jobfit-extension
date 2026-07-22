/**
 * Extension settings, persisted in `chrome.storage.local`. Settings are NOT
 * network state, so the popup and the worker both read/write them directly (no
 * message round-trip). Survives MV3 worker sleeps.
 */
import type { ExtSettings } from "./types";

const KEY = "jobfit:settings";

/** Alerts are opt-IN: nothing notifies until the user turns it on. */
const DEFAULTS: ExtSettings = {
  deadlineNotifications: false,
  scoutAlerts: false,
  scoutMinScore: 85,
};

export async function getSettings(): Promise<ExtSettings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(stored[KEY] as Partial<ExtSettings> | undefined) };
}

export async function setSettings(patch: Partial<ExtSettings>): Promise<ExtSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
