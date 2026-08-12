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
