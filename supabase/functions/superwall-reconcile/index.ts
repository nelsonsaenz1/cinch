import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { isSuperwallAlias, reconcile } from '../_shared/superwall-plan.ts';

/**
 * superwall-reconcile — give the purchase back to the person who paid for it.
 *
 * Audit item 24. A purchase made before `identify()` bound the Supabase user id
 * to the Superwall session is attributed to an anonymous `$SuperwallAlias:` that
 * maps to no user, so `superwall-webhook` writes no plan. Item 23 made that a
 * row in `superwall_events` instead of only a log line. This drains it.
 *
 * The app calls this once when a session is established, carrying the alias
 * SuperwallKit generated on that device. Almost every call finds nothing and
 * says so; that is the expected shape, not a failure.
 *
 * ── Why this is safe to expose to the app ───────────────────────────────────
 *
 * The user id comes from the verified JWT, never from the body — a caller can
 * only ever claim a purchase FOR THEMSELVES. What the body supplies is the
 * alias, which is a v4 UUID generated on-device and never transmitted to any
 * other client. Possession is the proof, and `claim_superwall_alias` makes the
 * binding exclusive and atomic so the same alias can never pay out twice. See
 * that function's migration for the shared-device case.
 *
 * ── Why it does not simply trust the queue ──────────────────────────────────
 *
 * The stored events are replayed through the same `_shared/superwall-plan.ts`
 * the live webhook uses, and the result is still subject to the same staleness
 * rule against whatever is already in `subscriptions`. A queued purchase that
 * has since expired, or that a later renewal already superseded, must not
 * resurrect an entitlement.
 */

interface Body {
  alias?: unknown;
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed.' }, { status: 405 });
      }

      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      // `UserClaims` normalizes the JWT's `sub` to `id`. There is no `.sub`.
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

      let body: Body;
      try {
        body = (await req.json()) as Body;
      } catch {
        return Response.json({ error: 'Malformed body.' }, { status: 400 });
      }

      const alias = typeof body.alias === 'string' ? body.alias : '';

      // Checked here as well as in SQL. The database is the authority — it is
      // what a service-role caller would also have to satisfy — but rejecting a
      // malformed alias before spending a round trip keeps the common bad case
      // cheap, and keeps the 400 distinguishable from "nothing to claim".
      if (!isSuperwallAlias(alias)) {
        return Response.json({ error: 'Not a Superwall alias.' }, { status: 400 });
      }

      // ── Claim ───────────────────────────────────────────────────────────
      //
      // Binds every unclaimed event for this alias to this user, atomically, and
      // returns them. Anything it does NOT return was either already claimed or
      // never queued, and in both cases there is nothing left to do.
      const { data: claimed, error: claimError } = await admin.rpc('claim_superwall_alias', {
        p_alias: alias,
        p_user_id: userId,
      });

      if (claimError) {
        console.error(`Alias claim failed for ${userId}: ${claimError.message}`);
        return Response.json({ error: 'Could not check for earlier purchases.' }, { status: 500 });
      }

      if (!claimed?.length) {
        return Response.json({ ok: true, reconciled: false, reason: 'nothing_queued' });
      }

      // ── Decide ──────────────────────────────────────────────────────────
      //
      // Rows come back in no guaranteed order, so they are sorted before being
      // folded. `reconcile` settles a queue holding more than one event — a
      // purchase and then an upgrade, or a purchase and then an expiration — on
      // the same `expirationAt` recency rule the live path uses.
      const settled = reconcile(
        [...claimed]
          .sort((a, b) => (a.expiration_at ?? '').localeCompare(b.expiration_at ?? ''))
          .map((row) => ({
            type: row.event_type,
            productId: row.product_id,
            periodEnd: row.expiration_at,
          })),
      );

      if (settled?.unmapped.length) {
        // Not fatal — the rest of the queue can still be settled — but it means
        // a product exists in the Superwall dashboard that PRODUCT_PLANS has
        // never heard of, which will also be silently downgrading people at
        // renewal on the live path.
        console.error(
          `Unmapped Superwall products during reconciliation: ${settled.unmapped.join(', ')}`,
        );
      }

      if (!settled) {
        return Response.json({ ok: true, reconciled: false, reason: 'no_plan_in_queue' });
      }

      // ── Apply, under the same staleness rule as the live path ───────────
      const { data: current, error: readError } = await admin
        .from('subscriptions')
        .select('current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (readError) {
        // The rows stay claimed. That is deliberate: re-running the claim would
        // return nothing, so this reports the failure rather than pretending
        // there was nothing to find. `superwall_unreconciled` will not list
        // these, but `reconciled_user_id` records who they belong to, which is
        // what an operator needs to finish the job by hand.
        console.error(`Could not read subscription during reconciliation: ${readError.message}`);
        return Response.json({ error: 'Could not apply your earlier purchase.' }, { status: 500 });
      }

      if (
        settled.periodEnd &&
        current?.current_period_end &&
        settled.periodEnd <= current.current_period_end
      ) {
        // The queued purchase is older than what this user already has. Claiming
        // it was still right — it stops the row being offered again — but
        // applying it would be a downgrade.
        return Response.json({ ok: true, reconciled: false, reason: 'stale' });
      }

      const { data: written, error: writeError } = await admin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: settled.plan,
            current_period_end: settled.periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select('user_id');

      if (writeError || !written?.length) {
        console.error(
          `Could not write reconciled subscription for ${userId}: ` +
            (writeError?.message ?? 'no row written'),
        );
        return Response.json({ error: 'Could not apply your earlier purchase.' }, { status: 500 });
      }

      // Recorded against every event that contributed, so the ledger shows both
      // what the webhook decided at the time and that it was later put right.
      for (const row of claimed) {
        const { error } = await admin.rpc('note_superwall_outcome', {
          p_svix_id: row.svix_id,
          p_outcome: 'reconciled',
          p_plan: settled.plan,
        });
        if (error) console.error(`Reconciled outcome not recorded: ${error.message}`);
      }

      console.log(
        `Reconciled ${claimed.length} anonymous Superwall event(s) to ${userId} as ${settled.plan}.`,
      );

      return Response.json({
        ok: true,
        reconciled: true,
        plan: settled.plan,
        events: claimed.length,
      });
    },
  ),
};
