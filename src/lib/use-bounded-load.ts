import { useCallback, useEffect, useState } from 'react';

import {
  BOUNDED_TIMEOUT_MS,
  boundedState,
  isFailed,
  type BoundedState,
} from '@/lib/bounded-load';

/**
 * THE BOUNDED LOAD, AS A HOOK — the one clock behind every route's skeleton.
 *
 * `@/lib/bounded-load` holds the rule; this holds the timer that decides when
 * `expired` is true, and nothing else. It takes a react-query result already
 * reduced to three booleans rather than the query object itself, because half
 * the screens in this app compose two or three queries into one page state
 * (`useLookbook` is `plates.isLoading || boards.isLoading`) and a hook typed to
 * a single `UseQueryResult` would send them back to hand-rolling the bound.
 *
 * ── THE TIMER RESTARTS ON A RETRY, NOT ON A RENDER ────────────────────────
 *
 * `retry()` bumps an attempt counter that the effect depends on. Without it a
 * retry pressed from the timeout state would be invisible: react-query keeps
 * `isLoading` true across the refetch, the effect never re-runs, and the
 * screen stays on the timeout it was already showing while a perfectly healthy
 * request runs behind it. The counter is the only reason the button does
 * anything the reader can see.
 *
 * ── NOTHING IS CANCELLED ──────────────────────────────────────────────────
 *
 * A timeout here is a statement about the wait, not an abort. The query is
 * untouched and still in flight; if it lands a second later the state falls
 * straight through to `content` and the page fills in. Cancelling would turn a
 * slow read into a failed one, which is the opposite of honest.
 */
export type BoundedLoadOptions = {
  /** Nothing to draw yet. `isLoading`/`isPending`, never `isFetching`. */
  loading: boolean;
  /** The read failed. */
  error: boolean;
  /** Settled and empty. Only consulted once the other two are false. */
  empty?: boolean;
  /** A refetch is in flight — the retry button reads "Trying…". */
  retrying?: boolean;
  /** Wired to the query's `refetch`. Without it the failing states dead-end. */
  onRetry?: () => void;
  /** Override for a screen with a genuinely different budget. Rarely needed. */
  timeoutMs?: number;
};

export type BoundedLoad = {
  state: BoundedState;
  /** `error` or `timeout` — the two states that owe a retry and a way back. */
  failed: boolean;
  /** The bound fired. Switches the error copy; see `boundedErrorCopy`. */
  timedOut: boolean;
  /** Restarts the read AND the clock. Safe to pass straight to `onRetry`. */
  retry: () => void;
  retrying: boolean;
};

export function useBoundedLoad({
  loading,
  error,
  empty = false,
  retrying = false,
  onRetry,
  timeoutMs = BOUNDED_TIMEOUT_MS,
}: BoundedLoadOptions): BoundedLoad {
  const waiting = loading && !error;

  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /**
   * Retiring a stale expiry belongs to RENDER, not to an Effect.
   *
   * This is React's own "adjusting state when a prop changes" pattern, the one
   * `components/media/garment-image.tsx` already uses to retire a previous
   * picture's verdict: the moment the wait ends, the expiry from that wait is
   * cleared in the SAME commit rather than one commit later, so a read that
   * lands never paints one frame of "this is taking a while" on its way to the
   * content. Doing it in an Effect would also be a synchronous setState in an
   * effect body, which is a cascading render and a lint error besides.
   */
  const [wasWaiting, setWasWaiting] = useState(waiting);
  if (wasWaiting !== waiting) {
    setWasWaiting(waiting);
    if (expired) setExpired(false);
  }

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setExpired(true), timeoutMs);
    return () => clearTimeout(timer);
    // `attempt` is the retry's restart. See the docblock.
  }, [waiting, timeoutMs, attempt]);

  const retry = useCallback(() => {
    setExpired(false);
    setAttempt((n) => n + 1);
    onRetry?.();
  }, [onRetry]);

  const state = boundedState({ loading, error, empty, expired });

  return { state, failed: isFailed(state), timedOut: state === 'timeout', retry, retrying };
}
