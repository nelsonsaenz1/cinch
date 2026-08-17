/**
 * The first social events this app has ever had.
 *
 * Cinch's taxonomy carries 47 events and not one of them is social: no
 * `friend_added`, no `explore_viewed`, no `comment_posted`. So this is where
 * social measurement starts, and the rule that governs it has to be right the
 * first time — a property added now is one that will be in a year of history
 * before anybody re-reads it.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * **No user id, friend id, outfit id or item id in any property, ever.**
 * Counts, booleans and short bounded enums only. `daily_social_reacted`
 * carries which of the three and nothing about who or what. This is the same
 * line `lib/posthog.tsx` already draws for the rest of the taxonomy, applied
 * to the one feature where crossing it would be most tempting and most
 * damaging.
 *
 * **No event fires on viewing a particular friend's look.** There is
 * deliberately no `daily_social_look_viewed`, and the absence is the design:
 * such an event would rebuild a record of who looks at whom, and it would do
 * it inside a third-party analytics store, which is worse than doing it in the
 * database. The six below answer whether the unit is worth opening, whether
 * finite works, whether the fixed set of three is the right set, whether the
 * privacy controls are used, whether anybody opts in, and which of the three
 * emptinesses people actually meet. None of them needs to know about a person.
 *
 * ── WHY THIS FILE HAS NO `track` IMPORT ───────────────────────────────────
 *
 * `@/lib/posthog` pulls in expo-updates and the PostHog React Native SDK, and
 * a module that imports it cannot be executed by the node suite. The property
 * shapes are the part worth testing — they are where an id would leak in — so
 * they are built by pure functions here and handed to `track()` at the call
 * site. `tests/daily-social-feed.test.ts` runs these builders for real and
 * asserts the key set, rather than asserting a description of it.
 */

import type { VisibilityFlag } from '@/features/privacy/visibility-flags';
import { VISIBILITY_COLUMNS } from '@/features/privacy/visibility-flags';

import type { DailyReaction } from './types';

/**
 * The six event names. Each is also a member of `AppEvent` in
 * `lib/posthog.tsx`, which is the closed union that makes a typo a compile
 * error rather than a second event that looks real and splits the funnel.
 */
export const DAILY_SOCIAL_EVENTS = {
  opened: 'daily_social_opened',
  completed: 'daily_social_completed',
  reacted: 'daily_social_reacted',
  closetVisibilityChanged: 'closet_visibility_changed',
  wornSharingChanged: 'worn_outfits_sharing_changed',
  empty: 'daily_social_empty',
} as const;

/**
 * Which of the six states the reader met, in the contract's own labels.
 *
 * Bounded, and the labels are the ones §4 uses, so a chart cut by this reads
 * against the state map without a translation table. S-1a and S-1b are
 * separate members because they are the whole reason the count RPC exists:
 * "no circle" and "a circle where nobody has opted in" are different problems
 * with different actions, and a single `empty` bucket would have hidden the
 * one most people meet on day one.
 */
export type DailySocialState = 'S-1a' | 'S-1b' | 'S-2' | 'S-3' | 'S-4' | 'S-5';

/** The three emptinesses, and only one of them is a content problem. */
export type DailySocialEmptyReason = 'no_friends' | 'nobody_sharing' | 'quiet_day';

/** The stable identifier for one of the four §5.1 flags: its column name. */
export type VisibilityColumn = (typeof VISIBILITY_COLUMNS)[VisibilityFlag];

/**
 * Is it worth opening, and which state do people actually meet?
 *
 * `item_count` is how many looks were on screen — a count, never a list, and
 * never an id.
 */
export function dailySocialOpenedProps(args: {
  state: DailySocialState;
  lookCount: number;
}): { state: DailySocialState; item_count: number } {
  return { state: args.state, item_count: args.lookCount };
}

/**
 * Does "finite" work — do people reach the end?
 *
 * The pair is the point. `items_seen` on its own cannot distinguish a short
 * day read to the end from a long day abandoned a third of the way through,
 * and `reached_end` on its own cannot say how much was there to reach.
 */
export function dailySocialCompletedProps(args: {
  itemsSeen: number;
  reachedEnd: boolean;
}): { items_seen: number; reached_end: boolean } {
  return { items_seen: args.itemsSeen, reached_end: args.reachedEnd };
}

/**
 * Is the fixed set the right set, and is one of the three dead weight?
 *
 * One property, and it is which of the three. Not who reacted, not to whom,
 * not to what, and — because there is no count anywhere in this unit — not
 * how many.
 */
export function dailySocialReactedProps(reaction: DailyReaction): { reaction: DailyReaction } {
  return { reaction };
}

/**
 * Do owners actually use the four visibility controls, and which of them?
 *
 * `flag` is the COLUMN name rather than the switch's camelCase key: the column
 * is what the read path filters on and what survives a UI rename, so a year of
 * history stays joinable to the thing it is about.
 */
export function closetVisibilityChangedProps(
  flag: VisibilityFlag,
  visible: boolean,
): { flag: VisibilityColumn; hidden: boolean } {
  // The one inversion boundary outside `visibility-flags.ts`: the switch says
  // visible, the column and therefore the event say hidden.
  return { flag: VISIBILITY_COLUMNS[flag], hidden: !visible };
}

/**
 * Does anyone opt in?
 *
 * With a default of off, this is the number the whole unit lives or dies on —
 * and it carries a boolean and nothing else. Not when, not for how long, not
 * how many friends it exposed anything to.
 */
export function wornSharingChangedProps(shared: boolean): { shared: boolean } {
  return { shared };
}

/** Three different emptinesses, and only one of them is a content problem. */
export function dailySocialEmptyProps(reason: DailySocialEmptyReason): {
  reason: DailySocialEmptyReason;
} {
  return { reason };
}
