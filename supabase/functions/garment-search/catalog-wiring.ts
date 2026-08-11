/**
 * Where the provider meets the environment.
 *
 * Split from `catalog-provider.ts` so that file stays PURE — no `Deno.env`, no
 * database client, no `npm:` specifier. That matters because
 * `tests/catalog-cache.test.ts` imports the provider directly to assert the
 * cache's state machine, and the repo's test runner is Node: anything reachable
 * from that import has to compile without the Deno runtime. Keeping the two
 * apart is what lets the cache semantics be tested at all rather than trusted.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { catalogOptsFromEnv } from '../_shared/catalog-store.ts';
import type { GarmentImageProvider } from './provider.ts';
import { datafeedrProvider, firstLicensed, type UnlicensedFallback } from './catalog-provider.ts';

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
 * Returns `fallback` unchanged when Datafeedr is unconfigured, so a missing
 * secret degrades to the previous behaviour rather than to no search at all.
 * That is the one place the licensed path does NOT fail closed, and it is
 * deliberate: a user searching for a garment is better served by an unlicensed
 * picture than by a broken screen, and the switch above is what makes that a
 * decision rather than an accident.
 */
export function licensedFirst(
  admin: SupabaseClient<Database>,
  fallback: GarmentImageProvider,
): GarmentImageProvider {
  const opts = catalogOptsFromEnv(admin);
  if (!opts) return fallback;
  return firstLicensed([datafeedrProvider(opts)], fallback, allowUnlicensed());
}
