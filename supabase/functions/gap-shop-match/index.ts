import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { publisherIdsFromEnv, trackingUrl, type Network } from '../_shared/commerce.ts';

/**
 * gap-shop-match — commerce-directive.md §2/§3, C-01/C-02/C-04's server half.
 *
 * ONE FUNCTION, TWO CALLERS. The request shape is a bare `slot`, in
 * `catalog_products.slot`'s own ten-value vocabulary (20260811143000) — not
 * "kind" or "gap", because this endpoint does not know or care whether the
 * caller is the Gap Feed matching a computed gap (C-01, four of the ten
 * slots, mapped client-side in `src/features/commerce/slot.ts`) or a
 * friend's closet item detail matching a specific piece's own category
 * (C-04, which needs all ten — `item_category` and `catalog_products.slot`
 * share the identical enum by design, so a friend's item passes its
 * `category` straight through with no translation). Naming the request
 * after the schema's own vocabulary is what let one function serve both
 * without either caller bending its language to fit the other's.
 *
 * WHY THIS IS A SERVER FUNCTION AND NOT A CLIENT QUERY
 *
 * `catalog_products`/`catalog_merchants` grant nothing to `anon` or
 * `authenticated` (20260811143000) — "clients never query the catalogue
 * directly" is the schema's own rule, not a preference of this file's. So
 * neither caller has a path to the data except through here, which is also
 * the one place `trackingUrl()` runs — a publisher id never reaches the
 * client, and the two per-network reference fields commerce.ts refuses to
 * set (`clickref`, `u1`) never get a client-side call site that could set
 * them by accident later.
 *
 * WHAT "BEST MATCH" MEANS HERE
 *
 * Slot, in stock, nothing more. commerce-directive.md §0 rules out ANY
 * ordering by pay rate; since this schema carries no commission column at
 * all (20260811143000), there is nothing to accidentally sort by even if the
 * query below were careless about it. C-04's "Find it" matches by the
 * piece's own category, the same coarse signal C-01 uses — it is a "shop
 * this kind of thing" match, not a reverse-image search for the exact piece
 * pictured, and the client-side copy says so rather than promising a
 * precision this endpoint does not have. A precise per-photograph match
 * would extend `garment-search`'s existing `match` action (already built
 * for exactly that, for a user's OWN items) to a friend's item under
 * `shoppable` — a real feature, deliberately left out of this pass: it needs
 * its own authorization review (whose AI consent gates a cross-account
 * search? does a declined match leak that a search was attempted?) rather
 * than an answer improvised inside an unrelated function.
 *
 * AT MOST THREE MERCHANTS
 *
 * One product per distinct merchant, freshest `updated_at` first within a
 * merchant. C-01's "at most three merchants" is enforced by construction —
 * the response can never contain two rows from the same shop — not by a
 * client-side slice that a future edit could relocate above the dedupe.
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
/** Candidates pulled before the per-merchant dedupe — generous enough that a
 *  handful of merchants selling the same slot still yields three distinct ones. */
const CANDIDATE_POOL = 24;

type CatalogProductRow = {
  id: string;
  title: string;
  brand: string | null;
  colour: string | null;
  price_cents: number | null;
  currency: string | null;
  image_url: string;
  product_url: string;
  updated_at: string;
  merchant: {
    id: string;
    name: string;
    network: string;
    external_id: string;
    active: boolean;
  } | null;
};

export type ShopMatch = {
  id: string;
  title: string;
  brand: string | null;
  colour: string | null;
  priceCents: number | null;
  currency: string | null;
  imageUrl: string;
  merchantName: string;
  /** Built by trackingUrl() — never the bare product_url. See the file header. */
  trackingUrl: string;
};

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

function isNetwork(value: string): value is Network {
  return value === 'awin' || value === 'rakuten';
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

      const slot = (body as { slot?: unknown })?.slot;
      if (!isCatalogSlot(slot)) {
        return fail(
          'invalid_request',
          `slot must be one of: ${CATALOG_SLOTS.join(', ')}.`,
          400,
        );
      }

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // C-03, enforced server-side too — the same defense-in-depth posture
      // every consent-gated function in this codebase already takes (see
      // garment-search's ai_consent check). A client that hid its own
      // merchant rows must not still be able to fetch the data behind them by
      // calling this endpoint directly. This is the CALLER's own preference —
      // for C-04 that is the person looking at a friend's closet, not the
      // friend; a viewer who turned shop suggestions off gets none anywhere,
      // including on someone else's piece.
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('show_where_to_buy')
        .eq('user_id', userId)
        .single();

      if (profileError) return fail('profile_read_failed', profileError.message, 500);
      if (profile?.show_where_to_buy === false) {
        return Response.json({ products: [] });
      }

      // service_role — catalog_products/catalog_merchants grant nothing to
      // authenticated (20260811143000). One query, an inner join so a product
      // whose merchant lapsed (or the merchant row was deleted, cascading)
      // never surfaces without a merchant to name.
      const { data, error } = await admin
        .from('catalog_products')
        .select(
          'id, title, brand, colour, price_cents, currency, image_url, product_url, updated_at, merchant:catalog_merchants!inner(id, name, network, external_id, active)',
        )
        .eq('slot', slot)
        .eq('availability', 'in_stock')
        .eq('merchant.active', true)
        .order('updated_at', { ascending: false })
        .limit(CANDIDATE_POOL);

      if (error) return fail('catalog_read_failed', error.message, 500);

      const ids = publisherIdsFromEnv();
      const seenMerchants = new Set<string>();
      const products: ShopMatch[] = [];

      for (const row of (data ?? []) as unknown as CatalogProductRow[]) {
        if (products.length >= MAX_MERCHANTS) break;
        const merchant = row.merchant;
        if (!merchant || seenMerchants.has(merchant.id)) continue;
        if (!isNetwork(merchant.network)) continue; // unreachable given the check constraint; narrows the type

        let link: string;
        try {
          link = trackingUrl(merchant.network, merchant.external_id, row.product_url, ids);
        } catch {
          // No publisher id configured for this network yet, or a malformed
          // stored URL — either way, never show a row whose link is not
          // actually tracked. Skip the product, not the whole response: the
          // other network may still be configured.
          continue;
        }

        seenMerchants.add(merchant.id);
        products.push({
          id: row.id,
          title: row.title,
          brand: row.brand,
          colour: row.colour,
          priceCents: row.price_cents,
          currency: row.currency,
          imageUrl: row.image_url,
          merchantName: merchant.name,
          trackingUrl: link,
        });
      }

      return Response.json({ products });
    },
  ),
};

// Exported for a future unit test without spinning up the Deno runtime.
export const __testables = { CATALOG_SLOTS, MAX_MERCHANTS };
