/**
 * Everything the blocked list and its unblock sheet say, as data.
 *
 * SF-01/02/03 (aliases of the repository's BL-01/BL-02) are a safety surface,
 * and audit 99's whole complaint was that the consequence of unblocking was
 * either missing or set as one bolded block. So the sentences live here rather
 * than inside the components: `tests/blocked-lines.test.ts` holds them against
 * the two facts the audit names, and the fixture routes and the shipping screen
 * print the same characters by construction.
 *
 * No React, no hook, no `@/lib/supabase` — the test bundles this module with
 * esbuild, the same rule `features/help/articles.ts` documents.
 *
 * ── PRONOUNS ──────────────────────────────────────────────────────────────
 *
 * The atlas writes the consequence as "He will be able to find you…". Cinch
 * knows a display name and a handle; it has never held a pronoun, and there is
 * no column anywhere in `supabase/migrations` that could supply one. Guessing
 * from a name misgenders a real person on the one screen where being wrong
 * about who someone is matters most. So every sentence here is they/them, and
 * the name itself carries the identification — which is the property audit 99
 * actually asked for ("nobody unblocks the wrong person from a list of three").
 *
 * ── WHAT A ROW MAY SAY (correction 28) ────────────────────────────────────
 *
 * `user_blocks` holds `blocker_id`, `blocked_id` and `created_at`
 * (20260807100000_social_graph_blocks_borrow.sql:24-30) and nothing else. The
 * row therefore draws a person, a handle and a date. The earlier "reported"
 * annotation implied this list could read `content_reports`; its RLS lets the
 * reporter select their own rows, but the blocked list never joins them and
 * must not — a report and a block are separate records and conflating them
 * tells a user their report was acted on when it was not.
 */

/**
 * SF-01's masthead. Three claims, and each is enforced somewhere:
 *
 *  - "cannot find you" — every social read screens the pair out;
 *    `social_profiles` (20260808110000_friend_closet_privacy_layer.sql:123)
 *    and the search paths in `features/social-graph/queries.ts` both do.
 *  - "see your looks" — `on_block_sever_graph()` deletes both follow edges
 *    (…blocks_borrow.sql:44-49), and friend reads require the friendship.
 *  - "comment in your events" — `20260810150100_event_roster_block_filter.sql`
 *    plus `20260809160000_block_retracts_votes`, which also removes them from
 *    every event the blocker hosts.
 *  - "none of them is told" — nothing anywhere sends on an insert into
 *    `user_blocks`; there is no branch for it in `supabase/functions/send-push`.
 *
 * The last one is the sentence people most want and most often have to guess,
 * which is why it is stated at the top rather than left to the sheet.
 *
 * THIS REPLACES `BLOCK_EFFECT` ON THIS SCREEN. That constant
 * (`components/social/friends-lines.ts`) is the same policy in the SINGULAR,
 * about one person, and FR-02 prints it on a blocked search result. Its own
 * docblock forbids two paraphrases of one policy — so BL-01 stopped printing
 * it when SF-01 landed, rather than the two sitting one above the other. The
 * facts are identical; only the number and the tense differ, and
 * `tests/blocked-lines.test.ts` pins the "not told" claim across both.
 */
export const BLOCKED_MASTHEAD =
  'They cannot find you, see your looks or comment in your events, and none of them is told that you blocked them.';

/**
 * "Three people are blocked." — spoken register, so the small numbers are
 * words. Zero and one both take a singular subject; the list never renders at
 * zero (SF-03's empty room does), but the sentence is still built correctly
 * rather than left to produce "Nobody are blocked" if it ever is.
 */
export function blockedCountLine(count: number): string {
  if (count === 0) return 'Nobody is blocked.';
  if (count === 1) return 'One person is blocked.';
  const spoken = ['', '', 'Two', 'Three', 'Four', 'Five'];
  const subject = count < spoken.length ? `${spoken[count]} people` : `${count} people`;
  return `${subject} are blocked.`;
}

/**
 * SF-01's footer. Blocking someone new is deliberately two taps deep on their
 * own profile (`FriendOverflowSheet` → the report/block flow), and this page
 * names where rather than growing an affordance for it.
 */
export const BLOCK_ELSEWHERE_LINE =
  'To block someone new, open their profile and use the menu there.';

/**
 * "Blocked in June" — the sub-line under a name.
 *
 * `now` is a parameter, not `Date.now()`, so a fixture route renders the same
 * characters on every run and the test can pin every branch. The relative
 * phrases stop at two weeks: past that, "a few weeks ago" would be an estimate
 * standing in for a date the row actually holds, and the standing refusal is
 * that a known figure is printed or omitted, never approximated.
 */
export function blockedWhen(iso: string, now: Date): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days < 7) return 'Blocked this week';
  if (days < 14) return 'Blocked last week';

  const month = at.toLocaleDateString('en-US', { month: 'long' });
  return at.getFullYear() === now.getFullYear()
    ? `Blocked in ${month}`
    : `Blocked in ${month} ${at.getFullYear()}`;
}

/** SF-02's question. The name is in it, and in both consequences below. */
export function unblockQuestion(name: string): string {
  return `Unblock ${name}?`;
}

/**
 * SF-02's three regular paragraphs, in the order they are read aloud.
 *
 * Audit 99 names two consequences and both are here: they can find you again,
 * and the votes they retracted while blocked do not come back. The second is
 * literally true rather than rhetorically — `20260809160000_block_retracts_votes`
 * DELETES those rows, and `useUnblockUser` only deletes the block row, so
 * nothing restores them. The third paragraph is the way back, which is what
 * keeps this sheet from reading as a warning.
 *
 * Three paragraphs, never one bolded block: the audit's specific complaint.
 */
export function unblockConsequences(name: string): readonly string[] {
  return [
    `${name} will be able to find you on Cinch again, send you a friend request, and see the looks you share with friends if you accept it.`,
    `Votes ${name} retracted while blocked are not restored, and they are not told that you unblocked them.`,
    `You can block ${name} again at any time from their profile.`,
  ];
}

/** The confirming action. Ink, never oxblood — a restoration is not a destruction. */
export const UNBLOCK_ACTION = 'Unblock them';
/** The second action, named for its outcome rather than "Cancel". */
export const KEEP_BLOCKED_ACTION = 'Keep them blocked';

/** The present-participle label a row wears while the delete is in flight. */
export const UNBLOCKING_LABEL = 'Unblocking…';

/**
 * SF-03's failure. The important state on a safety screen: it says the block is
 * still in force, that nothing changed, and that the other person was told
 * nothing — because a user who cannot tell whether a block lapsed has a real
 * problem, not a cosmetic one.
 */
export const UNBLOCK_FAILED_LINE =
  'The unblock did not go through, so nothing changed. They still cannot find you, and they were told nothing.';
/** The sub-line the failed row keeps, in place of its date. */
export const STILL_BLOCKED_LABEL = 'Still blocked';

/** SF-03's empty room. Teaches the mechanism and repeats the two facts that matter. */
export const BLOCKED_EMPTY_TITLE = 'Nobody is blocked';
export const BLOCKED_EMPTY_BODY =
  'If someone makes Cinch uncomfortable, you can block them from their profile. They are never told, and you can undo it here.';
