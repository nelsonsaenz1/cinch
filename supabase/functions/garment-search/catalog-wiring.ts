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
import type { DatafeedrOpts } from '../_shared/catalog.ts';
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
 * What a request may actually do, given the environment it woke up in.
 *
 * `provider` is the composed chain. The two booleans exist because an empty
 * chain and a working chain that found nothing are completely different answers
 * and must not both arrive as an empty candidate list: "no licensed listing
 * matches that" is a true sentence CPV2-09 prints, and printing it when the
 * catalogue was never asked would be a lie the user has no way to detect.
 */
export type CatalogueWiring = {
  provider: GarmentImageProvider;
  /** The licensed catalogue itself, when configured. Families need the opts. */
  catalogue: DatafeedrOpts | null;
  /** False when the search chain is empty — nothing can answer a description. */
  canSearch: boolean;
  /** False when nothing can identify a brand from a photograph. */
  canMatch: boolean;
};

/**
 * Compose the provider chain: licensed feeds first, the web model path only as
 * a fallback, and not at all when the switch is off.
 *
 * ── WHY THE MISSING-SECRET FALLBACK IS GONE ───────────────────────────────
 *
 * This function used to open with `if (!opts) return fallback;` — if Datafeedr
 * was unconfigured, the bare web provider was returned, on the argument that a
 * user is better served by an unlicensed picture than a broken screen.
 *
 * That argument does not survive the two things that happened after it was
 * written. First, `GARMENT_SEARCH_ALLOW_UNLICENSED` was flipped to default
 * FALSE precisely so that losing a secret could not silently re-enable the open
 * web — and the early return bypassed that switch entirely, so the two changes
 * did not compose: a pruned `DATAFEEDR_ACCESS_ID` re-enabled exactly what the
 * default was set to prevent, with the kill switch still off and nothing
 * reporting it.
 *
 * Second, and decisively, the app now PRINTS the promise. `CATALOGUE_DISCLOSURE`
 * says "nothing you type is sent to an AI model", the sheet says it again, and
 * `web/privacy.html` says it a third time. The web provider sends the typed
 * description to a model with a web-search plugin. So the old degrade did not
 * merely widen the sources — it made three shipped sentences false, by way of a
 * missing environment variable, with no code change and no review.
 *
 * A degraded search is recoverable and honest. A false privacy claim is
 * neither. So the licensed path fails CLOSED: no catalogue means no search, and
 * the screen says the catalogue could not be reached.
 *
 * `tests/catalogue-fail-closed.test.ts` couples this to the printed sentence
 * directly, so the claim and the code cannot drift apart again.
 */
export function licensedFirst(
  admin: SupabaseClient<Database>,
  fallback: GarmentImageProvider | null,
): CatalogueWiring {
  const opts = catalogOptsFromEnv(admin);
  const allow = allowUnlicensed();
  const licensed = opts ? [datafeedrProvider(opts)] : [];

  return {
    provider: firstLicensed(licensed, fallback, allow),
    catalogue: opts,
    // An unconfigured catalogue can still be searched IF somebody has
    // deliberately set the unlicensed flag to "true" — that is the flag's whole
    // purpose, and it is an act rather than an accident.
    canSearch: licensed.length > 0 || (allow.search && fallback !== null),
    canMatch: licensed.length > 0 || (allow.match && fallback !== null),
  };
}
