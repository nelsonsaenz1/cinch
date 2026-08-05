/**
 * Smoke test for the styling engine. Run with:
 *   npm run smoke:styling
 *
 * Not a substitute for unit tests — this exists so the colour maths and the
 * beam search can be eyeballed against combinations a person can judge by
 * reading them.
 */

import {
  hexToOklch,
  neutrality,
  pairHarmony,
  resolveColorName,
  toGarmentColors,
} from '../src/lib/color';
import { generateOutfits, explain, type Garment, type StyleContext } from '../src/lib/styling';

const pct = (n: number) => `${Math.round(n * 100)}`.padStart(3);

console.log('\n=== Colour resolution and neutrality ===\n');
for (const name of [
  'black', 'white', 'grey', 'navy', 'charcoal', 'olive', 'camel', 'beige',
  'burgundy', 'red', 'cobalt', 'mustard', 'sage', 'hot pink', 'light blue',
]) {
  const c = resolveColorName(name)!;
  console.log(
    `${name.padEnd(12)} L=${c.L.toFixed(2)} C=${c.C.toFixed(3)} h=${String(Math.round(c.h)).padStart(3)}  neutrality=${neutrality(c).toFixed(2)}`,
  );
}

console.log('\n=== Pair harmony (expected verdict in brackets) ===\n');
const pairs: [string, string, string][] = [
  ['navy', 'camel', 'good — the classic'],
  ['navy', 'rust', 'good — complementary'],
  ['black', 'white', 'good — neutral'],
  ['olive', 'camel', 'good — earth tones'],
  ['grey', 'burgundy', 'good — neutral + colour'],
  ['navy', 'black', 'BAD — near miss'],
  ['charcoal', 'navy', 'BAD — near miss'],
  ['red', 'lime green', 'BAD — discord'],
  ['mustard', 'sage', 'meh — discord zone'],
  ['cobalt', 'hot pink', 'loud — two vivid'],
  ['light blue', 'navy', 'good — monochrome w/ value gap'],
];
for (const [a, b, expected] of pairs) {
  const ca = toGarmentColors([{ name: a }])[0]!;
  const cb = toGarmentColors([{ name: b }])[0]!;
  const { score, label } = pairHarmony(ca, cb);
  console.log(
    `${(a + ' + ' + b).padEnd(24)} ${pct(score)}%  ${label.padEnd(20)} [${expected}]`,
  );
}

// ---------------------------------------------------------------------------

let seq = 0;
const g = (
  slot: Garment['slot'],
  sub: string,
  color: string,
  formality: number,
  warmth: number,
  fit: Garment['fit'] = 'regular',
  extra: Partial<Garment> = {},
): Garment => ({
  id: `i${++seq}`,
  slot,
  category: 'other',
  subcategory: sub,
  colors: toGarmentColors([{ name: color }]),
  visualWeight: { dress: 0.42, outerwear: 0.34, bottom: 0.26, base_top: 0.22, mid_layer: 0.24, footwear: 0.12, bag: 0.06, headwear: 0.05, accessory: 0.04 }[slot],
  fit,
  pattern: null,
  patternScale: 'none',
  material: null,
  brand: null,
  formality,
  warmth,
  waterResistant: false,
  seasons: [],
  occasions: [],
  wearCount: 0,
  lastWornAt: null,
  purchasePrice: null,
  thumbPath: null,
  cutoutPath: null,
    platePath: null,
  ...extra,
});

const closet: Garment[] = [
  g('base_top', 'oxford shirt', 'white', 4, 2),
  g('base_top', 't-shirt', 'white', 1, 2),
  g('base_top', 't-shirt', 'black', 2, 2),
  g('base_top', 'linen shirt', 'sage', 3, 1),
  g('base_top', 'polo', 'navy', 3, 2),
  g('mid_layer', 'merino sweater', 'camel', 3, 3),
  g('mid_layer', 'hoodie', 'grey', 1, 3, 'oversized'),
  g('mid_layer', 'cardigan', 'burgundy', 3, 3),
  g('bottom', 'selvedge jeans', 'indigo', 2, 3),
  g('bottom', 'chinos', 'stone', 3, 2),
  g('bottom', 'wool trousers', 'charcoal', 5, 3),
  g('bottom', 'wide-leg trousers', 'black', 4, 3, 'relaxed'),
  g('bottom', 'shorts', 'olive', 1, 1),
  g('outerwear', 'trench coat', 'camel', 4, 3, 'relaxed', { waterResistant: true }),
  g('outerwear', 'leather jacket', 'black', 3, 3),
  g('outerwear', 'wool overcoat', 'navy', 5, 5),
  g('footwear', 'white sneakers', 'white', 2, 2),
  g('footwear', 'suede loafers', 'brown', 4, 2, 'regular', { material: 'suede' }),
  g('footwear', 'chelsea boots', 'black', 4, 3),
  g('footwear', 'derby shoes', 'brown', 5, 2),
  g('bag', 'tote', 'canvas', 2, 1),
  g('accessory', 'wool scarf', 'burgundy', 3, 3),
];

const base: StyleContext = {
  weather: null,
  events: [],
  note: null,
  targetFormality: null,
  targetOccasion: null,
  season: null,
  colorSeason: null,
  now: Date.UTC(2026, 7, 3),
};

const show = (title: string, ctx: StyleContext) => {
  console.log(`\n=== ${title} ===\n`);
  const t0 = Date.now();
  const outfits = generateOutfits(closet, ctx, { count: 3 });
  const ms = Date.now() - t0;

  for (const o of outfits) {
    const names = o.items.map((i) => `${i.colors[0]?.name ?? '?'} ${i.subcategory}`).join(' + ');
    console.log(`  ${pct(o.score)}%  ${names}`);
    console.log(`        ${explain(o)}`);
    const f = o.features;
    console.log(
      `        palette ${pct(f.palette)} formality ${pct(f.formality)} weather ${pct(f.weather)} proportion ${pct(f.proportion)}`,
    );
  }
  console.log(`\n  (${ms}ms)`);
};

show('Warm day, 27C, no plans', {
  ...base,
  weather: { feelsLikeC: 27, highC: 29, lowC: 21, precipitationChance: 0.05, windKph: 8, swing: false },
});

show('Cold and wet, 4C, rain', {
  ...base,
  weather: { feelsLikeC: 4, highC: 7, lowC: 1, precipitationChance: 0.8, windKph: 25, swing: false },
});

show('Client dinner at 7, bar at 10 — 14C', {
  ...base,
  weather: { feelsLikeC: 14, highC: 18, lowC: 11, precipitationChance: 0.1, windKph: 10, swing: true },
  events: [
    { id: 'a', title: 'Client dinner', startsAt: 19 * 60, endsAt: 21 * 60, formality: 4, occasion: 'dinner', indoor: true },
    { id: 'b', title: 'Drinks', startsAt: 22 * 60, endsAt: 24 * 60, formality: 2, occasion: 'nightlife', indoor: true },
  ],
});

console.log(`\nCloset size: ${closet.length} items\n`);
