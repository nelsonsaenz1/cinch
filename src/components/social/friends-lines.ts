import type { SocialProfile } from '@/features/social-graph/types';

/**
 * Every sentence the Friends page prints (atlas FR-01, FR-02), as pure
 * functions.
 *
 * `.ts`, not `.tsx`, and deliberately — the same reason `features/boards/
 * board-lines.ts` is: the test bundler cannot parse React Native's Flow source,
 * so anything a test needs to read has to live where no component import can
 * reach it.
 *
 * CORRECTION 23 — WHAT A FRIENDS ROW MAY SAY.
 *
 * A friendship in this app is not a table. It is the intersection of two
 * `follows` edges (`features/social-graph/queries.ts` → `fetchEdges`), whose
 * columns are `follower_id`, `followee_id` and `created_at`, hydrated with
 * `social_profiles` (`user_id, username, display_name, avatar_url, bio` — the
 * whole select). That list is the whole of what a row can honestly draw:
 *
 *   name · handle · avatar · the person's own bio
 *
 * There is no mutual-friend count in it, no hosting state, and no lending flag:
 * `items.borrowable` is per garment (`features/social-graph/types.ts`
 * `FriendItem.borrowable`) and there is no account-level "lends her things"
 * setting anywhere in `supabase/migrations` to read. A row that printed one
 * would be inventing a private field, which is the refusal this module exists
 * to hold.
 *
 * "NOT NOW" NEVER MEANS REJECTED. On this page it writes nothing at all — see
 * `src/app/friends/index.tsx`, `DISMISSED_KEY`: the row leaves this device and
 * the sender cannot detect it. So nothing here says decline, reject or remove.
 */

// ---------------------------------------------------------------------------
// The masthead and its sections
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * `2 requests · 18 friends` — the masthead's own line, 13pt regular secondary.
 *
 * A count of zero is dropped rather than printed: "0 requests" is a number
 * about an absence, and the section it refers to is not on the page either.
 * With neither, the line disappears entirely rather than saying nothing twice.
 */
export function circleLine(requestCount: number, friendCount: number): string | null {
  const parts = [
    requestCount > 0 ? plural(requestCount, 'request', 'requests') : null,
    friendCount > 0 ? plural(friendCount, 'friend', 'friends') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** The requests section's heading. Not "Requests": a heading is a sentence here. */
export const REQUESTS_HEADING = 'Wants to be friends';

/** `18 friends` — the count is inline in the heading, 13pt regular. */
export const friendsHeading = (count: number): string => plural(count, 'friend', 'friends');

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

/** `@username`, or nothing — the second line never invents a handle. */
export function handleLine(profile: Pick<SocialProfile, 'username'>): string | null {
  return profile.username ? `@${profile.username}` : null;
}

/**
 * The one quiet line under a name: `@anab · Vintage denim, mostly`.
 *
 * Handle first because it is the identifier, bio second because it is the
 * person. Either may be absent; both absent prints nothing rather than a
 * placeholder. Nothing else may join this line — see the module header.
 */
export function personLine(profile: Pick<SocialProfile, 'username' | 'bio'>): string | null {
  const handle = handleLine(profile);
  const bio = profile.bio?.trim() || null;
  return [handle, bio].filter(Boolean).join(' · ') || null;
}

/** The quiet alternative beside Accept. It sends nothing and rejects nobody. */
export const NOT_NOW = 'Not now';

/**
 * The four words a friends row may never contain, and the guard that proves it.
 *
 * Exported so the acceptance test can assert against the strings themselves
 * rather than against a copy of them.
 */
export const REJECTION_WORDS = ['decline', 'declined', 'reject', 'rejected', 'remove', 'removed'];

export function impliesRejection(copy: string): boolean {
  return REJECTION_WORDS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(copy));
}

/**
 * What a waved-off request says while its undo is live.
 *
 * "Set aside", never "removed" — the earlier line read "Request removed.",
 * which is a word for a thing that was thrown away and a claim the write does
 * not support. The name carries the second sentence rather than a pronoun, so
 * the row is true whoever sent it.
 */
export function setAsideLine(name: string): string {
  return `Request from ${name} set aside`;
}

export function setAsideDetail(name: string): string {
  return `Still waiting in Friends. ${name} was not told.`;
}

/** A failed accept. It names what did NOT happen, then keeps the row where it was. */
export function acceptFailedLine(name: string): string {
  return `Accepting did not go through. ${name} has not been told anything.`;
}

// ---------------------------------------------------------------------------
// FR-02 · the empty page, and the blocked result
// ---------------------------------------------------------------------------

export const EMPTY_TITLE = 'No friends on Cinch yet';

/**
 * The empty state leads with what friendship means for privacy rather than
 * with an exhortation. Both halves are true today: a friend sees a look only
 * where it was shared, and `items.borrowable` is opt-in per garment.
 */
export const EMPTY_BODY =
  'Friends can see the looks you choose to share and lend pieces if they opt in. Nothing in your ' +
  'closet is shared until you decide it is.';

/**
 * THE BLOCKED RESULT, IN THE SAFETY PAGE'S OWN WORDS.
 *
 * `BLOCK_EFFECT` is the sentence `BlockedList.tsx` already prints above the
 * blocked rows, moved here so the two surfaces read one string instead of two
 * paraphrases. Two sentences for one policy is how a policy stops being one
 * policy; the safety page imports this constant rather than keeping its own.
 *
 * The claim is enforceable — `20260809160000` is what made it a fact rather
 * than a hope; see that file and `BlockedList.tsx`'s own header.
 */
export const BLOCK_EFFECT =
  'Blocking removed their votes from your looks and took them off every event you host. They ' +
  'cannot see your closet, and you will not see theirs.';

/** The other half of the safety page's claim, in `BlockConfirmSheet`'s words. */
export const BLOCK_NOT_TOLD = 'They cannot find you by username again, and they are not told.';

export const BLOCKED_TITLE = 'You blocked this person';
export const BLOCKED_BODY = `${BLOCK_EFFECT} ${BLOCK_NOT_TOLD}`;
export const BLOCKED_ACTION = 'Manage blocked people';


// ---------------------------------------------------------------------------
// Redesign 08 — the accepted frames' own words
//
// The page kept every promise it already made and changed how it says several
// of them. Where a line below replaces an older one, the older constant stays
// exported: `BlockedList.tsx` and the two dev fixtures still print it, and a
// constant deleted out from under another surface is how one policy becomes
// two paraphrases. Nothing here says decline, reject or remove — the guard
// above still holds over every string in this file.
// ---------------------------------------------------------------------------

/** The requests band's eyebrow. The rows beneath still say what they want. */
export const WAITING_ON_YOU = 'Waiting on you';

/** What a request row says under the name while it waits. */
export const WANTS_TO_BE_FRIENDS = 'Wants to be friends';

/** The band's affirmative. Its quiet neighbour is `NOT_NOW`, unchanged. */
export const ADD = 'Add';

/** While the accept is in flight. Both controls on the row are inert. */
export const ADDING = 'Adding…';

/** The beat after an accept lands, before the row joins the list below. */
export function joinedCircleLine(name: string): string {
  return `${name} is in your circle.`;
}

/** A failed accept, on the row that failed rather than at the top of the page. */
export const ACCEPT_FAILED_TITLE = 'That didn’t go through';
export const ACCEPT_FAILED_DETAIL = 'Still waiting — nothing was sent';
export const TRY_AGAIN = 'Try again';

/**
 * The waved-off receipt, in the frames' shorter words.
 *
 * `setAsideLine`/`setAsideDetail` above name the person and are what the older
 * fixtures print; this is the same promise in the one line the card has room
 * for. Both say the only thing that matters: nobody was told.
 */
export const SET_ASIDE = 'Set aside. Nobody was told.';
export const UNDO = 'Undo';

// ── Presence — the one authorized fact ─────────────────────────────────────

/**
 * `Wore the wool coat`.
 *
 * The garment's name comes from the app's one naming derivation, so a friend's
 * coat reads the same here as on their own closet grid. There is no count in
 * this sentence and there is no date: "Shared 2 pieces this week" was the exact
 * line the first export of this page was rejected for, and a quantity of
 * anything is the inference the whole projection exists to refuse.
 */
export function worePieceLine(pieceLabel: string): string {
  return `Wore the ${pieceLabel}`;
}

/** The mark that stands alone when the day is visible and the piece is not. */
export const WORN_TODAY = 'Worn today';

// ── The states of the two reads ────────────────────────────────────────────

export const REQUESTS_FAILED = 'Requests didn’t load. Your friends are fine.';

export const FRIENDS_FAILED_TITLE = 'Couldn’t load your circle';
export const FRIENDS_FAILED_BODY =
  'This is a connection problem, not an empty list. Nobody has been removed and nothing has ' +
  'changed.';

export const OFFLINE_TITLE = 'You’re offline';
export const OFFLINE_BODY =
  'These names are from the last time you were connected. What anyone wore isn’t shown until ' +
  'Cinch can check it again.';

// ── The empty circle ───────────────────────────────────────────────────────

export const NOBODY_YET_TITLE = 'Nobody here yet';
export const NOBODY_YET_BODY =
  'Cinch only ever shows people you’re both friends with. Find someone you already know, or ' +
  'send them an invitation.';
export const FIND_SOMEONE = 'Find someone';

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * The no-results line, worded so it says nothing about the person.
 *
 * It never implies the account does or does not exist: either claim would leak
 * the existence of a blocked or private profile to whoever typed the handle.
 */
export const NO_RESULTS_TITLE = 'No one to show';
export const NO_RESULTS_BODY =
  'Check the spelling, or send them an invitation and let them come to you.';

// ── Sent requests ──────────────────────────────────────────────────────────

export const SENT_HEADING = 'Sent';
export const WITHDRAW = 'Withdraw';
export const SENT_NOTE = 'Nothing is shared either way until a request is accepted.';

// ── The blocked receipt, and the footer ────────────────────────────────────

export const BLOCKED_RESULT_LINE =
  'Blocked. They’re gone from your circle, from search and from Explore, and they aren’t told.';
export const MANAGE_BLOCKED = 'Manage blocked';

export const INVITE_TITLE = 'Invite a friend';
export const INVITE_MUTUAL_NOTE = 'Cinch only shows people you’re both friends with.';
export const INVITE_BETTER_NOTE = 'Cinch is better with a few of yours in it.';
export const INVITE_LINK_NOTE = 'Send a link — they choose whether to accept.';
export const SHARE_YOUR_LINK = 'Share your link';

/**
 * The free-plan note, kept quiet and factual.
 *
 * The number is `PLANS.free.items`, passed in rather than typed, because every
 * number shown to a member derives from `plans.ts`. It carries no price, no
 * trial copy and no upgrade button — this page is not a place to sell.
 */
export function freeClosetNote(pieces: number): string {
  return (
    `On the free plan your friends see the first ${pieces} pieces of your closet. ` +
    'Everything else stays private until you say otherwise.'
  );
}

/** The AX frame's foot, where the page is taller than the screen. */
export const SCROLL_FOR_MORE = 'Scroll for more';
