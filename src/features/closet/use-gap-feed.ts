import { useMemo } from 'react';

import { useCapacity } from '@/features/billing/use-capacity';

import { dominantGaps, pairablePieces, type Gain, type PairablePiece } from './gap-feed';
import { countOutfits, kindOfSlot, rankGaps, tallyOf, type CountedKind, type Tally } from './outfit-count';
import { pieceName } from './item-name';
import { useCloset } from './queries';
import { useSignedUrls } from './use-image-urls';
import { useWardrobe } from '@/features/styling/queries';

/** One garment as the feed needs to show it — a name and an image, never invented. */
export type GapPiece = {
  id: string;
  name: string;
  imageUri?: string;
};

export type GapFeedModel = {
  loading: boolean;
  /** True once the wardrobe query has actually resolved — distinguishes "loading" from "empty". */
  ready: boolean;
  /** True when the wardrobe read failed outright — the screen's own ErrorState branch. */
  error: boolean;
  refetch: () => void;
  tally: Tally;
  outfitsToday: number;
  /** Every counted kind, ranked by computed gain — G-01's ordinary list. */
  ranked: Gain[];
  /** Set when one gap (or a genuine tie) swamps the rest — G-05's single card. */
  dominant: Gain[] | null;
  capacity: ReturnType<typeof useCapacity>;
  /** Real, owned pieces that would pair with a new piece of `kind`, sampled for display. */
  pairingsFor: (kind: CountedKind, limit?: number) => { shown: GapPiece[]; more: number };
};

/**
 * Everything the Gap Feed's screens need, minus how they look.
 *
 * `useWardrobe` (not `useCloset`) is the source of the tally: it is exactly
 * the shape the styling engine scores, already bucketed into the `Slot` union
 * `outfit-count.ts` reads (`kindOfSlot`), and it excludes anything not
 * `tagged`/`needs_review`/`verified` — a garment mid-upload cannot yet make an
 * outfit. `useCloset`'s `Item[]` supplies the display half only (names,
 * images), joined back to the wardrobe by id: the two queries describe the
 * same rows through two different lenses, and neither is asked to do the
 * other's job.
 */
export function useGapFeed(): GapFeedModel {
  const wardrobe = useWardrobe();
  const closet = useCloset();
  const capacity = useCapacity();

  const items = closet.data ?? [];
  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.listingPath, i.platePath, i.cutoutPath, i.thumbPath]),
  );

  const garments = wardrobe.data ?? [];
  const tally = useMemo(() => tallyOf(garments), [garments]);
  const ranked = useMemo(() => rankGaps(tally), [tally]);
  const dominant = useMemo(() => dominantGaps(ranked), [ranked]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pairable: PairablePiece<GapPiece>[] = useMemo(
    () =>
      garments.flatMap((g) => {
        const kind = kindOfSlot(g.slot);
        if (!kind) return [];
        const item = itemsById.get(g.id);
        const piece: GapPiece = {
          id: g.id,
          name: item ? pieceName(item) : 'Untitled piece',
          imageUri: item
            ? resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath)
            : undefined,
        };
        return [{ id: g.id, kind, piece }];
      }),
    [garments, itemsById, resolve],
  );

  const pairingsFor = (kind: CountedKind, limit = 3) => pairablePieces(kind, pairable, limit);

  return {
    loading: wardrobe.isLoading || closet.isLoading,
    ready: wardrobe.isSuccess,
    error: wardrobe.isError,
    refetch: () => void wardrobe.refetch(),
    tally,
    outfitsToday: countOutfits(tally),
    ranked,
    dominant,
    capacity,
    pairingsFor,
  };
}
