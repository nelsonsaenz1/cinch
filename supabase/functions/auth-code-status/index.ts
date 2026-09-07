import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';

import { bouncedInWindow } from './bounced.ts';

/**
 * auth-code-status — did the sign-in code we just sent bounce? (ledger A49)
 *
 * ── THE SILENT TOTAL LOSS THIS ANSWERS ────────────────────────────────────
 *
 * 2026-09-05 17:35:53Z: a sign-in code went to a syntactically valid Gmail
 * address that does not exist, and Resend recorded the hard bounce within
 * seconds. The app never learns about bounces — they happen at the SMTP
 * layer, after Supabase has said "sent" — so the person sat on "check your
 * email" waiting for a code that could never arrive. She found her own typo
 * 83 seconds later; nobody else would. `auth_address_refused` correctly did
 * not fire, because the address's SHAPE was fine.
 *
 * So the code screen asks this, a few seconds after the send: one POST with
 * the address, one answer — `{ bounced: true | false }` — read from Resend's
 * own log of the mail the auth server sent. No webhook, no table, no new
 * standing configuration anywhere: a read of what already exists.
 *
 * ── WHAT IT WILL AND WILL NOT SAY ────────────────────────────────────────
 *
 * Only `bounced`. Never "delivered", never "opened", never the id, never
 * whether ANY mail exists for the address — a yes/no on "did the sign-in
 * code sent to this address in the last {@link WINDOW_MS} bounce" is the
 * whole surface. Answering "delivered" would make this an oracle for "is
 * this address a Cinch user"; a bounce, by construction, is an address
 * that does not exist, so `true` reveals nothing about anyone.
 *
 * Unauthenticated by necessity (`verify_jwt = false`): the person asking
 * has no session yet — that is the point. Bounded body, one field, one
 * shape check, and Resend is read with a `limit` rather than a filter (its
 * list endpoint has none for recipients), which is why the window is short
 * and the page is one: the auth sender's volume is a handful an hour.
 *
 * Every failure — no key, Resend down, a malformed page — answers
 * `{ bounced: false }` with a 200. A person whose code was fine must never be
 * told it bounced because this function had a bad second; the cost of a
 * false negative is the pre-A49 behaviour, and the cost of a false positive
 * is a person abandoning a working address.
 */

const RESEND_URL = 'https://api.resend.com/emails';
/** One page, the newest first — the auth sender's volume is a handful an hour. */
const PAGE_SIZE = 100;
const MAX_EMAIL_CHARS = 254;


function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
}

function parseAddress(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new BoundsError('Expected an object.');
  }
  const email = (raw as Record<string, unknown>).email;
  if (typeof email !== 'string') throw new BoundsError('email must be a string.');
  const address = email.trim().toLowerCase();
  if (address.length === 0 || address.length > MAX_EMAIL_CHARS || !address.includes('@')) {
    throw new BoundsError('email does not look like an address.');
  }
  return address;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);

  let address: string;
  try {
    address = parseAddress(await readBoundedJson(req));
  } catch (err) {
    const message = err instanceof BoundsError ? err.message : 'Bad request.';
    return json({ error: message }, 400);
  }

  // A key with READ access. `RESEND_API_KEY` is the send-only key the mail
  // functions were written against (see support-mail/mail.ts) and Resend
  // answers its list call with 401 — verified 2026-09-07 20:03Z in the
  // function log — so this prefers a second, read-capable secret and falls
  // back to the send key only so a future full-access key needs no code
  // change. Until `RESEND_READ_API_KEY` is set (founder: Resend → API Keys →
  // full access; `supabase secrets set RESEND_READ_API_KEY=…`) every answer
  // is `false`, which is the pre-A49 screen and nothing worse. The 401 line
  // in the log is the pending signal.
  const key = Deno.env.get('RESEND_READ_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
  if (!key) return json({ bounced: false });

  try {
    const res = await fetch(`${RESEND_URL}?limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      // Answered false regardless — but the reason belongs in the log, or a
      // key with the wrong permissions (the send-only kind) would look like
      // "nothing ever bounces" forever.
      console.warn(`auth-code-status: Resend list answered ${res.status}`);
      return json({ bounced: false });
    }
    const page = await res.json();
    const rows = Array.isArray((page as { data?: unknown })?.data) ? (page as { data: unknown[] }).data.length : -1;
    const bounced = bouncedInWindow(page, address, Date.now());
    console.log(`auth-code-status: ${rows} rows read, bounced=${bounced}`);
    return json({ bounced });
  } catch {
    return json({ bounced: false });
  }
});
