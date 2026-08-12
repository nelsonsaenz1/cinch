/**
 * The channel table — every notification Cinch is allowed to send, and the
 * sentence it promises.
 *
 * Atlas 37's governing rule is "the description is the promise": if a row says
 * once a day, the sender enforces once a day, and copy and schedule are
 * reviewed together. That rule needs a single artefact both halves are read
 * against, so this file is it — the client renders these rows and the senders
 * (`supabase/functions/send-push/**`, Unit X) are checked against them. Neither
 * side gets to add a channel, soften a description, or invent a cadence on its
 * own.
 *
 * Pure data and pure functions, in a `.ts`, so `tests/notification-channels.
 * test.ts` can hold it against the migration's defaults without a React
 * renderer in the way.
 *
 * TWO CHANNELS THE ATLAS DRAWS THAT ARE NOT HERE
 *
 *  1. **Season in review.** Atlas 34 is deferred (contract §3) and
 *     `notification_prefs` deliberately has no column for it. A switch for a
 *     feature that does not exist is a promise nothing can keep.
 *  2. Nothing for offers, tips or re-engagement. The atlas says it in as many
 *     words — "there is no row for offers, tips or re-engagement, and none will
 *     be added" — and this list is where that refusal is kept.
 *
 * See docs/design/diary-boards-activity-contract.md §6.3.
 */

export type NotificationChannelKey =
  | 'morning_edit'
  | 'friend_activity'
  | 'borrow_requests'
  | 'event_reminders'
  | 'votes_comments';

/**
 * The atlas's two groups: what Cinch sends about your own day, and what other
 * people cause. The split is editorial, not technical — it is what lets a
 * reader turn off other people without turning off their own morning.
 */
export type NotificationChannelGroup = 'cinch' | 'friends';

export interface NotificationChannel {
  key: NotificationChannelKey;
  group: NotificationChannelGroup;
  title: string;
  /** What arrives, and how often. The promise. Never softened, never embellished. */
  description: string;
  /**
   * The atlas's rule: on by default, except votes. "Anything that fires per
   * friend action starts off" — votes is the one channel whose frequency is
   * set by other people. Must agree with `20260810100300_push.sql`; the test
   * is the tripwire.
   */
  defaultOn: boolean;
}

export const NOTIFICATION_GROUPS: readonly { id: NotificationChannelGroup; title: string }[] = [
  { id: 'cinch', title: 'From Cinch' },
  { id: 'friends', title: 'From friends' },
];

/**
 * The four slots the morning edit may be sent in, and nothing between them.
 *
 * `morning_edit_at` is constrained to exactly these in SQL. A free picker would
 * be a schedule nobody wrote a sender for: the cron runs every fifteen minutes
 * and fires for users whose slot has passed today, which only works if every
 * slot lands on the quarter hour.
 *
 * Stored as Postgres `time`, which reads back as `HH:MM:SS` — hence the
 * canonical values carrying seconds and `normalizeMorningEditTime` accepting
 * the shorter spelling a hand-written migration or fixture might use.
 */
export const MORNING_EDIT_SLOTS = [
  { value: '06:30:00', label: '6:30' },
  { value: '07:00:00', label: '7:00' },
  { value: '07:30:00', label: '7:30' },
  { value: '08:00:00', label: '8:00' },
] as const;

export type MorningEditTime = (typeof MORNING_EDIT_SLOTS)[number]['value'];

export const DEFAULT_MORNING_EDIT_TIME: MorningEditTime = '07:30:00';

/** `'06:30:00'` → `'6:30'`. The label the chip prints, no am/pm — all four are morning. */
export function morningEditLabel(value: MorningEditTime): string {
  return MORNING_EDIT_SLOTS.find((slot) => slot.value === value)?.label ?? '7:30';
}

/**
 * Anything the server hands back, coerced to one of the four. `'07:30'`,
 * `'07:30:00'` and `'07:30:00+00'` all mean the same slot; anything else is a
 * row written by something that did not know the constraint, and falls back to
 * the default rather than printing a time no sender fires at.
 */
export function normalizeMorningEditTime(raw: string | null | undefined): MorningEditTime {
  if (!raw) return DEFAULT_MORNING_EDIT_TIME;
  const hhmm = raw.slice(0, 5);
  const match = MORNING_EDIT_SLOTS.find((slot) => slot.value.slice(0, 5) === hhmm);
  return match ? match.value : DEFAULT_MORNING_EDIT_TIME;
}

/**
 * The morning edit's promise, at whatever time the reader chose.
 *
 * Contract §4.5: the atlas printed *"One notification at 7:30am with the day's
 * look"*, and the app cannot send a look. Generation is on-device —
 * `generateOutfits()` runs in `src/lib/styling` and the `generate-outfits` edge
 * function only re-ranks a shortlist the client already sent — so the server
 * never holds a look to put in a payload. The contract froze this replacement
 * line, and it is what a sender can actually keep.
 *
 * The hour is substituted because the reader can move it. A row that still said
 * 7:30 to somebody who picked 6:30 would be the same class of untruth the line
 * was rewritten to remove — the description is the promise, and the promise has
 * a time in it.
 */
export function morningEditDescription(at: MorningEditTime): string {
  return `One notification at ${morningEditLabel(at)}am, when the day’s look is ready to read. Nothing else arrives in the morning.`;
}

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  {
    key: 'morning_edit',
    group: 'cinch',
    // Frozen at the default slot. `morningEditDescription` is what the screen
    // renders; this is what Unit X's sender is checked against, and the test
    // holds the two together.
    description: morningEditDescription(DEFAULT_MORNING_EDIT_TIME),
    title: 'Morning edit',
    defaultOn: true,
  },
  {
    key: 'friend_activity',
    group: 'cinch',
    title: 'Friend activity',
    description: 'When someone you added adds you back, or adds a piece to their closet.',
    defaultOn: true,
  },
  {
    key: 'borrow_requests',
    group: 'cinch',
    title: 'Borrow requests',
    description: 'When a friend asks for something of yours, and when they return it.',
    defaultOn: true,
  },
  {
    key: 'event_reminders',
    group: 'cinch',
    title: 'Event reminders',
    description: 'The evening before an event you are going to, once.',
    defaultOn: true,
  },
  {
    key: 'votes_comments',
    group: 'friends',
    title: 'Votes and comments',
    description: 'When friends weigh in on a look you asked about.',
    defaultOn: false,
  },
];

export function channelsInGroup(group: NotificationChannelGroup): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.filter((channel) => channel.group === group);
}

/**
 * NT-01's opening sentence, and the whole reason this file is the authority.
 *
 * Five channels, counted from the table rather than typed, so a sixth cannot
 * be added without this line changing to match — which is the moment somebody
 * would have to justify it.
 */
export function channelCountLine(): string {
  const spoken = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  const n = NOTIFICATION_CHANNELS.length;
  return `Cinch sends ${spoken[n] ?? n} kinds of message and nothing else. There is no digest and no re-engagement reminder.`;
}

/**
 * NT-02 — what a channel WOULD do, if the phone were letting Cinch send.
 *
 * The conditional is the whole point: a row that still reads as a live promise
 * while iOS is dropping everything is the app telling somebody they will be
 * notified when they will not be. Built from the same description the enabled
 * row prints, so the two can never drift into two different promises.
 */
export function wouldArriveDescription(channel: NotificationChannel, at: MorningEditTime): string {
  const said =
    channel.key === 'morning_edit' ? morningEditDescription(at) : channel.description;
  const lower = said.charAt(0).toLowerCase() + said.slice(1);
  return `Would arrive: ${lower}`;
}

/** The state a toggle prints as a word, so no preference rides on track colour alone. */
export function channelStateWord(on: boolean): string {
  return on ? 'On' : 'Off';
}

/**
 * The reader's settings, in the app's own casing. Every channel plus the one
 * schedule; nothing derived is stored here, because a derived thing stored is a
 * thing that goes stale.
 */
export type NotificationPrefs = Record<NotificationChannelKey, boolean> & {
  morningEditAt: MorningEditTime;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ...(Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [channel.key, channel.defaultOn]),
  ) as Record<NotificationChannelKey, boolean>),
  morningEditAt: DEFAULT_MORNING_EDIT_TIME,
};

/** The shape `notification_prefs` comes back as. Structural, so this file stays free of DB types. */
export interface NotificationPrefsRow {
  morning_edit: boolean;
  morning_edit_at: string;
  friend_activity: boolean;
  borrow_requests: boolean;
  event_reminders: boolean;
  votes_comments: boolean;
}

/**
 * A row, or the absence of one, as settings.
 *
 * **Absence is the defaults.** A user who has never touched this screen has no
 * row — the migration writes none on sign-up — and the atlas's defaults are
 * what the senders will treat them as. Rendering "everything off" for that
 * person would be the screen disagreeing with the sender about what is about to
 * happen to them.
 */
export function prefsFromRow(row: NotificationPrefsRow | null | undefined): NotificationPrefs {
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  return {
    morning_edit: row.morning_edit,
    friend_activity: row.friend_activity,
    borrow_requests: row.borrow_requests,
    event_reminders: row.event_reminders,
    votes_comments: row.votes_comments,
    morningEditAt: normalizeMorningEditTime(row.morning_edit_at),
  };
}

/** The columns a write touches, from the app's own casing. */
export function rowFromPrefs(prefs: NotificationPrefs): NotificationPrefsRow {
  return {
    morning_edit: prefs.morning_edit,
    friend_activity: prefs.friend_activity,
    borrow_requests: prefs.borrow_requests,
    event_reminders: prefs.event_reminders,
    votes_comments: prefs.votes_comments,
    morning_edit_at: prefs.morningEditAt,
  };
}

/**
 * NP-02's predicate: every channel false.
 *
 * Not "nothing is on" as a feeling — the literal conjunction over the table, so
 * adding a channel later cannot leave the note showing while something is still
 * switched on.
 */
export function allChannelsOff(prefs: NotificationPrefs): boolean {
  return NOTIFICATION_CHANNELS.every((channel) => !prefs[channel.key]);
}
