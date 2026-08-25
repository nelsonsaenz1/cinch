import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { searchCatalogue, type CatalogProduct } from '../_shared/catalog.ts';
import { catalogOptsFromEnv } from '../_shared/catalog-store.ts';
import { trackingUrl } from '../_shared/commerce.ts';
import { publisherIdsFromEnv } from '../_shared/commerce-env.ts';
import { ALLOWED_MERCHANT_IDS } from '../_shared/merchants.ts';

import { CATALOG_SLOTS, decide, isCatalogSlot, readHints, type Deps } from './policy.ts';

/**
 * gap-shop-match — commerce-directive.md §2/§3, C-01/C-02/C-04's server half.
 *
 * ONE FUNCTION, TWO CALLERS: the Gap Feed matching a computed gap (C-01) and a
 * friend's closet item detail matching a specific piece (C-04). The request is
 * a `slot` in the ten-value vocabulary both sides already speak.
 *
 * THIS FILE IS PLUMBING. THE RULES ARE IN `policy.ts`.
 *
 * Everything that decides who may see what — the viewer's preference, the
 * owner's `shoppable`, the three-merchant cap, whether a link may be called
 * paid — lives in `policy.ts`, which imports no Deno and no npm and is
 * therefore testable. `tests/gap-shop-policy.test.ts` exercises all of it.
 *
 * That split exists because of what happened on 2026-08-11: a version of this
 * function shipped that returned a wooden coat stand for "coat", and the reason
 * nobody caught it is that nothing here could be run without deploying it.
 *
 * WHAT THIS READS AND WHY THE CLIENTS DIFFER
 *
 * `db` is the CALLER's client, carrying their RLS. `admin` is the service role.
 * The friend-item check deliberately uses `db`: the owner's consent must be
 * decided by the existing friendship and privacy layer, not reimplemented here
 * with a service-role read that would see rows the caller cannot.
 *
 * DISCOVERY AND MONETISATION ARE SEPARATE, AND STAY SEPARATE
 *
 * Nothing on the ranking path knows what anything pays. The order of results is
 * decided entirely by how well a product answers the gap, and monetisation is
 * resolved afterwards, per row, purely to decide how the link is LABELLED.
 * There is no commission figure anywhere to sort by even by accident, and
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
 */

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
      if (raw.itemId !== undefined && typeof raw.itemId !== 'string') {
        return fail('invalid_request', 'itemId must be a string.', 400);
      }

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // Counters are fire-and-forget: a health metric that could fail a
      // suggestion would be worse than no metric at all.
      const note: Deps['note'] = (metric, detail) => {
        void admin
          .rpc('note_commerce_metric', { p_metric: metric, p_delta: 1, p_detail: detail ?? undefined })
          .then(({ error }) => {
            if (error) console.error(`commerce-health: ${metric} not counted: ${error.message}`);
          });
      };

      const opts = catalogOptsFromEnv(admin);

      const deps: Deps = {
        showWhereToBuy: async () => {
          const { data, error } = await db
            .from('profiles')
            .select('show_where_to_buy')
            .eq('user_id', userId)
            .single();
          // A profile we cannot read is not consent to suggest. Returning
          // `false` fails closed; `null` would be read as "no preference set".
          if (error) return false;
          return data?.show_where_to_buy ?? null;
        },

        itemShoppable: async (itemId) => {
          const { data, error } = await db
            .from('friend_items')
            .select('id, shoppable')
            .eq('id', itemId)
            .maybeSingle();
          if (error || !data) return null;
          return data.shoppable === true;
        },

        search: async (query, brand) => {
          // Fail-closed: no licensed catalogue configured means no products,
          // never an unlicensed substitute.
          if (!opts) return [];
          // `ALLOWED_MERCHANT_IDS` is the suggestion path's curated shop list,
          // applied in the QUERY rather than after it so the hundred rows the
          // metered request buys are a hundred rows from shops we would name.
          // `garment-search` deliberately passes nothing here — see
          // `_shared/merchants.ts`.
          return await searchCatalogue(opts, 'keyword', query, {
            brand,
            merchantIds: ALLOWED_MERCHANT_IDS,
            // Both defaults, named rather than omitted. This path suggests
            // something to BUY, so a sold-out listing is a dead tile and one
            // representative row per garment is what it wants — the opposite
            // of the matcher on both counts. Written out so the difference is
            // visible here rather than only in `catalog.ts`.
            duplicates: 'variants',
            availability: 'in-stock-only',
          });
        },

        searchOwned: async (slot, hints) => {
          // The OWNED catalogue: rows `sync-feeds` ingested from programmes
          // Cinch is joined to (2026-08-25 decision — merchant-allowlist.md
          // records why membership, founder-accepted per invitation, is this
          // source's admission rule where Datafeedr's is the allowlist).
          //
          // `admin` on purpose: the catalogue tables are server-only, RLS with
          // no policies. Nothing user-specific is in the query — a slot and a
          // colour word — so the service role reads exactly what any caller
          // would get.
          //
          // Hint text is embedded in a PostgREST `or()` filter, whose syntax
          // travels in the value, so it is reduced to word characters first.
          // Dropping a strange hint means fewer rows, never a broken query.
          const clean = (v?: string) =>
            v
              ?.toLowerCase()
              .replace(/[^a-z0-9 -]/g, '')
              .trim() || undefined;
          const colour = clean(hints.colour);
          const brand = clean(hints.brand);

          let query = admin
            .from('catalog_products')
            .select(
              'external_id, title, brand, colour, price_cents, currency, image_url, product_url, google_category, catalog_merchants!inner(external_id, name, network, active)',
            )
            .eq('slot', slot)
            .eq('availability', 'in_stock')
            .eq('catalog_merchants.network', 'awin')
            .eq('catalog_merchants.active', true)
            .limit(100);
          if (colour) query = query.or(`colour.ilike.%${colour}%,title.ilike.%${colour}%`);
          if (brand) query = query.ilike('brand', `%${brand}%`);

          const { data, error } = await query;
          if (error) throw new Error(`owned catalogue: ${error.message}`);

          const ids = publisherIdsFromEnv();
          const out: CatalogProduct[] = [];
          for (const row of data ?? []) {
            const merchant = row.catalog_merchants;
            let sourceHost: string;
            try {
              sourceHost = new URL(row.product_url).hostname;
            } catch {
              continue;
            }
            // The tracking link is derived here, at read time, like every
            // other affiliate URL (commerce.ts). A build failure — publisher
            // id unset — degrades to the plain link with `monetised: false`,
            // which the policy then correctly refuses to call paid.
            let linkUrl = row.product_url;
            let monetised = false;
            try {
              linkUrl = trackingUrl('awin', merchant.external_id, row.product_url, ids);
              monetised = true;
            } catch {
              // The direct link still works and still says so.
            }
            out.push({
              title: row.title,
              brand: row.brand,
              merchant: merchant.name,
              sourceHost,
              imageUrl: row.image_url,
              thumbnailUrl: null,
              linkUrl,
              monetised,
              priceMinor: row.price_cents ?? 0,
              currency: row.currency ?? 'USD',
              identifier: null,
              // Prefixed so it can never collide with a Datafeedr row id in a
              // React key or a dedupe set.
              externalId: `awinfeed:${merchant.external_id}:${row.external_id}`,
              // THE NETWORK'S OWN advertiser id — unlike Datafeedr rows, where
              // `merchantId` is Datafeedr's. This is what makes the joined
              // check (`awin:124976`) and the `Paid link` label line up with
              // `commerce_joined_programmes` with no translation table.
              merchantId: merchant.external_id,
              sourceId: 310, // Awin US — networkFamily() reads this as 'awin'.
              directUrl: row.product_url,
              colour: row.colour,
              category: row.google_category,
              gender: null,
            });
          }
          return out;
        },

        joined: async () => {
          const { data } = await admin
            .from('commerce_joined_programmes')
            .select('network, merchant_id')
            .eq('active', true);
          return new Set((data ?? []).map((j) => `${j.network}:${j.merchant_id}`));
        },

        note,
      };

      const decision = await decide(
        { slot: raw.slot, itemId: raw.itemId, hints: readHints(raw.hints) },
        deps,
      );

      if (decision.products.length === 0 && decision.refusal) {
        // One counter for every empty answer, with the reason. An empty shop row
        // is a legitimate state, so the only way to tell "nobody sells this"
        // from "the provider is down" is to record which it was.
        note('suggestions_empty', decision.refusal);
      }

      return Response.json({ products: decision.products });
    },
  ),
};
