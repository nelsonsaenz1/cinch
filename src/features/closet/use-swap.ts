import { useMemo } from 'react';

import { useWardrobe } from '@/features/styling/queries';

import { pieceName } from './item-name';
import { kindOfSlot, tallyOf, type CountedKind, type Tally } from './outfit-count';
import { useCloset } from './queries';
import { rankSwapCandidates, type RankedSwapCandidate } from './swap';
import { useOutfitMembership } from './use-outfit-membership';
import { useSignedUrls } from './use-image-urls';

export type SwapPiece = {
  id: string;
  name: string;
  imageUri?: string;
};

export type SwapModel = {
  loading: boolean;
  error: boolean;
  tally: Tally;
  candidates: RankedSwapCandidate<SwapPiece>[];
};

/**
 * The Wall's W-04 and the Gap Feed's G-04 "swap instead" — every storable
 * piece, least-worn first, each carrying the honest recount for storing IT
 * specifically to make room for `add`.
 *
 * `useWardrobe` (not `useCloset`) supplies the `Garment.slot` that
 * `kindOfSlot` reads — the same source `use-gap-feed.ts` uses, so a top never
 * counts differently between the two screens. Wear counts, names and images
 * come off `useCloset`'s `Item[]`, joined by id.
 */
export function useSwap(add: CountedKind): SwapModel {
  const wardrobe = useWardrobe();
  const closet = useCloset();

  const garments = wardrobe.data ?? [];
  const items = closet.data ?? [];
  const tally = useMemo(() => tallyOf(garments), [garments]);

  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.listingPath, i.platePath, i.cutoutPath, i.thumbPath]),
  );
  const membership = useOutfitMembership(items.map((i) => i.id));

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const candidates = useMemo(() => {
    const raw = garments.map((g) => {
      const item = itemsById.get(g.id);
      return {
        id: g.id,
        kind: kindOfSlot(g.slot),
        wearCount: item?.wearCount ?? g.wearCount,
        outfitCount: membership.data?.[g.id] ?? 0,
        piece: {
          id: g.id,
          name: item ? pieceName(item) : 'Untitled piece',
          imageUri: item
            ? resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath)
            : undefined,
        },
      };
    });
    return rankSwapCandidates(tally, add, raw);
  }, [garments, itemsById, membership.data, resolve, tally, add]);

  return {
    loading: wardrobe.isLoading || closet.isLoading,
    error: wardrobe.isError || closet.isError,
    tally,
    candidates,
  };
}
