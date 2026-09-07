/**
 * The open doorway — GET /closet.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until now there was no path from any Cinch email into any Cinch screen.
 * Every template's call to action pointed at `apps.apple.com/app/id6798479578`,
 * a store page for people who already own the app, and the 29 conversion notes
 * of 2026-09-02 shipped with no link of any kind (ledger A20 → A32).
 *
 * `/closet` was chosen over a new `/open` path for one reason: it is already a
 * real route inside the app (`src/app/(tabs)/closet.tsx`). A universal link
 * only opens the app; expo-router then resolves the path against its own route
 * table, and an unclaimed path lands on `+not-found`. Claiming a path the app
 * already answers means this ships as a web deploy — no binary, no OTA.
 *
 * WHAT HAPPENS ON A TAP
 * ---------------------
 * iPhone with Cinch installed → iOS matches the AASA component and opens the
 * app on the Closet tab. This page is never rendered.
 * iPhone without Cinch, or any other device → this page, whose single action is
 * the App Store listing.
 *
 * THE APP_LIVE TRAP
 * -----------------
 * `web/api/invite.js` gates its store link behind `APP_LIVE`, which is NOT set
 * in the Vercel environment as of 2026-09-03 — so the live invite doorway sends
 * iPhone visitors to `/#waitlist` even though the listing resolves. This page
 * deliberately does not read that flag: the listing is verified live
 * (`itunes.apple.com/lookup?id=6798479578` → resultCount 1) and an email CTA
 * must not silently degrade to a waitlist.
 */

const APP_STORE_LISTING = 'https://apps.apple.com/app/id6798479578';

/**
 * The custom-scheme door, for the people this page exists to catch.
 *
 * iOS fetches a domain's AASA at app INSTALL/UPDATE time and otherwise only on
 * a slow periodic schedule; an OTA update is not an install. So every phone
 * that installed Cinch before `/closet` was claimed (2026-09-03) still holds a
 * cached AASA without it, and the universal link will NOT fire for them — they
 * land here instead. Build 47's signed entitlements do carry
 * `applinks:cinchstyle.com`, so this is a cache lifetime, not a defect.
 *
 * `cinch://closet` resolves through expo-router's default path matching to
 * `src/app/(tabs)/closet.tsx`. It is the only way this page can reach the app
 * for someone who already has it.
 *
 * It is deliberately NOT the sole action: a custom-scheme link is inert when
 * the app is absent, and silently doing nothing is the worst outcome on a page
 * whose whole job is to be a door. Both doors are shown, and the copy says
 * which is which rather than guessing at install state we cannot detect.
 */
const APP_SCHEME_URL = 'cinch://closet';

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isApplePhone(userAgent) {
  return /iPhone|iPad|iPod/i.test(userAgent || '');
}

function page({ onApplePhone }) {
  const title = 'Open your Cinch closet';
  const description =
    'Cinch is a closet you actually use — what you own, what you wore, and what to wear today.';

  const note = onApplePhone
    ? `Your closet is exactly as you left it, and it is waiting when you sign
       back in.`
    : `Cinch is an iPhone app &mdash; open this link on your iPhone to get to
       your closet.`;

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
<meta property="og:url" content="https://cinchstyle.com/closet">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://cinchstyle.com/og.png">
<meta property="og:image" content="https://cinchstyle.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Cinch — ten pieces is a wardrobe. Free on iPhone.">
<meta name="apple-itunes-app" content="app-id=6798479578, app-argument=https://cinchstyle.com/closet">
<link rel="canonical" href="https://cinchstyle.com/closet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/invite.css">
</head>
<body class="invite">
  <main class="invite-wrap">
    <p class="invite-eyebrow">Cinch</p>
    <h1 class="invite-headline">Your closet is in the app</h1>
    <p class="invite-body">
      Everything you photographed — the pieces, the tags, the wear history — is
      still there, and the ten-piece closet is free for good.
    </p>
    <a class="invite-action" href="${esc(APP_SCHEME_URL)}">Open in Cinch</a>
    <p class="invite-secondary"><a href="${esc(APP_STORE_LISTING)}">Don&rsquo;t have Cinch on this phone? Get it free on the App&nbsp;Store</a></p>
    <p class="invite-note">${note}</p>
  </main>
    <footer class="invite-foot">
      cinchstyle.com &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a>
    </footer>
</body>
</html>
`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent');

  const onApplePhone = isApplePhone(req.headers['user-agent']);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send(page({ onApplePhone }));
    return;
  }

  res.status(200).send(page({ onApplePhone }));
};
