/**
 * Every `chrome.storage.local` key the extension owns, and — the point of this
 * module — whether each one belongs to the DEVICE or to an ACCOUNT.
 *
 * WHY THIS EXISTS: these keys used to be fixed string literals scattered across
 * alarms.ts and settings.ts. `chrome.storage.local` is per browser PROFILE, not
 * per JobFit user, so on a shared computer Alice's alert preferences, her
 * already-notified job ids and her scout cursor were simply handed to Bob when
 * he signed in — he inherited her thresholds and silently MISSED alerts she had
 * already been shown. Naming the keys in one place makes the scoping rule
 * checkable instead of a convention nobody can see.
 *
 * THE RULE: anything derived from who is signed in is account-scoped. Alert
 * preferences count — "notify me above 85%" is a statement about a person's job
 * search, not a property of this laptop — so there is deliberately no
 * device-level settings blob to inherit.
 */

/** Keys that legitimately belong to the browser profile, not to a user. */
export const DEVICE_KEYS = {
  /** The JobFit user id last seen signed in — how an account CHANGE is noticed. */
  activeUser: "jobfit:active-user",
} as const;

/**
 * Base names of account-scoped keys. Never used raw — always through
 * `accountKey`, which is why these aren't exported.
 */
const ACCOUNT_BASES = {
  settings: "jobfit:settings",
  notifiedDeadlines: "jobfit:notified-deadlines",
  notifiedScout: "jobfit:notified-scout",
  notificationUrls: "jobfit:notification-urls",
  scoutLastRun: "jobfit:scout-last-run",
  /** Scout matches fetched but not yet delivered — the per-run cap's overflow. */
  scoutPending: "jobfit:scout-pending",
} as const;

export type AccountKeyName = keyof typeof ACCOUNT_BASES;

/**
 * The storage key holding `name` for one user, e.g.
 * `jobfit:notified-scout:u:ckl3…`. A missing/blank id would collapse two
 * accounts back into one shared bucket, so it throws rather than guessing.
 */
export function accountKey(name: AccountKeyName, userId: string): string {
  if (!userId) throw new Error(`accountKey(${name}) requires a user id`);
  return `${ACCOUNT_BASES[name]}:u:${userId}`;
}

/**
 * The pre-scoping key names. A profile upgraded from an earlier build still has
 * these, holding SOME user's state with no record of whose.
 *
 * They are DELETED, not migrated: adopting them means guessing that the next
 * person to sign in is the one who wrote them, and guessing wrong reproduces
 * exactly the inheritance bug this module exists to prevent. The cost of
 * deleting is small and self-correcting — alerts are opt-in and default OFF, so
 * a wiped preference lands on the safe value and the user re-enables it once.
 */
export const LEGACY_UNSCOPED_KEYS: readonly string[] = Object.values(ACCOUNT_BASES);
