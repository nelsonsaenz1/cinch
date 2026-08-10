/**
 * Whether the first-run tour runs at all, and how it walks.
 *
 * The whole of the atlas's "how it behaves" section that can be decided
 * without a screen lives here, in a `.ts`, so it can be tested: the once-ever
 * predicate, the three-frame limit, where Skip appears, and which of the two
 * real exits the last frame offers.
 */

import { PLANS } from '@/features/billing/plans';
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

/** The three routes the tour is allowed to hand off to. */
export type TourDestination = '/the-ten' | '/capture' | '/(tabs)';

/**
 * Which route an exit actually lands on.
 *
 * THE CAMERA EXIT GOES TO THE TEN. Founder decision D1
 * (docs/design/positioning-contract.md §5): The Ten is the default first run.
 * Until this, `/the-ten` had no entrance at all — the only production route to
 * it was the Reveal's own repair loop, a closed circle — and the guided ten is
 * the whole of the product's wedge. "Start with the camera" now means the ten
 * named positions rather than a bare camera pointed at an empty closet.
 *
 * THE ESCAPE STAYS AN ESCAPE. "I'll look around first" and Skip still land on
 * `(tabs)`, untouched. A first run with only one door is not an onboarding, it
 * is a gate, and TR-03 offers two ways out on purpose. What that reader loses
 * is only the guided order; the ten pieces are still the free closet and every
 * empty state in the app still counts toward them.
 *
 * WHY THE CLOSET SIZE IS AN ARGUMENT. `toured_at` was added on 2026-08-10, so
 * for one cohort "has never been toured" and "has never used the app" are not
 * the same account — an established user with a real wardrobe sees the tour
 * once, and sending her into a screen titled The Ten that opens on a stop
 * sheet reading "That's the ten" would be a straightforwardly false statement
 * about a closet of sixty pieces. At or above the free closet's own size the
 * guided ten has nothing left to ask for, so the button does exactly what it
 * says and opens the camera.
 *
 * `null` means the read has not landed. It falls to The Ten deliberately: the
 * overwhelmingly likely untoured account is a brand-new one, that account is
 * the entire point of this wave, and The Ten resumes from whatever is already
 * in the closet if the guess was wrong.
 */
export function exitDestination(exit: TourExit, closetSize: number | null): TourDestination {
  if (exit === 'tabs') return '/(tabs)';
  if (closetSize !== null && closetSize >= PLANS.free.items) return '/capture';
  return '/the-ten';
}
