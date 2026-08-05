/**
 * Exclusive claim on a per-item AI job.
 *
 * `tag-item` is invoked by the client's upload queue at concurrency 3 and is
 * retried by the client on failure, so "two invocations for the same item are
 * in flight at once" is an ordinary Tuesday rather than an attack. Without a
 * claim, both read the same untagged row, both call the vision model, and we
 * pay twice for one photograph.
 *
 * The claim is a row in `command_log` (migration 20260804200000), keyed by the
 * item id in the primary key `op_id`. That table exists for exactly this shape
 * of problem — "a client-generated operation id so a retry returns the original
 * result instead of doing the work twice" — and the primary key is what makes
 * the claim atomic: the second concurrent insert loses on a unique violation
 * rather than on anything this code decides. Item ids and client-generated
 * operation ids are both v4 uuids, so they share the keyspace without colliding.
 *
 * The claim is a lease, not a lock. An invocation killed mid-call (platform
 * timeout, deploy) would otherwise leave an item permanently unclaimable, and
 * "your photo never got tagged and the app will not retry" is a worse failure
 * than paying for one duplicate call in a rare race.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';

/** How long a claim is honoured before another invocation may take it over. */
const LEASE_MS = 5 * 60_000;

export type ClaimOutcome =
  /** This invocation owns the job and may call the provider. */
  | { claimed: true }
  /** Another invocation is working on it right now. */
  | { claimed: false; reason: 'in_flight' }
  /** A previous invocation finished this job. */
  | { claimed: false; reason: 'already_done' };

/**
 * Take the claim for `itemId`, or report who has it.
 *
 * `admin` must be the service-role client: `command_log` grants clients SELECT
 * only, which is deliberate — a claim a client could forge is not a claim.
 */
export async function claimItemJob(
  admin: SupabaseClient<Database>,
  itemId: string,
  userId: string,
  kind: string,
): Promise<ClaimOutcome> {
  const { error } = await admin.from('command_log').insert({
    op_id: itemId,
    user_id: userId,
    kind,
  });

  if (!error) return { claimed: true };

  // 23505 is unique_violation: somebody already holds or held this claim.
  // Anything else is a real database problem and must not be read as "busy".
  if (error.code !== '23505') {
    throw new Error(`Could not claim the tagging job: ${error.message}`);
  }

  const { data: existing } = await admin
    .from('command_log')
    .select('op_id, user_id, claimed_at, result_id')
    .eq('op_id', itemId)
    .maybeSingle();

  // Gone between the insert and the read — another invocation released a failed
  // claim. Retrying the whole claim once would be the tidier answer; reporting
  // it as busy is the safe one, and the client already retries.
  if (!existing) return { claimed: false, reason: 'in_flight' };

  if (existing.result_id !== null) return { claimed: false, reason: 'already_done' };

  const age = Date.now() - new Date(existing.claimed_at).getTime();
  if (age < LEASE_MS) return { claimed: false, reason: 'in_flight' };

  // Take over the expired lease, but only if nobody else did first: matching on
  // the exact `claimed_at` we read makes the takeover atomic in the same way
  // the insert was, so two invocations finding the same stale claim cannot both
  // win it.
  const { data: taken } = await admin
    .from('command_log')
    .update({ claimed_at: new Date().toISOString() })
    .eq('op_id', itemId)
    .eq('claimed_at', existing.claimed_at)
    .select('op_id');

  return taken?.length ? { claimed: true } : { claimed: false, reason: 'in_flight' };
}

/**
 * Mark the claimed job finished. A non-null `result_id` is what `claim_command`
 * and this module both read as "the original attempt got there".
 */
export async function completeItemJob(
  admin: SupabaseClient<Database>,
  itemId: string,
): Promise<void> {
  await admin
    .from('command_log')
    .update({ result_id: itemId })
    .eq('op_id', itemId);
}

/**
 * Drop the claim so the item can be tried again.
 *
 * Called when the job ends without a result. Keeping the row would be tidier
 * bookkeeping and would also mean a transient provider outage permanently
 * pinned every item it touched.
 */
export async function releaseItemJob(
  admin: SupabaseClient<Database>,
  itemId: string,
): Promise<void> {
  await admin.from('command_log').delete().eq('op_id', itemId);
}
