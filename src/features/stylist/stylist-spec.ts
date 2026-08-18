import type { EntryKey } from './questionnaire';

/**
 * The stylist — what the desk decides before it draws. Redesign 16.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it.
 *
 * ── THE FOUR THINGS THIS SCREEN MUST NEVER DO ───────────────────────────────
 *
 * SPEND AN ALLOWANCE ON A TAP. A door is LOCAL INTENT SELECTION. Nothing
 * between the tap and the composed question reaches a model, so nobody can
 * burn a chat by looking around.
 *
 * INVENT A GARMENT. Every plate resolves to a currently authorized owned item.
 * A brand, a price, a purchase link or an id that does not resolve is dropped
 * before render — a stylist that fills a plate with something you do not own
 * is a shop.
 *
 * PROMISE MORE THAN THE SERVER. The client counts nothing and infers nothing.
 * Standard's promise is five a month; the enforcement ceiling is eight, and the
 * gap between them exists so five survives a failed call or two. Showing the
 * ceiling would over-promise by three.
 *
 * CONFUSE A DENIAL. A plan boundary, an exhausted allowance and a dropped
 * connection are three different facts with three different remedies, and only
 * the last one may be retried.
 */

// ---------------------------------------------------------------------------
// The four doors
// ---------------------------------------------------------------------------

export type DoorKey = 'wear' | 'pack' | 'piece' | 'closet';

/**
 * What tapping a door does. NEVER a model call.
 *
 *   `questionnaire` — opens the existing on-device step flow.
 *   `compose`       — seeds the composer and focuses it, so the person
 *                     finishes the sentence themselves.
 *
 * Both are local. The second exists because three of the four doors need a
 * noun only the owner can supply — which trip, which piece, which question —
 * and a door that guessed would be inventing the very thing this screen
 * refuses to invent.
 */
export type DoorAction =
  | { kind: 'questionnaire'; entry: EntryKey }
  | { kind: 'compose'; seed: string };

export type Door = {
  key: DoorKey;
  label: string;
  /** The one-line description under the label. */
  hint: string;
  action: DoorAction;
};

/**
 * The four doors, in fixed order.
 *
 * Each maps to a path that already exists and already works:
 *
 *   WEAR   → the questionnaire's `dressed` entry, which is the whole existing
 *            step flow and composes its own ask.
 *   PACK   → a seeded question whose `parseIntent` sets `packing`, which
 *            `contextForQuestion` already reads.
 *   PIECE  → a seeded question that `routeFactQuestion` recognises as the
 *            `compatible` intent — answered on device when it is countable.
 *   CLOSET → a seeded question answered entirely from counted in-memory facts,
 *            which spends NOTHING.
 */
export const DOORS: readonly Door[] = [
  {
    key: 'wear',
    label: 'What should I wear',
    hint: 'A few taps, then a look built from your own clothes.',
    action: { kind: 'questionnaire', entry: 'dressed' },
  },
  {
    key: 'pack',
    label: 'Pack for a trip',
    hint: 'Say where and how long.',
    action: { kind: 'compose', seed: 'Help me pack for ' },
  },
  {
    key: 'piece',
    label: 'Make this piece work',
    hint: 'Name something you own and Cinch builds around it.',
    action: { kind: 'compose', seed: 'What goes with my ' },
  },
  {
    key: 'closet',
    label: 'Ask about my closet',
    hint: 'Counted from what you own. Costs nothing.',
    action: { kind: 'compose', seed: 'How many ' },
  },
] as const;

/** Whether a door reaches the model on tap. It never does. */
export function doorSpendsAllowance(door: Door): boolean {
  // Stated as a function rather than left implicit: "no model call happens
  // between taps" is a contract somebody could break by making a door send,
  // and a test needs something to hold.
  return false;
}

/** The door's index, 1-based, for the one bounded analytics field. */
export function doorIndex(key: DoorKey): 1 | 2 | 3 | 4 {
  const i = DOORS.findIndex((d) => d.key === key);
  return (i + 1) as 1 | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// The allowance
// ---------------------------------------------------------------------------

/**
 * What Standard is PROMISED, which is not what the server enforces.
 *
 * The promise is five chats a month. The server's ceiling is eight, and the
 * three-chat gap is deliberate: it is what keeps five deliverable through a
 * failed call or two. A mark computed against the ceiling would tell somebody
 * they had eight, and the eighth would be the one they remember.
 */
export const STANDARD_PROMISE = 5;

/** The mark appears only in the allowance's back half. */
export const MARK_THRESHOLD = 2;

export type AllowanceDisplay = {
  promiseLimit: number;
  successfulUsed: number;
  remaining: number;
};

/**
 * The display object, built from a count the SERVER supplied.
 *
 * `successfulUsed` counts successful REMOTE replies across the period. An
 * on-device fact answer, a failed turn and a provider-denied turn are all
 * excluded, because none of them was a chat the person got.
 *
 * Returns null when the server has not said. The client never infers a count
 * from one session: a number assembled locally would be wrong the moment
 * somebody used another device, and a wrong allowance is worse than none.
 */
export function allowanceDisplay(successfulUsed: number | null): AllowanceDisplay | null {
  if (successfulUsed === null || !Number.isFinite(successfulUsed)) return null;
  const used = Math.max(0, Math.trunc(successfulUsed));
  return {
    promiseLimit: STANDARD_PROMISE,
    successfulUsed: used,
    remaining: Math.max(0, STANDARD_PROMISE - used),
  };
}

/**
 * Whether the quiet chats-left mark is drawn.
 *
 * FOUR conditions, and all four must hold. Confirmed Standard — not Pro, whose
 * answer is "unlimited", and not free, who has no allowance to have a half of.
 * Not while entitlement or usage is loading, because a mark that appears and
 * corrects itself is worse than one that arrives late. Only in the back half,
 * because a counter from the first chat is a countdown game. And only from a
 * count the server gave.
 */
export function showsAllowanceMark(input: {
  plan: string;
  planLoading: boolean;
  usageLoading: boolean;
  display: AllowanceDisplay | null;
}): boolean {
  if (input.planLoading || input.usageLoading) return false;
  if (input.plan !== 'standard') return false;
  if (input.display === null) return false;
  return input.display.remaining <= MARK_THRESHOLD;
}

/** "2 chats left this month" — never a countdown, never a badge. */
export function allowanceMarkLabel(remaining: number): string {
  return remaining === 1 ? '1 chat left this month' : `${remaining} chats left this month`;
}

/**
 * What the opening says about the plan, if anything.
 *
 * Pro says unlimited and never the 100-a-day anti-abuse ceiling — that number
 * exists to stop a script, not to describe a product, and printing it would
 * turn "unlimited" into a lie the eleventh chat exposes.
 *
 * A TRIALING account says NOTHING. It follows its verified entitlement, and a
 * sales line on a screen somebody already has full access to is an
 * interruption advertising something they already have.
 */
export function planLine(plan: string, trialing: boolean, loading: boolean): string | null {
  if (loading) return null;
  if (trialing) return null;
  if (plan === 'pro') return 'Unlimited chats';
  if (plan === 'standard') return 'Five chats a month';
  return 'The stylist is part of Standard and Pro.';
}

// ---------------------------------------------------------------------------
// Denials, told apart
// ---------------------------------------------------------------------------

/**
 * The four ways a turn can fail, and they are four because they have four
 * different remedies.
 *
 *   `plan_excluded` — 402. Not exhaustion; a boundary. Routes to the existing
 *                     vendor-owned upgrade placement. NOT retryable: trying
 *                     again produces the identical refusal.
 *   `quota`         — 429. The allowance is spent and the SERVER owns when it
 *                     comes back. NOT retryable.
 *   `consent`       — the model boundary needs permission first. NOT retryable
 *                     in place; it routes to the consent path, and it is
 *                     neither an outage nor a paywall.
 *   `transport`     — the request did not arrive or the reply did not come
 *                     back. THE ONLY RETRYABLE ONE.
 */
export type DenialKind = 'plan_excluded' | 'quota' | 'consent' | 'transport';

export function isRetryable(kind: DenialKind): boolean {
  return kind === 'transport';
}

export function routesToUpgrade(kind: DenialKind): boolean {
  return kind === 'plan_excluded';
}

/**
 * What a 429 says about when it comes back.
 *
 * The period is the SERVER's, and if the server did not say when, neither does
 * this. An invented date is the worst possible failure here: somebody waits
 * for a Tuesday that means nothing and comes back to the same refusal.
 */
export function quotaResetLine(period: 'day' | 'week' | 'month' | null): string {
  if (period === 'day') return 'Your allowance resets tomorrow.';
  if (period === 'week') return 'Your allowance resets next week.';
  if (period === 'month') return 'Your allowance resets next month.';
  return 'Your allowance resets on the server’s schedule.';
}

export const DENIAL_COPY: Record<DenialKind, { title: string; body: string }> = {
  plan_excluded: {
    title: 'The stylist is part of Standard and Pro',
    body: 'Your closet, your outfits and everything else stay exactly as they are.',
  },
  quota: {
    title: 'That is this period’s chats',
    body: 'Nothing was spent on this one — it never reached the stylist.',
  },
  consent: {
    title: 'The stylist needs your say-so',
    body: 'Cinch sends a short summary of what you own, never your photographs. Doors, closet facts and your history all work without it.',
  },
  transport: {
    title: 'That didn’t send',
    body: 'Nothing was spent and your question is still here. Try again in a moment.',
  },
};

// ---------------------------------------------------------------------------
// Local facts
// ---------------------------------------------------------------------------

/**
 * A locally answered question spends nothing, and says so.
 *
 * The label matters as much as the arithmetic: a count of what somebody owns
 * presented as an AI answer would be claiming a model read their closet, which
 * is both false and the opposite of the boundary this screen keeps.
 */
export const LOCAL_FACT_MARK = 'Counted on your phone. No chat used.';

export function localFactSpendsAllowance(): boolean {
  return false;
}

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

/**
 * Every plate item must resolve to a currently authorized owned garment.
 *
 * An id in the reply that does not resolve is DROPPED, silently. Not shown as
 * a gap, not counted, not explained — a placeholder saying "1 item unavailable"
 * would reveal that something existed and is no longer visible, which is the
 * inference this app refuses everywhere.
 */
export function resolvePlateIds(
  ids: readonly string[],
  ownedIds: ReadonlySet<string>,
): string[] {
  return ids.filter((id) => ownedIds.has(id));
}

/** Whether a plate may be drawn at all: only when something survived. */
export function plateRenders(resolved: readonly string[]): boolean {
  return resolved.length > 0;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Two columns of doors, ONE at an accessibility size. */
export const DOOR_COLUMNS = 2;
export const DOOR_COLUMNS_AX = 1;
export const DOOR_RADIUS = 20;
export const DOOR_WELL = 132;
export const DOOR_WELL_AX = 96;

export const PLATE_RADIUS = 14;
export const PLATE_WELL = 104;

export const COMPOSER_HEIGHT = 52;
export const COMPOSER_HEIGHT_AX = 56;
export const COMPOSER_RADIUS = 26;

export const MIN_TARGET = 44;
export const MIN_TARGET_AX = 56;

export function doorColumns(ax: boolean): number {
  return ax ? DOOR_COLUMNS_AX : DOOR_COLUMNS;
}

export function doorWell(ax: boolean): number {
  return ax ? DOOR_WELL_AX : DOOR_WELL;
}

export function composerHeight(ax: boolean): number {
  return ax ? COMPOSER_HEIGHT_AX : COMPOSER_HEIGHT;
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const STYLIST_COPY = {
  title: 'Stylist',
  newChat: 'New chat',
  composerPlaceholder: 'Ask about what you own',
  send: 'Send',

  /** The desk's own line. Never a sales pitch, never a capability boast. */
  deskNote: 'Answers come from clothes you already own.',

  emptyCloset: 'Photograph a few pieces first',
  emptyClosetBody: 'The stylist works from what you own, so it needs something to work with.',

  notEnough: 'A few more pieces',
  notEnoughBody: 'Suggestions come only from clothes you actually own, and there are not enough yet to build one.',

  closetFailed: 'Couldn’t read your closet',
  closetFailedBody: 'Nothing has changed and nothing is lost — this device just couldn’t reach it.',

  signedOut: 'Sign in to use the stylist',
  offline: 'You’re offline. This is the last conversation Cinch loaded.',
} as const;
