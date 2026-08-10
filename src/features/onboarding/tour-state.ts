/**
 * Whether the first-run tour runs at all, and how it walks.
 *
 * The whole of the atlas's "how it behaves" section that can be decided
 * without a screen lives here, in a `.ts`, so it can be tested: the once-ever
 * predicate, the three-frame limit, where Skip appears, and which of the two
 * real exits the last frame offers.
 */

import { TOUR_FRAMES, type TourFrame, type TourFrameId } from '@/features/onboarding/tour-copy';

/**
 * "Three frames, hard limit." Asserted rather than assumed — a fourth frame
 * added to `tour-copy.ts` should fail a test, not quietly ship.
 */
export const TOUR_FRAME_COUNT = 3;

/**
 * What the caller knows about `profiles.toured_at` at the moment it asks.
 *
 * Three cases, not two, because "we have not read it yet" and "we read it and
 * there is nothing there" must not collapse into the same answer. A brand-new
 * account whose profile row has not been written yet IS `ready` with a null
 * `touredAt` — it has demonstrably never been toured. A read that failed is
 * `unavailable`, and an unavailable read never shows the tour: replaying the
 * promise to a user of six months because the network blinked is worse than a
 * new user meeting the empty states cold, which is a screen the app already
 * designs for.
 */
export type TourGate =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; touredAt: string | null };

/**
 * Once, ever, on any device.
 *
 * A server fact, deliberately — AsyncStorage would show the tour again on the
 * iPad and again after a reinstall. `onboarding_complete` is not reused: it
 * gates name capture, and overloading it would make skipping the tour look
 * like an incomplete account.
 */
export function shouldShowTour(gate: TourGate): boolean {
  return gate.status === 'ready' && gate.touredAt === null;
}

export function frameAt(index: number): TourFrame {
  const frame = TOUR_FRAMES[index];
  if (!frame) throw new Error(`No tour frame at index ${index}`);
  return frame;
}

export function indexOfFrame(id: TourFrameId): number {
  return TOUR_FRAMES.findIndex((f) => f.id === id);
}

export function isLastFrame(index: number): boolean {
  return index === TOUR_FRAMES.length - 1;
}

/** The next frame, or null when the tour is over. */
export function nextIndex(index: number): number | null {
  return isLastFrame(index) ? null : index + 1;
}

/**
 * Skip is present on every frame but the last, where the two real choices
 * replace it — so the reader is never left with only one way forward, and
 * never offered a third, quieter way out beside two honest ones.
 */
export function skipVisible(index: number): boolean {
  return frameAt(index).skippable;
}

/**
 * Where the tour lets go of the user.
 *
 * `camera` is TR-03's primary. `tabs` is everything else — Skip from either of
 * the first two frames, and "I'll look around first", which is TR-04: the
 * Today empty state, which already carries this load and which the tour has
 * just spent three frames making legible. There is no third destination and no
 * "replay the tour"; the tour is not in Settings.
 */
export type TourExit = 'camera' | 'tabs';
