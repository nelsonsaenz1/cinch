import { useEffect, useState } from 'react';

/**
 * "This has been loading too long to still be called loading."
 *
 * ── Why a screen needs this at all ───────────────────────────────────────
 *
 * A skeleton is a promise that something is about to arrive. `session.ts`
 * spells out the failure that breaks the promise: a Supabase auth call can pend
 * forever rather than reject, React Query only retries on *rejection*, so
 * `isLoading` stays true and the shimmer runs until the app is force-quit. The
 * closet fixed that at the source, with a deadline that rejects inside its own
 * query.
 *
 * Plan cannot do the same thing, because the queries it waits on are not its
 * own. `useWardrobe` (features/styling) still opens with the unbounded
 * `getUserId()`, and the subscription read belongs to features/billing. Fixing
 * those at the source is right and is somebody else's file; leaving the Plan
 * tab shimmering until the user force-quits in the meantime is not.
 *
 * So this is the same contract enforced one layer out, at the point of
 * rendering: after `ms`, the screen stops claiming the data is coming and draws
 * an error with a retry instead. It cannot cancel the pending read — nothing
 * can — but it converts "forever" into "an honest state with a way out", which
 * is the whole of what the skeleton owed the user.
 *
 * Returns false whenever `loading` is false, and resets on every fresh load, so
 * a retry that starts a new read gets a full window of its own.
 */
export function useStalled(loading: boolean, ms: number): boolean {
  /**
   * Only ever set from the timer, never synchronously from the effect body —
   * the React Compiler rejects the latter, and it would be a cascading render
   * on every load anyway. The reset lives in the cleanup, which runs exactly
   * when a load ends, and `loading &&` below makes the value meaningless
   * outside a load regardless of when that reset lands.
   */
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;

    const timer = setTimeout(() => setTimedOut(true), ms);
    return () => {
      clearTimeout(timer);
      setTimedOut(false);
    };
  }, [loading, ms]);

  return loading && timedOut;
}

/**
 * Generous on purpose. Every read behind it normally resolves in well under a
 * second; this is only the line past which "loading" has stopped being true,
 * not a performance budget.
 */
export const STALL_DEADLINE_MS = 10_000;
