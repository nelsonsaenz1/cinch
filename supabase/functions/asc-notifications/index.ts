import { X509Certificate } from 'npm:@peculiar/x509@^1';
import { createClient } from 'npm:@supabase/supabase-js@^2';
import { compactVerify, decodeProtectedHeader } from 'npm:jose@^5';

import type { Database } from '../_shared/database.types.ts';
import {
  APPLE_ROOT_CA_G3_B64,
  SUPERWALL_FORWARD_URL,
  ascVerdict,
} from '../_shared/asc-plan.ts';
import { isStale } from '../_shared/superwall-plan.ts';

/**
 * asc-notifications — Apple's App Store Server Notifications V2, received
 * FIRST-HAND, forwarded to Superwall, and settled into `subscriptions.plan`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The original arrangement was Apple → Superwall → (Svix webhook) → us.
 * Superwall's dispatcher never fired — zero delivery attempts ever, against a
 * verified-correct endpoint (docs/superwall/webhook-nondelivery-handoff.md) —
 * so the one real purchase in this app's life never reached the database.
 * Superwall's own docs offer the rearrangement this function implements
 * ("Event Forwarding"): Apple posts to us, we forward the unmodified body to
 * Superwall so their pipeline keeps working, and we ALSO apply the event
 * ourselves, from Apple's word directly. The revenue signal now lands in our
 * own logs and our own ledger no matter what Superwall's dispatcher does.
 *
 * `superwall-webhook` stays deployed and armed: if Superwall's dispatcher ever
 * wakes up, both pipelines write through the same product table and the same
 * staleness rule, so the second writer converges instead of fighting.
 *
 * ── AUTHENTICATION ──────────────────────────────────────────────────────────
 *
 * There is no shared secret with Apple; the request proves itself. The body is
 * `{"signedPayload": <JWS>}`, signed ES256 with an x5c chain that must lead to
 * the pinned Apple Root CA - G3. Verification here is the full ritual, not a
 * shortcut, because this function holds the service role and an accepted
 * forgery is a self-service Pro tier:
 *
 *   1. The chain's ROOT must be byte-identical to the pinned Apple root.
 *   2. Every link must actually sign the next (X509 signature checks), and be
 *      inside its validity window.
 *   3. The JWS signature must verify against the LEAF's public key.
 *   4. The nested `signedTransactionInfo` is its own JWS and gets the same
 *      treatment — the outer envelope vouching for it is not enough when the
 *      productId that grants a plan lives inside.
 *   5. The bundle id must be ours.
 *
 * `verify_jwt` is OFF for this function (config.toml): Apple has no Supabase
 * session, exactly like Superwall before it.
 *
 * ── ATTRIBUTION ─────────────────────────────────────────────────────────────
 *
 * `appAccountToken` IS the Supabase user id: SuperwallKit passes the id from
 * `identify()` into StoreKit's appAccountToken for every purchase it makes
 * (superwall.tsx documents that UUID requirement). A notification without one
 * — a purchase from before identify, or an App Store-side action — is recorded
 * as `unattributed` in the ledger for manual reconciliation, never guessed at.
 */

const BUNDLE_ID = 'com.nelsonsaenz.cinch';

/** Apple's own client timeout is generous; Superwall's example uses 5s. */
const FORWARD_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Signed-payload verification
// ---------------------------------------------------------------------------

type VerifiedJws =
  | { ok: true; payload: unknown }
  | { ok: false; reason: string };

/**
 * Verify one Apple JWS against the pinned root and return its decoded payload.
 *
 * The x5c header is ATTACKER-SUPPLIED: nothing about it is trusted until the
 * root matches the pin byte for byte and every signature in the chain checks
 * out. Only then is the leaf allowed to vouch for the payload.
 */
async function verifyAppleJws(jws: string): Promise<VerifiedJws> {
  let x5c: string[];
  try {
    const header = decodeProtectedHeader(jws);
    if (header.alg !== 'ES256') return { ok: false, reason: `alg ${header.alg ?? 'none'}` };
    if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
      return { ok: false, reason: 'x5c missing or too short' };
    }
    x5c = header.x5c;
  } catch {
    return { ok: false, reason: 'unparseable JWS header' };
  }

  // 1. Pin the root. Byte equality, not "issued by something named Apple".
  if (x5c[x5c.length - 1] !== APPLE_ROOT_CA_G3_B64) {
    return { ok: false, reason: 'chain root is not the pinned Apple Root CA - G3' };
  }

  // 2. Walk the chain: each certificate must be inside its validity window,
  //    name its issuer correctly, and actually be signed by it.
  //
  //    @peculiar/x509 rather than node:crypto's X509Certificate, and not by
  //    preference: the edge runtime (Deno 2.1.4) throws ERR_NOT_IMPLEMENTED
  //    from `checkIssued`/`verify` — discovered by probing the deployed
  //    function, which is exactly why the probe existed. The peculiar library
  //    is pure WebCrypto and runs the same checks for real.
  let chain: X509Certificate[];
  try {
    chain = x5c.map((der) => new X509Certificate(der));
  } catch {
    return { ok: false, reason: 'unparseable certificate in x5c' };
  }

  const now = new Date();
  for (const cert of chain) {
    if (now < cert.notBefore || now > cert.notAfter) {
      return { ok: false, reason: 'certificate outside validity window' };
    }
  }
  for (let i = 0; i < chain.length - 1; i++) {
    const issuedBy = chain[i].issuer === chain[i + 1].subject;
    const signedBy = await chain[i]
      .verify({ publicKey: chain[i + 1], signatureOnly: true }, crypto)
      .catch(() => false);
    if (!issuedBy || !signedBy) {
      return { ok: false, reason: `chain link ${i} does not verify` };
    }
  }

  // 3. The leaf signs the payload. Its public key exports as a WebCrypto
  //    CryptoKey, which is what npm:jose verifies with on this runtime.
  try {
    const key = await chain[0].publicKey.export(
      { name: 'ECDSA', namedCurve: 'P-256' },
      ['verify'],
      crypto,
    );
    const { payload } = await compactVerify(jws, key, { algorithms: ['ES256'] });
    return { ok: true, payload: JSON.parse(new TextDecoder().decode(payload)) };
  } catch {
    return { ok: false, reason: 'JWS signature did not verify against the leaf' };
  }
}

// ---------------------------------------------------------------------------
// Payload shapes (the fields this function reads; Apple sends far more)
// ---------------------------------------------------------------------------

interface NotificationPayload {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
  };
}

interface TransactionInfo {
  bundleId?: string;
  productId?: string;
  expiresDate?: number;
  appAccountToken?: string;
  originalTransactionId?: string;
  transactionId?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    }

    const rawBody = await req.text();

    // Arrival log BEFORE anything can reject — the same visibility rule the
    // Superwall webhook learned the hard way. Headers and size only.
    console.log(`asc-notifications arrival: bytes=${rawBody.length}`);

    let signedPayload: string;
    try {
      const body = JSON.parse(rawBody) as { signedPayload?: unknown };
      if (typeof body.signedPayload !== 'string') throw new Error('no signedPayload');
      signedPayload = body.signedPayload;
    } catch {
      return Response.json({ error: 'Malformed body.' }, { status: 400 });
    }

    // ── Verify BEFORE forwarding ──────────────────────────────────────────
    //
    // Superwall's example forwards before any application logic, but their
    // concern is latency, not provenance — and an open relay that forwards
    // whatever anyone POSTs would let a stranger spray junk into Superwall's
    // intake under our key. Verification is milliseconds; Apple retries on
    // failure; nothing is lost by doing it first.
    const outer = await verifyAppleJws(signedPayload);
    if (!outer.ok) {
      console.warn(`Rejected ASC notification: ${outer.reason}`);
      return Response.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const note = outer.payload as NotificationPayload;
    const type = note.notificationType ?? '';
    const uuid = note.notificationUUID ?? '';
    if (!type || !uuid) {
      return Response.json({ error: 'Missing notificationType or notificationUUID.' }, { status: 400 });
    }

    // The nested transaction is verified in its own right; a notification with
    // no transaction (Apple's TEST ping, for one) proceeds without it.
    let txn: TransactionInfo = {};
    if (note.data?.signedTransactionInfo) {
      const inner = await verifyAppleJws(note.data.signedTransactionInfo);
      if (!inner.ok) {
        console.warn(`Rejected ASC transaction info: ${inner.reason}`);
        return Response.json({ error: 'Invalid transaction signature.' }, { status: 401 });
      }
      txn = inner.payload as TransactionInfo;
    }

    const bundleId = note.data?.bundleId ?? txn.bundleId;
    if (bundleId && bundleId !== BUNDLE_ID) {
      // Signed by Apple, but for some other app. Not ours to forward or apply.
      console.warn(`ASC notification for foreign bundle ${bundleId}; dropped.`);
      return Response.json({ error: 'Wrong bundle.' }, { status: 400 });
    }

    // ── Forward to Superwall ──────────────────────────────────────────────
    //
    // The unmodified body, exactly as Apple sent it — their intake does its own
    // verification and needs the original bytes. A failed forward is a 500 so
    // Apple redelivers (the ledger below makes redelivery idempotent for us,
    // and Superwall dedupes on the notification's own identity).
    let forwarded = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
      const res = await fetch(SUPERWALL_FORWARD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
        signal: controller.signal,
      });
      clearTimeout(timer);
      forwarded = res.ok;
      if (!res.ok) console.error(`Superwall forward answered ${res.status}.`);
    } catch (error) {
      console.error('Superwall forward failed:', error);
    }
    if (!forwarded) {
      return Response.json({ error: 'Forward failed.' }, { status: 500 });
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const environment = note.data?.environment ?? 'UNKNOWN';
    const expiresAt = txn.expiresDate ? new Date(txn.expiresDate).toISOString() : null;
    const token = txn.appAccountToken && UUID_RE.test(txn.appAccountToken) ? txn.appAccountToken : null;

    // ── The ledger ────────────────────────────────────────────────────────
    //
    // Apple redelivers until it sees a 200, and `notificationUUID` is stable
    // across redeliveries — the same at-least-once contract Svix has, settled
    // the same way. The row is written before the verdict so a refused event
    // is still on record.
    const outcomeOf = async (): Promise<{ outcome: string; plan?: 'free' | 'standard' | 'pro'; status: number }> => {
      const verdict = ascVerdict(type, note.subtype ?? null, txn.productId ?? null);

      if (verdict.kind === 'no_change') return { outcome: 'no_change', status: 200 };
      if (verdict.kind === 'unmapped') {
        // Worth a retry: the fix is adding the product to PRODUCT_PLANS.
        console.error(`Unmapped ASC productId: ${verdict.productId ?? 'missing'}`);
        return { outcome: 'unmapped', status: 422 };
      }
      if (!token) {
        // A real event with nobody to credit. Recorded loudly; retrying cannot
        // attach a user that is not in the payload.
        console.error(
          `ASC ${type} without a usable appAccountToken — no plan written. ` +
            `originalTransactionId=${txn.originalTransactionId ?? 'unknown'}`,
        );
        return { outcome: 'unattributed', plan: verdict.plan, status: 200 };
      }

      const { data: current, error: readError } = await admin
        .from('subscriptions')
        .select('current_period_end')
        .eq('user_id', token)
        .maybeSingle();
      if (readError) {
        console.error('Could not read subscription:', readError.message);
        return { outcome: 'write_failed', plan: verdict.plan, status: 500 };
      }
      if (isStale(expiresAt, current?.current_period_end)) {
        return { outcome: 'stale', plan: verdict.plan, status: 200 };
      }

      const { data: written, error: writeError } = await admin
        .from('subscriptions')
        .upsert(
          {
            user_id: token,
            plan: verdict.plan,
            current_period_end: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select('user_id');
      if (writeError || !written?.length) {
        console.error('Could not write subscription:', writeError?.message ?? 'no row written');
        return { outcome: 'write_failed', plan: verdict.plan, status: 500 };
      }
      return { outcome: 'applied', plan: verdict.plan, status: 200 };
    };

    const result = await outcomeOf();

    // Idempotency: the first delivery inserts; a redelivery conflicts and
    // reports duplicate. On a 500 outcome the row still records the attempt —
    // `outcome` is updated on conflict so a retry that finally lands overwrites
    // `write_failed` with `applied` rather than being shrugged off.
    const { error: ledgerError } = await admin.from('asc_notifications').upsert(
      {
        notification_uuid: uuid,
        notification_type: type,
        subtype: note.subtype ?? null,
        environment,
        product_id: txn.productId ?? null,
        original_transaction_id: txn.originalTransactionId ?? null,
        app_account_token: token,
        expires_at: expiresAt,
        signed_date: note.signedDate ? new Date(note.signedDate).toISOString() : null,
        outcome: result.outcome,
        plan: result.plan ?? null,
      },
      { onConflict: 'notification_uuid' },
    );
    if (ledgerError) {
      console.error(`ASC ledger write failed: ${ledgerError.message}`);
      return Response.json({ error: 'Ledger unavailable.' }, { status: 500 });
    }

    console.log(
      `asc-notifications ${type}${note.subtype ? `/${note.subtype}` : ''} ` +
        `env=${environment} outcome=${result.outcome} uuid=${uuid}`,
    );

    if (result.status !== 200) {
      return Response.json({ error: result.outcome }, { status: result.status });
    }
    return Response.json({ ok: true, outcome: result.outcome });
  },
};
