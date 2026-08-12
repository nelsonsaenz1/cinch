import { Asset } from 'expo-asset';

import type { Item } from '@/schemas/item';

/**
 * Frozen fixture data for the Wave 3 Group 3 canonical routes.
 *
 * ── DETERMINISM IS THE CONTRACT ───────────────────────────────────────────
 *
 * Every value here is a literal. There is no `new Date()`, no `Date.now()`, no
 * `Math.random()`, no network read and no clock anywhere in this module or in
 * the routes that consume it. A fixture whose bytes change between two captures
 * cannot be diffed, which makes it worthless as evidence that a frame shipped.
 *
 * `lastWornAt` is a fixed ISO instant and every screen that formats it receives
 * the FORMATTED string from the route rather than computing "6 days ago" off
 * the system clock — see each route's own note.
 *
 * ── THE PHOTOGRAPHS ARE THE REPO'S OWN LICENSED SET ───────────────────────
 *
 * `assets/garments/*` — Unsplash / Pexels / Pixabay, commercial use, no
 * attribution required, provenance recorded per file in
 * `assets/garments/MANIFEST.md`. Nothing is fetched, nothing is generated, and
 * no new image dependency is introduced. The garments the atlas names happen to
 * be almost exactly the ones the manifest holds (mohair sweater, tailored
 * trousers, linen blouse, leather boots, shearling coat, corduroy skirt), which
 * is why the frames can be posed with real photography at all.
 *
 * Where a frame names a garment the licensed set does not hold — C-08's navy
 * wool sweater, black straight jeans, white leather trainers and camel
 * overcoat, and IT-02's camel overcoat — the piece is posed WITHOUT an image,
 * which is not a shortfall: those frames exist to draw the silhouette
 * treatment, so the shipping silhouette fallback is the state under test.
 */

export const PHOTO = {
  mohair: Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri,
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri,
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri,
  boots: Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri,
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri,
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri,
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri,
  poncho: Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')).uri,
  crossbody: Asset.fromModule(require('@/assets/garments/brown-leather-crossbody-bag.jpg')).uri,
} as const;

/** A fixed instant, so no fixture ever reads the system clock. */
export const FROZEN_NOW = '2026-07-04T09:41:00.000Z';

const BASE: Omit<Item, 'id' | 'category' | 'subcategory' | 'colors'> = {
  userId: '00000000-0000-4000-8000-000000000000',
  imagePath: null,
  cutoutPath: null,
  platePath: null,
  thumbPath: null,
  listingPath: null,
  status: 'tagged',
  pattern: null,
  material: null,
  brand: null,
  formalityScore: null,
  warmthScore: null,
  waterResistant: false,
  seasons: [],
  occasions: [],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 0,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: true,
  createdAt: FROZEN_NOW,
};

let seq = 0;
/** Deterministic ids — a counter, never a uuid generator. */
function nextId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

export function piece(over: Partial<Item> & Pick<Item, 'category'>): Item {
  return {
    ...BASE,
    id: nextId(),
    subcategory: null,
    colors: [],
    ...over,
  };
}

/**
 * C-01's four cards, with the atlas's own figures.
 *
 * The blouse carries a wear count and NO price, which is the frame's own proof
 * for audit 63: "the price half simply drops for the blouse, whose purchase
 * price is unknown."
 */
export const C01_PIECES: Item[] = [
  piece({
    category: 'top',
    subcategory: 'Mohair sweater',
    // The fixture stores the asset URI in `thumbPath`; the routes' resolver
    // hands it straight back, so no signing round trip and no network.
    thumbPath: PHOTO.mohair,
    colors: [{ name: 'Cream', hex: '#E8E0D2' }],
    wearCount: 14,
    purchasePrice: 90.02,
    lastWornAt: FROZEN_NOW,
  }),
  piece({
    category: 'bottom',
    subcategory: 'Tailored trousers',
    // The fixture stores the asset URI in `thumbPath`; the routes' resolver
    // hands it straight back, so no signing round trip and no network.
    thumbPath: PHOTO.trousers,
    colors: [{ name: 'Charcoal', hex: '#3A3833' }],
    wearCount: 31,
    purchasePrice: 98.89,
    lastWornAt: FROZEN_NOW,
  }),
  piece({
    category: 'top',
    subcategory: 'Linen blouse',
    // The fixture stores the asset URI in `thumbPath`; the routes' resolver
    // hands it straight back, so no signing round trip and no network.
    thumbPath: PHOTO.blouse,
    colors: [{ name: 'White', hex: '#F4F1EA' }],
    wearCount: 6,
    purchasePrice: null,
    lastWornAt: FROZEN_NOW,
  }),
  piece({
    category: 'footwear',
    subcategory: 'Leather boots',
    // The fixture stores the asset URI in `thumbPath`; the routes' resolver
    // hands it straight back, so no signing round trip and no network.
    thumbPath: PHOTO.boots,
    colors: [{ name: 'Brown', hex: '#5A4230' }],
    wearCount: 22,
    purchasePrice: 265.1,
    lastWornAt: FROZEN_NOW,
  }),
];

/**
 * C-02's matched set — the two pieces the frame draws under "wool".
 *
 * The figures are the frame's: the mohair sweater's line is the same one C-01
 * prints for it, and the poncho's `$29.66 a wear` is 88.98 over three wears.
 */
export const C02_MATCHES: Item[] = [
  piece({
    category: 'top',
    subcategory: 'Mohair sweater',
    thumbPath: PHOTO.mohair,
    colors: [{ name: 'Cream', hex: '#E8E0D2' }],
    wearCount: 14,
    purchasePrice: 90.02,
    lastWornAt: FROZEN_NOW,
  }),
  piece({
    category: 'top',
    subcategory: 'Crochet poncho',
    thumbPath: PHOTO.poncho,
    colors: [{ name: 'Cream', hex: '#E9E1D1' }],
    wearCount: 3,
    purchasePrice: 88.98,
    lastWornAt: FROZEN_NOW,
  }),
];

/** C-03's grid — the rail scrolled to its end, Accessories held. */
export const C03_ACCESSORIES: Item[] = [
  piece({
    category: 'bag',
    subcategory: 'Leather tote',
    thumbPath: PHOTO.tote,
    colors: [{ name: 'Cognac', hex: '#A9683A' }],
    wearCount: 58,
    purchasePrice: 240.12,
    lastWornAt: FROZEN_NOW,
  }),
  piece({
    category: 'bag',
    subcategory: 'Crossbody bag',
    thumbPath: PHOTO.crossbody,
    colors: [{ name: 'Brown', hex: '#6B4A32' }],
    wearCount: 9,
    purchasePrice: 119.97,
    lastWornAt: FROZEN_NOW,
  }),
];

/**
 * C-07's two stored pieces.
 *
 * `isArchived` is true because that is what stored MEANS in this database, and
 * a fixture whose rows contradict the query that produces them is a fixture of
 * a state the app cannot reach. The storing DATE the frame prints is absent
 * from every row here for the same reason it is absent from the screen: no
 * column records it (see `storedMetaLine`).
 */
export const C07_STORED: Item[] = [
  piece({
    category: 'bottom',
    subcategory: 'Corduroy skirt',
    thumbPath: PHOTO.skirt,
    colors: [{ name: 'Beige', hex: '#C9B394' }],
    wearCount: 7,
    isArchived: true,
  }),
  piece({
    category: 'top',
    subcategory: 'Crochet poncho',
    thumbPath: PHOTO.poncho,
    colors: [{ name: 'Cream', hex: '#E9E1D1' }],
    wearCount: 3,
    isArchived: true,
  }),
];

/**
 * C-08 — a closet built entirely through Describe.
 *
 * No photographs at all, on purpose: this is the frame that proves an
 * unphotographed piece "reads as filed, not as missing". The camel overcoat has
 * never been worn, which is where "Never worn" is printed as words.
 */
export const C08_PIECES: Item[] = [
  piece({
    category: 'top',
    subcategory: 'Navy wool sweater',
    colors: [{ name: 'Navy', hex: '#2A3244' }],
    wearCount: 4,
    purchasePrice: null,
  }),
  piece({
    category: 'bottom',
    subcategory: 'Black straight jeans',
    colors: [{ name: 'Black', hex: '#1F1E1C' }],
    wearCount: 19,
    purchasePrice: 79.99,
  }),
  piece({
    category: 'footwear',
    subcategory: 'White leather trainers',
    colors: [{ name: 'White', hex: '#EFEDE7' }],
    wearCount: 26,
    purchasePrice: 94.9,
  }),
  piece({
    category: 'outerwear',
    subcategory: 'Camel overcoat',
    colors: [{ name: 'Camel', hex: '#B79A72' }],
    wearCount: 0,
    purchasePrice: null,
  }),
];
