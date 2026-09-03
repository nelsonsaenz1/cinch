/**
 * Pinterest, server-side: token custody, the OAuth endpoints, and live reads.
 *
 * Everything Pinterest lives behind this module so the policy is in one
 * place:
 *
 *   - Tokens exist in plaintext only inside a running function. At rest they
 *     are AES-256-GCM ciphertext under a key that exists only in function
 *     secrets — a database read alone never yields a usable token.
 *   - Board and Pin content is fetched live and passed through an explicit
 *     field allowlist. Nothing is cached, stored, or logged; the Developer
 *     Guidelines' no-storage rule is enforced by there being no code path
 *     that writes API content anywhere.
 *   - Failures are bounded codes, never provider text. Pinterest's error
 *     bodies are not quoted back to clients or logs.
 *   - Nothing here touches OpenRouter or any other third party. Pin imagery
 *     goes to the client for display; the analysis gate for provider images
 *     lives client-side in `features/recreate/sources.ts` and is closed.
 */

// ---------------------------------------------------------------------------
// Endpoints and scopes
// ---------------------------------------------------------------------------

export const PINTEREST_AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';
export const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
export const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

/** The whole ask: the user's own boards and pins, read-only. Never widened. */
export const PINTEREST_SCOPES = ['boards:read', 'pins:read'] as const;

// ---------------------------------------------------------------------------
// Bounded failure vocabulary
// ---------------------------------------------------------------------------

/**
 * Every way a Pinterest interaction can fail, as the client is allowed to
 * know it. `unauthorized` collapses expired-and-unrefreshable with revoked:
 * the remedy (reconnect) is identical and the distinction is Pinterest's
 * private business.
 */
export type PinterestFailure =
  | 'not_connected'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'provider_down';

export class PinterestError extends Error {
  constructor(readonly code: PinterestFailure) {
    super(`pinterest:${code}`);
  }
}

export function failureStatus(code: PinterestFailure): number {
  switch (code) {
    case 'not_connected':
      return 409;
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'rate_limited':
      return 429;
    case 'provider_down':
      return 503;
  }
}

// ---------------------------------------------------------------------------
// Token custody
// ---------------------------------------------------------------------------

const IV_BYTES = 12;

async function tokenKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('PINTEREST_TOKEN_KEY');
  if (!raw) throw new Error('PINTEREST_TOKEN_KEY is not configured.');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('PINTEREST_TOKEN_KEY must be 32 bytes of base64.');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** `base64(iv).base64(ciphertext)` — GCM folds the auth tag into the body. */
export async function encryptToken(plain: string): Promise<string> {
  const key = await tokenKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptToken(stored: string): Promise<string> {
  const [ivPart, bodyPart] = stored.split('.');
  if (!ivPart || !bodyPart) throw new Error('Malformed token ciphertext.');
  const key = await tokenKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivPart) as BufferSource },
    key,
    fromBase64(bodyPart) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export type TokenGrant = {
  accessToken: string;
  refreshToken: string | null;
  /** Absolute, derived here from expires_in so callers never do the math. */
  accessExpiresAt: Date;
  refreshExpiresAt: Date | null;
  scopes: string[];
};

function clientCredentials(): { id: string; secret: string } {
  const id = Deno.env.get('PINTEREST_CLIENT_ID');
  const secret = Deno.env.get('PINTEREST_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Pinterest client credentials are not configured.');
  return { id, secret };
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const { id } = clientCredentials();
  const url = new URL(PINTEREST_AUTHORIZE_URL);
  url.searchParams.set('client_id', id);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', PINTEREST_SCOPES.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

type RawTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
};

async function tokenRequest(form: Record<string, string>): Promise<TokenGrant> {
  const { id, secret } = clientCredentials();
  let response: Response;
  try {
    response = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      // Bounded like every other provider call in _shared: a hung socket is
      // `provider_down`, not a function that runs until the platform kills it.
      signal: AbortSignal.timeout(PINTEREST_TIMEOUT_MS),
    });
  } catch {
    throw new PinterestError('provider_down');
  }

  if (!response.ok) {
    // A refused exchange or refresh is an authorization problem whatever the
    // body says; the body itself is deliberately not read into any log.
    await response.body?.cancel();
    if (response.status === 429) throw new PinterestError('rate_limited');
    if (response.status >= 500) throw new PinterestError('provider_down');
    throw new PinterestError('unauthorized');
  }

  const raw = (await response.json()) as RawTokenResponse;
  if (!raw.access_token || !raw.expires_in) throw new PinterestError('provider_down');

  const now = Date.now();
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    accessExpiresAt: new Date(now + raw.expires_in * 1000),
    refreshExpiresAt: raw.refresh_token_expires_in
      ? new Date(now + raw.refresh_token_expires_in * 1000)
      : null,
    scopes: raw.scope ? raw.scope.split(/[,\s]+/).filter(Boolean) : [],
  };
}

export function exchangeCode(code: string, redirectUri: string): Promise<TokenGrant> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshGrant(refreshToken: string): Promise<TokenGrant> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

// ---------------------------------------------------------------------------
// Live reads
// ---------------------------------------------------------------------------

/** One page from Pinterest, already reduced to the allowlisted shape. */
export type BoardSummary = {
  id: string;
  name: string;
  description: string | null;
  pinCount: number | null;
};

export type PinSummary = {
  id: string;
  title: string | null;
  description: string | null;
  altText: string | null;
  /** The Pin's own canonical page — what attribution links to. */
  pinUrl: string;
  /** Display-only. Never uploaded, never sent to a model (sources.ts gate). */
  imageUrl: string | null;
  dominantColor: string | null;
};

export type Page<T> = { items: T[]; bookmark: string | null };

/** Pinterest's page-size ceiling for these listings is generous; ask small. */
const PAGE_SIZE = 25;

/** Ceiling on any one Pinterest round trip — token exchange or a page read. */
const PINTEREST_TIMEOUT_MS = 10_000;

async function liveGet(path: string, accessToken: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${PINTEREST_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(PINTEREST_TIMEOUT_MS),
    });
  } catch {
    throw new PinterestError('provider_down');
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401) throw new PinterestError('unauthorized');
    if (response.status === 403) throw new PinterestError('forbidden');
    if (response.status === 404) throw new PinterestError('not_found');
    if (response.status === 429) throw new PinterestError('rate_limited');
    throw new PinterestError('provider_down');
  }
  return response.json();
}

type RawPage = { items?: unknown[]; bookmark?: string | null };

function pageOf<T>(raw: unknown, map: (item: Record<string, unknown>) => T | null): Page<T> {
  const page = (raw ?? {}) as RawPage;
  const items = Array.isArray(page.items) ? page.items : [];
  return {
    items: items
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .map(map)
      .filter((i): i is T => i !== null),
    bookmark: typeof page.bookmark === 'string' && page.bookmark ? page.bookmark : null,
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export async function listBoards(accessToken: string, bookmark: string | null): Promise<Page<BoardSummary>> {
  const qs = new URLSearchParams({ page_size: String(PAGE_SIZE) });
  if (bookmark) qs.set('bookmark', bookmark);
  const raw = await liveGet(`/boards?${qs}`, accessToken);
  return pageOf(raw, (b) => {
    const id = str(b.id);
    const name = str(b.name);
    if (!id || !name) return null;
    return {
      id,
      name,
      description: str(b.description),
      pinCount: typeof b.pin_count === 'number' ? b.pin_count : null,
    };
  });
}

export async function listPins(
  accessToken: string,
  boardId: string,
  bookmark: string | null,
): Promise<Page<PinSummary>> {
  // The board id goes into a path segment; a caller-supplied id must not be
  // able to change which endpoint is addressed.
  if (!/^[0-9]+$/.test(boardId)) throw new PinterestError('not_found');
  const qs = new URLSearchParams({ page_size: String(PAGE_SIZE) });
  if (bookmark) qs.set('bookmark', bookmark);
  const raw = await liveGet(`/boards/${boardId}/pins?${qs}`, accessToken);
  return pageOf(raw, (p) => {
    const id = str(p.id);
    if (!id) return null;
    // The image: v5 nests size variants under media.images; any one will do
    // for a reference card, preferring the largest named size present.
    let imageUrl: string | null = null;
    const media = p.media as Record<string, unknown> | undefined;
    const images = media?.images as Record<string, unknown> | undefined;
    if (images) {
      for (const size of ['1200x', '600x', '400x300', '150x150']) {
        const variant = images[size] as Record<string, unknown> | undefined;
        const url = variant ? str(variant.url) : null;
        if (url) {
          imageUrl = url;
          break;
        }
      }
    }
    return {
      id,
      title: str(p.title),
      description: str(p.description),
      altText: str(p.alt_text),
      // The canonical Pin page. Built from the id Pinterest itself returned
      // for this Pin — the one constructed URL attribution permits, since
      // pinterest.com/pin/{id} is Pinterest's own published address form.
      pinUrl: `https://www.pinterest.com/pin/${id}/`,
      imageUrl,
      dominantColor: str(p.dominant_color),
    };
  });
}
