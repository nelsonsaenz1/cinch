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

/** "@Dana agreed, that's the one" — what the composer sends for a reply. */
export function withReplyPrefix(body: string, replyToFirstName: string | null): string {
  if (!replyToFirstName) return body;
  return `@${replyToFirstName} ${body}`;
}
