/**
 * "Like your closet" — the ranking behind the Explore shelf (founder order
 * 2026-09-03: garments and accessories similar in style, fashion and gender
 * to the closet the person already owns).
 *
 * ── WHAT THE SHELF USED TO KNOW ──────────────────────────────────────────
 *
 * Which KINDS the closet holds (a browse per owned slot) and its colour
 * palette. Nothing about who wears it or how formally: a closet of dresses
 * and heels was shown men's chinos ranked by colour alone.
 *
 * ── WHAT IT KNOWS NOW ────────────────────────────────────────────────────
 *
 * A `ClosetProfile`, computed ON THE DEVICE from the wardrobe the styling
 * engine already holds, never sent anywhere — the browse request is still
 * `{ action: 'browse', slot }` and nothing else (explore-spec.ts). Five
 * facts, each a fold over the closet:
 *
 *   department  women | men | unisex, inferred from garments that are coded
 *               one way in ordinary retail (a dress, a skirt, heels; a tie,
 *               boxers). Confident only when the evidence is lopsided; a
 *               mixed or small closet reads `unisex` and nothing is filtered.
 *               `profiles.gender_presentation` outranks the inference when
 *               it is set (it is nullable and nobody has set it yet).
 *   formality   the closet's mean on the tagger's 1–5 scale.
 *   pattern     the share of pieces that are not solid.
 *   materials   the fabrics the tagger named, most common first.
 *   brands      what the person already buys.
 *   palette     the first-colour names, most common first (the old signal).
 *
 * A catalogue family is then scored against that profile from the words a
 * merchant wrote — its title, category, brand and gender field — because
 * that is all a family carries. Every rule is a plain word list, bounded,
 * and wrong in the safe direction: an unknown reads as neutral, never as a
 * match, and only a CONFIDENT department mismatch removes a card outright
 * (a women's closet is not shown men's trousers). Everything else re-orders.
 *
 * Pure. No React, no network, no store — so the ranking is a table of
 * inputs and outputs a test can hold to.
 */

import type { Garment } from '@/lib/styling';

export type Department = 'women' | 'men' | 'unisex';

export type ClosetProfile = {
  readonly department: Department;
  /** True when the department was read from lopsided evidence or the profile. */
  readonly departmentConfident: boolean;
  /** Mean formality, 1–5, or null for an empty closet. */
  readonly formality: number | null;
  /** Share of pieces with a pattern, 0–1. */
  readonly patternShare: number;
  /** Lower-cased material words, most common first. */
  readonly materials: readonly string[];
  /** Lower-cased brand names the closet holds. */
  readonly brands: readonly string[];
  /** First-colour names, most common first — the old palette signal. */
  readonly palette: readonly string[];
};

export const NEUTRAL_PROFILE: ClosetProfile = {
  department: 'unisex',
  departmentConfident: false,
  formality: null,
  patternShare: 0,
  materials: [],
  brands: [],
  palette: [],
};

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const fold = (text: string): string =>
  ` ${text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

const has = (haystack: string, word: string): boolean =>
  haystack.includes(` ${word} `) || haystack.includes(` ${word}s `) || haystack.includes(` ${word}es `);

/** Garments coded women's in ordinary retail. Subcategory words from the tagger. */
const WOMEN_CODED = [
  'dress', 'gown', 'skirt', 'blouse', 'heel', 'pump', 'stiletto', 'bralette', 'bra', 'camisole',
  'cami', 'bodysuit', 'tights', 'bikini', 'swimsuit', 'tunic', 'kimono', 'sarong', 'wrap dress',
  'maxi', 'midi', 'peplum', 'corset', 'bustier', 'handbag', 'clutch', 'ballet flat', 'wedge',
  'mule', 'kitten heel', 'slingback',
];
/** Garments coded men's in ordinary retail. */
const MEN_CODED = [
  'tie', 'necktie', 'bow tie', 'boxer', 'brief', 'tuxedo', 'cufflink', 'suspender', 'jockstrap',
  'oxford shoe', 'brogue', 'derby', 'wingtip', 'kilt',
];

/** How a merchant spells the department. */
const WOMEN_WORDS = ['women', 'womens', 'woman', 'ladies', 'lady', 'female', 'girls', 'girl', 'her', 'feminine'];
const MEN_WORDS = ['men', 'mens', 'man', 'male', 'gentlemen', 'boys', 'boy', 'his', 'masculine'];
const UNISEX_WORDS = ['unisex', 'gender neutral', 'genderless', 'everyone'];

/** Formality read off a title, on the tagger's own 1–5 scale. */
const FORMALITY_WORDS: readonly [number, readonly string[]][] = [
  [4.5, ['tuxedo', 'gown', 'evening', 'cocktail', 'black tie', 'formal']],
  [4, ['blazer', 'suit', 'tailored', 'dress shirt', 'oxford shirt', 'silk', 'loafer', 'oxford', 'derby', 'pump', 'heel', 'stiletto', 'trouser', 'slacks', 'sheath', 'pencil skirt', 'cashmere', 'wool coat', 'trench', 'brogue', 'satin']],
  [3, ['chino', 'cardigan', 'merino', 'knit', 'blouse', 'midi', 'boot', 'shirt', 'polo', 'skirt', 'coat', 'jumpsuit', 'linen', 'wrap', 'loafers', 'sweater', 'jacket', 'dress', 'denim jacket']],
  [2, ['hoodie', 'sweatshirt', 'jogger', 'sweatpant', 'sneaker', 'trainer', 'tee', 't shirt', 'tshirt', 'jean', 'denim', 'slide', 'cargo', 'fleece', 'graphic', 'flip flop', 'shorts', 'tank', 'crop top', 'sandal', 'puffer', 'parka', 'beanie', 'cap']],
  [1.5, ['running', 'gym', 'yoga', 'training', 'sports bra', 'jersey', 'leggings', 'legging', 'athletic', 'workout', 'cycling', 'swim', 'bikini', 'swimsuit', 'rash guard']],
];

const MATERIAL_WORDS = [
  'cotton', 'wool', 'linen', 'silk', 'leather', 'denim', 'cashmere', 'merino', 'suede', 'satin',
  'velvet', 'nylon', 'polyester', 'viscose', 'tencel', 'lyocell', 'jersey', 'corduroy', 'tweed',
  'fleece', 'canvas', 'lace', 'chiffon', 'knit', 'sherpa', 'shearling', 'alpaca', 'mohair', 'organza',
];

const PATTERN_WORDS = [
  'floral', 'stripe', 'striped', 'stripes', 'plaid', 'check', 'checked', 'gingham', 'print', 'printed',
  'graphic', 'logo', 'animal', 'leopard', 'zebra', 'polka', 'dot', 'paisley', 'tie dye', 'camo',
  'houndstooth', 'tartan', 'jacquard', 'embroidered', 'colourblock', 'colorblock', 'ombre', 'tartan',
];

// ---------------------------------------------------------------------------
// The closet's profile
// ---------------------------------------------------------------------------

export type ProfileHints = {
  /** `profiles.gender_presentation`, when the person has set it. */
  genderPresentation?: string | null;
};

function departmentFromPresentation(value: string | null | undefined): Department | null {
  if (!value) return null;
  const words = fold(value);
  if (WOMEN_WORDS.some((w) => has(words, w))) return 'women';
  if (MEN_WORDS.some((w) => has(words, w))) return 'men';
  if (UNISEX_WORDS.some((w) => has(words, w)) || has(words, 'nonbinary') || has(words, 'non binary')) {
    return 'unisex';
  }
  return null;
}

/**
 * Enough coded garments, and enough more of them than the other way: three
 * against at most half as many, or two against none. Two dresses and a tie
 * is a closet that has not said.
 */
const lopsided = (mine: number, theirs: number): boolean =>
  (mine >= 3 && mine >= theirs * 2) || (mine >= 2 && theirs === 0);

/** Fold the wardrobe into the five facts the shelf ranks on. */
export function closetProfile(
  wardrobe: readonly Pick<
    Garment,
    'category' | 'subcategory' | 'formality' | 'pattern' | 'material' | 'brand' | 'colors'
  >[],
  hints: ProfileHints = {},
): ClosetProfile {
  if (wardrobe.length === 0 && !hints.genderPresentation) return NEUTRAL_PROFILE;

  let women = 0;
  let men = 0;
  let formalitySum = 0;
  let patterned = 0;
  const materials = new Map<string, number>();
  const brands = new Set<string>();
  const palette = new Map<string, number>();

  for (const g of wardrobe) {
    const words = fold(`${g.category ?? ''} ${g.subcategory ?? ''}`);
    // One vote per garment, whichever way it reads.
    const w = g.category === 'dress' || WOMEN_CODED.some((x) => has(words, x));
    const m = MEN_CODED.some((x) => has(words, x));
    if (w && !m) women += 1;
    else if (m && !w) men += 1;

    formalitySum += g.formality;
    if (g.pattern && !/^(solid|plain|none|null)?$/i.test(g.pattern.trim())) patterned += 1;

    if (g.material) {
      const m = fold(g.material);
      for (const word of MATERIAL_WORDS) {
        if (has(m, word)) materials.set(word, (materials.get(word) ?? 0) + 1);
      }
    }
    if (g.brand?.trim()) brands.add(g.brand.trim().toLowerCase());

    const colour = g.colors[0]?.name?.toLowerCase().trim();
    if (colour) {
      const canon = colour === 'gray' ? 'grey' : colour;
      palette.set(canon, (palette.get(canon) ?? 0) + 1);
    }
  }

  // Lopsided and non-trivial evidence, or the person's own word.
  const stated = departmentFromPresentation(hints.genderPresentation);
  let department: Department = 'unisex';
  let departmentConfident = false;
  if (stated) {
    department = stated;
    departmentConfident = stated !== 'unisex';
  } else if (lopsided(women, men)) {
    department = 'women';
    departmentConfident = true;
  } else if (lopsided(men, women)) {
    department = 'men';
    departmentConfident = true;
  }

  const byCount = <K,>(m: Map<K, number>): K[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([k]) => k);

  return {
    department,
    departmentConfident,
    formality: wardrobe.length ? formalitySum / wardrobe.length : null,
    patternShare: wardrobe.length ? patterned / wardrobe.length : 0,
    materials: byCount(materials),
    brands: [...brands].sort(),
    palette: byCount(palette),
  };
}

/** A short, bounded string for a query key — never the closet itself. */
export function profileKey(profile: ClosetProfile): string {
  return [
    profile.department,
    profile.departmentConfident ? 'c' : 'u',
    profile.formality === null ? '-' : profile.formality.toFixed(1),
    profile.patternShare.toFixed(1),
    profile.materials.slice(0, 3).join('.'),
    profile.brands.length,
    profile.palette.slice(0, 6).join('.'),
  ].join('|');
}

// ---------------------------------------------------------------------------
// A family against the profile
// ---------------------------------------------------------------------------

export type Shoppable = {
  readonly title: string;
  readonly category?: string | null;
  readonly gender?: string | null;
  readonly brand?: string | null;
  /** The merchant's colourway label, when there is one. */
  readonly colourLabel?: string | null;
};

/** What the merchant says about who the thing is for. */
export function itemDepartment(item: Shoppable): Department | null {
  const explicit = departmentFromPresentation(item.gender ?? null);
  if (explicit) return explicit;
  const words = fold(`${item.title} ${item.category ?? ''}`);
  const w = WOMEN_WORDS.some((x) => has(words, x));
  const m = MEN_WORDS.some((x) => has(words, x));
  if (UNISEX_WORDS.some((x) => has(words, x))) return 'unisex';
  if (w && !m) return 'women';
  if (m && !w) return 'men';
  return null;
}

/** Formality from the merchant's words, or null when nothing in them says. */
export function itemFormality(item: Shoppable): number | null {
  const words = fold(`${item.title} ${item.category ?? ''}`);
  for (const [level, list] of FORMALITY_WORDS) {
    if (list.some((w) => has(words, w))) return level;
  }
  return null;
}

export type AffinityBreakdown = {
  readonly gender: number;
  readonly formality: number;
  readonly palette: number;
  readonly material: number;
  readonly pattern: number;
  readonly brand: number;
  /** Weighted sum, 0–1. */
  readonly score: number;
  /** True when a confident department disagrees — the card is dropped. */
  readonly excluded: boolean;
};

const WEIGHTS = { gender: 0.3, formality: 0.25, palette: 0.2, material: 0.1, pattern: 0.1, brand: 0.05 } as const;

export function affinity(item: Shoppable, profile: ClosetProfile): AffinityBreakdown {
  const words = fold(`${item.title} ${item.category ?? ''}`);

  // Department: a confident closet excludes the other department outright; an
  // unknown item reads as neutral, never as a match.
  const dept = itemDepartment(item);
  let gender = 0.6;
  let excluded = false;
  if (dept && profile.department !== 'unisex') {
    if (dept === profile.department) gender = 1;
    else if (dept === 'unisex') gender = 0.7;
    else {
      gender = 0;
      excluded = profile.departmentConfident;
    }
  } else if (dept === 'unisex') {
    gender = 0.7;
  }

  // Formality: distance on the 1–5 scale, unknown reads as the closet itself.
  const f = itemFormality(item);
  const formality =
    profile.formality === null || f === null ? 0.6 : 1 - Math.min(4, Math.abs(f - profile.formality)) / 4;

  // Palette: the colourway label is the strong signal, the title the weak one.
  let paletteHits = 0;
  const label = fold(item.colourLabel ?? '').replace(' gray ', ' grey ');
  const title = words.replace(' gray ', ' grey ');
  for (const colour of profile.palette.slice(0, 6)) {
    if (has(label, colour)) paletteHits += 2;
    else if (has(title, colour)) paletteHits += 1;
  }
  const palette = profile.palette.length ? Math.min(1, paletteHits / 2) : 0.5;

  // Material: one the closet already holds is a match; one it never holds is
  // a mild mismatch; a title that names no fabric is neutral.
  const named = MATERIAL_WORDS.filter((w) => has(words, w));
  const material =
    named.length === 0 || profile.materials.length === 0
      ? 0.6
      : named.some((w) => profile.materials.includes(w))
        ? 1
        : 0.4;

  // Pattern: printed against a closet's share of prints.
  const printed = PATTERN_WORDS.some((w) => has(words, w)) ? 1 : 0;
  const pattern = 1 - Math.abs(printed - profile.patternShare);

  const brand = item.brand && profile.brands.includes(item.brand.trim().toLowerCase()) ? 1 : 0;

  const score =
    gender * WEIGHTS.gender +
    formality * WEIGHTS.formality +
    palette * WEIGHTS.palette +
    material * WEIGHTS.material +
    pattern * WEIGHTS.pattern +
    brand * WEIGHTS.brand;

  return { gender, formality, palette, material, pattern, brand, score, excluded };
}

/**
 * Rank shoppables by affinity, dropping confident department mismatches.
 * Stable: ties keep the input order (the server's own ranking).
 */
export function rankByAffinity<T extends Shoppable>(items: readonly T[], profile: ClosetProfile): T[] {
  return items
    .map((item, index) => ({ item, index, a: affinity(item, profile) }))
    .filter(({ a }) => !a.excluded)
    .sort((x, y) => y.a.score - x.a.score || x.index - y.index)
    .map(({ item }) => item);
}
