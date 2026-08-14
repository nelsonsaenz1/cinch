import { Image } from 'react-native';

import { starterReadiness, type StarterReadiness } from '@/features/onboarding/starter-readiness';
import { emptyTen, fillSlot, type TenSlot } from '@/features/onboarding/ten-slots';
import type { Garment } from '@/lib/styling';

/**
 * DEV ONLY — fixtures behind `dev-ten` and `dev-reveal`.
 *
 * The bundled sample photographs (assets/garments — the same licensed set
 * `sample-plate.tsx` and the App Store frames use) stand in for a real closet.
 *
 * EACH FIXTURE NOW CARRIES A CLASSIFIED WARDROBE, not just filled positions.
 * The grid stopped knowing what its cells contain when the named template was
 * removed, so a fixture that only fills positions can no longer produce the
 * card, the suggestion or the readiness verdict — those all read the
 * classifier. The `slot` on each sample below is what the tagger would return
 * for that photograph, and it is the only reason these frames can be drawn
 * without a network.
 */

const uri = (mod: number) => Image.resolveAssetSource(mod).uri;

export const SAMPLE_ASSET = {
  blouse: uri(require('@/assets/garments/white-linen-blouse.jpg')),
  sweater: uri(require('@/assets/garments/cream-mohair-sweater.jpg')),
  trousers: uri(require('@/assets/garments/charcoal-tailored-trousers.jpg')),
  skirt: uri(require('@/assets/garments/beige-corduroy-skirt.jpg')),
  loafers: uri(require('@/assets/garments/brown-leather-loafers.jpg')),
  boots: uri(require('@/assets/garments/brown-leather-boots.jpg')),
  coat: uri(require('@/assets/garments/cognac-shearling-coat.jpg')),
  tote: uri(require('@/assets/garments/cognac-leather-tote.jpg')),
} as const;

type SampleKey = keyof typeof SAMPLE_ASSET;

export const SAMPLE_NAME: Record<SampleKey, string> = {
  blouse: 'White linen blouse',
  sweater: 'Cream mohair jumper',
  trousers: 'Charcoal trousers',
  skirt: 'Corduroy skirt',
  loafers: 'Brown loafers',
  boots: 'Black boots',
  coat: 'Shearling coat',
  tote: 'Cognac tote',
};

/**
 * What the classifier returns for each sample. The jumper is `mid_layer` and
 * counts as a top — `kindOfSlot` says so, `generateOutfits` agrees, and the
 * whole point of the correction is that this file does not get a second
 * opinion about it.
 */
const SAMPLE_SLOT: Record<SampleKey, Garment['slot']> = {
  blouse: 'base_top',
  sweater: 'mid_layer',
  trousers: 'bottom',
  skirt: 'bottom',
  loafers: 'footwear',
  boots: 'footwear',
  coat: 'outerwear',
  tote: 'bag',
};

export type TenFixture = {
  slots: TenSlot[];
  names: Record<number, string>;
  images: Record<number, string>;
  /** The classified closet these positions hold. */
  wardrobe: Pick<Garment, 'slot'>[];
  readiness: StarterReadiness;
};

/** Builds a fixture by filling the first N positions with the named samples. */
function fixture(keys: readonly SampleKey[]): TenFixture {
  const names: Record<number, string> = {};
  const images: Record<number, string> = {};
  let slots = emptyTen();

  keys.forEach((key, i) => {
    const id = i + 1;
    names[id] = SAMPLE_NAME[key];
    images[id] = SAMPLE_ASSET[key];
    slots = fillSlot(slots, id, `sample-${key}-${id}`);
  });

  const wardrobe = keys.map((key) => ({ slot: SAMPLE_SLOT[key] }));
  return { slots, names, images, wardrobe, readiness: starterReadiness(wardrobe) };
}

/** T-01 — nothing photographed yet. */
export function fixtureT01(): TenFixture {
  return fixture([]);
}

/** T-02 / T-03 — four filed: two tops, a bottom, a pair of shoes. */
export function fixtureT02(): TenFixture {
  return fixture(['blouse', 'sweater', 'trousers', 'loafers']);
}

/**
 * T-05 — nine filed, one position left. Deliberately NOT the old canonical
 * nine: this is a mixed closet with two coats' worth of uncounted pieces in
 * it, which is what a real one looks like.
 */
export function fixtureT05(): TenFixture {
  return fixture([
    'blouse',
    'sweater',
    'blouse',
    'trousers',
    'skirt',
    'loafers',
    'boots',
    'coat',
    'tote',
  ]);
}

/**
 * T-06 — the ten complete AND ready. Nelson's own acceptance mix in spirit:
 * four tops (one of them a jumper filed as `mid_layer`), two bottoms, two
 * pairs of shoes, a coat and a bag. Sixteen computed cores, no dress.
 */
export function fixtureT06(): TenFixture {
  return fixture([
    'blouse',
    'sweater',
    'blouse',
    'blouse',
    'trousers',
    'skirt',
    'loafers',
    'boots',
    'coat',
    'tote',
  ]);
}

/**
 * T-07 — ten filed and still not styleable. Ten pieces that never resolve to
 * a core: no footwear anywhere, so `countOutfits` is nought and the flow shows
 * the repair card rather than a reveal it has not earned.
 */
export function fixtureT07Repair(): TenFixture {
  return fixture([
    'blouse',
    'sweater',
    'blouse',
    'blouse',
    'coat',
    'coat',
    'tote',
    'tote',
    'coat',
    'tote',
  ]);
}
