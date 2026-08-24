/**
 * Which account owns the state on this device — the STORAGE half of that
 * question. Deliberately network-free: `auth.ts` composes this with a live
 * `/auth/me` to produce `resolveActiveUser`, and keeping the dependency
 * one-directional (auth → account) avoids a cycle between them.
 *
 * `chrome.storage.local` is scoped to the browser PROFILE. JobFit accounts are
 * not, so every read/write of account-derived state has to be told which user it
 * belongs to, and something has to notice when that user changes.
 */
import { DEVICE_KEYS, LEGACY_UNSCOPED_KEYS, accountKey } from "@/shared/storageKeys";

/** Prefix of every notification this extension creates. */
const NOTIFICATION_PREFIX = "jobfit:";

/** The user id last seen signed in, without touching the network. */
export async function getStoredActiveUser(): Promise<string | null> {
  const stored = await chrome.storage.local.get(DEVICE_KEYS.activeUser);
  return (stored[DEVICE_KEYS.activeUser] as string | undefined) ?? null;
}

/**
 * Dismiss every JobFit notification still on screen.
 *
 * These are the one piece of account state the OS holds for us, and they
 * outlive a sign-out: an unclicked "closing soon" toast from Alice sits in the
 * tray until someone clicks it. Clearing them is what stops that click from
 * navigating in Bob's session.
 */
async function clearOutstandingNotifications(): Promise<void> {
  // @types/chrome pins getAll to its callback form here, so it's promisified
  // rather than awaited directly.
  const all = await new Promise<object>((resolve) => {
    chrome.notifications.getAll((items) => resolve(items ?? {}));
  });
  await Promise.all(
    Object.keys(all)
      .filter((id) => id.startsWith(NOTIFICATION_PREFIX))
      .map((id) => chrome.notifications.clear(id)),
  );
}

/**
 * Hand the device over from one account to another.
 *
 * WHAT IS PURGED: the outgoing user's click-target map and any live
 * notifications — the state that can act on THIS device after they're gone.
 *
 * WHAT IS DELIBERATELY KEPT: their scoped preferences, already-notified id sets
 * and scout cursor. Those are namespaced, so Bob cannot read or inherit them,
 * and they are precisely what stops Alice being re-notified about the same
 * twenty jobs when she signs back in. Wiping them would trade a leak we have
 * already closed for a spam bug we haven't.
 */
export async function handOffDevice(previousUserId: string | null): Promise<void> {
  await clearOutstandingNotifications();
  if (previousUserId) {
    await chrome.storage.local.remove(accountKey("notificationUrls", previousUserId));
  }
}

/**
 * Drop pre-scoping keys once. See `LEGACY_UNSCOPED_KEYS` for why these are
 * deleted rather than adopted by whoever signs in first.
 */
export async function purgeLegacyUnscopedState(): Promise<void> {
  await chrome.storage.local.remove([...LEGACY_UNSCOPED_KEYS]);
}

/** Record who is now signed in, or clear the record when nobody is. */
export async function setActiveUser(userId: string | null): Promise<void> {
  if (userId) {
    await chrome.storage.local.set({ [DEVICE_KEYS.activeUser]: userId });
  } else {
    await chrome.storage.local.remove(DEVICE_KEYS.activeUser);
  }
}

/** Sign-out side of the same handoff — called by the AUTH_LOGOUT path. */
export async function forgetActiveUser(): Promise<void> {
  await handOffDevice(await getStoredActiveUser());
  await setActiveUser(null);
}
