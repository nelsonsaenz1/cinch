/**
 * What a refused write MEANS. Not what to say about it.
 *
 * Separate from `mutations.ts` for one reason: the mapping from a Postgres
 * failure to a product meaning is a pure function over an error object, it is
 * the part most worth testing, and it is the part most likely to be got wrong
 * quietly. Nothing here imports React, react-native or Supabase, and nothing
 * here contains a sentence. The copy module owns the words; this owns the
 * classification, and the two are separable precisely because the classification
 * is a closed set. Same split, same reason, as `features/circles/errors.ts`.
 *
 * ── THE ONE THAT IS NOT A FAILURE AT ALL ──────────────────────────────────
 *
 * `23505` is the unique constraint `saved_looks_once`, and it is the DUPLICATE
 * SAVE — OS-02c, a drawn state with its own toast and its own haptic. It arrives
 * here as a Postgres error because that is what a refused insert is, and it must
 * never reach the reader as one: the correct response is to fetch the row that
 * already exists and offer "View".
 *
 * That is why `saved_looks_once` is a constraint and not a client-side check.
 * The interface asking "have I saved this?" before writing is a race with itself
 * across two devices; the constraint is the answer, and this is where the answer
 * is read.
 *
 * ── AND THE ONE THAT MEANS SOMEBODY ELSE CHANGED THEIR MIND ───────────────
 *
 * `42501` on an INSERT is `saved_looks: owner can insert a source they can see`
 * refusing a source the caller cannot currently see. Almost always that is a
 * look which expired or was un-shared between the screen being drawn and the tap
 * landing — an ordinary decision by another person, not a fault, and not
 * something to apologise for in the language of errors. `no_access` is its own
 * kind so the interface can say so beside the control rather than in a banner.
 *
 * The SAME SQLSTATE on an UPDATE is `assert_saved_look_immutable`, which is a
 * client bug: nothing in `mutations.ts` writes a snapshot column or repoints a
 * source, so reaching it means a caller was built that should not exist. It maps
 * to `unknown` rather than to `no_access`, because telling somebody their friend
 * stopped sharing when in fact this app tried to rewrite a row is worse than
 * saying nothing useful at all.
 */

/**
 * The closed set of things that can go wrong, and what each one means.
 *
 * A discriminated union rather than a string so a `switch` over it is
 * exhaustive: a new failure kind does not compile until every consumer has
 * decided what to do about it.
 */
export type SavedFailure =
  /** `saved_looks_once`. Not an error — OS-02c's drawn state. */
  | { kind: 'duplicate' }
  /** The insert policy: the source is not currently visible to the caller. */
  | { kind: 'no_access' }
  /** A note over 500, or a collection name that is empty once trimmed. */
  | { kind: 'invalid_input' }
  /** The row moved or went. Refetch and redraw; say nothing. */
  | { kind: 'stale' }
  /** Anything else, including the network never answering. */
  | { kind: 'unknown' };

export type SavedFailureKind = SavedFailure['kind'];

/**
 * The immutability trigger's own message, matched rather than parsed — the
 * message is the contract, the same way 20260808101000:59-61 says it is for the
 * terms gate. Matched BEFORE the SQLSTATE, because that trigger raises 42501 too
 * and a client bug must not be delivered as "your friend stopped sharing".
 */
const IMMUTABLE = 'only the note and the collection may change';

/** As much of a PostgREST error as this file reads. Structural, so it needs no import. */
interface PgLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
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
 * The order of the branches is the design. The message sentinel is read before
 * the SQLSTATE because 42501 carries two meanings here — a refused source and a
 * refused rewrite — and reversing the pair produces a wrong answer that still
 * looks plausible.
 */
export function classifySavedError(error: unknown): SavedFailure {
  const pg = pgLike(error);
  const message = textOf(pg.message);
  const code = textOf(pg.code);

  // One save per source per person. A state, not a failure.
  if (code === '23505') return { kind: 'duplicate' };

  if (code === '42501') {
    if (message.includes(IMMUTABLE)) return { kind: 'unknown' };
    return { kind: 'no_access' };
  }

  // The length checks on `note` and on a collection's name.
  if (code === '23514') return { kind: 'invalid_input' };

  // A collection that was deleted on another device while this one still had it
  // in a picker. The row is not where the screen thinks it is.
  if (code === '23503') return { kind: 'stale' };

  return { kind: 'unknown' };
}

/**
 * Is this a failure the reader should never learn about?
 *
 * Two kinds. `stale` is the interface's problem rather than the user's — refetch,
 * redraw, and let them see the state that was actually true all along. And
 * `duplicate` is not a failure in the first place: it is OS-02c, and the caller
 * that receives it has a row to go and fetch, not an apology to make.
 */
export function savedFailureIsSilent(failure: SavedFailure): boolean {
  return failure.kind === 'stale' || failure.kind === 'duplicate';
}

/**
 * Should the surface that asked for the save print an inline refusal?
 *
 * `no_access` alone, and it belongs beside the control that was tapped rather
 * than in a banner: nothing was written, nothing is broken, and the thing that
 * changed is on somebody else's screen. §10 calls this state
 * `blocked(inline error, no write)` and the second half of that phrase is what
 * makes the first half honest.
 */
export function savedFailureIsInline(failure: SavedFailure): boolean {
  return failure.kind === 'no_access';
}
