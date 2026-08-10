/**
 * The waitlist — POST /api/waitlist.
 *
 * WHY THIS IS A FUNCTION AND NOT A THIRD-PARTY EMBED
 * --------------------------------------------------
 * Same reason api/invite.js is one. The site ships
 * `Content-Security-Policy: default-src 'none'` with no `script-src` at all, so
 * no JavaScript runs in the browser on any page here — no form widget, no
 * captcha, no fetch(), no client SDK. A form on this domain can therefore do
 * exactly one thing: a plain `method="post"` submission to a same-origin
 * endpoint that answers with a whole HTML page. That is what this is.
 *
 * THE ONE CSP CHANGE THIS COST
 * ----------------------------
 * `form-action` went from 'none' to 'self' in vercel.json. `form-action` has no
 * fallback to `default-src`, so without that token the browser refuses the
 * submission outright. 'self' is the smallest value that permits it: the form
 * may post to this origin and nowhere else, which means a future injected form
 * — or a rewritten action attribute — still cannot exfiltrate anything to
 * another host. No other directive moved. In particular `script-src` is still
 * absent, so this endpoint gains the page no ability to run code.
 *
 * WHAT IT IS ALLOWED TO DO
 * ------------------------
 * One fact goes in one direction: `join_waitlist(email, client_hash, source)`
 * returns the word 'ok', 'throttled' or 'invalid' and never a row. `anon` has
 * no grant on `public.waitlist` and no RLS policy on it, so even holding the
 * publishable key this endpoint cannot read a single address back — including
 * the one it just wrote. See the migration for the whole model.
 *
 * ABUSE, GIVEN THAT NOBODY IS SIGNED IN
 * -------------------------------------
 * Four layers, none of which needs a client:
 *   1. A labelled honeypot field no real user is offered. Filled means a bot;
 *      the bot gets the confirmation page and the database gets nothing.
 *   2. Same-origin check on Origin, so the form cannot usefully be posted from
 *      somebody else's page.
 *   3. Strict validation here, and the same validation again as a CHECK
 *      constraint in Postgres, so a caller who skips this file gains nothing.
 *   4. Five attempts an hour per caller, counted in the database against a
 *      salted digest of the IP. The raw address is never sent to Postgres and
 *      never logged.
 *
 * NOTHING HERE SENDS EMAIL. There is no RESEND_API_KEY on this project, so a
 * send would fail silently and a confirmation promising one would be a lie.
 * The page therefore says plainly that no confirmation is coming.
 */

const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ASC app id 6798479578. Apple redirects this to the localised listing. */
const APP_STORE_URL = 'https://apps.apple.com/app/id6798479578';

/** RFC 5321's practical ceiling. The same bound is a CHECK in the schema. */
const EMAIL_MAX = 254;

/**
 * Deliberately stricter than the RFC and deliberately identical to the CHECK
 * constraint on `waitlist.email`. An address this rejects is one no mail
 * server would have accepted either, and the two definitions being the same
 * string is what keeps the endpoint and the table from disagreeing.
 */
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/** A form submission is a few dozen bytes. Anything larger is not a form. */
const BODY_MAX_BYTES = 8 * 1024;

/** One insert and one upsert. If it has not answered by now, say so honestly
 *  rather than holding the browser open. */
const RPC_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Text handling
// ---------------------------------------------------------------------------

/**
 * HTML-escape, covering attribute contexts too. Nothing user-controlled is
 * echoed back by this endpoint today — the answer pages are fixed text, which
 * is the strongest possible position for a page fed by a public form — but the
 * escape exists so that adding a "we saved <address>" line later cannot be the
 * change that introduces an injection.
 */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalise an address the way the database will. Returns null for anything
 * that is not going to be stored, so the caller never has to ask twice.
 *
 * The control-character strip is not cosmetic: a CR or LF inside an address is
 * the classic header-injection primitive, and these rows are destined for a
 * mail merge one day.
 */
function normaliseEmail(raw) {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .toLowerCase();
  if (cleaned.length < 6 || cleaned.length > EMAIL_MAX) return null;
  if (!EMAIL_RE.test(cleaned)) return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

/**
 * Read the submitted fields.
 *
 * Vercel's Node runtime parses `application/x-www-form-urlencoded` into an
 * object for us, but not on every path and not for every runtime version, so
 * the raw stream is handled too — capped, because an uncapped read on a public
 * endpoint is a way to spend somebody else's memory.
 */
async function readForm(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  if (type !== 'application/x-www-form-urlencoded') return null;

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  let raw = '';
  if (typeof req.body === 'string') {
    raw = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    raw = req.body.toString('utf8');
  } else {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > BODY_MAX_BYTES) return null;
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }

  if (raw.length > BODY_MAX_BYTES) return null;

  const params = new URLSearchParams(raw);
  return { email: params.get('email'), company: params.get('company') };
}

/**
 * Reject a submission that came from somebody else's page.
 *
 * Compared against the request's own host rather than a hard-coded domain, so
 * this keeps working on preview deployments. A missing Origin is allowed: some
 * privacy tooling strips it, and turning those users away would cost more than
 * the header is worth on an endpoint that holds no session and no cookie.
 */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers.host || '');
  } catch {
    return false;
  }
}

/**
 * The salted digest that carries the rate limit.
 *
 * The IP itself never leaves this function: it is hashed with a server-side
 * secret and only the digest is sent to Postgres, which means the throttle
 * table cannot be read back into a list of visitors even by someone holding
 * the database. Without the salt a SHA-256 of an IPv4 address is trivially
 * reversible by enumeration, so a missing salt is a refusal rather than a
 * fallback — an unthrottled public writer is worse than a form that is
 * honestly broken until it is configured.
 */
function clientHash(req) {
  const salt = process.env.WAITLIST_SALT;
  if (!salt) {
    console.error('waitlist: WAITLIST_SALT is not set — refusing to accept unthrottled writes');
    return null;
  }
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.headers['x-real-ip'] || '').trim();
  if (!ip) return null;
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

// ---------------------------------------------------------------------------
// The one call
// ---------------------------------------------------------------------------

/**
 * Ask Supabase to add the address.
 *
 * Returns 'ok', 'throttled' or 'invalid' from the function itself, or 'error'
 * for anything that went wrong on the way — a missing configuration, a
 * timeout, a non-2xx. The caller shows a different page for 'error' than for
 * 'ok' because telling somebody they are on a list they are not on is the one
 * outcome this endpoint must never produce.
 */
async function submit({ email, hash }) {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('waitlist: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set');
    return 'error';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/join_waitlist`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ p_email: email, p_client_hash: hash, p_source: 'web' }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('waitlist: join_waitlist returned', response.status);
      return 'error';
    }

    // A scalar-returning RPC answers with a bare JSON string.
    const status = await response.json();
    return status === 'ok' || status === 'throttled' || status === 'invalid' ? status : 'error';
  } catch (error) {
    console.error('waitlist: join_waitlist failed', error && error.message);
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------

/**
 * The shell. `noindex` because these are answers to a submission and have no
 * business in a search index, and no Open Graph block for the same reason —
 * nobody shares a form receipt.
 */
function page({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home.css">
</head>
<body class="home">
<div class="wrap">

<header class="site">
  <a class="logo" href="/">Cinch</a>
  <nav>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/support">Support</a>
  </nav>
</header>

<main class="answer">
${body}
</main>

<footer class="site">
  <a href="/">Home</a>
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
  <a href="/support">Support</a>
</footer>

</div>
</body>
</html>
`;
}

/**
 * The address is on the list.
 *
 * The note about no confirmation email is not a nicety. Nothing on this
 * project can send to this list — there is no key for it — so a page that let
 * somebody wait for a confirmation would be arranging its own broken promise.
 * Saying so costs one sentence and stays true whether or not a sender is
 * wired up later.
 */
function joined() {
  return page({
    title: 'You are on the list — Cinch',
    body: `  <h1>You are on the list.</h1>
  <p class="lede">
    That is the whole of it — an address, and a note when there is something
    worth opening.
  </p>
  <p class="cta-note">
    There is no confirmation email; nothing is set up to send you one, and we
    would rather say that than have you watch an empty inbox. If you would like
    the address taken off again, <a href="/support">tell us</a> and it goes.
  </p>
  <a class="cta" href="${esc(APP_STORE_URL)}">Get Cinch on the App Store</a>
  <p class="cta-note">Cinch is an iPhone app, free to start.</p>`,
  });
}

/** The address did not look like one. Nothing was stored. */
function rejected() {
  return page({
    title: 'That address did not go through — Cinch',
    body: `  <h1>That address did not go through.</h1>
  <p class="lede">
    It did not look like an email address, so nothing was saved. Go back and
    try it again — a typo in the domain is usually the culprit.
  </p>
  <a class="cta" href="/#waitlist">Back to the form</a>`,
  });
}

/** Too many attempts from one place. Also nothing stored. */
function slowDown() {
  return page({
    title: 'Too many tries — Cinch',
    body: `  <h1>That is a few too many tries.</h1>
  <p class="lede">
    The form takes a handful of submissions an hour from one place, which this
    has passed. Nothing was saved this time. Leave it an hour and it will work
    again.
  </p>
  <a class="cta" href="${esc(APP_STORE_URL)}">Get Cinch on the App Store</a>`,
  });
}

/**
 * Something on our side failed.
 *
 * Explicitly not a success page. A form that says "you're on the list" when
 * the write failed is worse than one that admits it, because the person walks
 * away believing they will be told and never is.
 */
function failed() {
  return page({
    title: 'We could not save that — Cinch',
    body: `  <h1>We could not save that.</h1>
  <p class="lede">
    Something on our side went wrong and your address was not stored — so
    please do not assume you are on the list.
  </p>
  <p class="cta-note">
    Trying again in a minute usually works. If it does not,
    <a href="/support">email us</a> and we will add you by hand.
  </p>
  <a class="cta" href="/#waitlist">Back to the form</a>`,
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // GET /api/waitlist is somebody poking at the endpoint, or a browser
  // restoring a URL from history. Send them to the form rather than to an
  // error; there is nothing to see here without a submission.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Location', '/#waitlist');
    res.status(303).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send(failed());
    return;
  }

  if (!sameOrigin(req)) {
    res.status(403).send(rejected());
    return;
  }

  const form = await readForm(req);
  if (!form) {
    res.status(400).send(rejected());
    return;
  }

  // The honeypot. A filled trap is answered exactly like a success so the bot
  // learns nothing from the difference, and stored nowhere.
  if (typeof form.company === 'string' && form.company.trim() !== '') {
    res.status(200).send(joined());
    return;
  }

  const email = normaliseEmail(form.email);
  if (!email) {
    res.status(400).send(rejected());
    return;
  }

  const hash = clientHash(req);
  if (!hash) {
    // Either the salt is missing or there is no client address to hash. Both
    // are our problem, not the visitor's, and neither is a reason to write an
    // unthrottled row.
    res.status(500).send(failed());
    return;
  }

  const status = await submit({ email, hash });

  if (status === 'ok') {
    res.status(200).send(joined());
    return;
  }
  if (status === 'throttled') {
    res.status(429).send(slowDown());
    return;
  }
  if (status === 'invalid') {
    res.status(400).send(rejected());
    return;
  }
  res.status(502).send(failed());
};
