import { Asset } from 'expo-asset';

import type { DiaryEntry, DiaryPiece } from './types';

/**
 * Frozen fixture data for the Wave 3 Group 4 diary frames (WD-01, WD-02,
 * WD-03).
 *
 * ── DETERMINISM IS THE CONTRACT ───────────────────────────────────────────
 *
 * Every value here is a literal. No `new Date()`, no `Date.now()`, no
 * `Math.random()`, no network read, no clock — in this module or in the routes
 * that consume it. The diary is the most date-heavy surface in the wave, so
 * this matters here more than anywhere: a frame whose weekday, month header or
 * "hours left" figure changes overnight cannot be diffed, and a frame that
 * cannot be diffed is not evidence that anything shipped.
 *
 * Timestamps are written LOCAL-NAIVE (`2026-08-06T09:41:00`, no `Z`), which
 * `new Date` parses in the device's own zone. That is deliberate: every
 * selector in `entry.ts` reads dates in local time because a diary is a
 * calendar, and a `Z` instant would render as Wednesday on one machine and
 * Thursday on another.
 *
 * ── THE DATES ARE REAL, THE ATLAS'S ARE NOT ───────────────────────────────
 *
 * The atlas draws THU 7, WED 6, TUE 5, SUN 3 and WED 30 in August 2026. None
 * of those weekday/date pairs is true of 2026 — a mock's calendar is drawn, not
 * computed. The running app computes, so these are the real August 2026 days
 * with the same shape: Thu 6, Wed 5, Tue 4, Sun 2, and Thu 30 July.
 *
 * ── THE PHOTOGRAPHS ARE THE REPO'S OWN LICENSED SET ───────────────────────
 *
 * `assets/garments/*` — provenance per file in `assets/garments/MANIFEST.md`.
 * Nothing is fetched and no new image dependency is introduced. Two garments
 * the atlas names are NOT in that set — the navy merino crewneck and the black
 * jeans — and they are posed WITHOUT an image on purpose: WD-01's own
 * annotation is that "a described piece shows its silhouette at the same 56 pt
 * scale, so a words-only closet reads the same way", which makes the silhouette
 * the state under test rather than a shortfall.
 */

const PHOTO = {
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri,
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri,
  boots: Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri,
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri,
  overshirt: Asset.fromModule(require('@/assets/garments/beige-overshirt-jacket.jpg')).uri,
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri,
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri,
  poncho: Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')).uri,
  loafers: Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri,
} as const;

/**
 * The instant every WD frame is read against.
 *
 * 19:41 on Thursday 6 August, ten hours after that day's wear was recorded —
 * which is what makes WD-02 print "14 hours left" as a computed figure rather
 * than a transcribed one.
 */
export const WD_NOW = new Date('2026-08-06T19:41:00');

function piece(
  id: string,
  kind: string,
  colorName: string,
  brand: string | null,
  wearCount: number,
  purchasePrice: number | null,
  photo: string | null,
): DiaryPiece {
  return {
    id,
    kind,
    category: 'other',
    colorName,
    brand,
    wearCount,
    purchasePrice,
    imagePaths: [photo],
  };
}

// The priced five. Their arithmetic is the point: 348 + 298 + 210 + 124 + 90 =
// $1,070 of spend over 96 + 130 + 84 + 110 + 80 = 500 wears, which is $2.14 a
// wear — the atlas's own figure, arrived at by division rather than typed.
const COAT = piece('coat', 'shearling coat', 'cognac', 'Toteme', 96, 348, PHOTO.coat);
const TROUSERS = piece('trousers', 'tailored trousers', 'charcoal', 'The Row', 130, 298, PHOTO.trousers);
const BOOTS = piece('boots', 'leather boots', 'brown', null, 84, 210, PHOTO.boots);
const TOTE = piece('tote', 'leather tote', 'cognac', null, 110, 124, PHOTO.tote);
const OVERSHIRT = piece('overshirt', 'overshirt jacket', 'beige', null, 80, 90, PHOTO.overshirt);

// The unpriced. `items.purchase_price` is nullable and usually null, so these
// are the ordinary case, not the exception — and every look they are in loses
// its cost line entirely rather than printing a partial figure.
const BLOUSE = piece('blouse', 'Italian linen blouse', 'white', null, 7, null, PHOTO.blouse);
const SKIRT = piece('skirt', 'corduroy skirt', 'beige', null, 31, null, PHOTO.skirt);
const PONCHO = piece('poncho', 'crochet poncho', 'cream', null, 12, null, PHOTO.poncho);
const LOAFERS = piece('loafers', 'penny loafers', 'chestnut', null, 44, null, PHOTO.loafers);
// No photograph: described in words, so the row draws the silhouette.
const CREWNECK = piece('crewneck', 'merino crewneck', 'navy', null, 5, null, null);
const JEANS = piece('jeans', 'straight jeans', 'black', null, 22, null, null);

function entry(
  id: string,
  wornAt: string,
  pieces: DiaryPiece[],
  extras: Partial<DiaryEntry> = {},
): DiaryEntry {
  return {
    id,
    wornAt,
    name: null,
    occasion: null,
    note: null,
    savedAt: null,
    originOutfitId: null,
    source: 'ai',
    weather: null,
    pieces,
    ...extras,
  };
}

/**
 * WD-02's day, and WD-01's first row.
 *
 * The name is the longest realistic one in the set and is what audit 77 is
 * about: at 56pt of well and 44pt of date column it wraps to a second line
 * rather than ellipsising. The weather comes from `context_snapshot`, which
 * this wear has because it was confirmed from Today's plate.
 */
export const WD_TODAY = entry(
  'wd-g4-thu',
  '2026-08-06T09:41:00',
  [COAT, TROUSERS, BOOTS, TOTE, OVERSHIRT],
  {
    name: 'Quiet authority with the cognac shearling coat',
    occasion: 'Dinner at Nora’s',
    weather: {
      feelsLikeC: 22,
      highC: 26,
      lowC: 14,
      precipitationChance: 0.05,
      windKph: 9,
      swing: false,
    },
  },
);

/** Worn on its own — the wear-count case, and no price anywhere in it. */
export const WD_BLOUSE_DAY = entry('wd-g4-wed', '2026-08-05T08:10:00', [BLOUSE], {
  name: 'White Italian linen blouse, sleeves rolled',
});

/** Described in words: both pieces draw the silhouette at the same scale. */
export const WD_CREWNECK_DAY = entry('wd-g4-tue', '2026-08-04T08:02:00', [CREWNECK, JEANS], {
  name: 'Navy merino crewneck, described in words',
});

export const WD_SUNDAY = entry('wd-g4-sun', '2026-08-02T11:20:00', [SKIRT, PONCHO, LOAFERS], {
  name: 'Corduroy skirt and the cream crochet poncho',
});

/** The month boundary — July, so WD-01 draws two month headers. */
export const WD_JULY = entry('wd-g4-jul', '2026-07-30T07:55:00', [BOOTS, TROUSERS, COAT, TOTE], {
  name: 'Leather boots with the tailored trousers',
});

/**
 * WD-03's planned day — Saturday 8 August 2026, two days ahead of `WD_NOW`.
 *
 * Local noon, the `fromIsoDate` convention the real read uses, and no
 * photograph on either piece so the plan is legible on a described closet too.
 */
export const WD_PLANNED = entry('wd-g4-sat', '2026-08-08T12:00:00', [OVERSHIRT, JEANS], {
  planned: true,
  name: 'the overcoat with the black jeans',
});

export const WD_ENTRIES: DiaryEntry[] = [
  WD_TODAY,
  WD_BLOUSE_DAY,
  WD_CREWNECK_DAY,
  WD_SUNDAY,
  WD_JULY,
];

/** Every image path in the fixture resolves to itself — these are already URIs. */
export const resolveFixtureImage = (p: DiaryPiece): string | undefined =>
  p.imagePaths.find((path): path is string => typeof path === 'string' && path.length > 0);
