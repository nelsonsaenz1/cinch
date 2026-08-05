/**
 * Outbound fetches to addresses a *user's words* chose.
 *
 * Everything this function downloads — a retailer's product page, then the
 * product photograph on it — is reached from a URL that ultimately traces back
 * to a search query somebody typed. That makes every call in this file a
 * server-side request forgery risk in the textbook sense: the Edge Function
 * runs inside Supabase's network and can therefore reach things the caller
 * cannot, and "fetch whatever the model said" is exactly the primitive an
 * attacker wants.
 *
 * So the rules here are deliberately narrow rather than clever:
 *
 *   https only          — no file:, no http:, no data:, no gopher:
 *   no address literals — 127.0.0.1, ::1, 169.254.169.254 and friends by name
 *   no private hosts    — localhost, *.local, *.internal, bare hostnames
 *   redirects by hand   — every hop re-validated, at most three
 *   bytes counted       — the cap is enforced while streaming, not after
 *
 * WHAT THIS DOES NOT DEFEND AGAINST, stated plainly: a public hostname whose
 * DNS answer is a private address (rebinding). Deno's fetch gives no hook
 * between resolution and connection, so the only real fix is an egress proxy.
 * The consolation is that the bytes are never returned to the caller — they are
 * validated as an image and written to Storage — so a successful rebind reads
 * an internal endpoint into a private bucket rather than onto someone's screen.
 */

/** Hostnames that are never a legitimate retailer. */
const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localdomain', '.home.arpa'];

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
]);

/** IPv4 in dotted-quad form, which is the only IPv4 shape a URL host can take. */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIpv4(host: string): boolean {
  const match = IPV4.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return a >= 224; // multicast and reserved
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/**
 * Parse and vet one URL, or throw.
 *
 * Returns the parsed URL so callers cannot accidentally validate one string and
 * then fetch another.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('not a url');
  }

  if (url.protocol !== 'https:') throw new UnsafeUrlError('not https');
  // Credentials in a URL are only ever an attempt to confuse a parser.
  if (url.username || url.password) throw new UnsafeUrlError('credentials in url');

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) throw new UnsafeUrlError('no host');
  if (BLOCKED_HOSTS.has(host)) throw new UnsafeUrlError('blocked host');
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UnsafeUrlError('blocked host');
  }
  // A host with no dot is a name only resolvable inside a private network.
  if (!host.includes('.') && !host.includes(':')) throw new UnsafeUrlError('non-public host');
  if (isPrivateIpv4(host)) throw new UnsafeUrlError('private address');
  // Any IPv6 literal: the mapped and unique-local forms are too easy to smuggle
  // past a check-list, and no retailer publishes one.
  if (host.includes(':')) throw new UnsafeUrlError('ip literal');

  return url;
}

export type GuardedResponse = {
  url: URL;
  status: number;
  contentType: string;
  body: Uint8Array;
};

/**
 * Fetch with every hop vetted and the body capped as it arrives.
 *
 * `redirect: 'manual'` is the load-bearing part: the default follows redirects
 * inside the runtime, so a public URL that 302s to 169.254.169.254 would be
 * fetched before any of the checks above ran. Following by hand means the guard
 * applies to the address actually connected to, every time.
 */
export async function guardedFetch(
  raw: string,
  opts: { accept: string; maxBytes: number; timeoutMs: number; maxHops?: number },
): Promise<GuardedResponse> {
  const maxHops = opts.maxHops ?? 3;
  let url = assertSafeUrl(raw);

  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: {
        accept: opts.accept,
        // Some retailers serve a bot-blocking stub to an empty user agent. This
        // says who we are honestly rather than impersonating a browser.
        'user-agent': 'CinchBot/1.0 (+https://cinch.app)',
      },
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Drain: an unread body holds the connection open for the pool's lifetime.
      await response.body?.cancel();
      if (hop >= maxHops) throw new UnsafeUrlError('too many redirects');
      url = assertSafeUrl(new URL(location, url).toString());
      continue;
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();

    if (!response.ok) {
      await response.body?.cancel();
      return { url, status: response.status, contentType, body: new Uint8Array() };
    }

    // Content-Length is a hint, not a promise — a lying or absent header is
    // normal — so it is used to fail early and the running total below is what
    // actually enforces the cap.
    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      await response.body?.cancel();
      throw new UnsafeUrlError('too large');
    }

    const body = await readCapped(response, opts.maxBytes);
    return { url, status: response.status, contentType, body };
  }
}

/** Read a response body, aborting the moment it exceeds `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UnsafeUrlError('too large');
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
