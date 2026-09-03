import { useMemo } from 'react';

import type { WeatherContext } from '@/lib/styling';

import { buildPackingMemo, type PackingMemo } from './packing-memo';
import type { PackingResult } from './packing';
import { tripDays, vibeOf, type DayPartKey, type Trip } from './trip';

/**
 * The memo, computed on the device from the bag that is already on screen.
 *
 * ── This used to be a network call, and the removal is the feature ─────────
 *
 * `packing-brief` sent the trip, a 120-garment inventory, the style summary and
 * the packed capsule to OpenRouter, and asked a model to write the memo. It
 * checked AI consent, it spent the STYLIST's monthly allowance, and it could
 * fail four different ways — offline, consent withdrawn, allowance spent, not
 * deployed — each with its own card over a suitcase the phone had already
 * finished computing.
 *
 * None of that bought anything the app could stand behind. The forecast, the
 * closet read and the capsule are arithmetic; the prose on top was the only
 * element with no source, and it was set in the largest type. See
 * `packing-memo.ts` for the three specific reasons and for what replaced it.
 *
 * ── What this hook is now ─────────────────────────────────────────────────
 *
 * A `useMemo`. It cannot fail, so there is no error state to render and no
 * retry to offer; it cannot be refused, so there is no consent branch; and it
 * costs nothing, so there is no allowance to spend. The `packing-brief` Edge
 * Function was deleted 2026-09-03 (founder: finish it if needed — it was not;
 * the memo is the feature). Packing's Pro lock is therefore CLIENT-ONLY
 * (`use-packing-access.ts`): there is no longer a server call to refuse. `null` means the inputs are
 * not ready yet — no trip, or the capsule still building — which is the only
 * state left and is what K-04's fourth research line already draws.
 *
 * THE SHAPE IS KEPT ON PURPOSE. `packing-trip.tsx` reads `data`, `isPending`
 * and `isSuccess`; keeping those names means the screen did not have to be
 * rewritten to prove the memo no longer needs a server, and a diff that touches
 * one file is a diff whose behaviour can be reasoned about.
 */

/** Unchanged field for field from the old server response — see the header. */
export type PackingBrief = PackingMemo;

export function usePackingBrief({
  trip,
  forecasts,
  weatherSource,
  packing,
  requestedLooks,
}: {
  trip: Trip | null;
  /** The destination forecast, or the seasonal normals standing in for it. */
  forecasts: WeatherContext[] | undefined;
  /** Which of the two the numbers came from. The memo prints the difference. */
  weatherSource: 'forecast' | 'normals';
  /** `buildPackingList`'s result, once the capsule exists. */
  packing: PackingResult | null | undefined;
  /** How many looks were asked for, so a shortfall can be named honestly. */
  requestedLooks: number;
}) {
  const data = useMemo<PackingBrief | null>(() => {
    if (!trip || !packing) return null;
    return buildPackingMemo({
      vibes: trip.vibes.map((v) => {
        const vibe = vibeOf(v);
        return { label: vibe.label, formality: vibe.formality };
      }),
      parts: trip.parts as readonly DayPartKey[],
      days: tripDays(trip),
      forecasts,
      weatherSource,
      packing,
      requestedLooks,
    });
  }, [trip, forecasts, weatherSource, packing, requestedLooks]);

  return {
    data,
    /** True only while the capsule is still being built. */
    isPending: data === null,
    isSuccess: data !== null,
    /** Both permanently false: a pure function has no failure mode. */
    isError: false as const,
    error: null,
    isRefetching: false as const,
    /** Nothing to refetch. Kept so the screen's prop shape is unchanged. */
    refetch: () => {},
  };
}
