/**
 * Background alerts. MV3 workers sleep, so all scheduling uses `chrome.alarms`
 * (never setInterval/timers) and all state lives in `chrome.storage`.
 *
 * One opt-IN alert — nothing fires until the user enables it in the popup:
 *   · deadline reminders (Phase 7) — saved jobs closing soon
 *
 * It dedupes so a given job pings at most once, and clicking a notification
 * opens the relevant page.
 *
 * The passive job-scout alert (Phase 11) was removed; `RETIRED_ALARMS` below is
 * what stops its alarm still firing in an upgraded profile.
 */
import { getSettings } from "@/shared/settings";
import { getUpcomingDeadlines } from "@/data/deadlines";
import { isMock, isSafeToShow } from "@/data/source";
import { savedJobUrl } from "@/shared/jobUrl";
import { accountKey } from "@/shared/storageKeys";
import { getStoredActiveUser } from "./account";
import { resolveActiveUser } from "./auth";

const DEADLINE_ALARM = "jobfit:deadline-check";

/**
 * Alarms this build no longer creates. A profile that installed an earlier
 * build still has them REGISTERED — chrome.alarms persists across upgrades — so
 * they must be cleared explicitly, or the worker keeps waking every few hours
 * for a feature that no longer exists.
 */
const RETIRED_ALARMS = ["jobfit:scout-check"] as const;

const ICON = "icon128.png";

/** Register the alarm (idempotent — safe on install and startup). */
export function setupAlarms(): void {
  for (const name of RETIRED_ALARMS) chrome.alarms.clear(name);

  // Don't even schedule the deadline check while its data is a dev-only
  // fixture — a release build has nothing truthful to remind anyone about.
  // `clear` (not just "skip create") matters on upgrade: a profile that
  // installed an earlier build still has the alarm registered.
  if (!isSafeToShow("deadlines")) {
    chrome.alarms.clear(DEADLINE_ALARM);
  } else {
    chrome.alarms.get(DEADLINE_ALARM, (existing) => {
      if (!existing) {
        chrome.alarms.create(DEADLINE_ALARM, { periodInMinutes: 360, delayInMinutes: 1 });
      }
    });
  }
}

// ─── Dedupe + click-target helpers ──────────────────────────────────────────
async function loadSet(key: string): Promise<Set<string>> {
  const stored = await chrome.storage.local.get(key);
  return new Set((stored[key] as string[] | undefined) ?? []);
}

async function saveSet(key: string, ids: Set<string>): Promise<void> {
  // Cap growth so storage can't balloon over months of use.
  await chrome.storage.local.set({ [key]: [...ids].slice(-500) });
}

/**
 * Raise a notification and report whether it actually appeared.
 *
 * WHY THE RETURN VALUE MATTERS: the loop used to call `create` and then
 * immediately record the job as notified. `create` is fire-and-forget — it
 * reports failure through the callback's `runtime.lastError`, never by throwing
 * — so if Chrome suppressed the notification (permission revoked, Focus Assist,
 * quota) the job was marked "already told them about it" and never retried. The
 * user was silently never informed.
 *
 * Reading `lastError` inside the callback is also what stops Chrome logging an
 * "unchecked runtime.lastError" warning.
 */
function deliver(
  notificationId: string,
  options: chrome.notifications.NotificationOptions<true>,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.notifications.create(notificationId, options, () => {
        resolve(!chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Remember where a notification should navigate when clicked — under the id of
 * the user it was raised for. A click is only honoured while that same user is
 * signed in, so Alice's leftover toast cannot open her saved job in Bob's
 * session; the lookup simply misses and the notification is dismissed.
 */
async function rememberUrl(
  userId: string,
  notificationId: string,
  url: string,
): Promise<void> {
  const key = accountKey("notificationUrls", userId);
  const stored = await chrome.storage.local.get(key);
  const map = (stored[key] as Record<string, string> | undefined) ?? {};
  map[notificationId] = url;
  await chrome.storage.local.set({ [key]: map });
}

// ─── Deadline reminders (Phase 7) ───────────────────────────────────────────
function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export async function runDeadlineCheck(): Promise<void> {
  // Second gate, deliberately redundant with setupAlarms: an alarm registered
  // by a previous build can still fire before the new worker re-registers.
  if (!isSafeToShow("deadlines")) return;

  // An alarm is a timer and knows nothing about sign-outs, so ask who (if
  // anyone) is signed in BEFORE reading any preference or notifying.
  const userId = await resolveActiveUser();
  if (!userId) return;

  const { deadlineNotifications } = await getSettings(userId);
  if (!deadlineNotifications) return;

  let upcoming;
  try {
    upcoming = await getUpcomingDeadlines(72);
  } catch {
    return; // never let a failed check crash the worker
  }

  const notified = await loadSet(accountKey("notifiedDeadlines", userId));
  for (const job of upcoming) {
    const key = `${job.source}:${job.externalId}`;
    if (notified.has(key)) continue;
    const hours = Math.max(0, Math.round(hoursUntil(job.deadline)));
    const score = job.matchScore != null ? ` You have a ${job.matchScore}% match.` : "";
    const id = `jobfit:deadline:${key}`;
    // Reachable only in dev while the endpoint is mocked; say so in the title
    // so a fixture is never mistaken for a real closing date.
    const sample = isMock("deadlines") ? "[SAMPLE DATA] " : "";
    // The saved job's own URL first. This used to hardcode LinkedIn, so a
    // JobNet or Khmer24 reminder opened an unrelated site's 404. Stored BEFORE
    // the notification so a click can never outrun its destination.
    await rememberUrl(userId, id, savedJobUrl(job.source, job.externalId, job.url));
    const shown = await deliver(id, {
      type: "basic",
      iconUrl: ICON,
      title: `${sample}⏰ A saved job is closing soon`,
      message: `${job.title} closes in ~${hours}h.${score}`,
      priority: 1,
    });
    // Only now is it true that the user was told. A suppressed notification
    // leaves the job unmarked so the next run tries again.
    if (shown) notified.add(key);
  }
  await saveSet(accountKey("notifiedDeadlines", userId), notified);
}

/** Wire alarm + notification-click listeners. Call once at worker startup. */
export function registerAlarmHandlers(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DEADLINE_ALARM) void runDeadlineCheck();
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    void (async () => {
      // The STORED id, not a fresh /auth/me: a click should open a tab
      // immediately, and the account change that matters here was already
      // handled when it was detected. A notification raised for another account
      // finds no destination and is simply dismissed.
      const userId = await getStoredActiveUser();
      if (userId) {
        const key = accountKey("notificationUrls", userId);
        const stored = await chrome.storage.local.get(key);
        const map = (stored[key] as Record<string, string> | undefined) ?? {};
        const url = map[notificationId];
        if (url) {
          await chrome.tabs.create({ url });
          delete map[notificationId];
          await chrome.storage.local.set({ [key]: map });
        }
      }
      chrome.notifications.clear(notificationId);
    })();
  });
}
