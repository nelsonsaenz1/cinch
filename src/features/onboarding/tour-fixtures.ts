/**
 * DEV ONLY · Redesign 20 — the poses the tour fixtures draw.
 *
 * In `features/` rather than beside the fixtures for one practical reason: a
 * fixture is often copied alone into `src/app/` to be opened in the simulator,
 * and a relative sibling import breaks the moment it moves. Reached through the
 * `@/` alias, this file works from either location.
 *
 * It holds POSES, not fakes. Every sentence, colour and measurement the
 * fixtures draw comes from `tour-copy.ts` and `tour-spec.ts` — the shipping
 * modules — so a fixture that looks right is evidence about the app rather than
 * about itself. What is invented here is only the composition a device cannot
 * be asked for on demand: the iOS text slider cannot be set from a deep link,
 * and a 667pt screen is not something the simulator will become mid-session.
 */

import {
  AX_STACK_SCALE,
  SHORT_DEVICE_HEIGHT,
  tourMeasure,
  type TourMeasure,
} from '@/features/onboarding/tour-spec';
import { TOUR_FRAMES, type TourFrameId } from '@/features/onboarding/tour-copy';

export const TOUR_POSES: readonly TourFrameId[] = TOUR_FRAMES.map((f) => f.id);

/**
 * The three compositions, forced.
 *
 * `standard` is a notched device at the default text size; `large` is what the
 * shipping screen draws above `AX_STACK_SCALE`; `short` is the 667pt SE class.
 * Each is produced by the SAME `tourMeasure` the screen calls, given the inputs
 * that reach it — never by a second table of numbers, which is how a fixture
 * comes to document a screen that does not exist.
 */
export type TourComposition = 'standard' | 'large' | 'short';

export const TOUR_COMPOSITIONS: readonly TourComposition[] = ['standard', 'large', 'short'];

/** A notched device: 393 × 852. The height is all `tourMeasure` reads. */
export const TALL_DEVICE_HEIGHT = 852;

export function composedMeasure(composition: TourComposition): TourMeasure {
  if (composition === 'large') {
    return tourMeasure({ fontScale: AX_STACK_SCALE, height: TALL_DEVICE_HEIGHT });
  }
  if (composition === 'short') {
    return tourMeasure({ fontScale: 1, height: SHORT_DEVICE_HEIGHT - 1 });
  }
  return tourMeasure({ fontScale: 1, height: TALL_DEVICE_HEIGHT });
}
