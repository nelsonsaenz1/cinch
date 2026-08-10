/**
 * The invite link, as a pure function of a handle.
 *
 * Kept in a `.ts` with no React in it because `scripts/run-tests.mjs` bundles
 * with esbuild and cannot parse React Native's Flow source — logic that needs
 * a test cannot live in a `.tsx`. This is the parsing half of atlas 39 and it
 * is the half most worth testing: the routing table has five branches and four
 * of them are decided here.
 *
 * ONE LINK PER PERSON, FOREVER. There is no code, no token and no expiry, so
 * there is nothing to look up — the handle IS the link, and building one is
 * string concatenation rather than a round trip. That is the atlas's first
 * rule expressed as an absence of code.
 */

/** The host the universal link is associated with. Also the AASA's home. */
export const INVITE_HOST = 'cinchstyle.com';

/**
 * `/i/` rather than `/invite/`: it is typed out loud in messages and read off
 * screenshots, and two characters of path is two fewer things to get wrong.
 */
const INVITE_PATH = 'i';

/** `@sophie` → `sophie`. Accepts either form from anywhere. */
export function bareHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * The link as it is printed on IV-01 and shared everywhere.
 *
 * The `@` is kept in the URL because the card sets it in serif as a thing you
 * own — `cinchstyle.com/i/@sophie` reads as a person, `.../i/sophie` reads as
 * a database row. The web side accepts both.
 */
export function inviteUrl(handle: string): string {
  return `https://${INVITE_HOST}/${INVITE_PATH}/@${bareHandle(handle)}`;
}

/**
 * The link as the ink card PRINTS it — no scheme.
 *
 * The atlas sets `cinchstyle.com/i/@sophie`, not `https://cinchstyle.com/...`,
 * and the difference is the whole point of that card: without the scheme it
 * reads as an address a person owns, and with it as a URL a machine parses.
 * Caught by holding the simulator against the PNG; nothing else would have
 * found it, because both strings are correct and only one is the design.
 *
 * Display only. Everything that SENDS the link — share, copy, the preview
 * title — uses `inviteUrl`, because a scheme-less string pasted into Messages
 * is not reliably linkified.
 */
export function inviteUrlForDisplay(handle: string): string {
  return `${INVITE_HOST}/${INVITE_PATH}/@${bareHandle(handle)}`;
}

/**
 * What IV-02's share sheet carries. The title is the sentence the recipient
 * reads on the landing page, so the invite says the same thing in Messages as
 * it does in the browser — the atlas is explicit that these must match.
 */
export function shareTitle(displayName: string): string {
  return `${displayName} added you on Cinch`;
}

/**
 * Pull a handle out of an incoming URL, or null if this is not an invite.
 *
 * Handles every shape the app can be opened with:
 *
 *   https://cinchstyle.com/i/@sophie   universal link, the real one
 *   https://www.cinchstyle.com/i/sophie
 *   cinch://i/@sophie                  the custom scheme, for dev and fallback
 *   cinch://invite/sophie              tolerated spelling
 *
 * Deliberately strict about the host on https links: an invite that could be
 * spoofed from any domain is a way to make somebody a friend of an account
 * they never chose, and the whole premise of `apply_invite` is that tapping
 * the link IS the consent.
 */
export function handleFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();

  // `cinch://i/@sophie` puts `i` in the host and `@sophie` in the path, which
  // is why the two schemes are read differently rather than through one regex.
  const segments =
    scheme === 'cinch'
      ? [parsed.hostname, ...parsed.pathname.split('/')].filter(Boolean)
      : parsed.pathname.split('/').filter(Boolean);

  if (scheme === 'https' || scheme === 'http') {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== INVITE_HOST) return null;
  } else if (scheme !== 'cinch') {
    return null;
  }

  // Exactly two segments. Reading the first two and ignoring the rest let
  // `/i/@so/phie` resolve to `so` — a trailing segment is free space in which
  // to dress a link up as something else while it still lands on a real
  // account. An invite URL has one shape, so anything longer is not one.
  // (A trailing slash is fine: the empty segment is filtered out above.)
  if (segments.length !== 2) return null;

  const [first, second] = segments;
  if (first.toLowerCase() !== INVITE_PATH && first.toLowerCase() !== 'invite') return null;

  const handle = bareHandle(decodeURIComponent(second));
  // Mirrors the handle rules the account screen enforces. A path segment that
  // cannot be a handle is not a handle, and passing it to the RPC would be a
  // lookup guaranteed to miss.
  return /^[a-z0-9_.]{2,30}$/.test(handle) ? handle : null;
}
