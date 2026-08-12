import { Asset } from 'expo-asset';

import type { Board, KeptPlate } from './types';

/**
 * The plates SV-01 and SV-02 are drawn from.
 *
 * FIXED CLOCK. `SV_NOW` is a literal and every `savedAt` is a literal, so
 * "Saved in June" is the same string in September as it is today. The pages
 * take `now` as a prop for exactly this reason.
 *
 * THE PHOTOGRAPHS ARE THE REPO'S OWN LICENSED SET, resolved through
 * `expo-asset` — no network, and the same bytes on every run.
 *
 * `itemIds` IS THE PIECE COUNT and it is deliberately not the same length as
 * `imagePaths` everywhere: the three-piece plate has three of each, the
 * five-piece plate has five ids and four images, and the pictureless plate has
 * four ids with a hole in the middle. Those three shapes are what audit 98 is
 * about, and the tile can only tell them apart because both fields are here.
 */

const uri = (mod: number) => Asset.fromModule(mod).uri;

const TROUSERS = uri(require('@/assets/garments/charcoal-tailored-trousers.jpg'));
const BLOUSE = uri(require('@/assets/garments/white-linen-blouse.jpg'));
const LOAFERS = uri(require('@/assets/garments/brown-leather-loafers.jpg'));
const TOTE = uri(require('@/assets/garments/cognac-leather-tote.jpg'));
const COAT = uri(require('@/assets/garments/cognac-shearling-coat.jpg'));
const SKIRT = uri(require('@/assets/garments/beige-corduroy-skirt.jpg'));
const SWEATER = uri(require('@/assets/garments/cream-mohair-sweater.jpg'));

export const SV_NOW = new Date('2026-08-12T09:41:00');

function plate(input: {
  id: string;
  name: string;
  savedAt: string;
  wornCount: number;
  boardId?: string | null;
  /** One entry per piece. `null` means that piece has no photograph. */
  pieces: (string | null)[];
}): KeptPlate {
  return {
    id: input.id,
    name: input.name,
    occasion: null,
    savedAt: input.savedAt,
    boardId: input.boardId ?? null,
    wornCount: input.wornCount,
    itemIds: input.pieces.map((_, i) => `${input.id}-item-${i}`),
    // Four cells, always — the read path's own shape (`toKeptPlate`).
    imagePaths: [0, 1, 2, 3].map((i) => input.pieces[i] ?? null),
  };
}

/** Three pieces — the fourth cell is a sand cell carrying "3 pieces". */
export const SV_THREE = plate({
  id: 'p-linen',
  name: 'Linen and corduroy',
  savedAt: '2026-06-04T10:00:00',
  wornCount: 2,
  pieces: [BLOUSE, SKIRT, LOAFERS],
});

/** Five pieces — four are shown and the total is stated in the metadata. */
export const SV_FIVE = plate({
  id: 'p-quiet',
  name: 'Quiet authority',
  savedAt: '2026-08-01T10:00:00',
  wornCount: 1,
  boardId: 'work',
  pieces: [TROUSERS, BLOUSE, LOAFERS, TOTE, COAT],
});

/** Four pieces, one of them pictureless — a silhouette, never a blank well. */
export const SV_SILHOUETTE = plate({
  id: 'p-rainy',
  name: 'Rainy Tuesday',
  savedAt: '2026-05-19T10:00:00',
  wornCount: 0,
  pieces: [COAT, null, TROUSERS, LOAFERS],
});

/** Four pieces, four photographs — the case with nothing to resolve. */
export const SV_FOUR = plate({
  id: 'p-sunday',
  name: 'Sunday market',
  savedAt: '2026-05-02T10:00:00',
  wornCount: 4,
  pieces: [SWEATER, SKIRT, LOAFERS, TOTE],
});

export const SV_PLATES: KeptPlate[] = [SV_THREE, SV_FIVE, SV_SILHOUETTE, SV_FOUR];

const MARCH = '2026-03-04T10:00:00';

export const SV_WORK: Board = {
  id: 'work',
  name: 'Work',
  startsOn: null,
  endsOn: null,
  createdAt: MARCH,
};

export const SV_BOARDS: Board[] = [
  SV_WORK,
  { id: 'weddings', name: 'Weddings', startsOn: null, endsOn: null, createdAt: MARCH },
  { id: 'travel', name: 'Travelling light', startsOn: null, endsOn: null, createdAt: MARCH },
  { id: 'evening', name: 'Evening', startsOn: null, endsOn: null, createdAt: MARCH },
];

/** SV-02's board: five plates, one of them the five-piece case. */
export const SV_WORK_PLATES: KeptPlate[] = [
  plate({
    id: 'b-monday',
    name: 'Monday standard',
    savedAt: '2026-03-09T10:00:00',
    wornCount: 9,
    boardId: 'work',
    pieces: [TROUSERS, BLOUSE, LOAFERS],
  }),
  plate({
    id: 'b-client',
    name: 'Client day',
    savedAt: '2026-04-02T10:00:00',
    wornCount: 3,
    boardId: 'work',
    pieces: [TROUSERS, SWEATER, LOAFERS, TOTE],
  }),
  SV_FIVE,
  plate({
    id: 'b-friday',
    name: 'Friday, warmer',
    savedAt: '2026-05-08T10:00:00',
    wornCount: 0,
    boardId: 'work',
    pieces: [SKIRT, SWEATER],
  }),
  plate({
    id: 'b-travel',
    name: 'The long meeting',
    savedAt: '2026-06-21T10:00:00',
    wornCount: 1,
    boardId: 'work',
    pieces: [TROUSERS, BLOUSE, COAT, LOAFERS],
  }),
];

/** The signing step, skipped: fixtures carry display URIs already. */
export const resolveFixtureImages = (p: KeptPlate): readonly (string | undefined)[] =>
  p.imagePaths.map((path) => path ?? undefined);
