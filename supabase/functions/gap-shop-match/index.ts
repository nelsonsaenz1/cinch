import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { searchCatalogue } from '../_shared/catalog.ts';
import { catalogOptsFromEnv } from '../_shared/catalog-store.ts';
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
          return await searchCatalogue(
            opts,
            'keyword',
            query,
            brand,
            null,
            ALLOWED_MERCHANT_IDS,
          );
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
