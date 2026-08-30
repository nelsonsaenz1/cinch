import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import {
  authorizeUrl,
  encryptToken,
  exchangeCode,
  PinterestError,
} from '../_shared/pinterest.ts';

/**
 * pinterest-oauth — the connection's whole lifecycle: /start, /callback,
 * /disconnect.
 *
 * `verify_jwt` is OFF for this function (supabase/config.toml) because
 * /callback is Pinterest's redirect and carries no Supabase session — the
 * same reasoning as superwall-webhook. The other two routes therefore do
 * their own authentication, build-export's way: the bearer token is handed
 * to `admin.auth.getUser`, and no user means no service.
 *
 * The state parameter is the only thing that ties a callback to a user, so
 * it carries the whole burden: 32 random bytes, ten-minute expiry, bound to
 * the minting user, consumed atomically by a single UPDATE whose predicate
 * (`consumed_at is null and expires_at > now()`) makes replay and expiry the
 * same non-event. That statement is proven verbatim in
 * supabase/tests/26_pinterest_connection.sql.
 *
 * The client secret and the code exchange live here and nowhere else. The
 * app never sees a token, encrypted or otherwise; it learns "connected" from
 * the column-grant-limited row and nothing more.
 *
 * Disconnect deletes Cinch-held material. Pinterest v5 publishes no token
 * revocation endpoint, so upstream the grant ages out by expiry and the
 * person can revoke Cinch at pinterest.com/settings/security — the
 * disconnect copy in the app says exactly that rather than claiming a
 * revocation this API cannot perform.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

/** Where Pinterest sends the person back to; must match the app's registered
 * redirect URI character for character. */
function callbackUri(req: Request): string {
  // Derive from the request's own URL so the value cannot drift from the
  // function's actual address across projects.
  const url = new URL(req.url);
  return `${url.origin}/functions/v1/pinterest-oauth/callback`;
}

/** The app's return address. A custom-scheme deep link, not a web page. */
const APP_RETURN = 'cinch://pinterest-callback';

function appRedirect(params: Record<string, string>): Response {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_RETURN}?${qs}` },
  });
}

function mintState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default {
  async fetch(req: Request): Promise<Response> {
    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    // The two Pinterest tables postdate the last `gen:types` run; one cast in
    // one named place, build-export's arrangement exactly.
    const db = admin as unknown as SupabaseClient;

    const route = new URL(req.url).pathname.split('/').pop();

    // ── /callback — Pinterest's redirect; the one public route ─────────────
    if (route === 'callback') {
      if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed.' }, { status: 405 });
      }
      const params = new URL(req.url).searchParams;
      const state = params.get('state') ?? '';
      const code = params.get('code');

      // A denial arrives as error=... with no code. The state, when it is
      // still live, is consumed either way — a denied attempt must not leave
      // a mintable ticket behind.
      const { data: consumed } = await db
        .from('pinterest_oauth_states')
        .update({ consumed_at: new Date().toISOString() })
        .eq('state', state)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('user_id');

      const userId: string | null = consumed?.[0]?.user_id ?? null;
      if (!userId) return appRedirect({ error: 'expired' });
      if (!code) return appRedirect({ error: 'denied' });

      try {
        const grant = await exchangeCode(code, callbackUri(req));
        const { error } = await db.from('pinterest_connections').upsert({
          user_id: userId,
          access_token_enc: await encryptToken(grant.accessToken),
          refresh_token_enc: grant.refreshToken ? await encryptToken(grant.refreshToken) : null,
          access_expires_at: grant.accessExpiresAt.toISOString(),
          refresh_expires_at: grant.refreshExpiresAt?.toISOString() ?? null,
          scopes: grant.scopes,
          status: 'connected',
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return appRedirect({ connected: '1' });
      } catch (err) {
        // Bounded code out, never provider text; the log carries the shape
        // of the failure and nothing that arrived in it.
        console.error(
          `pinterest-oauth callback failed: ${err instanceof PinterestError ? err.code : 'write_failed'}`,
        );
        return appRedirect({ error: 'failed' });
      }
    }

    // ── Everything else requires the caller to be a signed-in user ─────────
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    }
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const { data: userData } = bearer ? await admin.auth.getUser(bearer) : { data: null };
    const userId = userData?.user?.id ?? null;
    if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

    if (route === 'start') {
      // Opportunistic housekeeping: dead states are small but need not
      // accumulate forever.
      await db
        .from('pinterest_oauth_states')
        .delete()
        .lt('expires_at', new Date(Date.now() - STATE_TTL_MS).toISOString());

      const state = mintState();
      const { error } = await db.from('pinterest_oauth_states').insert({
        state,
        user_id: userId,
        expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
      });
      if (error) return Response.json({ error: 'Could not start.' }, { status: 500 });

      try {
        return Response.json({ url: authorizeUrl(callbackUri(req), state) });
      } catch {
        // Credentials unset: the source is honestly not configured.
        return Response.json({ error: 'not_configured' }, { status: 503 });
      }
    }

    if (route === 'disconnect') {
      // Delete rather than mark: what disconnect promises is that Cinch no
      // longer holds connection material, and a deleted row is that promise
      // kept. Idempotent — a second call deletes nothing and succeeds.
      const { error } = await db.from('pinterest_connections').delete().eq('user_id', userId);
      if (error) return Response.json({ error: 'Could not disconnect.' }, { status: 500 });
      await db.from('pinterest_oauth_states').delete().eq('user_id', userId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'No such route.' }, { status: 404 });
  },
};
