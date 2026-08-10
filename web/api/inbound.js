/**
 * Forward mail sent to hello@mail.cinchstyle.com to the founder's inbox.
 *
 * WHY THIS EXISTS
 *
 * The privacy policy, the terms, the support page and the app's own help
 * composer all name `hello@mail.cinchstyle.com` as the way to reach a person.
 * Resend can now RECEIVE at that domain, but Resend delivers inbound mail to a
 * webhook rather than to another mailbox — so without this endpoint the address
 * accepts mail and drops it on the floor, which is worse than the personal
 * address it replaced. A published support contact that silently discards mail
 * is the kind of defect nobody notices until somebody needed help.
 *
 * SETUP, none of which this file can do for you:
 *
 *  1. Cloudflare DNS, on `cinchstyle.com`:
 *       MX   mail   inbound-smtp.us-east-1.amazonaws.com   priority 10   DNS only
 *     Receiving is already enabled on the Resend domain.
 *  2. Resend → Webhooks → add endpoint `https://cinchstyle.com/api/inbound`,
 *     subscribed to `email.received`. Copy the signing secret.
 *  3. Vercel env: `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`, plus
 *     `SUPPORT_FORWARD_TO` (the destination inbox).
 *
 * Until 1 and 2 exist this route is never called, which is why it fails loudly
 * rather than silently when its configuration is missing.
 */

import crypto from 'node:crypto';

/** Where forwarded mail lands. Never hard-code an address into the source. */
const FORWARD_TO = process.env.SUPPORT_FORWARD_TO;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/** The verified sending identity. Forwarded mail must come FROM us. */
const FROM = 'Cinch <hello@mail.cinchstyle.com>';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!RESEND_API_KEY || !WEBHOOK_SECRET || !FORWARD_TO) {
    // Loud, not quiet. A misconfigured forwarder looks identical to "nobody
    // has emailed us", and that is exactly the failure this file exists to
    // prevent — so it must never be mistaken for silence.
    console.error(
      'inbound: not configured — need RESEND_API_KEY, RESEND_WEBHOOK_SECRET and SUPPORT_FORWARD_TO',
    );
    return res.status(500).json({ error: 'not_configured' });
  }

  const payload = await rawBody(req);

  /**
   * Verify before reading. This endpoint is public, it forwards its input to a
   * real mailbox, and it authenticates as our own domain when it does — an
   * unverified handler is an open relay wearing our SPF record. Resend signs
   * with Svix headers; a bad signature is a 400 and nothing else happens.
   */
  // Verified with node:crypto rather than the `svix` SDK on purpose: web/ has
  // no package.json and no build step — it is static files plus a couple of
  // functions — and adding a dependency to check one HMAC would mean giving
  // this directory a toolchain it has so far done without.
  if (!verifySvix(req.headers, payload, WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'bad_signature' });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: 'bad_payload' });
  }

  if (event?.type !== 'email.received') {
    // Other subscriptions are not an error; acknowledge so Resend stops
    // retrying a delivery we simply do not act on.
    return res.status(200).json({ ok: true, ignored: event?.type ?? 'unknown' });
  }

  const mail = event.data ?? {};
  const sender = mail.from ?? 'unknown sender';
  const subject = mail.subject ?? '(no subject)';

  const forwarded = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [FORWARD_TO],
      // `reply_to` is the whole point: hitting reply in the destination inbox
      // must answer the PERSON who wrote in, not our own forwarder.
      reply_to: sender,
      subject: `[Cinch support] ${subject}`,
      text: `From: ${sender}\nTo: ${(mail.to ?? []).join(', ')}\n\n${mail.text ?? ''}`,
      html: mail.html ?? undefined,
    }),
  });

  if (!forwarded.ok) {
    const detail = await forwarded.text().catch(() => '');
    console.error(`inbound: forward failed ${forwarded.status}: ${detail.slice(0, 300)}`);
    // A non-2xx tells Resend to retry, which is what we want — the alternative
    // is losing somebody's support request to a transient blip.
    return res.status(502).json({ error: 'forward_failed' });
  }

  return res.status(200).json({ ok: true });
}

/**
 * Svix's scheme, which is what Resend signs with: HMAC-SHA256 over
 * `id.timestamp.body`, base64, compared against a space-separated list of
 * `v1,<sig>` candidates (a list, because a secret being rotated signs with
 * both for a while).
 *
 * The timestamp window is not optional — without it a captured-and-replayed
 * request stays valid forever, and this endpoint sends mail.
 */
function verifySvix(headers, payload, secret) {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!id || !timestamp || !signatures) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');

  return String(signatures)
    .split(' ')
    .some((candidate) => {
      const sig = candidate.startsWith('v1,') ? candidate.slice(3) : candidate;
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      // Length check first: timingSafeEqual throws on a mismatch rather than
      // returning false, and a thrown comparison is a failed verification with
      // a stack trace attached.
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
}
