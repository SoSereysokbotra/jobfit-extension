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
import type { UserRole } from "@/shared/types";
import {
  DEVICE_KEYS,
  LEGACY_UNSCOPED_KEYS,
  RETIRED_KEY_PREFIXES,
  accountKey,
} from "@/shared/storageKeys";

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
 * WHAT IS DELIBERATELY KEPT: their scoped preferences and already-notified id
 * sets. Those are namespaced, so Bob cannot read or inherit them, and they are
 * precisely what stops Alice being re-notified about the same twenty jobs when
 * she signs back in. Wiping them would trade a leak we have already closed for
 * a spam bug we haven't.
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

/**
 * Drop the storage left behind by removed features. See `RETIRED_KEY_PREFIXES`.
 *
 * Enumerates the whole store (`get(null)`) because the retired keys are
 * account-scoped: their suffixes are user ids this profile no longer has a list
 * of. Runs on install/upgrade only, and touches nothing that doesn't match a
 * retired prefix.
 */
export async function purgeRetiredState(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const stale = Object.keys(all).filter((key) =>
    RETIRED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
  if (stale.length) await chrome.storage.local.remove(stale);
}

/** Record who is now signed in, or clear the record when nobody is. */
export async function setActiveUser(userId: string | null): Promise<void> {
  if (userId) {
    await chrome.storage.local.set({ [DEVICE_KEYS.activeUser]: userId });
  } else {
    await chrome.storage.local.remove(DEVICE_KEYS.activeUser);
  }
}

/**
 * Remember the signed-in user's role, or clear it when nobody is signed in.
 *
 * Written wherever the worker learns it (getAuthState), so no caller needs a request of
 * its own. See DEVICE_KEYS.activeRole.
 */
export async function setActiveRole(role: UserRole | null): Promise<void> {
  if (role) {
    await chrome.storage.local.set({ [DEVICE_KEYS.activeRole]: role });
  } else {
    await chrome.storage.local.remove(DEVICE_KEYS.activeRole);
  }
}

/**
 * The cached role, or null when it has never been learned on this device.
 *
 * NULL IS "UNKNOWN", NOT "FORBIDDEN". A caller deciding whether to show something must
 * default to showing it: a fresh install has no cached role, and hiding the product from
 * a job seeker because we have not asked yet is a far worse failure than briefly showing
 * a badge to an employer.
 */
export async function getActiveRole(): Promise<UserRole | null> {
  const stored = await chrome.storage.local.get(DEVICE_KEYS.activeRole);
  return (stored[DEVICE_KEYS.activeRole] as UserRole | undefined) ?? null;
}

/** Sign-out side of the same handoff — called by the AUTH_LOGOUT path. */
export async function forgetActiveUser(): Promise<void> {
  await handOffDevice(await getStoredActiveUser());
  await setActiveUser(null);
  // The role goes with the user. Leaving a stale "EMPLOYER" behind would keep the badge
  // suppressed for the job seeker who signs in next.
  await setActiveRole(null);
}
