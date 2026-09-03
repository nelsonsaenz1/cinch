/**
 * ONE BOUNDED LOADING CONTRACT — the state machine, with no React in it.
 *
 * The audit's finding, restated: "Event and social-detail loading states can
 * occupy an entire route for several seconds with no progress or timeout
 * signal… Saved Looks and Wear Diary can remain in skeleton states long enough
 * to look like an unfinished page." Every one of those screens already had an
 * error branch and an empty branch. What none of them had was an END to the
 * skeleton: a query that never settles — a request hung behind a captive
 * portal, a signed-URL round trip that never returns, a device that woke with
 * no route to the host — leaves react-query in `isLoading` forever, and a
 * screen that is honestly still loading looks exactly like a screen that is
 * broken. There is no way to tell them apart, and no way out of either.
 *
 * So the skeleton gets a clock. After `BOUNDED_TIMEOUT_MS` of continuous
 * waiting the route stops drawing placeholders and says so, with the same
 * retry the error branch offers and the same way back the header already
 * carries. Nothing is cancelled — the query keeps going, and if it lands the
 * screen fills in — the change is only that the reader is told, and given
 * something to do.
 *
 * ── WHY THE ORDER OF THE BRANCHES IS WHAT IT IS ────────────────────────────
 *
 * `error` outranks `loading`, because react-query is both at once during a
 * retry (`isError` stays true while `isRefetching` runs) and the honest thing
 * to draw then is the failure that has already happened, with its button
 * saying "Trying…", rather than a fresh skeleton that hides it.
 *
 * `empty` is LAST and is only ever reached once the read has settled without
 * failing. This is `EmptyState`'s own rule — "an empty state makes a claim
 * about the data: there is nothing here. Only render it once you know that is
 * true" — expressed as a state machine so a call site cannot get it wrong by
 * writing its branches in the wrong order.
 *
 * Pure and React-free on purpose: `tests/bounded-load.test.ts` runs it under
 * `node --test` with no renderer. `@/lib/use-bounded-load` is the hook that
 * puts a timer behind `expired` and hands the result to a screen.
 */

/**
 * The five things a route can be doing. There is no sixth, and in particular
 * there is no "loading forever": `skeleton` is bounded by construction.
 */
export type BoundedState = 'skeleton' | 'content' | 'empty' | 'error' | 'timeout';

/**
 * How long a route-level skeleton may run before it becomes a state with a way
 * out of it.
 *
 * Six seconds, which is deliberately generous: a cold closet read behind a
 * batch of signed URLs on a slow connection genuinely takes three or four, and
 * a bound that fires on the merely-slow case would replace a working screen
 * with an apology. It is short enough that nobody sits in front of an
 * unexplained page for longer than it takes to wonder whether the app is dead.
 */
export const BOUNDED_TIMEOUT_MS = 6_000;

export type BoundedInput = {
  /** The query has nothing to draw yet. `isLoading`, never `isFetching`. */
  loading: boolean;
  /** The read failed. Outranks everything else. */
  error: boolean;
  /**
   * The read settled and returned nothing. Only consulted once `loading` and
   * `error` are both false, so a call site may compute it from data that is
   * still undefined without asserting anything false.
   */
  empty?: boolean;
  /** The skeleton has been on screen past its bound. See `useBoundedLoad`. */
  expired?: boolean;
};

/** The whole contract, in five lines. */
export function boundedState({
  loading,
  error,
  empty = false,
  expired = false,
}: BoundedInput): BoundedState {
  if (error) return 'error';
  if (loading) return expired ? 'timeout' : 'skeleton';
  return empty ? 'empty' : 'content';
}

/** True for the two states that owe the reader a retry and a way back. */
export function isFailed(state: BoundedState): boolean {
  return state === 'error' || state === 'timeout';
}

/** True while the route is still drawing placeholders rather than facts. */
export function isWaiting(state: BoundedState): boolean {
  return state === 'skeleton';
}

/** Whether a wait of this length has outrun its bound. */
export function hasExpired(elapsedMs: number, timeoutMs: number = BOUNDED_TIMEOUT_MS): boolean {
  return elapsedMs >= timeoutMs;
}

/**
 * The copy an `ErrorState` takes for each failing state.
 *
 * Two shapes, because they are two different facts and a reader can act on the
 * difference. A failure is over — the request came back and it came back
 * wrong. A timeout is not: the request is still out there and may yet land,
 * which is why this one says "still" and offers to start again rather than
 * claiming anything about the connection.
 */
export type BoundedErrorCopy = {
  /** The caps oxblood lead-in, where the screen's atlas draws one. */
  kicker?: string;
  title: string;
  body: string;
  retryTitle?: string;
};

/**
 * The timeout's words. "Still loading" is the whole point: the app is not
 * claiming to have failed, only admitting how long it has been silent.
 *
 * No number in it. "Six seconds" would be a fact about this constant rather
 * than about the reader's connection, and it would have to be corrected in
 * copy every time the bound moved.
 */
export const BOUNDED_TIMEOUT_COPY: BoundedErrorCopy = {
  kicker: 'Still loading',
  title: 'This is taking a while',
  body: 'Cinch is still waiting to hear back. Nothing has moved and nothing was lost — start the read again, or go back and come to it later.',
  retryTitle: 'Try again',
};

/**
 * Which copy a failing state takes. `own` is the screen's own error wording —
 * the board's "Couldn’t read this board", the export page's "Couldn’t read
 * your exports" — kept for the `error` case, where it is true, and replaced
 * wholesale on `timeout`, where it is not.
 *
 * Returns null for the three non-failing states so a call site cannot render
 * an error over content by forgetting a branch.
 */
export function boundedErrorCopy(
  state: BoundedState,
  own?: BoundedErrorCopy,
): BoundedErrorCopy | null {
  if (state === 'timeout') return BOUNDED_TIMEOUT_COPY;
  if (state === 'error') return own ?? null;
  return null;
}
