import { useEffect, useRef, useState } from 'react';

import {
  ARRIVAL_FLOOR_MS,
  CASCADE_STEP_MS,
  COUNT_UP_MS,
  MAX_PLATES,
  countUpValue,
  type RevealPhase,
} from './reveal-spec';

/**
 * The Reveal's clock. Redesign 12's one deviation from "reuse what exists".
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * The cascade needs a single clock. Before this, the route owned one boolean
 * (`settled`) and everything else was a render-time consequence of it, which
 * worked while there was one plate and stops working the moment there are
 * three that have to land in order. Putting the clock inside `RevealStage`
 * would have mixed presentation with arithmetic; putting it in the route would
 * have buried a seven-state machine in a file that also does billing.
 *
 * ── WHAT IT DOES NOT OWN ────────────────────────────────────────────────────
 *
 * No arithmetic and no billing. It is handed a resolved count and a number of
 * available plates and it decides only WHEN. It cannot compute a count, cannot
 * present a placement, and cannot decide that a closet makes none — `zero`
 * arrives as an input, from the tally, and this hook only holds it.
 *
 * ── REDUCE MOTION ───────────────────────────────────────────────────────────
 *
 * `reduced` collapses counting and cascade into the settled composition after
 * one cross-fade. The FINAL COMPOSITION IS IDENTICAL by contract — same
 * number, same derivation, same plates, same exit — which is why the reduced
 * path is a shortcut through the phases rather than a different screen.
 */
export type RevealSequence = {
  phase: RevealPhase;
  /** The digit on screen. Zero while no digit may be drawn at all. */
  shownCount: number;
  /** How many plates have landed. */
  platesShown: number;
  /** True once the sequence has finished and the exit may take focus. */
  complete: boolean;
};

export function useRevealSequence({
  countReady,
  count,
  zero,
  platesAvailable,
  reduced,
}: {
  /** The tally has resolved. Until it has, no digit may be drawn. */
  countReady: boolean;
  count: number;
  zero: boolean;
  platesAvailable: number;
  reduced: boolean;
}): RevealSequence {
  const [phase, setPhase] = useState<RevealPhase>('arriving');
  const [progress, setProgress] = useState(0);
  const [platesShown, setPlatesShown] = useState(0);

  // Beat one's floor. A floor and not a delay: the wardrobe refetch runs
  // underneath it and usually finishes first.
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase((p) => (p === 'arriving' ? 'computing' : p));
    }, ARRIVAL_FLOOR_MS);
    return () => clearTimeout(t);
  }, []);

  // Computing → counting, or straight to the honest zero.
  //
  // ADJUSTED DURING RENDER, not in an effect. This is React's own "adjusting
  // state when a prop changes" pattern and it is the right one here for a
  // reason that is not merely stylistic: the tally resolving is not an
  // external system to synchronise with, it is a prop, and doing it in an
  // effect would paint one frame of `computing` AFTER the count was already
  // known. On a fast closet that frame is the whole beat, so the screen would
  // flash the words it had just stopped needing.
  //
  // The same shape the Today route uses for its shortlist key. The React
  // Compiler rejects `setState` in an effect body for exactly this case.
  if (phase === 'computing' && countReady) {
    if (zero) {
      setPhase('zero');
    } else if (reduced) {
      // Reduce Motion skips the count-up entirely: there is no interpolation
      // to watch, so the number is simply true from its first frame.
      setProgress(1);
      setPhase('settled');
    } else {
      setPhase('counting');
    }
  }

  // Zero is terminal for a closet that cannot pair — but not for one that had
  // simply not been READ yet. When pieces finish tagging under the unread-zero
  // screen (the sweep after a consent grant, or a tagger that was mid-pass),
  // the wardrobe query refreshes, the count turns real, and the sequence picks
  // up exactly where a fast closet would have: the count-up. Guarded on
  // `count > 0`, never on `!zero` — `zero` also flips false while a refetch is
  // merely in flight, and a screen that abandoned its result because the
  // reader asked it to check again would be worse than one that waited.
  if (phase === 'zero' && countReady && count > 0) {
    if (reduced) {
      setProgress(1);
      setPhase('settled');
    } else {
      setPhase('counting');
    }
  }

  // The count-up. A finite, non-looping ramp toward a value that already
  // exists — every frame is an interpolation, never a guess.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'counting') return;
    let raf = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      if (startedAt.current === null) startedAt.current = now;
      const p = Math.min(1, (now - startedAt.current) / COUNT_UP_MS);
      setProgress(p);
      if (p >= 1) {
        setPhase('settled');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  // Settled → plating. The plate reserves its space before it has anything to
  // put in it, so the page does not reflow under somebody already reading it.
  useEffect(() => {
    if (phase !== 'settled') return;
    const t = setTimeout(() => setPhase('plating'), reduced ? 0 : CASCADE_STEP_MS);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const target = Math.min(MAX_PLATES, Math.max(0, platesAvailable));
  const cascading = phase === 'plating' || phase === 'cascade';

  // Reduce Motion lands every plate at once. Adjusted during render for the
  // same reason as above — there is no animation to schedule, so scheduling
  // one and then cancelling it is just a frame of the wrong screen.
  if (cascading && reduced && target > 0 && platesShown !== target) {
    setPlatesShown(target);
    setPhase('complete');
  }

  // The cascade proper. Finite and non-looping: it walks to `target` and stops,
  // and `target` is the number of REAL outfits the engine produced, capped at
  // three — never a number of slots waiting to be filled.
  useEffect(() => {
    if (!cascading || reduced || target === 0) return;
    if (platesShown >= target) {
      const t = setTimeout(() => setPhase('complete'), CASCADE_STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setPlatesShown((n) => n + 1);
      setPhase('cascade');
    }, CASCADE_STEP_MS);
    return () => clearTimeout(t);
  }, [cascading, platesShown, target, reduced]);

  return {
    phase,
    // The digit is gated on the PHASE, not on the count: a resolved count that
    // arrives during `computing` still draws nothing, because the beat is the
    // promise that no number is being implied yet.
    shownCount:
      phase === 'counting'
        ? countUpValue(count, progress)
        : phase === 'arriving' || phase === 'computing' || phase === 'zero'
          ? 0
          : count,
    platesShown,
    complete: phase === 'complete',
  };
}
