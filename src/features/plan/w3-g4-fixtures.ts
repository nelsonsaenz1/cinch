import { Asset } from 'expo-asset';

import type { Garment, OutfitCandidate, WeatherContext } from '@/lib/styling';

import type { PlannedDay } from './packing';

/**
 * Frozen fixture data for the Wave 3 Group 4 plan and packing frames.
 *
 * ── DETERMINISM IS THE CONTRACT ───────────────────────────────────────────
 *
 * Every value is a literal. No `new Date()`, no `Date.now()`, no
 * `Math.random()`, no network, no clock. The plan is the second most
 * date-heavy surface in the wave after the diary, and the day row's own label
 * ("Today", "Tomorrow", "Sat 8") is computed against an INJECTED day — see
 * `dayHeadLabel` — so every route below hands it `PL_TODAY` rather than letting
 * it read the system clock and drift overnight.
 *
 * The `Date`s are built local-naive (`new Date(2026, 7, 6)`), never parsed from
 * a `Z` instant, for the same reason the diary's timestamps are: a week is a
 * calendar, and a UTC midnight renders as the previous day west of Greenwich.
 *
 * ── THE PHOTOGRAPHS ARE THE REPO'S OWN LICENSED SET ───────────────────────
 *
 * `assets/garments/*`, provenance per file in `assets/garments/MANIFEST.md`.
 * Two garments the atlas names are not in the set — the navy merino crewneck
 * and the black jeans — and they are posed WITHOUT a picture on purpose, so the
 * silhouette treatment audit 80 asks about is the state under test.
 */

const PHOTO = {
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri,
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri,
  boots: Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri,
  loafers: Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri,
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri,
  crossbody: Asset.fromModule(require('@/assets/garments/brown-leather-crossbody-bag.jpg')).uri,
  overshirt: Asset.fromModule(require('@/assets/garments/beige-overshirt-jacket.jpg')).uri,
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri,
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri,
  poncho: Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')).uri,
  mohair: Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri,
} as const;

/** The day every plan frame is read against — Thursday 6 August 2026, local. */
export const PL_TODAY = new Date(2026, 7, 6);

/** `PL_TODAY` plus `n` days, local, at midnight. */
export const plDay = (n: number): Date => new Date(2026, 7, 6 + n);

/**
 * A garment, complete enough for the layout and the reasoning and no more.
 *
 * Cast at the boundary because `Garment` carries two dozen scoring fields that
 * no frame reads — the same trick `dev-packing-memo.tsx` has used since the
 * packing wave, and for the same reason: a fixture that has to be a valid
 * scorer input is a fixture nobody maintains.
 */
export function garment(
  id: string,
  slot: Garment['slot'],
  category: string,
  subcategory: string,
  photo: string | null,
): Garment {
  return {
    id,
    slot,
    category,
    subcategory,
    colors: [],
    visualWeight: 1,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: photo,
    cutoutPath: photo,
    platePath: photo,
  } as unknown as Garment;
}

export const G = {
  coat: garment('g-coat', 'outerwear', 'outerwear', 'shearling coat', PHOTO.coat),
  overshirt: garment('g-overshirt', 'outerwear', 'outerwear', 'overshirt', PHOTO.overshirt),
  mohair: garment('g-mohair', 'mid_layer', 'top', 'mohair sweater', PHOTO.mohair),
  blouse: garment('g-blouse', 'base_top', 'top', 'linen blouse', PHOTO.blouse),
  poncho: garment('g-poncho', 'mid_layer', 'top', 'crochet poncho', PHOTO.poncho),
  // Described in words: no photograph, so the row draws the silhouette.
  crewneck: garment('g-crewneck', 'base_top', 'top', 'merino crewneck', null),
  jeans: garment('g-jeans', 'bottom', 'bottom', 'black jeans', null),
  trousers: garment('g-trousers', 'bottom', 'bottom', 'tailored trousers', PHOTO.trousers),
  skirt: garment('g-skirt', 'bottom', 'bottom', 'corduroy skirt', PHOTO.skirt),
  boots: garment('g-boots', 'footwear', 'shoes', 'leather boots', PHOTO.boots),
  loafers: garment('g-loafers', 'footwear', 'shoes', 'loafers', PHOTO.loafers),
  tote: garment('g-tote', 'bag', 'bag', 'leather tote', PHOTO.tote),
  crossbody: garment('g-crossbody', 'bag', 'bag', 'crossbody bag', PHOTO.crossbody),
} as const;

/**
 * A candidate whose `notes` are the reasoning the row prints.
 *
 * `explain` reads `notes` in a fixed key order and joins the first three, so
 * writing the notes IS writing the sentence — the frames use the real function
 * over real note keys rather than a transcribed string, which is what makes the
 * frame evidence about the app instead of about the fixture.
 */
export function candidate(items: Garment[], notes: OutfitCandidate['notes']): OutfitCandidate {
  return { items, features: {} as OutfitCandidate['features'], score: 0.8, notes, harmonies: [] };
}

const weather = (
  feelsLikeC: number,
  over: Partial<WeatherContext> = {},
): WeatherContext => ({
  feelsLikeC,
  highC: feelsLikeC + 4,
  lowC: feelsLikeC - 6,
  precipitationChance: 0,
  windKph: 8,
  swing: false,
  ...over,
});

/** Five days, each naming its outfit and its reason — PL-01's whole frame. */
export const PL_WEEK: PlannedDay[] = [
  {
    date: plDay(0),
    weather: weather(22),
    outfit: candidate(
      [G.coat, G.mohair, G.trousers, G.loafers],
      { weather: 'warm enough for a light coat', palette: 'cognac and cream, grounded by charcoal' },
    ),
  },
  {
    date: plDay(1),
    weather: weather(26),
    outfit: candidate([G.blouse, G.skirt, G.boots, G.crossbody], {
      weather: 'warm at eight, and it holds up at midnight',
      freshness: 'you have not worn this pairing since April',
    }),
  },
  {
    date: plDay(2),
    weather: weather(29),
    outfit: candidate([G.crewneck, G.jeans, G.loafers], {
      freshness: 'two pieces you have not worn together since May',
      palette: 'navy against black, kept plain',
    }),
  },
  {
    date: plDay(3),
    weather: weather(27),
    outfit: candidate([G.poncho, G.skirt, G.loafers], {
      weather: 'cool morning, warm afternoon, nothing to carry',
      proportion: 'volume up top, so the skirt stays narrow',
    }),
  },
  {
    date: plDay(4),
    weather: weather(20, { precipitationChance: 0.6 }),
    outfit: candidate([G.overshirt, G.trousers, G.boots, G.tote], {
      weather: 'rain until noon, so nothing suede',
      formality: 'dressed enough for the office either way',
    }),
  },
];

/**
 * PL-03's week: three days planned, one being planned, one that could not be
 * dressed at all, and two still to come.
 *
 * `outfit: null` is the honest "nothing planned" case — the engine found
 * nothing in the closet that works for that day's weather — and it is what
 * `DayRowUnplanned` renders.
 */
export const PL_PARTIAL_WEEK: PlannedDay[] = [
  PL_WEEK[0]!,
  PL_WEEK[1]!,
  { date: plDay(2), weather: weather(29), outfit: null },
];

/** The forecast behind `PL_WEEK`, for the masthead's own range. */
export const PL_FORECASTS: WeatherContext[] = PL_WEEK.map(
  (d) => d.weather!,
);
