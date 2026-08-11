import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { ALIAS_PREFIX, isStale, verdictFor } from '../_shared/superwall-plan.ts';

/**
 * superwall-webhook — the one path by which `subscriptions.plan` ever changes.
 *
 * `20260805160000_membership_tiers.sql` left exactly this seam: the table has no
 * insert/update/delete policy at all, so the plan column is unreachable from any
 * client and only the service role can move it. This function is the service
 * role. If it is wrong, users are on the wrong tier; if it is spoofable, anyone
 * can grant themselves Pro.
 *
 * ── Why not `withSupabase({ auth: 'user' })` like every other function here ──
 *
 * The other four are called by the app with a user's JWT. This one is called by
 * Superwall, which has no Supabase session and never will. Its authentication is
 * the Svix signature below, not a bearer token — so the function takes the
 * service-role key directly and verifies the signature itself. That also means
 * `verify_jwt` must be OFF for this function (see supabase/config.toml); with it
 * on, the platform rejects Superwall at the door and the signature check never
 * runs.
 *
 * ── What the payload does and does not contain ──────────────────────────────
 *
 * Superwall's webhook carries NO entitlements array. It reports a `productId`
 * and an event `type`, and the mapping from product to plan is ours to own —
 * which is why PRODUCT_PLANS below is the authority and has to stay in step with
 * the products configured in the Superwall dashboard.
 */

// ---------------------------------------------------------------------------
// Product -> plan
// ---------------------------------------------------------------------------
//
// PRODUCT_PLANS, GRANTING and REVOKING moved to `_shared/superwall-plan.ts` for
// audit item 24. `superwall-reconcile` has to reach the same verdict about a
// STORED event that this reaches about the live one, and two copies of that
// table would drift — with a paying customer on the wrong tier as the failure
// mode. Being dependency-free, the shared module is also covered by executable
// tests, which the copy that lived here never was.

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/** Svix rejects anything older than this; replaying a captured request fails. */
const TOLERANCE_MS = 5 * 60 * 1000;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Svix-signed request.
 *
 * The signed content is `id.timestamp.body` and the key is the base64 half of
 * the `whsec_` secret. `body` must be the EXACT bytes received — parsing to JSON
 * and re-stringifying changes key order and whitespace and invalidates a
 * signature that was perfectly good, which is the classic way this check fails
 * in a framework that helpfully parses bodies for you.
 */
async function verifySignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');

  if (!id || !timestamp || !signature) return { ok: false, reason: 'Missing svix headers.' };

  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'Unparseable svix-timestamp.' };
  if (Math.abs(Date.now() - sentAt) > TOLERANCE_MS) {
    return { ok: false, reason: 'Timestamp outside tolerance.' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    // The secret is `whsec_<base64>`; only the base64 half is the key material.
    Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // The header carries a space-separated list of `v1,<sig>` — plural because a
  // secret being rotated signs with both the old and the new key for a window.
  // Any one matching is a pass.
  const passed = signature
    .split(' ')
    .map((part) => part.split(',')[1] ?? '')
    .some((candidate) => constantTimeEqual(candidate, expected));

  return passed ? { ok: true } : { ok: false, reason: 'Signature mismatch.' };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface SuperwallEvent {
  type?: string;
  data?: {
    productId?: string;
    originalAppUserId?: string;
    expirationAt?: number;
    periodType?: string;
    originalTransactionId?: string;
  };
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    }

    const secret = Deno.env.get('SUPERWALL_WEBHOOK_SECRET');
    if (!secret) {
      // Fail closed. An unset secret must never degrade into "accept anything" —
      // that is a self-service Pro tier for whoever finds the URL.
      console.error('SUPERWALL_WEBHOOK_SECRET is unset; refusing every delivery.');
      return Response.json({ error: 'Not configured.' }, { status: 500 });
    }

    const rawBody = await req.text();
    const verified = await verifySignature(rawBody, req.headers, secret);
    if (!verified.ok) {
      console.warn('Rejected Superwall webhook:', verified.reason);
      return Response.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    // Only after the signature holds. An unverified request must never be able
    // to write a row, or the ledger becomes a way for a stranger to fill a
    // table and to poison the reconciliation queue with invented aliases.
    const svixId = req.headers.get('svix-id')!;

    let event: SuperwallEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Malformed JSON.' }, { status: 400 });
    }

    const type = event.type;
    const data = event.data ?? {};
    const userId = data.originalAppUserId;

    if (!type || !userId) {
      return Response.json({ error: 'Missing type or originalAppUserId.' }, { status: 400 });
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // ── The ledger (audit 23) ─────────────────────────────────────────────
    //
    // Svix guarantees AT-LEAST-ONCE delivery. Everything below this line is
    // written to run exactly once per logical event, and `svix-id` is what
    // makes that true: every retry of one event carries the same id, and two
    // different events never share one.
    //
    // Claimed BEFORE any decision, so an event this handler refuses is still on
    // record. That is the whole reason it lands before the alias work — you
    // cannot replay a queue of refused purchases that was never written down.
    //
    // "Claimed" means FINISHED WITH, not merely seen: the two paths below that
    // fail deliberately in order to be retried (`unmapped_product`, and a failed
    // subscription write) leave the id claimable, or the ledger would answer
    // their redelivery with 200/duplicate and quietly cancel the retry the
    // handler asked for. See `claim_superwall_event`.
    const expirationAt = data.expirationAt ? new Date(data.expirationAt).toISOString() : null;

    const { data: firstDelivery, error: claimError } = await admin.rpc('claim_superwall_event', {
      p_svix_id: svixId,
      p_event_type: type,
      p_app_user_id: userId,
      p_product_id: data.productId ?? undefined,
      p_original_transaction_id: data.originalTransactionId ?? undefined,
      p_expiration_at: expirationAt ?? undefined,
    });

    if (claimError) {
      // 500, so Svix retries. Losing the ledger row is worse than a redelivery:
      // an unrecorded purchase is one nobody can reconcile later.
      console.error(`Superwall ledger write failed: ${claimError.message}`);
      return Response.json({ error: 'Ledger unavailable.' }, { status: 500 });
    }

    if (firstDelivery !== true) {
      // Seen, and finished with. The row's `delivery_count` has been bumped and
      // nothing else runs.
      return Response.json({ ok: true, applied: false, reason: 'duplicate' });
    }

    type Outcome = Database['public']['Enums']['superwall_outcome'];
    const note = (outcome: Outcome, plan?: 'free' | 'standard' | 'pro') =>
      admin
        .rpc('note_superwall_outcome', {
          p_svix_id: svixId,
          p_outcome: outcome,
          p_plan: plan ?? undefined,
        })
        .then(({ error }) => {
          if (error) console.error(`Superwall outcome not recorded: ${error.message}`);
        });

    // A purchase that happened before `identify()` landed is attributed to
    // Superwall's anonymous alias, which maps to no Supabase user. Retrying will
    // never fix that, so this returns 200 — a 4xx would have Svix redeliver for
    // days against a payload that cannot succeed. It is logged at error level
    // with the transaction id because it is a real paying customer with no
    // entitlement, and somebody has to reconcile it by hand.
    if (userId.startsWith(ALIAS_PREFIX)) {
      console.error(
        `Superwall ${type} for an unidentified alias — no plan written. ` +
          `originalTransactionId=${data.originalTransactionId ?? 'unknown'}`,
      );
      // Recorded as a queue entry rather than only as a log line. This row is
      // what audit item 24 drains once the alias is bound to a real user.
      await note('unidentified_alias');
      return Response.json({ ok: true, applied: false, reason: 'unidentified_alias' });
    }

    // Events outside both sets are real and expected — `cancellation` and
    // `billing_issue` most of all — and deliberately change nothing. See the
    // comments on REVOKING in the shared module.
    const verdict = verdictFor(type, data.productId ?? null);

    if (verdict.kind === 'no_change') {
      await note('no_state_change');
      return Response.json({ ok: true, applied: false, reason: 'no_state_change' });
    }

    if (verdict.kind === 'unmapped') {
      // 422, not 200: this one IS worth retrying, because the fix is to add the
      // product to PRODUCT_PLANS and redeploy, after which redelivery succeeds.
      console.error(`Unmapped Superwall productId: ${verdict.productId ?? 'missing'}`);
      await note('unmapped_product');
      return Response.json({ error: 'Unknown product.' }, { status: 422 });
    }

    const plan = verdict.plan;
    const periodEnd = expirationAt;

    // ── Out-of-order delivery ─────────────────────────────────────────────
    //
    // Svix guarantees delivery, not order. A `renewal` and the `expiration` of
    // the period it replaced can arrive backwards, and applying them in receipt
    // order would downgrade a user who just renewed. `expirationAt` is the
    // authority on recency, so an event describing a period that ends no later
    // than the one already stored is stale and dropped.
    //
    // Revocations with no `expirationAt` are applied unconditionally —
    // `subscription_paused` has no end date and must not be ignorable.
    const { data: current, error: readError } = await admin
      .from('subscriptions')
      .select('current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) {
      // 500 so Svix retries — a transient database error should not lose a
      // purchase.
      console.error('Could not read subscription:', readError.message);
      return Response.json({ error: 'Read failed.' }, { status: 500 });
    }

    if (isStale(periodEnd, current?.current_period_end)) {
      await note('stale');
      return Response.json({ ok: true, applied: false, reason: 'stale_event' });
    }

    // UPSERT, not update. An `.update()` against a missing row is not an error
    // in PostgREST — zero rows, `error` null — so a purchase by a user whose
    // subscriptions row never got created (a failed signup trigger, an id
    // Superwall knows that this database does not) would return 200, Svix
    // would mark it delivered, and the payment would be silently dropped. This
    // is the one path by which anyone becomes a paying customer; it must
    // either land or fail loudly enough to be redelivered.
    //
    // `.select()` so the write proves itself: an upsert that touched nothing
    // comes back empty and is treated as the failure it is.
    const { data: written, error: writeError } = await admin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('user_id');

    if (writeError || !written?.length) {
      console.error('Could not write subscription:', writeError?.message ?? 'no row written');
      // Recorded as its own outcome, which is what keeps the id claimable: this
      // returns 500 asking Svix to retry, and the retry has to be allowed to
      // actually re-run the write. Storing `write_failed` rather than leaving
      // the default also means an operator can find the purchases that were
      // taken and never applied with one query, instead of inferring them from
      // logs.
      await note('write_failed', plan);
      return Response.json({ error: 'Write failed.' }, { status: 500 });
    }

    await note('applied', plan);

    // Note for the operator: `effective_plan()` reports `pro` for the whole
    // 14-day trial window regardless of what is written here, so a Standard
    // purchase made mid-trial takes visible effect on day 15. Correct, but
    // surprising the first time you watch a webhook land and nothing change.
    return Response.json({ ok: true, applied: true, plan, periodType: data.periodType ?? null });
  },
};
