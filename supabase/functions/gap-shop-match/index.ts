import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { networkFamily, searchCatalogue, type CatalogProduct } from '../_shared/catalog.ts';
import { catalogOptsFromEnv } from '../_shared/catalog-store.ts';
import { ALLOWED_MERCHANT_IDS } from '../_shared/merchants.ts';
import { admitProduct, type RelevanceSlot } from './relevance.ts';

/**
 * gap-shop-match — commerce-directive.md §2/§3, C-01/C-02/C-04's server half.
 *
 * ONE FUNCTION, TWO CALLERS: the Gap Feed matching a computed gap (C-01) and a
 * friend's closet item detail matching a specific piece (C-04). The request is
 * a `slot` in the ten-value vocabulary both sides already speak.
 *
 * WHAT CHANGED, AND WHY
 *
 * This read `catalog_products` — the Awin FEED tables, filled by `sync-feeds`.
 * Those tables are empty and stay empty until Awin approves a programme, so
 * both commerce surfaces rendered nothing at all while the licensed Datafeedr
 * catalogue sat right next to them answering garment searches across 44,027
 * merchants without needing any approval. Catalogue access and commission are
 * different permissions, and only the second one is blocked.
 *
 * So this now queries the same licensed provider and the same global cache
 * `garment-search` uses. `sync-feeds` and its tables are kept as Awin
 * redundancy for when those approvals land — not deleted, not the blocker.
 *
 * DISCOVERY AND MONETISATION ARE SEPARATE, AND STAY SEPARATE
 *
 * Nothing on the ranking path knows what anything pays. The order of results is
 * decided entirely by how well a product answers the gap — locale, stock,
 * colour, brand, formality, price — and monetisation is resolved afterwards,
 * per row, purely to decide how the link is LABELLED. There is no commission
 * figure anywhere in this function to sort by even by accident, and
 * `tests/commerce-isolation.test.ts` holds the other half of that line by
 * forbidding the closet-ranking modules from importing anything commerce.
 *
 * THE CLOSET RANKS FIRST, THEN THE MERCHANT LOOKUP HAPPENS
 *
 * The caller has already decided WHAT is missing before this function is
 * reached — that computation lives in `outfit-count.ts`/`gap-feed.ts` and reads
 * only the closet. This endpoint is told the answer. It never gets to influence
 * which gap was chosen, which is the property that keeps "what you are missing"
 * an honest statement about a wardrobe rather than a dressed-up ad slot.
 *
 * A PAID LINK IS ONLY CALLED A PAID LINK WHEN IT IS ONE
 *
 * Being able to build a tracking URL is not evidence of earning from it — see
 * `commerce_joined_programmes`. Awin reports zero joined programmes today, so
 * every result currently ships as an ordinary link to the merchant, and says
 * so. The label is computed from a table of confirmed approvals, never from the
 * shape of a URL.
 */

/** Mirrors `CatalogSlot` in `src/features/commerce/slot.ts` — the Deno and
 *  Expo bundles cannot share a source file, so the ten literals are kept in
 *  sync by this comment rather than an import. */
const CATALOG_SLOTS = [
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
type CatalogSlot = (typeof CATALOG_SLOTS)[number];

function isCatalogSlot(value: unknown): value is CatalogSlot {
  return typeof value === 'string' && (CATALOG_SLOTS as readonly string[]).includes(value);
}

const MAX_MERCHANTS = 3;

/**
 * The word a slot is searched with, and whether a fixture says it may ship.
 *
 * ONE word, not several. `name LIKE` is AND across terms, so "shirt top" demands
 * both and quietly narrows to whatever happens to carry each.
 *
 * `verified` IS NOT A FREE-TEXT OPINION. A slot may only be true here if
 * `tests/fixtures/slot-relevance.json` holds recorded catalogue rows for it and
 * `tests/slot-relevance.test.ts` pins what survives `admitProduct` — the test
 * fails if this table claims a slot the fixture does not cover. Turning a slot
 * on is therefore a recorded measurement, not an edit.
 *
 * The merchant `category` term this table used to carry is GONE. It was a
 * merchant-authored free-text field and it does not survive contact with the
 * data: Wayfair files furniture under "Shoes" and a dressmaker's mannequin
 * under "Dresses", so `category LIKE apparel` admitted a coat stand and refused
 * nothing that mattered. Its job is done properly now by two things that
 * actually work — the merchant allowlist and `relevance.ts`.
 */
const SLOT_QUERY: Record<CatalogSlot, { word: string; verified: boolean } | null> = {
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
type Hints = {
  colour?: string;
  brand?: string;
  formality?: 'casual' | 'smart' | 'formal';
  /** Minor units. A ceiling drawn from what the closet already cost. */
  priceCeilingCents?: number;
};

function readHints(raw: unknown): Hints {
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
function score(p: CatalogProduct, hints: Hints, slot: CatalogSlot): number {
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

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return fail('invalid_request', 'Malformed JSON body.', 400);
      }

      const raw = body as { slot?: unknown; itemId?: unknown; hints?: unknown };
      if (!isCatalogSlot(raw?.slot)) {
        return fail('invalid_request', `slot must be one of: ${CATALOG_SLOTS.join(', ')}.`, 400);
      }
      const slot: CatalogSlot = raw.slot;
      const hints = readHints(raw.hints);

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // ── C-03 · the VIEWER's own preference ────────────────────────────────
      // Enforced server-side as well as in the client, because a client that
      // hid its merchant rows must not still be able to fetch the data behind
      // them by calling this endpoint directly. For C-04 this is the person
      // LOOKING at a friend's closet, not the friend: a viewer who turned shop
      // suggestions off gets none anywhere, including on someone else's piece.
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('show_where_to_buy')
        .eq('user_id', userId)
        .single();

      if (profileError) return fail('profile_read_failed', profileError.message, 500);
      if (profile?.show_where_to_buy === false) return Response.json({ products: [] });

      // ── C-05 · the OWNER's permission, for a friend's piece ───────────────
      // This check did not exist server-side. `shoppable` was read only in
      // `FriendItemSheet`, so the owner's consent was enforced by the same
      // client that was asking — anyone calling this endpoint with a slot got
      // matches for a friend's garment whether or not that friend had allowed
      // it. Read through `friend_items` under the CALLER's own RLS rather than
      // as admin, so the existing friendship and privacy layer decides
      // visibility and this function does not reimplement it.
      if (raw.itemId !== undefined) {
        if (typeof raw.itemId !== 'string') {
          return fail('invalid_request', 'itemId must be a string.', 400);
        }
        const { data: item, error: itemError } = await db
          .from('friend_items')
          .select('id, shoppable')
          .eq('id', raw.itemId)
          .maybeSingle();

        // Not visible, not shoppable, or unreadable — all the same silence. A
        // distinct error would tell the caller which of those it was, and
        // "this item exists but its owner said no" is not theirs to learn.
        if (itemError || !item || item.shoppable !== true) {
          return Response.json({ products: [] });
        }
      }

      const recipe = SLOT_QUERY[slot];
      // Unsearchable, or searchable but not yet proven by a fixture. Both are
      // the same silence to a caller, and both are deliberate: a slot with no
      // measured evidence behind it ships nothing at all.
      if (!recipe?.verified) return Response.json({ products: [] });

      // NO HINT, NO SUGGESTION.
      //
      // A slot on its own is not a shopping query. Measured against the live
      // catalogue: "coat" returns a coat stand and an automotive listing, while
      // "black coat" returns fifteen apparel merchants and no junk at all. The
      // colour or brand the closet supplies is the entire difference between a
      // suggestion and a random product that shares a noun.
      //
      // So when the closet has told us nothing beyond the slot, this returns
      // nothing. C-01 already states the rule that makes that safe: "if no
      // merchant matches, the row is absent entirely" — an empty answer is a
      // shape the surface knows how to render, and a bad suggestion is worse
      // than no suggestion in a product whose whole claim is that it is not a
      // shop.
      const qualifier = hints.colour ?? hints.brand;
      if (!qualifier) return Response.json({ products: [] });

      const query = `${hints.colour ?? ''} ${recipe.word}`.trim();

      // ── The licensed catalogue, fail-closed ──────────────────────────────
      const opts = catalogOptsFromEnv(admin);
      if (!opts) return Response.json({ products: [] });

      // Counters are fire-and-forget: a health metric that could fail a
      // suggestion would be worse than no metric at all.
      const note = (metric: string, detail?: string) => {
        void admin
          .rpc('note_commerce_metric', { p_metric: metric, p_delta: 1, p_detail: detail ?? null })
          .then(({ error }) => {
            if (error) console.error(`commerce-health: ${metric} not counted: ${error.message}`);
          });
      };

      let rows: CatalogProduct[];
      try {
        // `brand` goes to the catalogue's own brand FIELD when the closet
        // supplied one — the same lesson as garment-search: a brand name inside
        // a merchant's free-text title is not evidence the garment is that brand.
        //
        // `ALLOWED_MERCHANT_IDS` is the suggestion path's curated shop list. It
        // is applied in the QUERY rather than after it so the hundred rows the
        // request buys are a hundred rows from shops we would name.
        rows = await searchCatalogue(
          opts,
          'keyword',
          query,
          hints.brand ?? null,
          null,
          ALLOWED_MERCHANT_IDS,
        );
      } catch {
        // The only place the provider can fail from here. Recorded with a
        // constant string, never the thrown message — a provider error body
        // quotes the request back, and the request carries our query.
        note('provider_failure', 'catalogue_lookup_threw');
        return Response.json({ products: [] });
      }

      // ── Is each row actually the garment asked for? ──────────────────────
      //
      // Before any ranking, because ranking junk only decides which junk goes
      // first. `name LIKE black coat` matches "Black Coated Skinny Jean" and
      // `cream dress` matches "Ice Cream Dress"; both satisfy the query exactly
      // and neither is the garment. Costs nothing — the rows are already here.
      const relevant = rows.filter(
        (p) =>
          admitProduct(p.title, {
            slot: slot as RelevanceSlot,
            noun: recipe.word,
            colour: hints.colour ?? null,
            brand: p.brand,
          }).admitted,
      );

      // ── Rank on fit, then cap at three distinct merchants ────────────────
      const ranked = [...relevant].sort((a, b) => score(b, hints, slot) - score(a, hints, slot));

      // Which programmes are actually joined. Empty today, which is why every
      // row below currently comes back `paid: false`.
      const { data: joined } = await admin
        .from('commerce_joined_programmes')
        .select('network, merchant_id')
        .eq('active', true);
      const joinedKeys = new Set((joined ?? []).map((j) => `${j.network}:${j.merchant_id}`));

      const seen = new Set<string>();
      const products: ShopMatch[] = [];

      for (const p of ranked) {
        if (products.length >= MAX_MERCHANTS) break;
        // "At most three merchants" enforced by construction: the response can
        // never hold two rows from one shop, rather than by a client-side slice
        // a later edit could relocate above the dedupe.
        if (seen.has(p.merchant)) continue;
        seen.add(p.merchant);

        // `monetised` from the catalogue means only "a publisher id existed for
        // this network, so a tracking URL was built". Whether it EARNS is a
        // different fact and lives in the table above.
        // Three things must all hold: a tracking URL was buildable, the row
        // is on a network we hold a publisher id for, and that merchant's
        // programme is confirmed joined. The first two are about plumbing; only
        // the third is about money.
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
          // An unmonetised row goes to the merchant directly. Sending it through
          // a network redirect we earn nothing from would add a hop, hand a
          // third party the click, and still not pay — all cost, no benefit.
          url: paid ? p.linkUrl : p.directUrl,
          paid,
        });
      }

      // What actually went out. `links_direct` vs `links_paid` is the number
      // that keeps the disclosure honest at a glance: while the first is the
      // whole total, every row in the app truthfully reads "Open at merchant".
      if (products.length === 0) {
        note('suggestions_empty', slot);
      } else {
        note('suggestions_served', slot);
        const paidCount = products.filter((p) => p.paid).length;
        if (paidCount) note('links_paid');
        if (products.length - paidCount) note('links_direct');
      }
      if (rows.length - relevant.length > 0) note('rows_refused_as_irrelevant', slot);

      return Response.json({ products });
    },
  ),
};

// Exported for unit tests without spinning up the Deno runtime.
export const __testables = { CATALOG_SLOTS, MAX_MERCHANTS, SLOT_QUERY, score, readHints };
