/**
 * What a refused write MEANS. Not what to say about it.
 *
 * This file is separate from `mutations.ts` for one reason: the mapping from a
 * Postgres failure to a product meaning is a pure function over an error
 * object, it is the part most worth testing, and it is the part most likely to
 * be got wrong quietly. Nothing here imports React, react-native or Supabase,
 * and nothing here contains a sentence. The copy module owns the words; this
 * owns the classification, and the two are separable precisely because the
 * classification is a closed set.
 *
 * ── THE ONE MAPPING THAT MUST NOT BE REFINED ──────────────────────────────
 *
 * `not_mutual` covers BOTH "you have blocked each other" and "you are no
 * longer mutual friends", and they are deliberately indistinguishable. They
 * arrive as the same SQLSTATE from the same policy on purpose:
 * `blocked_between` and `not is_friend` sit in one `with check` and one
 * trigger branch, and a block already severs both follow edges permanently, so
 * a blocked pair are not mutual friends either. Telling the two apart here
 * would let the interface say "blocked" — which discloses that a block exists,
 * to the person it was made against, which is exactly what PC-10 avoids by
 * saying only "No longer a mutual friend". There is no branch below that could
 * separate them, and adding one is a privacy regression rather than an
 * improvement.
 *
 * ── AND THE ONE THAT IS NOT A FAILURE ─────────────────────────────────────
 *
 * `22023` is `assert_circle_member_transition` refusing a move — accept an
 * invitation that was already withdrawn, leave a group you were already
 * removed from, remove somebody who left a moment ago. Every one of those
 * means the screen is showing a state the row has already left, so the answer
 * is a refetch and a redraw, not an error. `circleFailureIsSilent` is what
 * says so.
 */

/**
 * The closed set of things that can go wrong, and what each one means.
 *
 * A discriminated union rather than a string so a `switch` over it is
 * exhaustive: a new failure kind does not compile until every consumer has
 * decided what to do about it.
 */
export type CircleFailure =
  /** `enforce_circle_size`: twelve seats, `invited` and `joined` together. */
  | { kind: 'group_full' }
  /** Blocked, or no longer mutual friends. One meaning, on purpose — see above. */
  | { kind: 'not_mutual' }
  /** `assert_social_terms`. The existing terms sheet, not a second path. */
  | { kind: 'terms_required' }
  /** The row already moved. Refetch and redraw; say nothing. */
  | { kind: 'stale' }
  /** `enforce_social_rate_limits`: 100 invitations a day, per inviter. */
  | { kind: 'rate_limited' }
  /** `assert_clean_ugc` on the group's name. */
  | { kind: 'blocked_text' }
  /** The only other check constraint on either table: 1 to 60 characters. */
  | { kind: 'invalid_name' }
  /** Anything else, including the network never answering. */
  | { kind: 'unknown' };

export type CircleFailureKind = CircleFailure['kind'];

/**
 * The message `assert_social_terms` raises, matched rather than parsed — the
 * message is the contract, and 20260808101000:59-61 says so in as many words.
 * Matched BEFORE the SQLSTATE, because the terms gate raises 42501 too and
 * "agree to the terms" must not be delivered as "no longer a mutual friend".
 */
const TERMS_REQUIRED = 'social_terms_required';

/**
 * The hint `enforce_circle_size` attaches. The sentinel is the `circle_full:`
 * message prefix; the hint is checked as well because it is the more stable of
 * the two and `tests/private-circles-client.test.ts` reads both back out of
 * the migration.
 */
const FULL_MESSAGE = 'circle_full';
const FULL_HINT = 'This group is full.';

/** `assert_clean_ugc`'s check violation, distinguished from the seat cap's. */
const UNCLEAN_TEXT = 'not allowed here';

/**
 * The transition trigger's own 42501, which is a client bug rather than an
 * eligibility answer: the primary key or the role was written. Nothing in
 * `mutations.ts` can produce it, and it must not be reported as ineligibility.
 */
const IMMUTABLE_COLUMN = 'only state may change';

/** As much of a PostgREST error as this file reads. Structural, so it needs no import. */
interface PgLike {
  message?: unknown;
  code?: unknown;
  hint?: unknown;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pgLike(error: unknown): PgLike {
  return error && typeof error === 'object' ? (error as PgLike) : {};
}

/**
 * A Postgres failure, as a product meaning.
 *
 * The order of the branches is the design. Message sentinels are read before
 * SQLSTATEs wherever one SQLSTATE carries two meanings — 42501 is both the
 * terms gate and every ordinary RLS refusal, 23514 is both the seat cap and
 * the text filter — and reversing either pair produces a wrong answer that
 * still looks plausible.
 */
export function classifyCircleError(error: unknown): CircleFailure {
  const pg = pgLike(error);
  const message = textOf(pg.message);
  const hint = textOf(pg.hint);
  const code = textOf(pg.code);

  // Before anything else: the gate that is not about groups at all. It raises
  // 42501, so a later branch would read it as ineligibility.
  if (message.includes(TERMS_REQUIRED)) return { kind: 'terms_required' };

  if (code === '23514') {
    if (message.includes(FULL_MESSAGE) || hint.includes(FULL_HINT)) {
      return { kind: 'group_full' };
    }
    if (message.includes(UNCLEAN_TEXT)) return { kind: 'blocked_text' };
    // `circles.name` carries the only other check constraint on either table.
    return { kind: 'invalid_name' };
  }

  if (code === '42501') {
    // A write that tried to move a primary key or a role. Unreachable from
    // this feature, and not something to tell somebody about their friend.
    if (message.includes(IMMUTABLE_COLUMN)) return { kind: 'unknown' };
    return { kind: 'not_mutual' };
  }

  // The transition trigger. The row is not where the screen thinks it is.
  if (code === '22023') return { kind: 'stale' };

  // A duplicate membership row: somebody in the picker already has a row in
  // this group (removed, left or declined), so the verb was invite when it
  // should have been ask-again. Same answer as 22023 — the view is behind.
  if (code === '23505') return { kind: 'stale' };

  if (code === '54000') return { kind: 'rate_limited' };

  return { kind: 'unknown' };
}

/**
 * Is this a failure the reader should never learn about?
 *
 * True for exactly one kind. A stale view is the interface's problem, not the
 * user's: refetch, redraw, and let them see the state that was actually true
 * all along.
 */
export function circleFailureIsSilent(failure: CircleFailure): boolean {
  return failure.kind === 'stale';
}

/**
 * Should this failure raise the existing social terms sheet?
 *
 * There is one terms path in this app and this routes into it rather than
 * beside it — `isSocialTermsError` in `features/auth/use-social-terms.ts` is
 * the other half, and both match the same sentinel.
 */
export function circleFailureNeedsTerms(failure: CircleFailure): boolean {
  return failure.kind === 'terms_required';
}
