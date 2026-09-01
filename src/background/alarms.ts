/**
 * Background alerts. MV3 workers sleep, so all scheduling uses `chrome.alarms`
 * (never setInterval/timers) and all state lives in `chrome.storage`.
 *
 * Two opt-IN alerts — nothing fires until the user enables it in the popup:
 *   · deadline reminders (Phase 7)  — saved jobs closing soon
 *   · job-scout alerts   (Phase 11) — new high-match jobs
 *
 * Both dedupe so a given job pings at most once, and clicking a notification
 * opens the relevant page.
 */
import { getSettings } from "@/shared/settings";
import { getUpcomingDeadlines } from "@/data/deadlines";
import { isMock, isSafeToShow } from "@/data/source";
import { getScoutMatches } from "@/data/scout";
import type { ScoutMatch } from "@/shared/types";
import { savedJobUrl } from "@/shared/jobUrl";
import { accountKey } from "@/shared/storageKeys";
import { getStoredActiveUser } from "./account";
import { resolveActiveUser } from "./auth";

const DEADLINE_ALARM = "jobfit:deadline-check";
const SCOUT_ALARM = "jobfit:scout-check";

const ICON = "icon128.png";

/** Register both alarms (idempotent — safe on install and startup). */
export function setupAlarms(): void {
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
  chrome.alarms.get(SCOUT_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(SCOUT_ALARM, { periodInMinutes: 180, delayInMinutes: 2 });
    }
  });
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
 * WHY THE RETURN VALUE MATTERS: both loops used to call `create` and then
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

// ─── Passive job-scout alerts (Phase 11) ────────────────────────────────────
/**
 * How many scout alerts may be raised in a single run. This exists so a backlog
 * can't fire twenty toasts at once — it is a RATE LIMIT, not a filter.
 */
const MAX_PER_RUN = 3;

/**
 * Hard ceiling on the deferral queue. Reached only if the user is fed matches
 * far faster than MAX_PER_RUN drains them for days on end; see `mergeQueue`.
 */
const MAX_QUEUE = 50;

const scoutKey = (m: ScoutMatch): string => `${m.source}:${m.externalId}`;

async function loadQueue(userId: string): Promise<ScoutMatch[]> {
  const key = accountKey("scoutPending", userId);
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as ScoutMatch[] | undefined) ?? [];
}

/**
 * Build the delivery queue: everything still waiting, then this run's new
 * arrivals, best score first.
 *
 * ORDER IS THE WHOLE POINT. Waiting items keep their place at the FRONT, so an
 * item at position k is delivered within ceil((k+1)/MAX_PER_RUN) runs no matter
 * how many higher-scoring jobs arrive after it. Sorting the combined set by
 * score instead would let a steady stream of 95% matches starve an 86% one
 * forever — the per-run cap would quietly become a filter again, just a slower
 * one.
 */
function mergeQueue(pending: ScoutMatch[], incoming: ScoutMatch[], notified: Set<string>): ScoutMatch[] {
  const seen = new Set(pending.map(scoutKey));
  const fresh = incoming
    .filter((m) => !notified.has(scoutKey(m)) && !seen.has(scoutKey(m)))
    .sort((a, b) => b.score - a.score);

  const merged = [...pending, ...fresh];
  // Overflow drops from the TAIL: the lowest-scoring of the newest arrivals.
  // Everything already waiting keeps the promise that it will be delivered.
  // This is the one remaining bounded-loss case, and it replaces the previous
  // behaviour of dropping every match past the third on EVERY run.
  return merged.slice(0, MAX_QUEUE);
}

/**
 * Deliver up to MAX_PER_RUN scout alerts, deferring the rest to later runs.
 *
 * THE BUG THIS REPLACES: the old version fetched everything since the cursor,
 * kept the best three, and then advanced the cursor to `now`. Matches four and
 * beyond were neither shown nor re-fetched — the "safety limit" was silent,
 * permanent data loss. The cursor may still advance to `now` here, but only
 * because nothing fetched is thrown away: the remainder is persisted locally
 * and drained at MAX_PER_RUN per run until the queue is empty.
 */
export async function runScoutCheck(): Promise<void> {
  const userId = await resolveActiveUser();
  if (!userId) return;

  const { scoutAlerts, scoutMinScore } = await getSettings(userId);
  if (!scoutAlerts) return;

  // The cursor is per account: it records how far THIS user's feed has been
  // read. Shared, it made the next person start mid-stream.
  const cursorKey = accountKey("scoutLastRun", userId);
  const queueKey = accountKey("scoutPending", userId);
  const notifiedKey = accountKey("notifiedScout", userId);

  const stored = await chrome.storage.local.get(cursorKey);
  const since = (stored[cursorKey] as string | undefined) ?? null;

  const pending = await loadQueue(userId);
  const notified = await loadSet(notifiedKey);

  let incoming: ScoutMatch[] = [];
  let fetched = false;
  try {
    incoming = await getScoutMatches(scoutMinScore, since);
    fetched = true;
  } catch {
    // Fall through — anything already queued still deserves delivery — but
    // leave the cursor untouched below so this window is requested again.
  }

  const queue = mergeQueue(pending, incoming, notified);

  // Persist the queue and advance the cursor in ONE write. The cursor moves
  // ONLY on a successful fetch, and only once the overflow is durably stored:
  // advancing past a window we never received, or past matches not yet saved,
  // is precisely the data loss this rewrite exists to remove.
  await chrome.storage.local.set({
    [queueKey]: queue,
    ...(fetched ? { [cursorKey]: new Date().toISOString() } : {}),
  });

  const batch = queue.slice(0, MAX_PER_RUN);
  const undelivered: ScoutMatch[] = [];

  for (const match of batch) {
    const key = scoutKey(match);
    const id = `jobfit:scout:${key}`;
    const at = match.company ? ` at ${match.company}` : "";
    await rememberUrl(userId, id, match.url);
    const shown = await deliver(id, {
      type: "basic",
      iconUrl: ICON,
      title: `✦ ${match.score}% match found`,
      message: `${match.title}${at} — click to view.`,
      priority: 1,
    });
    // A suppressed notification goes back to the front of the queue rather than
    // being recorded as seen.
    if (shown) notified.add(key);
    else undelivered.push(match);
  }

  await chrome.storage.local.set({
    [queueKey]: [...undelivered, ...queue.slice(MAX_PER_RUN)],
  });
  await saveSet(notifiedKey, notified);
}

/** Wire alarm + notification-click listeners. Call once at worker startup. */
export function registerAlarmHandlers(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DEADLINE_ALARM) void runDeadlineCheck();
    if (alarm.name === SCOUT_ALARM) void runScoutCheck();
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
