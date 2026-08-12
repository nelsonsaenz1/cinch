/**
 * Pure Event Comments arithmetic — the composer's character rule and the
 * reply-indent heuristic — held against the Event Comments State Atlas
 * (EC-01…EC-04, renumbered in code from the atlas's own M-01…M-04 to avoid
 * the collision with the already-shipped Match & Confirm atlas; see
 * `docs/design/event-social-contract.md` §5).
 *
 * ── Why replies are inferred, not stored ──────────────────────────────────
 * `event_comments` (see `@/features/social/db-rows`) has no parent/reply
 * column — `id, event_id, post_id, user_id, body, reported, hidden,
 * created_at` is the whole row. Adding one is a migration on a live,
 * three-unit-shared database, which is exactly the kind of shared-layer
 * change the redesign rules ask this unit not to make unilaterally. So a
 * reply is a client convention instead: the composer prepends "@Name " to
 * the body when a reply target is set (`replyPrefix`), and a row that begins
 * with an "@name" token renders one indent level in with that mention
 * highlighted (`isReplyBody`). It reads identically to the atlas's M-01 —
 * "Mel `@Dana` tote it is." at one indent — without a schema change.
 */

export const COMMENT_MAX = 300;
/** The counter is silent until this length — "counted only past 240". */
const COUNT_FROM = 240;

/** "25 / 300" once past 240 characters; `null` while there's nothing to count. */
export function counterLabel(body: string): string | null {
  if (body.length <= COUNT_FROM) return null;
  return `${body.length} / ${COMMENT_MAX}`;
}

/** A reply row: one leading "@Token" with nothing glued to it. */
const MENTION = /^@(\S+)\s?/;

export function isReplyBody(body: string): boolean {
  return MENTION.test(body);
}

/** The mentioned token ("Dana" from "@Dana tote it is."), or null. */
export function mentionOf(body: string): string | null {
  return body.match(MENTION)?.[1] ?? null;
}

/** Splits a reply body into its leading "@Name" and the rest, for styling. */
export function splitMention(body: string): { mention: string; rest: string } | null {
  const m = body.match(MENTION);
  if (!m) return null;
  return { mention: `@${m[1]}`, rest: body.slice(m[0].length) };
}

/**
 * The masthead's privacy scope — audit 94, "the privacy scope is in the
 * masthead rather than a footnote".
 *
 * A constant rather than a function of the member count. The count was there
 * before ("Only the 6 people at this event can read this") and it is a small
 * leak in the same family the group's other privacy rules close: a comment
 * thread that prints the roster size tells an invitee how many people were
 * asked, which is one arithmetic step from how many said no. Audit 92's rule
 * for the same group is "nobody is ever named as not going, not responded or
 * declined"; a headcount is the coarse version of the same disclosure.
 *
 * "Only the invited" is also simply what is true: the read policy is
 * `is_event_member(event_id)` (migration 20260807102000), which is membership,
 * not attendance.
 */
export const audienceScopeLine = 'only the invited can read this';

/** "7 comments" — `null` at zero, where the thread's empty state speaks instead. */
export function commentCountLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 comment' : `${count} comments`;
}

/**
 * Correction 25's closed-thread notice — the version that is TRUE TODAY.
 *
 * The atlas draws "nothing new can be added". Dependency A records that this
 * is only true once the server refuses inserts past `starts_at`, and it does
 * not: `event_comments` has no `comments_closed` column, no `closes_at`, and
 * its insert policy is `auth.uid() = user_id and is_event_member(event_id) and
 * not hidden and not reported` with no time predicate anywhere (migration
 * 20260807102000, lines 126–130). Closure today is CLIENT-SIDE ONLY.
 *
 * So this string says what the client actually does — it stops offering the
 * composer — and stops short of asserting a server rule. The composer is still
 * REMOVED rather than disabled, which is the part of correction 25 that is
 * separable and correct either way: a disabled field invites a draft, and a
 * draft that cannot be sent is a draft that gets lost.
 *
 * When dependency A lands, the honest ending is "nothing new can be added",
 * and this is the one line that has to change.
 */
export const CLOSED_THREAD_TITLE = 'Comments are closed';
export function closedThreadLine(startLabel: string | null): string {
  const cause = startLabel
    ? `The occasion started at ${startLabel}, so the thread closed.`
    : 'The occasion has started, so the thread closed.';
  return `${cause} Everything said stays readable to the people who were invited.`;
}

/** "@Dana agreed, that's the one" — what the composer sends for a reply. */
export function withReplyPrefix(body: string, replyToFirstName: string | null): string {
  if (!replyToFirstName) return body;
  return `@${replyToFirstName} ${body}`;
}
