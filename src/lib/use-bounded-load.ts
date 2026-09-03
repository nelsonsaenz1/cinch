import { useCallback, useEffect, useState } from 'react';

import {
  BOUNDED_TIMEOUT_MS,
  boundedState,
  isFailed,
  type BoundedState,
} from '@/lib/bounded-load';

/**
 * The clock behind the bounded-load contract (`bounded-load.ts`).
 *
 * Takes booleans rather than a `UseQueryResult` because half the screens that
 * use it compose two or three queries into one page state. The bound is a
 * statement about the WAIT, never about the request: nothing here cancels a
 * read, and a read that lands after the clock has run out falls straight
 * through to `content`.
 *
 * `fetching` is the difference between a bound and half a bound: react-query
 * keeps `status: 'error'` through a retry, so `loading` is false while that
 * retry hangs. With `fetching` the clock arms for the retry too
 * (verification, UX-29), and a retry tapped during a timeout re-arms the
 * clock instead of cancelling the read still in flight (UX-33).
 */
export type BoundedLoadOptions = {
  loading: boolean;
  error: boolean;
  empty?: boolean;
  /** `isFetching` — a request is out, first read or retry. */
  fetching?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  timeoutMs?: number;
};

export type BoundedLoad = {
  state: BoundedState;
  failed: boolean;
  timedOut: boolean;
  retry: () => void;
  retrying: boolean;
};

export function useBoundedLoad({
  loading,
  error,
  empty = false,
  fetching = false,
  retrying = false,
  onRetry,
  timeoutMs = BOUNDED_TIMEOUT_MS,
}: BoundedLoadOptions): BoundedLoad {
  // A retry in flight is a wait again: the clock, not a disabled button, is
  // what bounds it.
  const retryOut = error && fetching;
  const waiting = (loading && !error) || retryOut;

  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Reset in render, not in an effect: a wait that ends (content landed, or
  // failed) must clear a stale expiry before the next frame draws it.
  const [wasWaiting, setWasWaiting] = useState(waiting);
  if (wasWaiting !== waiting) {
    setWasWaiting(waiting);
    if (expired) setExpired(false);
  }

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setExpired(true), timeoutMs);
    return () => clearTimeout(timer);
    // `attempt` is the retry's restart: without it a retry from the timeout
    // state is invisible (`waiting` never changes) and the clock never re-arms.
  }, [waiting, timeoutMs, attempt]);

  const retry = useCallback(() => {
    setExpired(false);
    setAttempt((n) => n + 1);
    // The FIRST tap on a read that is still out leaves it alone — `refetch()`
    // would cancel it and restart the wait from zero; the clock restarts
    // instead. A second tap, with the read still not back, re-issues it: by
    // then the socket is more likely dead than slow (verification, V2-6).
    if (fetching && !error && attempt === 0) return;
    onRetry?.();
  }, [onRetry, fetching, error, attempt]);

  // An error whose retry is out keeps its page (the button reads "Trying…")
  // until the clock runs out, then becomes a timeout the reader can act on.
  const state = boundedState({
    loading: loading || (retryOut && expired),
    error: error && !(retryOut && expired),
    empty,
    expired,
  });

  return {
    state,
    failed: isFailed(state),
    timedOut: state === 'timeout',
    retry,
    retrying: retrying || retryOut,
  };
}
