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
import { getScoutMatches } from "@/data/scout";

const DEADLINE_ALARM = "jobfit:deadline-check";
const SCOUT_ALARM = "jobfit:scout-check";

const NOTIFIED_DEADLINES = "jobfit:notified-deadlines";
const NOTIFIED_SCOUT = "jobfit:notified-scout";
const NOTIFICATION_URLS = "jobfit:notification-urls";
const SCOUT_LAST_RUN = "jobfit:scout-last-run";

const ICON = "icon128.png";

/** Register both alarms (idempotent — safe on install and startup). */
export function setupAlarms(): void {
  chrome.alarms.get(DEADLINE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(DEADLINE_ALARM, { periodInMinutes: 360, delayInMinutes: 1 });
    }
  });
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

/** Remember where a notification should navigate when clicked. */
async function rememberUrl(notificationId: string, url: string): Promise<void> {
  const stored = await chrome.storage.local.get(NOTIFICATION_URLS);
  const map = (stored[NOTIFICATION_URLS] as Record<string, string> | undefined) ?? {};
  map[notificationId] = url;
  await chrome.storage.local.set({ [NOTIFICATION_URLS]: map });
}

// ─── Deadline reminders (Phase 7) ───────────────────────────────────────────
function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

async function runDeadlineCheck(): Promise<void> {
  const { deadlineNotifications } = await getSettings();
  if (!deadlineNotifications) return;

  let upcoming;
  try {
    upcoming = await getUpcomingDeadlines(72);
  } catch {
    return; // never let a failed check crash the worker
  }

  const notified = await loadSet(NOTIFIED_DEADLINES);
  for (const job of upcoming) {
    const key = `${job.source}:${job.externalId}`;
    if (notified.has(key)) continue;
    const hours = Math.max(0, Math.round(hoursUntil(job.deadline)));
    const score = job.matchScore != null ? ` You have a ${job.matchScore}% match.` : "";
    const id = `jobfit:deadline:${key}`;
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: ICON,
      title: "⏰ A saved job is closing soon",
      message: `${job.title} closes in ~${hours}h.${score}`,
      priority: 1,
    });
    await rememberUrl(id, `https://www.linkedin.com/jobs/view/${job.externalId}`);
    notified.add(key);
  }
  await saveSet(NOTIFIED_DEADLINES, notified);
}

// ─── Passive job-scout alerts (Phase 11) ────────────────────────────────────
async function runScoutCheck(): Promise<void> {
  const { scoutAlerts, scoutMinScore } = await getSettings();
  if (!scoutAlerts) return;

  const stored = await chrome.storage.local.get(SCOUT_LAST_RUN);
  const since = (stored[SCOUT_LAST_RUN] as string | undefined) ?? null;

  let matches;
  try {
    matches = await getScoutMatches(scoutMinScore, since);
  } catch {
    return;
  }
  await chrome.storage.local.set({ [SCOUT_LAST_RUN]: new Date().toISOString() });

  const notified = await loadSet(NOTIFIED_SCOUT);
  // Best match first, and cap per run so a backlog can't spam the user.
  const fresh = matches
    .filter((m) => !notified.has(`${m.source}:${m.externalId}`))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const match of fresh) {
    const key = `${match.source}:${match.externalId}`;
    const id = `jobfit:scout:${key}`;
    const at = match.company ? ` at ${match.company}` : "";
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: ICON,
      title: `✦ ${match.score}% match found`,
      message: `${match.title}${at} — click to view.`,
      priority: 1,
    });
    await rememberUrl(id, match.url);
    notified.add(key);
  }
  await saveSet(NOTIFIED_SCOUT, notified);
}

/** Wire alarm + notification-click listeners. Call once at worker startup. */
export function registerAlarmHandlers(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DEADLINE_ALARM) void runDeadlineCheck();
    if (alarm.name === SCOUT_ALARM) void runScoutCheck();
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    void (async () => {
      const stored = await chrome.storage.local.get(NOTIFICATION_URLS);
      const map = (stored[NOTIFICATION_URLS] as Record<string, string> | undefined) ?? {};
      const url = map[notificationId];
      if (url) {
        await chrome.tabs.create({ url });
        delete map[notificationId];
        await chrome.storage.local.set({ [NOTIFICATION_URLS]: map });
      }
      chrome.notifications.clear(notificationId);
    })();
  });
}
