/**
 * The invite doorway — GET /i/:handle (atlas 39, IV-04 and IV-05).
 *
 * WHY THIS IS A FUNCTION AND NOT A STATIC PAGE
 * --------------------------------------------
 * The site ships `Content-Security-Policy: default-src 'none'` with no
 * `script-src` at all, so no JavaScript runs in the browser on any page here.
 * A per-handle page therefore cannot be rendered client-side: there is no way
 * to fetch the name and no way to write it into the DOM. It is rendered on the
 * server instead, which keeps the CSP exactly as strict as it was and has the
 * side benefit that the name is in the HTML for link previews in Messages and
 * WhatsApp.
 *
 * WHAT IT IS ALLOWED TO KNOW
 * --------------------------
 * One fact, from one function: `invite_card(p_handle)` returns a display name
 * and nothing else — no id, no avatar, no counts. It is the only thing in the
 * schema granted to `anon`. The initial in the disc is derived from that name,
 * which is why the page renders identically for every handle and why nothing
 * of the inviter's is served to a stranger.
 *
 * WHEN IN DOUBT, IV-05
 * --------------------
 * Unknown handle, deleted account, RPC error, timeout, missing configuration —
 * every one of them renders IV-05. A doorway that 500s is worse than a doorway
 * that says the invite is closed, and the visitor is never dead-ended for
 * somebody else's decision.
 *
 * THE ONE INJECTION SURFACE
 * -------------------------
 * `display_name` is user-controlled text going into HTML. `esc()` below is the
 * only thing standing between that and script injection, so nothing derived
 * from the name reaches the output without passing through it.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVITE_HOST = 'cinchstyle.com';

/**
 * The single flip for launch day.
 *
 * Until the listing is public, `apps.apple.com/app/id6798479578` 404s, so
 * every invite would land its recipient on a dead Apple page — the worst
 * possible first impression, and it is the referral loop that carries it.
 * While this is false, an invite falls back to the waitlist instead.
 *
 * Set to `true` (or `APP_LIVE=1` in the Vercel environment) at the moment the
 * App Store product page actually resolves. Verify with:
 *   curl -s 'https://itunes.apple.com/lookup?id=6798479578&country=us'
 * A `resultCount` of 0 means it is not live, whatever ASC says.
 */
const APP_LIVE = process.env.APP_LIVE === '1';

/** ASC app id 6798479578. Apple redirects this to the localised listing. */
const APP_STORE_LISTING = 'https://apps.apple.com/app/id6798479578';

/** Where a would-be installer goes while the listing is not yet public. */
const WAITLIST_URL = 'https://cinchstyle.com/#waitlist';

const APP_STORE_URL = APP_LIVE ? APP_STORE_LISTING : WAITLIST_URL;

/**
 * The words move with the link, or the flip is only half done.
 *
 * A button reading "See Cinch on the App Store" that lands on a waitlist is a
 * worse first impression than the 404 it was meant to avoid — it reads as a
 * broken link rather than an honest "not yet". So every label the flip touches
 * is derived from `APP_LIVE` here rather than written out a second time at each
 * call site, which is how one of them comes to be missed.
 *
 * `AVAILABILITY` is a fragment, deliberately: it appears mid-sentence in the
 * invite notes and has to read as naturally there as the phrase it replaces.
 */
const GET_CTA = APP_LIVE ? 'Get Cinch' : 'Join the list';
const SEE_CTA = APP_LIVE ? 'See Cinch on the App Store' : 'Join the list';
const AVAILABILITY = APP_LIVE ? 'free on the App Store' : 'coming to the App Store shortly';
const AVAILABILITY_SENTENCE = APP_LIVE
  ? 'Free on the App Store.'
  : 'Coming to the App Store shortly.';

/** Mirrors `src/features/invite/link.ts` — a path segment that cannot be a
 *  handle is not a handle, and passing it to the RPC is a guaranteed miss. */
const HANDLE_RE = /^[a-z0-9_.]{2,30}$/;

/** Long enough for any real name, short enough that the headline still fits. */
const NAME_MAX = 40;

/** The RPC is one indexed lookup. If it has not answered by now something is
 *  wrong, and IV-05 is a better answer than a spinner nobody can see. */
const RPC_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// Text handling
// ---------------------------------------------------------------------------

/**
 * HTML-escape. Covers attribute contexts too, which is why `"` and `'` are in
 * the list — every interpolation in this file lands in text or in a quoted
 * attribute, and this handles both.
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
 * Strip the characters that are invisible but not harmless: C0/C1 controls,
 * and the bidi overrides that can make a display name render as something
 * other than what it is. Escaping alone does not defend against those because
 * they are legal text.
 */
function sanitiseName(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // C0 and C1 controls.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Zero-width marks, bidi marks, bidi embedding/override, isolates, BOM.
    // Escaping alone does not defend against these: they are legal text that
    // can make a display name render as something other than what it is.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const points = Array.from(cleaned);
  return points.length > NAME_MAX ? `${points.slice(0, NAME_MAX).join('')}\u2026` : cleaned;
}

/** The initial for the disc. Falls back to the first code point when the name
 *  starts with something that is not a letter or a digit. */
function initialOf(name) {
  const points = Array.from(name);
  const alnum = points.find((c) => /[\p{L}\p{N}]/u.test(c));
  return (alnum || points[0] || 'C').toUpperCase();
}

/** `@Sophie` → `sophie`. Accepts either form, exactly as the app does. */
function bareHandle(handle) {
  return String(handle).trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Names ending in an s take a bare apostrophe. Small thing, but the sentence
 * with the inviter's name in it is the whole page.
 */
function possessive(name) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

// ---------------------------------------------------------------------------
// The one fact
// ---------------------------------------------------------------------------

/**
 * Ask Supabase for the display name behind a handle.
 *
 * Returns a string, or null for "no such invite" — including every failure
 * mode, because the caller treats them identically and the page has nothing
 * useful to say about the difference.
 */
async function lookupName(handle) {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // Deliberately not a throw: an unconfigured deployment shows IV-05 rather
    // than a stack trace. The log line is for whoever set it up.
    console.error('invite: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/invite_card`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ p_handle: handle }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('invite: invite_card returned', response.status);
      return null;
    }

    // A scalar-returning RPC answers with a bare JSON value: "Sophie" or null.
    return sanitiseName(await response.json());
  } catch (error) {
    console.error('invite: invite_card failed', error && error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function isApplePhone(userAgent) {
  return /iPhone|iPad|iPod/i.test(userAgent || '');
}

const FOOTER = `
    <footer class="invite-foot">
      ${INVITE_HOST} &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a>
    </footer>`;

/**
 * The shell. `noindex` because an invite page is addressed to one person and
 * has no business in a search index; the Open Graph block is there so the
 * preview in Messages reads the same sentence as the page it opens, which the
 * atlas is explicit about.
 */
function page({ title, description, canonical, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cinch">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://cinchstyle.com/og.png">
<meta property="og:image" content="https://cinchstyle.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Cinch — ten pieces is a wardrobe. Free on iPhone.">
<meta name="apple-itunes-app" content="app-id=6798479578, app-argument=${esc(canonical)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/invite.css">
</head>
<body class="invite">
  <main class="invite-wrap">
${body}
  </main>
${FOOTER}
</body>
</html>
`;
}

/** IV-04 — the handle resolved. */
function resolved({ name, handle, onApplePhone }) {
  const link = `${INVITE_HOST}/i/@${handle}`;
  const headline = `${name} added you on Cinch`;
  const description =
    'Cinch is a closet you actually use — what you own, what you wore, and what your friends would lend you.';

  // The single action. On an iPhone it is the App Store. Everywhere else the
  // useful thing is not a download — Cinch is an iPhone app — so the button
  // carries the link to a phone instead. `mailto:` rather than a form, because
  // the CSP sets `form-action 'none'` and there is no script to submit one.
  const action = onApplePhone
    ? `<a class="invite-action" href="${esc(APP_STORE_URL)}">${GET_CTA}</a>`
    : `<a class="invite-action" href="mailto:?subject=${encodeURIComponent(
        headline,
      )}&amp;body=${encodeURIComponent(`https://${link}`)}">Send this link to your phone</a>`;

  // The honest line about what an App Store install does and does not carry.
  // Nothing on this page promises the invite survives the trip to the App
  // Store by itself, because today nothing makes that true. Tapping the link
  // again once Cinch is installed is what completes it, and that sentence
  // stays correct whether or not deferred-link attribution is ever added.
  const note = onApplePhone
    ? `${AVAILABILITY_SENTENCE} If you already have Cinch, this link opens it.
        Installing now? Tap this link once more when Cinch is on your phone —
        that is the tap that puts you and ${esc(name)} together.`
    : `Cinch is an iPhone app, ${AVAILABILITY}. Open the link on your
        iPhone, install Cinch, then tap the link once more — that is the tap
        that puts you and ${esc(name)} together.`;

  const carry = onApplePhone ? '' : `\n    <p class="invite-link">${esc(link)}</p>`;

  const body = `    <p class="invite-eyebrow">Cinch</p>
    <p class="invite-disc" aria-hidden="true">${esc(initialOf(name))}</p>
    <h1 class="invite-headline">${esc(headline)}</h1>
    <p class="invite-body">
      Cinch is a closet you actually use — what you own, what you wore, and
      what your friends would lend you. ${esc(possessive(name))} closet is
      waiting once you sign in.
    </p>
    ${action}
    <p class="invite-note">${note}</p>${carry}`;

  return page({
    title: headline,
    description,
    canonical: `https://${link}`,
    body,
  });
}

/**
 * IV-05 — nobody behind the handle.
 *
 * The body sentence has to be true of every branch that lands here, and one of
 * those branches is "the lookup failed", where the account may be perfectly
 * fine. So it says what is actually known — we could not find them — rather
 * than asserting a deletion that may not have happened.
 */
function closed({ onApplePhone }) {
  const description =
    'Cinch is a closet you actually use — what you own, what you wore, and what your friends would lend you.';

  const action = onApplePhone
    ? `<a class="invite-action" href="${esc(APP_STORE_URL)}">${GET_CTA}</a>`
    : `<a class="invite-action" href="${esc(APP_STORE_URL)}">${SEE_CTA}</a>`;

  const note = onApplePhone
    ? `${AVAILABILITY_SENTENCE} You can add friends by handle once you are in.`
    : `Cinch is an iPhone app, ${AVAILABILITY}. You can add friends by handle once you are in.`;

  const body = `    <p class="invite-eyebrow">Cinch</p>
    <h1 class="invite-headline">This invite has been closed</h1>
    <p class="invite-body">
      We could not find whoever sent it — they may have changed their handle or
      left Cinch. The app is still here, and you can join without an invite.
    </p>
    ${action}
    <p class="invite-note">${note}</p>`;

  return page({
    title: 'This invite has been closed — Cinch',
    description,
    canonical: `https://${INVITE_HOST}/`,
    body,
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  // The copy differs by device and the name differs by handle, so there is
  // nothing here a shared cache should keep. Invite traffic is a trickle; one
  // indexed lookup per view is the right trade for a page that must stop
  // working the moment its owner leaves.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent');

  const onApplePhone = isApplePhone(req.headers['user-agent']);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send(closed({ onApplePhone }));
    return;
  }

  const raw = req.query && req.query.handle;
  let handle = '';
  try {
    handle = bareHandle(decodeURIComponent(Array.isArray(raw) ? raw[0] : raw || ''));
  } catch {
    handle = bareHandle(Array.isArray(raw) ? raw[0] : raw || '');
  }

  if (!HANDLE_RE.test(handle)) {
    res.status(200).send(closed({ onApplePhone }));
    return;
  }

  const name = await lookupName(handle);

  // 200 on both branches. IV-05 is a route into the app, not an error, and a
  // 4xx here would suppress the link preview that carries the invite.
  res.status(200).send(name ? resolved({ name, handle, onApplePhone }) : closed({ onApplePhone }));
};
