import { Asset } from 'expo-asset';

import type { GapPiece } from '@/features/closet/use-gap-feed';
import { gainFrom, type Gain, type Tally } from '@/features/closet/outfit-count';
import type { ShopMatch } from '@/features/commerce/use-shop-match';

/**
 * The canonical closet and catalogue behind the five GF fixtures.
 *
 * DETERMINISM: every value here is a literal or is computed from one by
 * `outfit-count.ts`. No clock, no network, no random source, no spinner and no
 * shimmer, so each frame reproduces its own bytes on every run.
 *
 * ── WHY THIS CLOSET AND NOT THE ATLAS'S ────────────────────────────────────
 *
 * The atlas draws "You own 4 tops that work with trousers and only 1 pair. A
 * second pair would give you 7 more outfit cores … taking you from 14 to 21."
 * Those four numbers cannot coexist. A core is
 * `tops × bottoms × shoes + dresses × shoes`, so the gain from one more bottom
 * is exactly `tops × shoes` — with 4 tops that is 4, 8, 12 or 16, never 7. And
 * no assignment with 4 tops and 1 bottom produces a base of 14 that rises to
 * 21. The drawn card is a hand-written illustration, not an evaluation.
 *
 * So the fixture carries a closet whose numbers are real: SEVEN tops, TWO
 * bottoms, ONE pair of shoes, no dresses.
 *
 *     cores now  = 7 × 2 × 1            = 14
 *     one more bottom  = 7 × 3 × 1      = 21     (gain 7)
 *
 * — the atlas's own 14 → 21 → "7 more outfit cores", produced by
 * `countOutfits()` rather than typed beside it. That is the whole of audit 85:
 * the card's arithmetic is the app's arithmetic, and a fixture that copied the
 * drawn figures would have proved the opposite.
 */

const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const SWEATER = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;
const OVERSHIRT = Asset.fromModule(require('@/assets/garments/beige-overshirt-jacket.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const SKIRT = Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri;

/** Seven tops, two bottoms, one pair of shoes. 14 cores. */
export const FIXTURE_TALLY: Tally = { tops: 7, bottoms: 2, dresses: 0, shoes: 1 };

/** The leading gap: a third bottom — 14 → 21. */
export const BOTTOM_GAP: Gain = gainFrom(FIXTURE_TALLY, 'bottoms');

/** The runner-up, so a second card on the frame is a real second card. */
export const SHOE_GAP: Gain = gainFrom(FIXTURE_TALLY, 'shoes');

/** Three real, owned tops waiting for a partner, plus the four beyond them. */
export const WAITING_TOPS: { shown: GapPiece[]; more: number } = {
  shown: [
    { id: 'top-1', name: 'Cream mohair jumper', imageUri: SWEATER },
    { id: 'top-2', name: 'White linen blouse', imageUri: BLOUSE },
    { id: 'top-3', name: 'Beige overshirt jacket', imageUri: OVERSHIRT },
  ],
  more: 4,
};

/**
 * Two merchant matches — ONE joined, ONE direct.
 *
 * The split is the point of the fixture: `paid: true` on Everlane and
 * `paid: false` on Uniqlo is what makes GF-02 a per-row disclosure frame
 * rather than a picture of a tray. `paid` is never inferred from the link's
 * shape here either — these are literal values standing in for the edge
 * function's `commerce_joined_programmes` lookup.
 */
export const JOINED_MATCH: ShopMatch = {
  id: 'everlane-wide-leg-twill',
  title: 'Wide-leg twill',
  brand: 'Everlane',
  colour: 'charcoal',
  priceCents: 8_800,
  currency: 'USD',
  imageUrl: TROUSERS,
  merchantName: 'Everlane',
  url: 'https://example.invalid/everlane',
  paid: true,
};

export const DIRECT_MATCH: ShopMatch = {
  id: 'uniqlo-pleated-trouser',
  title: 'Pleated trouser',
  brand: 'Uniqlo',
  colour: 'navy',
  priceCents: 4_900,
  currency: 'USD',
  imageUrl: SKIRT,
  merchantName: 'Uniqlo',
  url: 'https://example.invalid/uniqlo',
  paid: false,
};

export const FIXTURE_MATCHES: readonly ShopMatch[] = [JOINED_MATCH, DIRECT_MATCH];

/**
 * A third joined match, so redesign 26's "three paid, the cap" frame is a real
 * three rows rather than two rows and an argument. `MAX_ROWS` is 3 and
 * `MAX_MERCHANTS` is 3 on the server; a fixture with four would be drawing a
 * state the policy cannot produce.
 */
export const SECOND_JOINED_MATCH: ShopMatch = {
  id: 'cos-cotton-poplin',
  title: 'Cotton-poplin trouser',
  brand: 'COS',
  colour: 'stone',
  priceCents: 9_900,
  currency: 'USD',
  imageUrl: OVERSHIRT,
  merchantName: 'COS',
  url: 'https://example.invalid/cos',
  paid: true,
};

/**
 * A match whose price the catalogue does not carry.
 *
 * `priceCents: null` is the real shape — the row prints the merchant alone and
 * never a placeholder, a dash or a zero. The frame for this state is
 * `merchant-row-price-unknown-omitted`.
 */
export const PRICELESS_MATCH: ShopMatch = {
  ...DIRECT_MATCH,
  id: 'uniqlo-no-price',
  priceCents: null,
  currency: null,
};

/** The GF-03 product sheet's own product — always exactly one merchant. */
export const SHEET_PRODUCT: ShopMatch = {
  ...JOINED_MATCH,
  title: 'The Wide-Leg Twill Trouser',
};

/** Standard's active ceiling, which is the one GF-04 draws. */
export const ACTIVE_LIMIT = 150;
