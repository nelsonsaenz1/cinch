/**
 * THE SIX STATES, AS ONE PURE FUNCTION — contract §4.
 *
 * Five of the six are emptiness or failure, and the contract's own line about
 * them is the reason this file exists at all: "Every one must be drawn; five
 * are failure or emptiness, and those are where the unit is actually judged."
 * A screen that resolves its own state inline resolves it slightly differently
 * from the analytics call beside it, and the state that gets under-tested is
 * always one of the five.
 *
 * No React, no react-native, no supabase — the whole point. The node runner
 * exercises the real function rather than a description of it, which is the
 * same split `visibility-flags.ts` made away from `use-closet-visibility.ts`.
 *
 * ── The one distinction that cannot be derived from the look list ───────────
 *
 * `nobody_sharing` and `quiet_day` both arrive with zero looks. From an empty
 * list the client cannot tell "nobody has turned sharing on" from "everybody
 * has, and today was quiet", and they are different screens with different
 * actions — one is about you, one is about nobody. `sharingFriendCount` is the
 * only input that separates them, and it comes from a scalar RPC that returns
 * an integer and nothing else (Worker A's `friends_sharing_worn_outfits_count`,
 * commit e2da020): no list, no id, no name, no timestamp. Getting the split
 * wrong tells someone to go invite more people when what they should do is go
 * first, or tells them to go first when their friends already did.
 *
 * ── Why `reachedEnd` is here and the packet's four fields are not enough ────
 *
 * S-4 is not a property of the data. It is "reached the end of S-3" — a
 * scroll fact — and a resolver that could not express it would leave the sixth
 * state to be decided somewhere untested. It is optional and defaults false, so
 * the four fields the packet names are still the whole input for the other
 * five states.
 *
 * S-4 does NOT replace S-3's content. `showsLooks()` below is true for both,
 * because the caught-up line is the END of the day's looks and not a screen
 * that erases them — a terminal state that unmounted the list would be its own
 * kind of infinite-scroll bug, one where the reward for reaching the bottom is
 * losing the thing you scrolled through.
 */

export type DailyState =
  /** S-1a · no mutual friends. Invite path; never a stranger suggestion. */
  | 'no_circle'
  /** S-1b · mutuals exist, none sharing. The action is about YOU: go first. */
  | 'nobody_sharing'
  /** S-2 · friends share, nothing new. Not an error, not empty-styled. */
  | 'quiet_day'
  /** S-3 · 1–N looks from mutuals. Finite, ordered, ends in the caught-up line. */
  | 'the_day'
  /** S-4 · the end of S-3. Terminal; no infinite scroll, no "load more". */
  | 'caught_up'
  /** S-5 · query failed or device offline. Says offline, distinctly from quiet. */
  | 'offline';

/** Every state, in the order §4's table lists them. */
export const DAILY_STATES: readonly DailyState[] = [
  'no_circle',
  'nobody_sharing',
  'quiet_day',
  'the_day',
  'caught_up',
  'offline',
];

export interface DailyStateInput {
  /** Mutual follows, not blocked either way — `is_friend()`'s definition. */
  friendCount: number;
  /** How many of those have `worn_outfits_shared_since` set. An integer, only. */
  sharingFriendCount: number;
  /** Looks currently readable through `friend_worn_outfits`. */
  lookCount: number;
  /** The read failed, or the device is offline. */
  failed: boolean;
  /** The reader has reached the end of the day. Defaults false. */
  reachedEnd?: boolean;
}

/**
 * A count, defended.
 *
 * A query that has not answered yet hands back `undefined`, and `undefined > 0`
 * is false rather than a crash — which would silently resolve a still-loading
 * screen to `no_circle` and tell somebody with eleven friends that they have
 * none. Non-finite and negative both floor to zero for the same reason: this
 * function's answers are sentences shown to a person, and it must not have an
 * undefined branch.
 */
function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Which of the six a reader is in.
 *
 * Order matters and is the contract's own precedence:
 *
 *   1. **Failure first.** "Any → S-5 on failure." A failed read must never be
 *      dressed as an empty circle — the same refusal `ErrorState` exists for,
 *      and the one that made eleven screens tell people their data had
 *      vanished when it was merely unreadable.
 *   2. **No circle before nobody sharing.** With no friends at all, how many of
 *      them share is not a question. An incoherent input (no friends, yet a
 *      positive sharing count) resolves to `no_circle` rather than inventing a
 *      sharing friend, because friendship is the outer gate in the view too.
 *   3. **Nobody sharing before quiet.** See the header.
 *   4. **Quiet before the day.** Zero looks is a quiet day once somebody is
 *      sharing, not an error and not an empty state.
 *   5. **Caught up last**, because it is a fact about S-3 rather than a rival
 *      to it.
 */
export function resolveDailyState(input: DailyStateInput): DailyState {
  if (input.failed) return 'offline';

  if (count(input.friendCount) === 0) return 'no_circle';
  if (count(input.sharingFriendCount) === 0) return 'nobody_sharing';
  if (count(input.lookCount) === 0) return 'quiet_day';

  return input.reachedEnd ? 'caught_up' : 'the_day';
}

/**
 * Whether the day's looks are on screen in this state.
 *
 * True for `the_day` AND `caught_up` — see the header. The caller renders the
 * same list either way and only appends the closure line, which is what makes
 * "reaching the end" cost nothing and take nothing away.
 */
export function showsLooks(state: DailyState): boolean {
  return state === 'the_day' || state === 'caught_up';
}

/**
 * Whether the closure line may print.
 *
 * Only under a day that actually has looks in it. A quiet day prints the same
 * sentence for its own reasons (§4: "the caught-up line, and the date it
 * covers"), but it prints it from `QuietDayState`, where the dated line beside
 * it says what was covered. `showsCaughtUp` in `features/explore/feed.ts` makes
 * the identical refusal for the identical reason: "caught up" over a failed
 * read is a claim the app cannot make.
 */
export function showsCaughtUpLine(state: DailyState): boolean {
  return state === 'caught_up';
}

/**
 * The failure carries no state of its own.
 *
 * §4 requires "any → S-5 on failure, and back WITHOUT losing scroll position".
 * The half of that promise this module can keep is that recovery is exact:
 * clearing `failed` returns the identical state for identical content, so
 * nothing about having been offline changes what is drawn afterwards. The other
 * half belongs to the screen, and follows from the same property — the state
 * screens in `components/daily-social/` hold no state of their own, so the
 * scroll container is never remounted and never keyed on the state.
 */
export function stateAfterRecovery(input: DailyStateInput): DailyState {
  return resolveDailyState({ ...input, failed: false });
}
