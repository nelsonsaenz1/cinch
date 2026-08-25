/**
 * Every decision `gap-shop-match` makes, with the database and the network
 * taken out.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 * `index.ts` cannot be imported by a test: it pulls in `npm:@supabase/server`
 * and the Deno globals, neither of which exists in the Node test runner. So for
 * as long as the rules lived there, the only way to check that a friend's
 * `shoppable = false` was honoured, or that no more than three merchants came
 * back, was to read the code and believe it. That is exactly how the junk
 * results of 2026-08-11 shipped.
 *
 * `decide()` takes its four reads as functions. `index.ts` supplies the real
 * ones; `tests/gap-shop-policy.test.ts` supplies fakes and asserts the seven
 * conditions the commerce directive actually requires. The seam is small on
 * purpose — the point is not abstraction, it is that the rules become
 * executable.
 *
 * WHAT STAYS IN index.ts
 *
 * Parsing the request, resolving the caller, constructing the clients, and
 * turning the result into a Response. Nothing that decides who may see what.
 */

import { networkFamily, type CatalogProduct } from '../_shared/catalog.ts';

import { admitProduct, type RelevanceSlot } from './relevance.ts';

export const CATALOG_SLOTS = [
  'top',
  'bottom',
  'outerwear',
  'footwear',
  'dress',
  'accessory',
  'bag',
  'headwear',
  'jewelry',
  'other',
] as const;
export type CatalogSlot = (typeof CATALOG_SLOTS)[number];

export function isCatalogSlot(value: unknown): value is CatalogSlot {
  return typeof value === 'string' && (CATALOG_SLOTS as readonly string[]).includes(value);
}

export const MAX_MERCHANTS = 3;

/**
 * The word a slot is searched with, and whether a fixture says it may ship.
 *
 * ONE word, not several. `name LIKE` is AND across terms, so "shirt top"
 * demands both and quietly narrows to whatever happens to carry each.
 *
 * `verified` IS NOT A FREE-TEXT OPINION. A slot may only be true here if
 * `tests/fixtures/slot-relevance.json` holds recorded catalogue rows for it and
 * `tests/slot-relevance.test.ts` pins what survives `admitProduct` — that test
 * reads this table and fails if it claims a slot the fixture does not cover.
 * Turning a slot on is therefore a recorded measurement, not an edit.
 *
 * The merchant `category` term this table used to carry is GONE. It was a
 * merchant-authored free-text field and it does not survive contact with the
 * data: Wayfair files furniture under "Shoes" and a dressmaker's mannequin
 * under "Dresses", so `category LIKE apparel` admitted a coat stand and refused
 * nothing that mattered. Its job is done properly now by two things that
 * actually work — the merchant allowlist and `relevance.ts`.
 */
export const SLOT_QUERY: Record<CatalogSlot, { word: string; verified: boolean } | null> = {
  top: { word: 'shirt', verified: true },
  bottom: { word: 'trousers', verified: true },
  outerwear: { word: 'coat', verified: true },
  footwear: { word: 'shoes', verified: true },
  dress: { word: 'dress', verified: true },
  accessory: { word: 'scarf', verified: true },
  bag: { word: 'handbag', verified: true },
  headwear: { word: 'hat', verified: true },
  jewelry: { word: 'necklace', verified: true },
  // Deliberately unsearchable. "other" means the closet could not classify the
  // piece, and guessing a shopping term from that would be inventing a gap.
  other: null,
};

/**
 * Relevance hints, all derived from the CLOSET by the caller before this
 * function is reached. None of them identify anybody: a colour, a brand name, a
 * formality band and a price ceiling describe a garment, not a person.
 */
export type Hints = {
  colour?: string;
  brand?: string;
  formality?: 'casual' | 'smart' | 'formal';
  /** Minor units. A ceiling drawn from what the closet already cost. */
  priceCeilingCents?: number;
};

export function readHints(raw: unknown): Hints {
  const h = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

  const formality = h.formality;
  return {
    colour: str(h.colour, 40),
    brand: str(h.brand, 80),
    formality:
      formality === 'casual' || formality === 'smart' || formality === 'formal'
        ? formality
        : undefined,
    priceCeilingCents:
      typeof h.priceCeilingCents === 'number' &&
      Number.isFinite(h.priceCeilingCents) &&
      h.priceCeilingCents > 0
        ? Math.min(Math.round(h.priceCeilingCents), 100_000_00)
        : undefined,
  };
}

/** Words that suggest a garment is dressier or plainer than average. */
const FORMAL_WORDS = /\b(tailored|suit|blazer|silk|satin|evening|gown|oxford|dress shirt|loafer|heel)\b/i;
const CASUAL_WORDS = /\b(hoodie|sweatshirt|jogger|sneaker|tee|t-shirt|graphic|fleece|track)\b/i;

/**
 * Score one product against the gap. Higher is better.
 *
 * Every term is a statement about FIT TO THE REQUEST. There is deliberately no
 * term for what a merchant pays, no term for how new the listing is, and no
 * term for how expensive it is in isolation — "freshest first", which this
 * function used to rank by, is a property of our sync schedule rather than of
 * the garment, and it put whichever merchant happened to update last at the top
 * of every list.
 */
export function score(p: CatalogProduct, hints: Hints, slot: CatalogSlot): number {
  let s = 0;

  // Colour is the strongest signal a closet gives: a gap is usually "another
  // one of these but in a colour I don't own".
  if (hints.colour && p.colour) {
    const want = hints.colour.toLowerCase();
    const got = p.colour.toLowerCase();
    if (got === want) s += 5;
    else if (got.includes(want) || want.includes(got)) s += 3;
  }

  // A brand the closet already contains is evidence of taste, not a promotion —
  // it is the user's own history and is weighted below colour on purpose.
  if (hints.brand && p.brand && p.brand.toLowerCase() === hints.brand.toLowerCase()) s += 2;

  if (hints.formality) {
    const text = `${p.title} ${p.brand ?? ''}`;
    const formal = FORMAL_WORDS.test(text);
    const casual = CASUAL_WORDS.test(text);
    if (hints.formality === 'formal' && formal) s += 2;
    if (hints.formality === 'casual' && casual) s += 2;
    if (hints.formality === 'formal' && casual) s -= 2;
    if (hints.formality === 'casual' && formal) s -= 1;
  }

  // Price relevance is a CEILING, not an ordering. Under it is fine and equal;
  // over it is progressively less useful, because a suggestion nobody would buy
  // is not a suggestion. Ordering by price ascending is what previously
  // surfaced the bottom of the market.
  if (hints.priceCeilingCents && p.priceMinor > 0) {
    if (p.priceMinor <= hints.priceCeilingCents) s += 2;
    else if (p.priceMinor <= hints.priceCeilingCents * 1.5) s += 1;
    else s -= 2;
  }

  // The slot's own words appearing in the title is weak but real evidence the
  // row is the kind of thing asked for rather than an accessory to it.
  const word = SLOT_QUERY[slot]?.word;
  if (word && p.title.toLowerCase().includes(word)) s += 1;

  // A product with no picture cannot be shown at all; one with a second picture
  // is marginally better presented. Tiny, and last.
  if (p.thumbnailUrl) s += 0.5;

  return s;
}

export type ShopMatch = {
  id: string;
  title: string;
  brand: string | null;
  colour: string | null;
  priceCents: number | null;
  currency: string | null;
  imageUrl: string;
  merchantName: string;
  /** Where the tap goes. Tracked only when `paid` is true. */
  url: string;
  /**
   * True ONLY when this merchant's programme is confirmed joined and the link
   * therefore earns a commission. The client labels the row from this and must
   * never assume it — see `commerce_joined_programmes`.
   */
  paid: boolean;
};

/** A joined programme, as `commerce_joined_programmes` records it. */
export type JoinedKey = `${string}:${string}`;

export type Deps = {
  /** The VIEWER's own "show where to buy". Null when the row is unreadable. */
  showWhereToBuy: () => Promise<boolean | null>;
  /** The OWNER's `shoppable`, read under the caller's RLS. Null = not visible. */
  itemShoppable: (itemId: string) => Promise<boolean | null>;
  /** The licensed catalogue. Throws or returns [] when it cannot answer. */
  search: (query: string, brand: string | null) => Promise<CatalogProduct[]>;
  /**
   * The OWNED catalogue — `catalog_products`, the rows `sync-feeds` ingests
   * from programmes Cinch is actually joined to. Second source, same shape,
   * three deliberate differences from `search`:
   *
   *   it is free (a local read, no metered request, no quota claim);
   *   its merchants are admitted by PROGRAMME MEMBERSHIP, not the Datafeedr
   *   allowlist — every row descends from an invitation the founder accepted
   *   in the Awin dashboard, which is the same "we choose the shops" property
   *   the allowlist exists for, enforced one step earlier (2026-08-25
   *   decision; merchant-allowlist.md records the split);
   *   its `merchantId` is the NETWORK's advertiser id, so the joined check
   *   and the `Paid link` label work exactly as they do everywhere else.
   */
  searchOwned: (slot: CatalogSlot, hints: Hints) => Promise<CatalogProduct[]>;
  /** Confirmed joined programmes, as `network:merchant_id`. */
  joined: () => Promise<Set<string>>;
  /** Fire-and-forget health counters. */
  note: (metric: string, detail?: string) => void;
};

export type Decision = {
  products: ShopMatch[];
  /** Why nothing came back, for the counters. Absent when products were found. */
  refusal?:
    | 'viewer_opted_out'
    | 'owner_not_shoppable'
    | 'slot_unverified'
    | 'no_qualifier'
    | 'provider_failed'
    | 'nothing_relevant';
};

const EMPTY = (refusal: Decision['refusal']): Decision => ({ products: [], refusal });

/**
 * The whole policy, in the order the directive requires it.
 *
 * The ORDER is load-bearing and is asserted in the tests: a viewer who turned
 * suggestions off must never cause a catalogue request, and a friend's item
 * that is not shoppable must not either. Checking consent after spending a
 * metered request would still return the right answer and would still be wrong.
 */
export async function decide(
  input: { slot: CatalogSlot; itemId?: string; hints: Hints },
  deps: Deps,
): Promise<Decision> {
  // ── C-03 · the VIEWER's own preference ──────────────────────────────────
  // For C-04 this is the person LOOKING at a friend's closet, not the friend: a
  // viewer who turned shop suggestions off gets none anywhere, including on
  // someone else's piece.
  if ((await deps.showWhereToBuy()) === false) return EMPTY('viewer_opted_out');

  // ── C-05 · the OWNER's permission, for a friend's piece ─────────────────
  // Not visible, not shoppable, or unreadable — all the same silence. A
  // distinct answer would tell the caller which of those it was, and "this item
  // exists but its owner said no" is not theirs to learn.
  if (input.itemId !== undefined) {
    if ((await deps.itemShoppable(input.itemId)) !== true) return EMPTY('owner_not_shoppable');
  }

  const recipe = SLOT_QUERY[input.slot];
  // Unsearchable, or searchable but not yet proven by a fixture. Both are the
  // same silence, and both are deliberate: a slot with no measured evidence
  // behind it ships nothing at all.
  if (!recipe?.verified) return EMPTY('slot_unverified');

  // ── NO HINT, NO SUGGESTION ──────────────────────────────────────────────
  //
  // A slot on its own is not a shopping query. Measured against the live
  // catalogue: "coat" returns a coat stand and an automotive listing, while
  // "black coat" returns fifteen apparel merchants and no junk at all. The
  // colour or brand the closet supplies is the entire difference between a
  // suggestion and a random product that shares a noun.
  //
  // C-01 already states the rule that makes an empty answer safe: "if no
  // merchant matches, the row is absent entirely".
  const qualifier = input.hints.colour ?? input.hints.brand;
  if (!qualifier) return EMPTY('no_qualifier');

  const query = `${input.hints.colour ?? ''} ${recipe.word}`.trim();

  // Two sources, asked together and allowed to fail separately. Datafeedr
  // being down must not hide the owned catalogue (it is our own table), and an
  // owned-read failure must not waste the metered request that just succeeded.
  // Only both failing is a provider failure.
  //
  // LICENSED ROWS FIRST, and the order is load-bearing: `sort` is stable, so
  // on an equal fit score the earlier row wins the merchant slot. Owned rows
  // are the ones that can be `paid`, and a tie broken toward them would be
  // commission choosing the order — the thing §0 forbids. The incumbent
  // source keeps ties; an owned row has to EARN its place on fit.
  const [licensed, owned] = await Promise.allSettled([
    deps.search(query, input.hints.brand ?? null),
    deps.searchOwned(input.slot, input.hints),
  ]);
  if (licensed.status === 'rejected') deps.note('provider_failure', 'catalogue_lookup_threw');
  if (owned.status === 'rejected') deps.note('provider_failure', 'owned_catalogue_threw');
  if (licensed.status === 'rejected' && owned.status === 'rejected') {
    return EMPTY('provider_failed');
  }
  // With one source down, an empty final answer must still read as a provider
  // failure — the counter's whole job is telling "nobody sells this" from "we
  // did not hear everyone", and absence can only be claimed by a full house.
  // A NON-empty answer from the surviving source still ships: partial results
  // are real results.
  const sourceFailed = licensed.status === 'rejected' || owned.status === 'rejected';
  const emptyRefusal = sourceFailed ? ('provider_failed' as const) : ('nothing_relevant' as const);

  const rows: CatalogProduct[] = [
    ...(licensed.status === 'fulfilled' ? licensed.value : []),
    ...(owned.status === 'fulfilled' ? owned.value : []),
  ];

  // ── Is each row actually the garment asked for? ─────────────────────────
  //
  // Before any ranking, because ranking junk only decides which junk goes
  // first. `name LIKE black coat` matches "Black Coated Skinny Jean" and
  // `cream dress` matches "Ice Cream Dress"; both satisfy the query exactly and
  // neither is the garment. Costs nothing — the rows are already here.
  const relevant = rows.filter(
    (p) =>
      admitProduct(p.title, {
        slot: input.slot as RelevanceSlot,
        noun: recipe.word,
        colour: input.hints.colour ?? null,
        brand: p.brand,
      }).admitted,
  );
  if (rows.length - relevant.length > 0) deps.note('rows_refused_as_irrelevant', input.slot);

  const ranked = [...relevant].sort(
    (a, b) => score(b, input.hints, input.slot) - score(a, input.hints, input.slot),
  );

  const joinedKeys = await deps.joined();

  const seen = new Set<string>();
  const products: ShopMatch[] = [];

  for (const p of ranked) {
    if (products.length >= MAX_MERCHANTS) break;
    // "At most three merchants" enforced by construction: the response can
    // never hold two rows from one shop, rather than by a client-side slice a
    // later edit could relocate above the dedupe.
    if (seen.has(p.merchant)) continue;
    seen.add(p.merchant);

    // Three things must all hold: a tracking URL was buildable, the row is on a
    // network we hold a publisher id for, and that merchant's programme is
    // confirmed joined. The first two are about plumbing; only the third is
    // about money. `monetised` alone means only "a publisher id existed for
    // this network, so a tracking URL was built".
    const family = networkFamily(p.sourceId);
    const paid = p.monetised && family !== null && joinedKeys.has(`${family}:${p.merchantId}`);

    products.push({
      id: p.externalId,
      title: p.title,
      brand: p.brand,
      colour: p.colour,
      priceCents: p.priceMinor > 0 ? p.priceMinor : null,
      currency: p.currency,
      imageUrl: p.imageUrl,
      merchantName: p.merchant,
      // An unmonetised row goes to the merchant directly. Sending it through a
      // network redirect we earn nothing from would add a hop, hand a third
      // party the click, and still not pay — all cost, no benefit.
      url: paid ? p.linkUrl : p.directUrl,
      paid,
    });
  }

  if (products.length === 0) return EMPTY(emptyRefusal);

  deps.note('suggestions_served', input.slot);
  const paidCount = products.filter((p) => p.paid).length;
  if (paidCount) deps.note('links_paid');
  if (products.length - paidCount) deps.note('links_direct');

  return { products };
}
