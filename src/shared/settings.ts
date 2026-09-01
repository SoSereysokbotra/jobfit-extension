/**
 * Extension settings, persisted in `chrome.storage.local`. Settings are NOT
 * network state, so the popup and the worker both read/write them directly (no
 * message round-trip). Survives MV3 worker sleeps.
 *
 * PER ACCOUNT, NOT PER DEVICE. `chrome.storage.local` is scoped to the browser
 * profile, so a single blob meant that on a shared computer Bob signed in and
 * silently inherited Alice's "alert me above 85%". "Which jobs should interrupt
 * me" is a fact about a person's search, not about this laptop, so every read
 * and write is addressed to a user id. See @/shared/storageKeys.
 */
import type { ExtSettings } from "./types";
import { accountKey } from "./storageKeys";

/** Alerts are opt-IN: nothing notifies until the user turns it on. */
export const DEFAULT_SETTINGS: ExtSettings = {
  deadlineNotifications: false,
  scoutAlerts: false,
  scoutMinScore: 85,
};

export async function getSettings(userId: string): Promise<ExtSettings> {
  const key = accountKey("settings", userId);
  const stored = await chrome.storage.local.get(key);
  return { ...DEFAULT_SETTINGS, ...(stored[key] as Partial<ExtSettings> | undefined) };
}

export async function setSettings(
  userId: string,
  patch: Partial<ExtSettings>,
): Promise<ExtSettings> {
  const next = { ...(await getSettings(userId)), ...patch };
  await chrome.storage.local.set({ [accountKey("settings", userId)]: next });
  return next;
}
