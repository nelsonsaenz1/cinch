/**
 * Listings become product families — the shape the matcher actually needs.
 *
 * WHAT A FEED GIVES YOU AND WHY IT IS THE WRONG SHAPE
 *
 * Datafeedr returns LISTINGS: one row per merchant per colourway per size, with
 * a merchant-authored title, a merchant-authored category, and no notion that
 * four of those rows are the same shirt. Ask it for a James Perse tee and the
 * honest answer is thirty rows describing perhaps three garments.
 *
 * The handoff is explicit that fixing this is server work and that the client
 * may never attempt it: *"Grouping key (brand + normalised product name +
 * category) and merchant-duplicate collapse must exist before the client sees
 * results. The client must never attempt grouping from raw titles."* (§10.2.)
 * This module is that grouping, and it is pure so it can be proved against
 * fixtures without a network.
 *
 * THE TWO RULES THAT ARE EASY TO GET BACKWARDS
 *
 *   COLLAPSE ACROSS MERCHANTS. Three shops listing the same shirt are one
 *   family with one entry, not three results. The user owns one shirt.
 *
 *   NEVER COLLAPSE COLOURWAYS. They are the thing being chosen between. This is
 *   why `DuplicateMode` exists upstream: the feed query must be told to keep
 *   rows that share a name but differ by image, or the colours are gone before
 *   this module ever sees them.
 *
 * NEAR MISSES ARE DEMOTED, NOT DELETED (CPV2-04). A henley is a top and so is a
 * tee, so `admitProduct`-style class refusal admits both — and a person who
 * asked for a tee and is shown a henley has been shown the wrong SHIRT, not the
 * wrong garment. The atlas gives that group its own heading, "Not a T-shirt,
 * but close", which only reads honestly if the group is genuinely subordinate
 * and genuinely optional: per §10.4, a noun with no distinguisher table
 * produces no near-miss group at all rather than a guessed one.
 *
 * WHAT IS DELIBERATELY ABSENT FROM EVERY TYPE HERE
 *
 * Price, currency, sale state, affiliate link, monetisation flag, stock. They
 * exist on `CatalogProduct` because the feed supplies them and `gap-shop-match`
 * needs them; they must not cross into this contract, because this is intake of
 * a garment somebody already owns and the handoff bans the vocabulary outright:
 * "Words that appear nowhere: price, buy, shop now, cart, sponsored, paid link,
 * affiliate, commission, in stock, web search." `tests/catalog-families.test.ts`
 * asserts the absence rather than trusting it.
 */

import type { CatalogProduct } from '../_shared/catalog.ts';
import { prepareText, type ParsedQuery } from '../_shared/catalog-query.ts';
import { normaliseQuery } from '../_shared/catalog.ts';
import {
  COLOUR_PHRASES,
  COLOUR_SET,
  type GarmentClass,
  GENDER_TERMS,
  headNoun,
  SIZE_SET,
} from '../_shared/garment-lexicon.ts';
import { boundTitle } from './title-bound.ts';

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

export type CatalogColourway = {
  /**
   * What to print. Cinch's own word when the merchant's resolves to one, and
   * the MERCHANT'S OWN WORDS when it does not.
   *
   * §10.3: *"Where no usable name exists the row must say so, not invent one."*
   * So there is no fallback to "grey" and no fallback to "Multi" — an
   * unresolvable colour keeps the shop's spelling, and `resolved` tells the
   * screen which of the two it is holding so it can say so.
   */
  label: string;
  /** True when `label` came from Cinch's colour lexicon rather than the feed. */
  resolved: boolean;
  /** Null is a drawn state, not an error — §11 forbids assuming an image. */
  imageUrl: string | null;
  /** `alternativeimageurl1`, on 43% of rows. The only real second image. */
  alternateImageUrl: string | null;
  /** Datafeedr's row id. Stable, and the idempotency key a later packet needs. */
  externalId: string;
  /** Bare host from `direct_url` — the shop, never an affiliate redirector. */
  sourceHost: string;
  /** The merchant's product page, where the feed gave one. Never a tracked link. */
  pageUrl: string | null;
};

export type CatalogFamily = {
  /** Derived from the grouping key. Response-only; nothing stores it. */
  familyId: string;
  brand: string | null;
  /** The canonical product name — the shortest title in the family. */
  title: string;
  productClass: GarmentClass | null;
  /** The merchant's own category string, when every row agreed on one. */
  category: string | null;
  /** 68% of rows carry this. Null is ordinary and is a drawn state. */
  gender: string | null;
  colours: CatalogColourway[];
  /** Shop names, for the provenance line. Not links and not destinations. */
  merchants: string[];
  /**
   * The cut that made this a near miss — "henley" when a tee was asked for.
   * Null on every exact family. It exists so the subordinate group can say WHY
   * a row is in it rather than leaving the reader to guess.
   */
  nearMissCut: string | null;
};

export type FamilyResult = {
  /** What was asked for. Ranked, best first. */
  exact: CatalogFamily[];
  /**
   * The same class, a different cut. Always subordinate to `exact` and always
   * separately labelled; empty when the query's noun has no distinguisher table
   * (§10.4) or when nothing matched one.
   */
  nearMiss: CatalogFamily[];
};

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * Merchant shorthand, expanded.
 *
 * §10.3 names the exact problem: *"Heather grey" / "Htr Grey" / "Grey Heather"
 * are one colourway.* Sorting the tokens handles the third; this table handles
 * the first two. It is short and literal on purpose — every entry is a spelling
 * observed in apparel feeds, and a clever general rule here would start merging
 * colours that are genuinely different.
 */
const COLOUR_ABBREVIATIONS: Record<string, string> = {
  htr: 'heather',
  hthr: 'heather',
  heathered: 'heather',
  gry: 'grey',
  gray: 'grey',
  grey: 'grey',
  blk: 'black',
  wht: 'white',
  nvy: 'navy',
  chr: 'charcoal',
  chcl: 'charcoal',
  brn: 'brown',
  drk: 'dark',
  lt: 'light',
  med: 'medium',
  nat: 'natural',
};

/** Words that describe the finish rather than the hue, and never the whole name. */
const COLOUR_NOISE = new Set(['color', 'colour', 'solid', 'shade', 'tone']);

/**
 * Colour words that are not IN the colour lexicon but are unmistakably part of
 * a colour name, stripped from TITLES before a family key is taken.
 *
 * Without this the key splits on a word the lexicon happens not to carry. One
 * merchant titles a shirt "Crew Neck Tee — Heather Grey" and the next writes
 * "Crew Neck Tee"; `COLOUR_SET` removes "grey" from the first and leaves
 * "heather" behind, so the two canonical titles differ by one word and the
 * same shirt becomes two families — which is precisely the failure this module
 * exists to prevent, arrived at from the wrong end.
 *
 * Deliberately not merged with `COLOUR_ABBREVIATIONS`: that table decides what
 * a colourway IS, and this one only decides what a product NAME is not.
 */
const TITLE_COLOUR_NOISE = new Set([
  'heather', 'heathered', 'htr', 'hthr', 'vintage', 'washed', 'faded', 'distressed',
  'dark', 'deep', 'pale', 'bright', 'multi', 'assorted', 'natural', 'nat',
]);

/**
 * The four words above that a GROUPING key must keep — and why the two uses
 * had to be split.
 *
 * `vintage`, `washed`, `faded` and `distressed` earn their place in the set
 * above because they arrive attached to a colour: "Vintage Black" is one
 * colourway, and a trailing segment reading "Vintage Black" is not part of the
 * product's name. But in the PRODUCT-NAME position the same words name a
 * different garment, and dropping them from the family key merges two things
 * the merchant sells side by side.
 *
 * Measured, not theorised. The live Mr Porter feed carries both "Distressed
 * Cotton-Jersey T-Shirt" and "Cotton-Jersey T-Shirt" under James Perse; with
 * these words dropped from the key the two became one family, and the Brown
 * distressed shirt appeared as a colourway of the plain one — so somebody
 * picking Brown would have imported a garment they had not looked at. See
 * `tests/fixtures/catalogue-james-perse.json`.
 *
 * Position is what separates the two readings, and the trailing-segment rule in
 * `displayTitle` already encodes position. So the display vocabulary keeps all
 * sixteen words and the grouping key keeps these four.
 */
const TITLE_FINISH_WORDS = new Set(['vintage', 'washed', 'faded', 'distressed']);

/**
 * Trailing words that are a variant AXIS rather than part of a name — display
 * only, and never part of a grouping key.
 *
 * Both entries come from titles the live feed actually returned.
 *
 *   GENDER. Mr Porter formats every row "Brand - Product - Men - Colour - Size",
 *   so stripping the colour and the size left "Combed Cotton-Jersey T-Shirt -
 *   Men" on the card. Grailed suffixes ", Men's" for the same reason. Gender is
 *   display-only and never a key by §11 of the handoff, and it is already
 *   dropped from the query as a weak term — a card that has to say it can read
 *   it off `family.gender`.
 *
 *   THE WORD "size" ITSELF. Grailed writes "(Size L)". Stripping "L)" as a size
 *   and stopping left "V-Neck T-Shirt in Gray, Men's (Size" — a name ending
 *   mid-parenthesis, which is the one outcome worse than an over-long title.
 *
 * Only ever consulted at the END of a title. "Men's Essential T-Shirt" leads
 * with its gender word and keeps it, because the leading position is the
 * product's own name.
 */
const DISPLAY_VARIANT_WORDS = new Set([...GENDER_TERMS, 'size', 'sizes']);

/**
 * Words a name must not END on once the variants are off.
 *
 * "V-Neck T-Shirt in Gray" loses "Gray" and would otherwise be printed as
 * "V-Neck T-Shirt in". These carry no meaning alone and only ever appear here
 * because the thing they introduced has just been removed.
 */
const TRAILING_CONNECTIVES = new Set(['in', 'and', 'or', 'with', 'for', 'by', 'the', 'a', 'of']);

/**
 * One colourway's identity and its printable name.
 *
 * Returns null only when the feed gave no colour at all — which is 3% of rows
 * and a real state the screen draws, not something to paper over.
 */
export function normaliseColour(raw: string | null): { key: string; label: string; resolved: boolean } | null {
  if (!raw) return null;
  const cleaned = normaliseQuery(raw);
  if (!cleaned) return null;

  const tokens = cleaned
    .split(' ')
    .map((t) => COLOUR_ABBREVIATIONS[t] ?? t)
    .filter((t) => t.length > 0 && !COLOUR_NOISE.has(t));

  if (tokens.length === 0) return null;

  // Sorted and deduplicated, so word order cannot fork one colourway into two.
  // "Grey Heather" and "Heather Grey" both key as `grey heather` sorted.
  const key = [...new Set(tokens)].sort().join(' ');

  // Cinch's own word, when the merchant's phrase contains one. Longest phrase
  // first so "light grey" beats "grey".
  const expanded = tokens.join(' ');
  let resolvedTerm: string | null = null;
  for (const phrase of COLOUR_PHRASES) {
    const parts = phrase.split(' ');
    const hit = parts.every((p) => tokens.includes(p));
    if (hit) {
      resolvedTerm = phrase;
      break;
    }
  }

  // A resolved term is only allowed to BE the label when it accounts for the
  // whole phrase. "Heather Grey" resolves `grey`, but printing "Grey" would
  // quietly drop the heather and put two different colourways under one name —
  // so the merchant's fuller phrase wins and `resolved` reports false.
  const resolvedCoversAll =
    resolvedTerm !== null && resolvedTerm.split(' ').length === tokens.length;

  if (resolvedCoversAll && resolvedTerm) {
    return { key, label: titleCase(resolvedTerm), resolved: true };
  }

  // The shop's own words, tidied of case only. Truthful rather than tidy.
  return { key, label: titleCase(expanded), resolved: false };
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/**
 * The product name, with everything that varies between rows taken out.
 *
 * A family key built from raw titles would put "Crew Neck Jersey Tee - White,
 * XL" and "Crew Neck Jersey Tee - Navy, S" in different families, which is the
 * failure this whole module exists to prevent. So the colour the row itself
 * declares, any colour word, every size token and the brand's own name all come
 * out before the key is taken.
 *
 * The brand comes out because merchants disagree about whether to repeat it:
 * one shop lists "James Perse Crew Neck Tee" and the next lists "Crew Neck Tee"
 * for the identical garment, and the brand is already part of the key on its
 * own axis.
 */
export function canonicalTitle(
  title: string,
  opts: { colour?: string | null; brand?: string | null } = {},
): string {
  let tokens = normaliseQuery(prepareText(title)).split(' ').filter(Boolean);

  const drop = new Set<string>();
  if (opts.colour) for (const t of normaliseQuery(opts.colour).split(' ')) drop.add(t);
  if (opts.brand) for (const t of normaliseQuery(opts.brand).split(' ')) drop.add(t);

  tokens = tokens.filter(
    (t) =>
      !drop.has(t) &&
      !COLOUR_SET.has(t) &&
      (!TITLE_COLOUR_NOISE.has(t) || TITLE_FINISH_WORDS.has(t)) &&
      !SIZE_SET.has(t) &&
      !/^\d+$/.test(t),
  );

  return tokens.join(' ').trim();
}

/**
 * The product name a card actually prints — CPV2-04.
 *
 * `canonicalTitle` above answers "are these two rows the same garment"; this
 * answers "what is this garment called". They are different questions and were
 * previously answered by the same value, which is why a single-merchant family
 * came out as "James Perse Short Sleeve Crew Tee - Navy" while a three-merchant
 * one came out as "Crew Neck Jersey T-Shirt". Two names for the same kind of
 * thing, differing only by an accident of which shop happened to list it.
 *
 * The atlas settles what belongs here. Its VoiceOver example reads *"Crew Neck
 * Jersey Tee. James Perse, short sleeve. Six colours available."* — the maker is
 * spoken separately, the cut is kept, and the colourway is not in the name at
 * all, because the name has to stand above a row of six colours.
 *
 * SO THREE THINGS COME OFF, AND ONLY THREE:
 *
 *   the brand, which the family carries on its own field and which merchants
 *   repeat or omit at random;
 *
 *   trailing variant SEGMENTS — everything after the last real separator when
 *   what follows is only colour, size or filler ("… Tee - Navy", "… Tee, XL");
 *
 *   trailing variant WORDS where the merchant used no separator at all
 *   ("Cotton Crew Neck Tee White").
 *
 * AND NOTHING ELSE COMES OFF. "Short Sleeve", "Crew Neck", "Sueded Jersey" are
 * the words that distinguish one product from the next, and stripping them
 * would leave every shirt in the catalogue called "Tee". The stripping is also
 * refused outright if it would empty the name — a garment titled only by its
 * colour keeps that title, because a blank card is worse than an odd one.
 *
 * Operates on the RAW string, never on normalised tokens, so "T-Shirt" comes
 * back as "T-Shirt" and not "t shirt".
 */
export function displayTitle(
  rawTitle: string,
  opts: { brand?: string | null } = {},
): string {
  let title = rawTitle.trim();

  // The maker, when the merchant led with it. Only as a PREFIX: a brand in the
  // middle of a name is usually part of the product's own name ("Levi's 501"),
  // and cutting there would leave a fragment.
  if (opts.brand) {
    const brand = normaliseQuery(prepareText(opts.brand));
    const head = normaliseQuery(prepareText(title));
    if (brand && head.startsWith(`${brand} `)) {
      // Count the words rather than the characters: the raw string has the
      // punctuation and casing the normalised one does not.
      const words = brand.split(' ').length;
      title = title.split(/\s+/).slice(words).join(' ');
      title = title.replace(/^[\s\-–—|,/]+/, '');
    }
  }

  const isVariantWord = (word: string): boolean => {
    const token = normaliseQuery(prepareText(word));
    if (!token) return true; // punctuation alone
    return token
      .split(' ')
      .every(
        (t) =>
          COLOUR_SET.has(t) ||
          SIZE_SET.has(t) ||
          TITLE_COLOUR_NOISE.has(t) ||
          DISPLAY_VARIANT_WORDS.has(t) ||
          /^\d+$/.test(t),
      );
  };

  // A title made ENTIRELY of variant words is left alone, whole, before any
  // stripping starts. Otherwise "Heather Grey XL" is eroded to "Heather" — a
  // fragment, which is worse than the odd-but-honest name the shop gave it.
  const allWords = title.split(/\s+/).filter(Boolean);
  if (allWords.length > 0 && allWords.every(isVariantWord)) return boundTitle(title);

  // Trailing SEGMENTS. Split keeping the delimiters so the survivors can be
  // rejoined exactly as the merchant punctuated them.
  const parts = title.split(/(\s*[\-–—|/,]\s*)/);
  const segments: { text: string; delimiter: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    segments.push({ text: parts[i] ?? '', delimiter: parts[i + 1] ?? '' });
  }
  while (
    segments.length > 1 &&
    segments[segments.length - 1].text.trim() !== '' &&
    segments[segments.length - 1].text.trim().split(/\s+/).every(isVariantWord)
  ) {
    segments.pop();
  }
  title = segments
    .map((s, i) => (i === segments.length - 1 ? s.text : s.text + s.delimiter))
    .join('')
    .trim();

  // Trailing WORDS, for the merchants who use no separator. Stops at the first
  // word that carries meaning, so "Short Sleeve Crew Tee" loses nothing.
  const words = title.split(/\s+/).filter(Boolean);
  while (words.length > 1 && isVariantWord(words[words.length - 1])) words.pop();

  // And never end on the connective the removed word was hanging off.
  while (
    words.length > 1 &&
    TRAILING_CONNECTIVES.has(normaliseQuery(prepareText(words[words.length - 1])))
  ) {
    words.pop();
  }

  // Punctuation the stripping orphaned: a dangling comma, dash or open bracket.
  const cleaned = words
    .join(' ')
    .replace(/[\s\-–—|,/(]+$/, '')
    .trim();
  // A name made entirely of variant words keeps the merchant's own, because a
  // blank card is worse than an odd one.
  //
  // Bounded on the way out, at every exit. The stripping above removes a
  // variant suffix, which is not a length rule and cannot be relied on to
  // produce one: a merchant who writes a 170-character product name and no
  // trailing colour leaves the whole thing intact. This title is posted back
  // verbatim as an import's `title`, so a value the import would refuse must
  // never leave here — the user cannot shorten a name that was never theirs.
  return boundTitle(cleaned || rawTitle.trim());
}

/** The garment class a title claims, by its longest matching noun. */
export function classOfTitle(title: string): { noun: string | null; klass: GarmentClass | null } {
  const tokens = normaliseQuery(prepareText(title)).split(' ').filter(Boolean);
  const head = headNoun(tokens);
  return { noun: head?.noun ?? null, klass: head?.klass ?? null };
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** A short, stable id from the grouping key. Derived, never stored. */
function familyId(key: string): string {
  // FNV-1a. A hash rather than the key itself so the id carries no merchant
  // text, and a plain one rather than SHA-256 because this function is pure and
  // synchronous by design — `crypto.subtle` is async and would make the whole
  // grouping pass async for an identifier nobody verifies.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `f${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Which of two rows for the same colourway is the one to show.
 *
 * Deterministic and explicitly NOT about price — the directive forbids ranking
 * by it and the handoff forbids showing it, so it cannot be a tiebreak either.
 * Image completeness first, because a colourway with no picture is a degraded
 * row the screen has to apologise for; then the identifier, which correlates
 * with a merchant who publishes a full feed; then the external id, so the
 * answer is stable across runs and a fixture test can pin it.
 */
function betterRepresentative(a: CatalogProduct, b: CatalogProduct): CatalogProduct {
  const score = (p: CatalogProduct) =>
    (p.imageUrl ? 4 : 0) + (p.thumbnailUrl ? 2 : 0) + (p.identifier ? 1 : 0);
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sa > sb ? a : b;
  return a.externalId <= b.externalId ? a : b;
}

/**
 * Listings in, families out.
 *
 * Rows arrive in Datafeedr's own relevance order and that order is preserved:
 * the first row of a family sets its position, so a family whose best listing
 * ranked first ranks first here too. Ranking proper happens in `rankFamilies`;
 * this function only decides what is one garment.
 */
export function groupFamilies(rows: readonly CatalogProduct[]): CatalogFamily[] {
  const byKey = new Map<
    string,
    {
      key: string;
      brand: string | null;
      titles: string[];
      klass: GarmentClass | null;
      categories: string[];
      genders: string[];
      merchants: string[];
      /** colour key -> best row so far. `''` is "the feed named no colour". */
      colours: Map<string, { row: CatalogProduct; label: string; resolved: boolean }>;
    }
  >();

  for (const row of rows) {
    const brandKey = row.brand ? normaliseQuery(row.brand) : '';
    const colour = normaliseColour(row.colour);
    const canonical = canonicalTitle(row.title, { colour: row.colour, brand: row.brand });
    const { klass } = classOfTitle(row.title);

    // A row whose title reduces to nothing once colour, size and brand are
    // stripped has no product name left to group on — "Navy XL", say. It is
    // kept as its own family rather than merged into an empty bucket with
    // every other nameless row, which would invent a family that is not one.
    const nameKey = canonical || `row:${row.externalId}`;
    const key = `${brandKey}|${klass ?? ''}|${nameKey}`;

    let family = byKey.get(key);
    if (!family) {
      family = {
        key,
        brand: row.brand,
        titles: [],
        klass,
        categories: [],
        genders: [],
        merchants: [],
        colours: new Map(),
      };
      byKey.set(key, family);
    }

    family.titles.push(row.title);
    if (row.category) family.categories.push(row.category);
    if (row.gender) family.genders.push(row.gender);
    if (!family.merchants.includes(row.merchant)) family.merchants.push(row.merchant);

    const colourKey = colour?.key ?? '';
    const existing = family.colours.get(colourKey);
    if (!existing) {
      family.colours.set(colourKey, {
        row,
        // A colourway the feed did not name is not given one. The screen draws
        // this state; it does not print a guess.
        label: colour?.label ?? '',
        resolved: colour?.resolved ?? false,
      });
    } else {
      const winner = betterRepresentative(existing.row, row);
      family.colours.set(colourKey, {
        row: winner,
        // Prefer a resolved label if either row produced one; otherwise keep
        // whichever merchant's words we already had.
        label: existing.resolved ? existing.label : (colour?.resolved ? colour.label : existing.label || (colour?.label ?? '')),
        resolved: existing.resolved || (colour?.resolved ?? false),
      });
    }
  }

  return [...byKey.values()].map((family) => ({
    familyId: familyId(family.key),
    brand: family.brand,
    // The shortest title is the closest to the maker's own name — merchants
    // pad, they rarely truncate — and then the variant suffix comes off it. See
    // `displayTitle` for why the two steps are separate.
    title: displayTitle(
      [...family.titles].sort((a, b) => a.length - b.length || a.localeCompare(b))[0],
      { brand: family.brand },
    ),
    productClass: family.klass,
    category: agreedValue(family.categories),
    gender: agreedValue(family.genders),
    merchants: family.merchants,
    nearMissCut: null,
    colours: [...family.colours.values()].map(({ row, label, resolved }) => ({
      label,
      resolved,
      imageUrl: row.imageUrl || null,
      alternateImageUrl: row.thumbnailUrl,
      externalId: row.externalId,
      sourceHost: row.sourceHost,
      // `direct_url` is the merchant's own page and is on 100% of rows. It is
      // carried because the handoff asks for "page URL where the feed provides
      // it" and because provenance has to be recordable at import — NOT as a
      // destination. Nothing in the matcher may render it as a link.
      pageUrl: row.directUrl || null,
    })),
  }));
}

/** The one value every row agreed on, or null when they did not agree. */
function agreedValue(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const first = normaliseQuery(values[0]);
  return values.every((v) => normaliseQuery(v) === first) ? values[0] : null;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Order the families, and split off the near misses.
 *
 * The comparison is a fixed cascade rather than a weighted score, because a
 * weighted score is a set of numbers nobody can defend individually and every
 * later change to one silently reorders everything. Each rule below is a
 * tiebreak of the one above it, and each is a fact about the row rather than a
 * judgement about the garment:
 *
 *   1. The brand, from the `brand` COLUMN. A foreign brand can never outrank an
 *      exact one — the measurement in `catalog.ts` is that a brand name inside
 *      a merchant-written title is not evidence, so a title match scores zero.
 *   2. The garment class, then the exact head noun the query asked for.
 *   3. The colour, when one was asked for.
 *   4. Completeness: a family whose colourways carry pictures beats one whose
 *      do not, because the screen can actually show it.
 *   5. The number of colourways, then the id — a stable tiebreak so a fixture
 *      test pins one order rather than an arbitrary one.
 *
 * PRICE APPEARS NOWHERE, at any level of the cascade.
 */
export function rankFamilies(families: readonly CatalogFamily[], parsed: ParsedQuery): FamilyResult {
  const brandKey = parsed.brand ? normaliseQuery(parsed.brand) : null;

  const exact: CatalogFamily[] = [];
  const nearMiss: CatalogFamily[] = [];

  for (const family of families) {
    // A family of a different garment class than the one asked for is not a
    // near miss, it is a wrong answer — "Navy Dress Pant" against "dress". The
    // near-miss group is for the right garment in the wrong cut only.
    if (parsed.productClass && family.productClass && family.productClass !== parsed.productClass) {
      continue;
    }

    const cut = nearMissCutOf(family, parsed);
    if (cut) nearMiss.push({ ...family, nearMissCut: cut });
    else exact.push(family);
  }

  const compare = (a: CatalogFamily, b: CatalogFamily) => {
    if (brandKey) {
      const ab = a.brand && normaliseQuery(a.brand) === brandKey ? 1 : 0;
      const bb = b.brand && normaliseQuery(b.brand) === brandKey ? 1 : 0;
      if (ab !== bb) return bb - ab;
    }
    if (parsed.productClass) {
      const ac = a.productClass === parsed.productClass ? 1 : 0;
      const bc = b.productClass === parsed.productClass ? 1 : 0;
      if (ac !== bc) return bc - ac;
    }
    if (parsed.noun) {
      const an = classOfTitle(a.title).noun === parsed.noun ? 1 : 0;
      const bn = classOfTitle(b.title).noun === parsed.noun ? 1 : 0;
      if (an !== bn) return bn - an;
    }
    if (parsed.colour) {
      const has = (f: CatalogFamily) =>
        f.colours.some((c) => normaliseQuery(c.label).includes(parsed.colour!)) ? 1 : 0;
      const ac = has(a);
      const bc = has(b);
      if (ac !== bc) return bc - ac;
    }
    const pictured = (f: CatalogFamily) => f.colours.filter((c) => c.imageUrl).length;
    const ap = pictured(a) > 0 ? 1 : 0;
    const bp = pictured(b) > 0 ? 1 : 0;
    if (ap !== bp) return bp - ap;

    if (a.colours.length !== b.colours.length) return b.colours.length - a.colours.length;
    return a.familyId.localeCompare(b.familyId);
  };

  return { exact: [...exact].sort(compare), nearMiss: [...nearMiss].sort(compare) };
}

/**
 * Which distinguisher, if any, makes this family a near miss.
 *
 * Returns null — meaning "exact" — in three cases, and the third is the one
 * §10.4 legislates:
 *
 *   · the family carries no distinguisher word at all;
 *   · the query asked for that very cut, so it is what was wanted;
 *   · the query's noun has no distinguisher table, in which case
 *     `parsed.nearMissCuts` is empty and NO near-miss group is produced —
 *     "if it cannot be derived, omit the near-miss group rather than mixing
 *     cuts."
 */
function nearMissCutOf(family: CatalogFamily, parsed: ParsedQuery): string | null {
  if (parsed.nearMissCuts.length === 0) return null;

  const haystack = ` ${normaliseQuery(prepareText(`${family.title} ${family.category ?? ''}`))} `;
  const asked = ` ${parsed.normalised} `;

  for (const cut of parsed.nearMissCuts) {
    if (!haystack.includes(` ${cut} `)) continue;
    // The user asked for it: a query for a polo shirt is answered by a polo.
    if (asked.includes(` ${cut} `)) continue;
    return cut;
  }
  return null;
}
