import type { Plan } from './plans';

/**
 * The decision flow of `useTrialExpiredPlacement`, with its IO injected.
 *
 * Split out of the hook the same way the analytics builders are split out of
 * their screens — a module with no React and no native import, so the node
 * suite (`tests/trial-expired-placement.test.ts`) can execute every branch
 * rather than grep the hook. The hook owns WHEN this runs (effect timing,
 * cancellation on unmount); this module owns WHAT runs, verbatim.
 */

/** Storage key for the once-per-lapse marker. See the hook for why a
 *  timestamp rather than a boolean. */
export const FIRED_KEY = 'cinch.trialExpiredFiredFor';

/** The slice of `usePlan` the decision reads, with `trialEndsAt` already
 *  reduced to its ISO string (the hook's `marker`). */
export interface TrialExpiredState {
  loading: boolean;
  trialing: boolean;
  plan: Plan;
  marker: string | null;
  /**
   * Active garments, or null while the count is unread — A75 (2026-09-11).
   * The placement never presents over an empty closet: a person with nothing
   * filed has nothing membership could open, and the one real impression this
   * gate exists for was a fourteen-day return to zero garments that met a
   * paywall on arrival. Unread is not zero — the effect re-runs when the
   * count settles, and no marker is spent in the meantime.
   */
  garments: number | null;
}

export interface TrialExpiredIo {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  /** Registers `Placement.TrialExpired` with the gate. Fire-and-forget. */
  present(): void;
  /** True once the owning effect has been cleaned up. Checked at the same two
   *  points the hook's `cancelled` flag was. */
  cancelled(): boolean;
}

/** What happened, for the tests. The hook ignores it. */
export type TrialExpiredOutcome =
  /** The guard said no: loading, trialing, not free, no trial ever, or the
   *  garment count is still unread. */
  | 'not_lapsed'
  /** Lapsed, but the closet holds nothing — no ask, and no marker spent, so
   *  the lapse is still noticed the first time a garment is in (A75). */
  | 'empty_closet'
  /** This exact lapse already fired on this device. */
  | 'already_fired'
  /** Unmounted before the marker was read back. Nothing written. */
  | 'cancelled'
  /** Marker written, then unmounted before presenting — the deliberate
   *  "better wrong": one missed interruption, never a repeated one. */
  | 'marked_only'
  | 'presented';

export async function evaluateTrialExpired(
  state: TrialExpiredState,
  io: TrialExpiredIo,
): Promise<TrialExpiredOutcome> {
  // A past `trialEndsAt` with `trialing` false is the lapse signal. A user
  // with no trial timestamp at all never lapsed (they predate trials or
  // already subscribed) and is never interrupted.
  if (state.loading || state.trialing || state.plan !== 'free' || !state.marker) {
    return 'not_lapsed';
  }
  // Nothing filed, nothing to open — see `garments` on the state. BEFORE the
  // marker read on purpose: an empty closet must not consume the lapse.
  if (state.garments === null) return 'not_lapsed';
  if (state.garments <= 0) return 'empty_closet';

  const fired = await io.getItem(FIRED_KEY);
  if (io.cancelled()) return 'cancelled';
  if (fired === state.marker) return 'already_fired';

  // Write BEFORE presenting. If the write happened after, a crash or kill
  // mid-paywall would re-interrupt on next launch — the failure mode this
  // flow exists to prevent.
  await io.setItem(FIRED_KEY, state.marker);
  if (io.cancelled()) return 'marked_only';

  io.present();
  return 'presented';
}
