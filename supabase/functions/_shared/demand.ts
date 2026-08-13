/**
 * The database half of the demand aggregate.
 *
 * The canonicalisation — and the argument for why it is safe — lives in
 * `demand-intent.ts`. This file is only the call, kept separate so the logic
 * can be tested without a Supabase client. See that file's header.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';
import type { ParsedQuery } from './catalog-query.ts';
import { demandIntent, isRecordableIntent, latencyBucket } from './demand-intent.ts';

export * from './demand-intent.ts';

export type DemandCounters = {
  searches?: number;
  zeroResult?: number;
  familyOpens?: number;
  importAttempts?: number;
  importSuccesses?: number;
  latencyMs?: number;
};

/**
 * Bump the counters for one intent.
 *
 * Never throws and never fails the request. This is bookkeeping for a search
 * the user has already waited for and already paid a metered request for;
 * turning a counter failure into a 500 would throw away a finished answer to
 * protect a statistic.
 *
 * Returns the intent key when a row was touched, null when there was nothing
 * recognised — which the caller can log but must not act on.
 */
export async function recordDemand(
  admin: SupabaseClient<Database>,
  parsed: ParsedQuery,
  counters: DemandCounters,
): Promise<string | null> {
  const intent = demandIntent(parsed);
  if (!isRecordableIntent(intent)) return null;

  try {
    /**
     * Cast, and the reason is the generator rather than the schema.
     *
     * Every one of these parameters is nullable in SQL — `p_brand_slug text`
     * with no NOT NULL — and null is the meaningful value for "not
     * recognised". `gen:types` models a bare `text` argument as a required
     * `string`, so the honest call does not typecheck against the generated
     * signature. The cast is narrow and lives at the one call site.
     */
    const { data, error } = await admin.rpc('record_catalogue_demand', {
      p_brand_slug: intent.brandSlug,
      p_garment_class: intent.garmentClass,
      p_audience: intent.audience,
      p_colour_family: intent.colourFamily,
      p_searches: counters.searches ?? 0,
      p_zero_result: counters.zeroResult ?? 0,
      p_family_opens: counters.familyOpens ?? 0,
      p_import_attempts: counters.importAttempts ?? 0,
      p_import_successes: counters.importSuccesses ?? 0,
      p_latency_bucket: counters.latencyMs === undefined ? null : latencyBucket(counters.latencyMs),
    } as never);

    if (error) {
      console.error(`record_catalogue_demand rejected: ${error.code ?? 'no-code'} ${error.message}`);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error('record_catalogue_demand threw:', err);
    return null;
  }
}
