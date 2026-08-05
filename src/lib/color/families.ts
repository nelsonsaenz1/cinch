/**
 * Hue families, wardrobe-neutral detection, and colour-name resolution.
 *
 * Two ideas here that generic colour-theory code gets wrong for clothing:
 *
 * 1. NEUTRALITY IS NOT "CHROMA NEAR ZERO". In a wardrobe, navy, olive, camel,
 *    charcoal, cream and chocolate all *behave* as neutrals — they anchor an
 *    outfit and go with nearly anything — despite carrying real chroma. Treat
 *    them as saturated colours and the engine will refuse to pair navy with
 *    olive, which is one of the most reliable combinations in menswear. So
 *    neutrality is a 0..1 scalar, not a boolean, and it is boosted for the
 *    specific low-chroma/low-value regions where wardrobe neutrals live.
 *
 * 2. THE MODEL RETURNS NAMES, NOT HEX. `tag-schema.ts` deliberately excludes
 *    hex, because vision models are unreliable at naming exact values but very
 *    reliable at "navy". Hex comes from on-device pixel sampling of the cutout.
 *    Until that lands (and as a permanent fallback when sampling fails), names
 *    resolve through the table below.
 */

import { deltaE, hexToOklch, type Oklch } from './oklch';

export type HueFamily =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'neutral';

/**
 * Hue band centres in OKLCH degrees. These are NOT the RGB-wheel positions —
 * OKLCH redistributes hue to match perception, so yellow sits near 110 rather
 * than 60 and blue near 264 rather than 240.
 */
const FAMILY_BANDS: { family: Exclude<HueFamily, 'neutral'>; from: number; to: number }[] = [
  { family: 'red', from: 15, to: 40 },
  { family: 'orange', from: 40, to: 80 },
  { family: 'yellow', from: 80, to: 130 },
  { family: 'green', from: 130, to: 175 },
  { family: 'teal', from: 175, to: 230 },
  { family: 'blue', from: 230, to: 290 },
  { family: 'purple', from: 290, to: 335 },
  { family: 'pink', from: 335, to: 375 }, // wraps past 360
];

/**
 * How much this colour behaves like a neutral, 0..1.
 *
 * 1.0  — true achromatic: black, white, grey.
 * ~0.8 — navy, charcoal, chocolate, deep olive. Dark and unsaturated enough to
 *        read as structural rather than as "a colour".
 * ~0.6 — camel, beige, cream, stone. Light, warm, low chroma.
 * 0.0  — anything vivid.
 */
export function neutrality({ L, C, h }: Oklch): number {
  // True achromatic. Below ~0.03 chroma nothing reads as coloured.
  if (C < 0.03) return 1;

  // Base falloff: neutrality decays as chroma rises, gone by C ~= 0.16.
  let n = Math.max(0, 1 - C / 0.16);

  // Dark colours read as neutral at much higher chroma than light ones do. A
  // navy at C=0.09 is a neutral; a sky blue at C=0.09 is a colour. Darkness
  // suppresses the perception of chroma, so the tolerance widens as L falls —
  // this is what makes navy, charcoal, forest and espresso behave like the
  // wardrobe neutrals they are rather than like colours.
  if (L < 0.45) {
    const denom = 0.16 + (0.45 - L) * 0.2;
    n = Math.max(n, Math.max(0, 1 - C / denom));
  }

  // Earth-tone corridor: warm hues (orange through yellow-green) at moderate
  // chroma are camel/tan/olive/khaki territory and function as neutrals.
  const warmEarth = h >= 45 && h <= 145;
  if (warmEarth && C < 0.11) n = Math.max(n, 0.65 + (1 - C / 0.11) * 0.25);

  return Math.min(1, n);
}

export function hueFamily(c: Oklch): HueFamily {
  if (neutrality(c) > 0.7) return 'neutral';
  const h = c.h;
  for (const band of FAMILY_BANDS) {
    const hi = band.to > 360 ? band.to - 360 : band.to;
    const wraps = band.to > 360;
    if (wraps ? h >= band.from || h < hi : h >= band.from && h < band.to) return band.family;
  }
  return 'red';
}

/** Metallics behave as accents that pair with anything — track them separately. */
const METALLIC = /\b(gold|silver|bronze|copper|gunmetal|pewter|rose gold|brass|chrome)\b/i;
export const isMetallicName = (name: string) => METALLIC.test(name);

/**
 * Garment colour names -> representative hex.
 *
 * Chosen to match how the word is used on a clothing label rather than its CSS
 * definition, which matters more often than you would think. CSS `green` is a
 * vivid mid-green; a green jacket is almost always olive or forest. CSS `purple`
 * is electric; a purple sweater is usually aubergine.
 */
const NAMED: Record<string, string> = {
  // Achromatic
  black: '#111111',
  charcoal: '#36393d',
  'dark grey': '#4a4d52',
  'dark gray': '#4a4d52',
  grey: '#8b8f94',
  gray: '#8b8f94',
  'light grey': '#c3c6ca',
  'light gray': '#c3c6ca',
  silver: '#c9ccd1',
  white: '#f7f7f5',
  'off white': '#f0ede6',
  'off-white': '#f0ede6',
  ivory: '#efe9dc',
  cream: '#efe6d2',
  ecru: '#e3dac6',
  bone: '#e6e0d4',

  // Blues
  navy: '#1f2a44',
  'navy blue': '#1f2a44',
  midnight: '#151d33',
  indigo: '#2b3a67',
  denim: '#3f5d80',
  'light wash': '#8aa6c0',
  'medium wash': '#5c7fa3',
  'dark wash': '#2f4459',
  blue: '#2f5fa8',
  'royal blue': '#2a4fc4',
  cobalt: '#2549b8',
  'sky blue': '#8ec3e8',
  'baby blue': '#adcfe8',
  'powder blue': '#bdd4e3',
  'light blue': '#9fc4e0',
  cornflower: '#6b8fd4',
  slate: '#5a6b7d',
  'slate blue': '#57688a',
  steel: '#6c7c8c',

  // Teals / cyans
  teal: '#1f6f6b',
  turquoise: '#3aa9a2',
  aqua: '#77c9c4',
  cyan: '#4dbcc9',
  petrol: '#1d5560',

  // Greens
  green: '#3f7a4a',
  olive: '#6a6b3d',
  'olive green': '#6a6b3d',
  khaki: '#9a9060',
  'forest green': '#2c4f38',
  forest: '#2c4f38',
  hunter: '#2b4a3a',
  emerald: '#1f8a5c',
  sage: '#9aa88e',
  mint: '#a8d6bb',
  'lime green': '#8fbe45',
  lime: '#8fbe45',
  moss: '#5c6b45',
  'army green': '#585f43',

  // Yellows / golds
  yellow: '#e3c23c',
  mustard: '#c9a227',
  gold: '#c9a227',
  butter: '#f0dfa0',
  lemon: '#eddc63',
  ochre: '#bb8f34',

  // Oranges / browns
  orange: '#d97230',
  rust: '#a8502c',
  terracotta: '#b96a4c',
  burnt: '#a55a2e',
  'burnt orange': '#b35c22',
  peach: '#f0b79a',
  apricot: '#e8a677',
  coral: '#e5735c',
  brown: '#6b4a34',
  chocolate: '#4a3225',
  espresso: '#3b2a20',
  tan: '#b99567',
  camel: '#b58f5f',
  beige: '#d6c4a8',
  sand: '#d9c9a8',
  stone: '#c9bfae',
  taupe: '#9a8b7c',
  caramel: '#a9743f',
  cognac: '#8e5525',
  bronze: '#8c6239',
  copper: '#a3603a',

  // Reds
  red: '#b8332f',
  crimson: '#a5203a',
  burgundy: '#5e2233',
  maroon: '#5c2029',
  wine: '#5a2334',
  brick: '#9c4437',
  cherry: '#a8253c',
  scarlet: '#c02b28',

  // Pinks
  pink: '#e493ac',
  'hot pink': '#e0479a',
  blush: '#e8c0bd',
  rose: '#c97b8b',
  fuchsia: '#cf3a8e',
  magenta: '#c22b7d',
  mauve: '#a37f92',
  salmon: '#e9927c',

  // Purples
  purple: '#6b4a8a',
  lavender: '#b7a6d4',
  lilac: '#c1b0d9',
  violet: '#7a52a8',
  plum: '#5f3350',
  aubergine: '#42263c',
  eggplant: '#42263c',
};

/** Multi-word names first, so "light blue" wins over "blue". */
const NAMED_KEYS = Object.keys(NAMED).sort((a, b) => b.length - a.length);

/**
 * Resolve a free-text colour name to OKLCH.
 *
 * Substring matching is deliberate: the model returns things like "washed
 * indigo" or "heather grey" that no exact table will ever cover, but which
 * contain the anchor word.
 */
export function resolveColorName(name: string): Oklch | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;

  const direct = NAMED[lower];
  if (direct) return hexToOklch(direct);

  for (const key of NAMED_KEYS) {
    if (lower.includes(key)) {
      const base = hexToOklch(NAMED[key]!);
      if (!base) continue;
      // Honour modifiers the table cannot enumerate. Lightness moves are
      // perceptually meaningful in OKLCH, so this is a legitimate shortcut.
      if (/\b(light|pale|pastel|washed|faded)\b/.test(lower)) {
        return { ...base, L: Math.min(0.95, base.L + 0.16), C: base.C * 0.7 };
      }
      if (/\b(dark|deep)\b/.test(lower)) {
        return { ...base, L: Math.max(0.12, base.L - 0.14), C: base.C * 0.9 };
      }
      if (/\b(bright|vivid|neon|electric)\b/.test(lower)) {
        return { ...base, C: Math.min(0.34, base.C * 1.5) };
      }
      if (/\b(muted|dusty|heather|marled|washed out)\b/.test(lower)) {
        return { ...base, C: base.C * 0.55 };
      }
      return base;
    }
  }
  return null;
}

/**
 * The table above, pre-converted, minus the metallics. Built once on first use:
 * the reverse lookup runs a few times per imported garment and re-parsing 130
 * hex strings each time is pure waste during a 60-photo import.
 */
let namedOklch: { name: string; value: Oklch }[] | null = null;

function namedTable() {
  if (namedOklch) return namedOklch;
  namedOklch = [];
  for (const [name, hex] of Object.entries(NAMED)) {
    // Metallics are excluded on purpose. Pixels cannot tell bronze from brown
    // or silver from light grey — the difference is specular behaviour, not
    // colour — and `isMetallicName` feeds a real scoring rule, so a name
    // guessed from a sample would make ordinary brown boots pair like jewellery.
    if (isMetallicName(name)) continue;
    const value = hexToOklch(hex);
    if (value) namedOklch.push({ name, value });
  }
  return namedOklch;
}

/**
 * The reverse of `resolveColorName`: a measured hex to the nearest wardrobe name.
 *
 * Needed because colour now arrives from two directions. The tagger supplies
 * names without values; on-device pixel sampling supplies values without names.
 * Both have to end up in the same `colors` column, and a swatch with no name is
 * unspeakable — the review deck, the stylist and every empty state say "navy
 * blazer", not "#1f2a44 blazer".
 *
 * Nearest in OKLab, so "nearest" means what a person would say it means. Ties go
 * to whichever name is listed first in the table, which is why the curated
 * spellings ("grey", "olive green") appear above their aliases.
 */
export function nearestColorName(hex: string): string | null {
  const target = hexToOklch(hex);
  if (!target) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const entry of namedTable()) {
    const distance = deltaE(target, entry.value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.name;
    }
  }
  return best;
}

/**
 * A garment colour as the engine consumes it.
 * `weight` is the share of the garment this colour covers (primary vs trim).
 */
export type GarmentColor = {
  oklch: Oklch;
  name: string;
  family: HueFamily;
  neutrality: number;
  metallic: boolean;
  weight: number;
};

/**
 * Build engine colours from whatever the item row happens to carry.
 *
 * Colours arrive as `[{hex?, name}]`. Hex wins when present (sampled from real
 * pixels); otherwise the name is resolved. Anything unresolvable is dropped
 * rather than defaulted — a wrong colour is far more damaging to a
 * recommendation than a missing one, because it will confidently pair things
 * that clash.
 */
export function toGarmentColors(
  raw: { hex?: string | null; name?: string | null }[] | null | undefined,
): GarmentColor[] {
  if (!raw?.length) return [];

  const out: GarmentColor[] = [];
  for (const entry of raw) {
    const name = entry.name?.trim() ?? '';
    const oklch = (entry.hex ? hexToOklch(entry.hex) : null) ?? resolveColorName(name);
    if (!oklch) continue;

    out.push({
      oklch,
      name,
      family: hueFamily(oklch),
      neutrality: neutrality(oklch),
      metallic: isMetallicName(name),
      weight: 0, // assigned below
    });
  }

  // First colour listed is the dominant one; later colours are trim. Decaying
  // weights beat equal weights because a navy blazer with a white pocket square
  // must score as "navy", not as "navy-and-white".
  const decay = out.map((_, i) => 1 / (i + 1) ** 1.6);
  const total = decay.reduce((a, b) => a + b, 0);
  out.forEach((c, i) => {
    c.weight = decay[i]! / total;
  });

  return out;
}
