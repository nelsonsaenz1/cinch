import { Image } from 'react-native';

import { canonicalTen, declineSlot, fillSlot, type TenSlot } from '@/features/onboarding/ten-slots';

/**
 * DEV ONLY — fixtures behind `dev-ten` and `dev-reveal`.
 *
 * The bundled sample photographs (assets/garments — the same licensed set
 * `sample-plate.tsx` and the App Store frames use) stand in for a real
 * closet. Only real cut-outs are drawn; a slot with no matching asset in that
 * folder (the dress, above all — there is no sample dress) renders empty
 * rather than borrowing an unrelated photo, exactly as The Ten atlas's own
 * note on T-05 requires.
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

export const SAMPLE_NAME: Record<keyof typeof SAMPLE_ASSET, string> = {
  blouse: 'White linen blouse',
  sweater: 'Cream mohair jumper',
  trousers: 'Charcoal trousers',
  skirt: 'Corduroy skirt',
  loafers: 'Brown loafers',
  boots: 'Black boots',
  coat: 'Shearling coat',
  tote: 'Cognac tote',
};

/** Fill helper that also records the fixture's display name + image by slot id. */
function stock(
  slots: TenSlot[],
  slotId: number,
  key: keyof typeof SAMPLE_ASSET,
  names: Record<number, string>,
  images: Record<number, string>,
): TenSlot[] {
  names[slotId] = SAMPLE_NAME[key];
  images[slotId] = SAMPLE_ASSET[key];
  return fillSlot(slots, slotId, `sample-${key}`);
}

export type TenFixture = { slots: TenSlot[]; names: Record<number, string>; images: Record<number, string> };

/** T-01 — nothing photographed yet. */
export function fixtureT01(): TenFixture {
  return { slots: canonicalTen(), names: {}, images: {} };
}

/** T-02 / T-03 — four filled (two tops, a bottom, a pair of shoes), slot 3 next. */
export function fixtureT02(): TenFixture {
  const names: Record<number, string> = {};
  const images: Record<number, string> = {};
  let slots = canonicalTen();
  slots = stock(slots, 1, 'blouse', names, images);
  slots = stock(slots, 2, 'sweater', names, images);
  slots = stock(slots, 4, 'trousers', names, images);
  slots = stock(slots, 7, 'loafers', names, images);
  return { slots, names, images };
}

/** T-04 — six settled (three tops, two bottoms, a pair of shoes), the dress declined. */
export function fixtureT04(): TenFixture {
  const names: Record<number, string> = {};
  const images: Record<number, string> = {};
  let slots = canonicalTen();
  slots = stock(slots, 1, 'blouse', names, images);
  slots = stock(slots, 2, 'sweater', names, images);
  slots = stock(slots, 4, 'trousers', names, images);
  slots = stock(slots, 5, 'skirt', names, images);
  slots = stock(slots, 7, 'loafers', names, images);
  return { slots, names, images };
}

/**
 * T-05 — nine filled, the bag left. The dress IS one of the nine — it's on
 * the canonical list this state follows (T-06 quotes fourteen outfits, the
 * WITH-dress figure) — but there is no sample dress photograph in
 * assets/garments, so its tile is filled with no image and carries the slot
 * word until a real tagger names it, same as any freshly-captured piece
 * whose thumbnail hasn't resolved yet.
 */
export function fixtureT05(): TenFixture {
  const names: Record<number, string> = {};
  const images: Record<number, string> = {};
  let slots = canonicalTen();
  slots = stock(slots, 1, 'blouse', names, images);
  slots = stock(slots, 2, 'sweater', names, images);
  slots = stock(slots, 3, 'blouse', names, images);
  slots = stock(slots, 4, 'trousers', names, images);
  slots = stock(slots, 5, 'skirt', names, images);
  slots = fillSlot(slots, 6, 'sample-dress-no-asset'); // the dress; no bundled photo
  slots = stock(slots, 7, 'loafers', names, images);
  slots = stock(slots, 8, 'boots', names, images);
  slots = stock(slots, 9, 'coat', names, images);
  return { slots, names, images };
}

/** T-06 — the ten complete: fixtureT05 plus the bag. */
export function fixtureT06(): TenFixture {
  const nine = fixtureT05();
  const slots = fillSlot(nine.slots, 10, 'sample-tote');
  const names = { ...nine.names, 10: SAMPLE_NAME.tote };
  const images = { ...nine.images, 10: SAMPLE_ASSET.tote };
  return { slots, names, images };
}

/** T-04's own branch: the dress declined into a fourth top, for `dev-reveal`'s R-04. */
export function fixtureDressDeclinedToFourthTop(): TenFixture {
  const four = fixtureT02();
  let slots = declineSlot(four.slots, 6, { to: 'tops' });
  slots = stock(slots, 5, 'skirt', four.names, four.images);
  slots = stock(slots, 6, 'blouse', four.names, four.images);
  slots = stock(slots, 8, 'boots', four.names, four.images);
  slots = stock(slots, 9, 'coat', four.names, four.images);
  slots = stock(slots, 10, 'tote', four.names, four.images);
  return { slots, names: four.names, images: four.images };
}
