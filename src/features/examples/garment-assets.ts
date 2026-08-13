import type { GarmentKey } from './example-copy';

/**
 * The eleven owned garment photographs, as bundled modules.
 *
 * BUNDLED, NOT FETCHED. The handoff is explicit: "Ship the fixtures as a
 * bundled asset group, not a network fetch — examples must render offline and
 * on first launch." Both are exactly when an example is needed: an empty Today
 * is the first screen a new account sees, and it is the screen most likely to
 * be looked at on a train.
 *
 * `require` rather than a URL for the same reason, and it costs nothing at
 * runtime: Metro resolves these at build time into the JS bundle's asset list,
 * so there is no new dependency, no permission and no native change — the
 * images travel with an over-the-air update like any other asset.
 *
 * Kept apart from `example-copy.ts` so that file stays import-free and the
 * tests can read the copy without asking the node test bundler to resolve a
 * JPEG.
 *
 * ── THIS IS THE DEDICATED FIXTURE SET. SETTLED ────────────────────────────
 *
 * The handoff left "a distinct example fixture set" open as decision 1, on the
 * worry that an example photograph might collide with one of a user's own. It
 * is settled: `assets/garments` IS that set. Nothing else uses these eleven in
 * the product, no user owns them, and the collision the worry described cannot
 * happen in the direction that mattered — examples never derive from closet
 * data, so a reader's garment can never appear inside a card labelled Example.
 *
 * Which means this map is the whole of the example imagery contract. Swapping a
 * photograph is an edit to one line here and to nothing else.
 */
export const GARMENT_ASSETS: Record<GarmentKey, number> = {
  'beige-corduroy-skirt': require('@/assets/garments/beige-corduroy-skirt.jpg'),
  'beige-overshirt-jacket': require('@/assets/garments/beige-overshirt-jacket.jpg'),
  'brown-leather-boots': require('@/assets/garments/brown-leather-boots.jpg'),
  'brown-leather-crossbody-bag': require('@/assets/garments/brown-leather-crossbody-bag.jpg'),
  'brown-leather-loafers': require('@/assets/garments/brown-leather-loafers.jpg'),
  'charcoal-tailored-trousers': require('@/assets/garments/charcoal-tailored-trousers.jpg'),
  'cognac-leather-tote': require('@/assets/garments/cognac-leather-tote.jpg'),
  'cognac-shearling-coat': require('@/assets/garments/cognac-shearling-coat.jpg'),
  'cream-crochet-poncho': require('@/assets/garments/cream-crochet-poncho.jpg'),
  'cream-mohair-sweater': require('@/assets/garments/cream-mohair-sweater.jpg'),
  'white-linen-blouse': require('@/assets/garments/white-linen-blouse.jpg'),
};
