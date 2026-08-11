/**
 * The plumbing between `catalog.ts` (which knows Datafeedr) and Postgres (which
 * holds the cache and the quota ledger).
 *
 * `catalog.ts` takes its cache and quota as injected functions rather than
 * reaching for a database client itself, which is what lets it be reasoned about
 * and tested without a Postgres. This file is the only place that knows both
 * halves, and it is deliberately small.
 *
 * WHY THE PROVIDER IS BUILT HERE RATHER THAN IN index.ts
 *
 * `index.ts` constructs a provider in two places (`search` and `match`). If the
 * composition lived there it would have to be repeated, and the day somebody
 * changed one and not the other, one of the two paths would silently go back to
 * the unlicensed source. One function, called twice, cannot drift.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import {
  type CatalogProduct,
  datafeedrProvider,
  firstLicensed,
  type LookupMode,
  type UnlicensedFallback,
} from './catalog.ts';
import type { GarmentImageProvider } from './provider.ts';

/**
 * Datafeedr `source_id` (a NETWORK, per country) to our publisher id on that
 * network. Not merchant id — see the note on `DatafeedrProduct.source_id`.
 *
 * Read from Datafeedr's own `/networks` on 2026-08-11:
 *   310  Awin US        4  Rakuten US
 *    10  Awin UK       48  Rakuten Australia
 *
 * Awin US and Awin UK share one publisher id because Awin issues one per
 * publisher account, not per territory. Rakuten is absent on purpose: its `@@@`
 * takes the 11-character mixed-case tracking id, which only exists once a
 * partnership is approved, and putting the SID there yields a link that lands on
 * an error page instead of failing loudly. A missing entry is NOT an error — the
 * row falls back to `direct_url`, which works and earns nothing, and that is the
 * whole reason this can ship before any approval lands.
 */
function affiliateIdsFromEnv(): Record<number, string> {
  const ids: Record<number, string> = {};

  const awin = Deno.env.get('AWIN_PUBLISHER_ID');
  if (awin) {
    ids[310] = awin; // Awin US
    ids[10] = awin; // Awin UK
  }

  const rakuten = Deno.env.get('RAKUTEN_TRACKING_ID');
  // Guard the shape rather than trusting it. The SID is 4–8 digits and the
  // tracking id is 11 mixed-case characters; a digits-only value here is the
  // known confusion, and accepting it would produce links that quietly fail.
  if (rakuten && /^[A-Za-z0-9]{11}$/.test(rakuten) && /[A-Za-z]/.test(rakuten)) {
    ids[4] = rakuten; // Rakuten US
  } else if (rakuten) {
    console.error(
      'catalog: RAKUTEN_TRACKING_ID is not an 11-character alphanumeric tracking id ' +
        '(a 4-8 digit value is the SID, which belongs elsewhere) — ignoring it',
    );
  }

  return ids;
}

/**
 * The two kill switches, read per request rather than at module load so that
 * flipping either is a secret change plus a cold start, not a redeploy.
 *
 * `GARMENT_SEARCH_ALLOW_UNLICENSED` governs IMAGES from the open web and
 * **defaults to FALSE**. It shipped defaulting to true, which was the wrong way
 * round in the one way that matters: the secret is what turns the unlicensed
 * path OFF, so losing it — a project restore, a secret pruned by mistake, a new
 * environment stood up from the repo — would silently re-enable exactly the
 * behaviour this module exists to replace, and nothing would report it. The
 * safe state is the default state; enabling the open web is now the act that
 * requires a deliberate `"true"`.
 *
 * Licensed-only is also what the measurement supports: post-policy coverage was
 * 28/28 against real garment descriptions on 2026-08-11, every case filling all
 * six candidate slots.
 *
 * `GARMENT_SEARCH_ALLOW_UNLICENSED_MATCH` governs BRAND IDENTIFICATION from a
 * photograph the user took themselves, and defaults to TRUE — see
 * `UnlicensedFallback` for why these are not one switch. Its default runs the
 * other way because its failure mode does too: losing the secret restores a
 * feature rather than a licensing exposure, since reading a brand off the
 * user's own picture copies no image.
 */
function allowUnlicensed(): UnlicensedFallback {
  return {
    search: Deno.env.get('GARMENT_SEARCH_ALLOW_UNLICENSED') === 'true',
    match: (Deno.env.get('GARMENT_SEARCH_ALLOW_UNLICENSED_MATCH') ?? 'true') !== 'false',
  };
}

/**
 * Compose the provider chain: licensed feeds first, the web model path only as
 * a fallback, and not at all when the switch is off.
 *
 * Returns `fallback` unchanged when Datafeedr is not configured, so a missing
 * secret degrades to exactly today's behaviour rather than to no search at all.
 */
export function licensedFirst(
  admin: SupabaseClient<Database>,
  fallback: GarmentImageProvider,
): GarmentImageProvider {
  const accessId = Deno.env.get('DATAFEEDR_ACCESS_ID');
  const accessKey = Deno.env.get('DATAFEEDR_ACCESS_KEY');

  if (!accessId || !accessKey) {
    console.error('catalog: DATAFEEDR_ACCESS_ID/KEY unset — licensed path is off');
    return fallback;
  }

  const datafeedr = datafeedrProvider({
    accessId,
    accessKey,
    affiliateIds: affiliateIdsFromEnv(),
    claimRequest: (exact) => claimRequest(admin, exact),
    cacheGet: (key) => cacheGet(admin, key),
    cachePut: (key, mode, query, products, ttlHours) =>
      cachePut(admin, key, mode, query, products, ttlHours),
  });

  return firstLicensed([datafeedr], fallback, allowUnlicensed());
}

/**
 * Claim one metered request, or refuse it.
 *
 * The decision is made in SQL (`claim_catalog_request`) and never reimplemented
 * here: two concurrent lookups must not both believe they took the last request
 * of the month, and only a `for update` inside the database can promise that.
 *
 * Fails CLOSED. If the ledger cannot be read we refuse the request rather than
 * spend one — Datafeedr stops dead at the monthly limit with no overage, so the
 * cost of a wrong "yes" near the cap is that the feature stops working for
 * everybody until the cycle rolls, while the cost of a wrong "no" is one lookup
 * falling back to the web path.
 */
async function claimRequest(
  admin: SupabaseClient<Database>,
  exact: boolean,
): Promise<boolean> {
  const { data, error } = await admin.rpc('claim_catalog_request', {
    p_provider: 'datafeedr',
    p_exact: exact,
  });

  if (error) {
    console.error(`catalog: quota claim failed, refusing request: ${error.message}`);
    return false;
  }
  return data === true;
}

/**
 * Three distinct return values, and the distinction is the whole point:
 *
 *   undefined  no row, or expired      -> ask the provider
 *   CatalogProduct[]  a stored answer  -> serve it
 *   null       a stored MISS           -> serve nothing, and DO NOT ask again
 *
 * Collapsing the last two into "falsy" is the single most expensive bug
 * available in this file. It costs a metered request every time anybody
 * re-describes a garment no feed carries, and those are precisely the garments
 * people describe more than once.
 *
 * A read error returns `undefined` rather than `null`: degrading to "ask the
 * provider" spends a request, whereas degrading to "cached miss" would invent a
 * negative answer the cache never actually held.
 */
async function cacheGet(
  admin: SupabaseClient<Database>,
  key: string,
): Promise<CatalogProduct[] | null | undefined> {
  const { data, error } = await admin.rpc('read_catalog_cache', { p_cache_key: key });

  if (error) {
    console.error(`catalog: cache read failed: ${error.message}`);
    return undefined;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.is_hit) return undefined;
  if (row.products === null) return null; // cached miss, authoritative

  return row.products as unknown as CatalogProduct[];
}

/**
 * Store an answer, including a negative one.
 *
 * `product_count` is derived here rather than trusted from a caller, because the
 * table's own CHECK requires it to agree with the payload and a mismatch would
 * reject the write at the moment we have already paid for the data.
 *
 * `terms` arrives already sanitised — a sorted, order-free subset of a fixed
 * garment vocabulary. This function does not receive the user's words at all,
 * which is the point: there is no line here that could accidentally start
 * writing them.
 */
async function cachePut(
  admin: SupabaseClient<Database>,
  key: string,
  mode: LookupMode,
  terms: string[],
  products: CatalogProduct[] | null,
  ttlHours: number,
): Promise<void> {
  const now = Date.now();
  const { error } = await admin.from('catalog_lookups').upsert(
    {
      cache_key: key,
      provider: 'datafeedr',
      mode,
      terms,
      products: products as unknown as Database['public']['Tables']['catalog_lookups']['Insert']['products'],
      product_count: products?.length ?? 0,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlHours * 3_600_000).toISOString(),
    },
    { onConflict: 'cache_key' },
  );

  // Counted, not just logged. Every failed write is a cache miss somebody pays
  // for again on the next lookup, so a rising rate here is a bill, not noise —
  // and a silent one, because the user still gets their answer from the
  // response already in hand. (Audit item 28.)
  if (error) {
    console.error(`catalog: cache write failed: ${error.message}`);
    await admin
      .rpc('note_catalog_cache_write_failure', { p_provider: 'datafeedr' })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error(`catalog: could not count the failure: ${rpcError.message}`);
      });
  }
}
