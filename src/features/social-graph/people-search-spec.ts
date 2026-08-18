/**
 * People Search — the page's decisions, as data. Redesign 09, 2026-08-17.
 *
 * The screen itself is a rendering problem and cannot be asserted on by this
 * repo's test runner (there is no React renderer here, on purpose). What CAN
 * be asserted is every decision the screen makes before it draws anything:
 * when the two invite rows are on screen, when a query is long enough to ask
 * the server about, whether a failure was the network's fault, what the
 * oxblood row says underneath its heading, and where each affordance goes.
 *
 * Those are the things the accepted frames are actually about, and they are
 * the things a later edit can quietly get wrong. So they live here, in one
 * pure module, with `tests/people-search-spec.test.ts` pinning them.
 *
 * ── THE ONE CORRECTION FROM THE FIRST DRAFT ───────────────────────────────
 *
 * Every invite affordance on this page NAVIGATES to Share (page 10). Nothing
 * copies a link inline. The first design draft had the resting row copying to
 * the clipboard and the accepted cut does not, because a page that sometimes
 * navigates and sometimes silently mutates the pasteboard from two rows that
 * look alike is a page nobody can predict. `INVITE_ROUTE` is the only
 * destination in this file for exactly that reason.
 */

import { inviteUrlForDisplay } from '@/features/invite/link';

/** Share — page 10. The single destination of every invite affordance here. */
export const INVITE_ROUTE = '/invite' as const;

/**
 * The exact visible strings, so no screen types one from memory.
 *
 * The names and handles in the frames ("Priya Raghunathan", "@priyar") are
 * design fixtures and are deliberately NOT here: they are somebody's data at
 * render time, and a copy table is the wrong place to make them look settled.
 */
export const COPY = {
  title: 'Find people',
  cancel: 'Cancel',
  searchPlaceholder: 'Search by username',

  shareHeading: 'Share your link',
  inviteHeading: 'Invite a friend',
  inviteSubtitle: 'Text, mail, or anywhere else',

  recent: 'RECENT',
  friends: 'Friends',
  add: 'Add',

  emptyHeadline: 'No one goes by that username',
  emptyBody: 'Cinch searches usernames only. Check the spelling, or send them a link.',
  emptySubtitle: 'Opens Share to send them your link',

  offline: 'OFFLINE',
  errorHeadline: 'Search couldn’t reach Cinch',
  errorBody: 'Your search wasn’t sent. Nothing was changed.',
  tryAgain: 'Try again',
  shareInstead: 'Share your link instead',
} as const;

/**
 * Two states the frames do not draw, because the fixtures never hit them, and
 * which the page still has to answer for.
 *
 * `requested` is the state this screen already had before the redesign and
 * the brief says to preserve. `you` is new: `useProfileSearch` returns the
 * caller herself flagged `isSelf` (a username field is the one place looking
 * yourself up is a reasonable thing to do), and the alternative to naming
 * that state is an Add button that can only ever fail.
 */
export const STATE_COPY = {
  requested: 'Requested',
  you: 'You',
} as const;

/**
 * The oxblood row's second line: where Share goes, and what it will hand over.
 *
 * The frame reads "Opens Share — cinch.app/priya". Both halves of that are
 * fixture: the host is `cinchstyle.com` and the handle belongs to whoever is
 * signed in. A page that showed a stranger's handle — or a domain the app
 * does not own — would be lying about the thing it is about to send.
 *
 * `null` handle is an ordinary state, not an error: a member who has not
 * claimed a username yet has no link to preview, and Share is still exactly
 * where she should be sent to get one.
 */
export function shareSubtitle(handle: string | null | undefined): string {
  if (!handle) return 'Opens Share';
  return `Opens Share — ${inviteUrlForDisplay(handle)}`;
}

/** The oxblood row on the no-results state, which names the query back. */
export function inviteHeadingFor(query: string): string {
  return `Invite ${searchTerm(query)}`;
}

/**
 * The query as the user meant it: trimmed, and without the `@` a username
 * field invites people to type. Mirrors `useProfileSearch`'s own
 * normalisation so that what the page SAYS and what it ASKED cannot drift.
 */
export function searchTerm(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

/** The shortest query worth a round trip — `useProfileSearch`'s own floor. */
export const MIN_QUERY = 2;

/** Whether the query is one the server has been asked about. */
export function isSearching(raw: string): boolean {
  return searchTerm(raw).length >= MIN_QUERY;
}

/**
 * Whether the two invite rows and the recent list are on screen.
 *
 * THE FIRST KEYSTROKE, not the second. The brief is explicit — "invite
 * affordances disappear immediately on the first typed character" — and it is
 * the right cut: the rows are an answer to "I do not know their username",
 * and somebody who has begun typing one has stopped asking that question.
 * Tying them to `isSearching` instead would leave them sitting under a
 * one-character query, which is the exact moment they read as clutter.
 *
 * Whitespace is not a character for this purpose. A field holding one space
 * is a field the user has not started.
 */
export function showsInviteRows(raw: string): boolean {
  return raw.trim().length === 0;
}

/**
 * Whether a failed search failed because the phone could not reach anything.
 *
 * There is no NetInfo in this app and no `onlineManager` — Today says so in
 * as many words — so "offline" here is an inference from the shape of the
 * failure, never a claim about the radio. `fetch` rejecting with a TypeError
 * is what a transport failure looks like from JS; a PostgREST error that came
 * back WITH an HTTP response is the server answering, and is not this.
 *
 * The consequence of getting it wrong is small and deliberately one-sided:
 * the pill is the only thing gated on this. The headline and the body copy
 * are true of any failed search — the request either did not complete or its
 * answer did not arrive, and either way nothing was written — so a
 * misclassified error still gets an honest page, just without the badge.
 */
export function isOfflineLike(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|network error|load failed|timed out|timeout/i.test(
    message,
  );
}

/**
 * The largest type at which this page still draws itself the way the frames
 * at standard size do.
 *
 * `AX_STACK_SCALE` and not a number of this page's own: three screens
 * changing composition at three thresholds is three different apps to the
 * person moving the slider. Reused verbatim from the closet/item/review
 * group for that reason.
 */
export { AX_STACK_SCALE as PEOPLE_SEARCH_STACK_SCALE } from '@/features/closet/dynamic-type';
