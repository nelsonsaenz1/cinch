import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import {
  decryptToken,
  encryptToken,
  failureStatus,
  listBoards,
  listPins,
  PinterestError,
  refreshGrant,
  type Page,
} from '../_shared/pinterest.ts';

/**
 * pinterest-api — live, read-only board and Pin listings for the signed-in
 * user's own account.
 *
 * A proxy and nothing more. Every response is assembled from a live Pinterest
 * call and an explicit field allowlist (_shared/pinterest.ts); nothing is
 * cached or written, which is how the no-storage rule stays true by
 * construction rather than by policy. Failures leave as bounded codes.
 *
 * Refresh is opportunistic and race-safe without a lock: when the access
 * token is inside its final minute, refresh it, then write the new grant
 * with a predicate on the previously read `updated_at`. Two racing
 * invocations both hold valid new tokens — Pinterest's continuous-refresh
 * rotation tolerates an unused sibling — and only one wins the write, so the
 * stored refresh token is always the one from the row's own lineage.
 */

const REFRESH_MARGIN_MS = 60 * 1000;

type ConnectionRow = {
  access_token_enc: string;
  refresh_token_enc: string | null;
  access_expires_at: string;
  refresh_expires_at: string | null;
  updated_at: string;
};

async function usableAccessToken(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db
    .from('pinterest_connections')
    .select('access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle<ConnectionRow>();

  if (!data) throw new PinterestError('not_connected');

  const accessFresh = new Date(data.access_expires_at).getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (accessFresh) return decryptToken(data.access_token_enc);

  const refreshAlive =
    data.refresh_token_enc &&
    (!data.refresh_expires_at || new Date(data.refresh_expires_at).getTime() > Date.now());
  if (!refreshAlive) {
    await db
      .from('pinterest_connections')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    throw new PinterestError('unauthorized');
  }

  const grant = await refreshGrant(await decryptToken(data.refresh_token_enc!));

  await db
    .from('pinterest_connections')
    .update({
      access_token_enc: await encryptToken(grant.accessToken),
      refresh_token_enc: grant.refreshToken
        ? await encryptToken(grant.refreshToken)
        : data.refresh_token_enc,
      access_expires_at: grant.accessExpiresAt.toISOString(),
      refresh_expires_at: grant.refreshExpiresAt?.toISOString() ?? data.refresh_expires_at,
      status: 'connected',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    // The race arbiter: the loser's write matches zero rows and is silently
    // dropped, which is correct — the winner's lineage is already stored.
    .eq('updated_at', data.updated_at);

  return grant.accessToken;
}

type ApiRequest =
  | { resource: 'boards'; bookmark?: string | null }
  | { resource: 'pins'; boardId: string; bookmark?: string | null };

function parseRequest(body: unknown): ApiRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const bookmark = typeof b.bookmark === 'string' && b.bookmark.length <= 2048 ? b.bookmark : null;
  if (b.resource === 'boards') return { resource: 'boards', bookmark };
  if (b.resource === 'pins' && typeof b.boardId === 'string' && b.boardId.length <= 64) {
    return { resource: 'pins', boardId: b.boardId, bookmark };
  }
  return null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req: Request, ctx): Promise<Response> => {
    const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
    // The Pinterest tables postdate the last gen:types run — one cast, one
    // named place, the build-export arrangement.
    const db = admin as unknown as SupabaseClient;
    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Malformed JSON.' }, { status: 400 });
    }
    const request = parseRequest(body);
    if (!request) return Response.json({ error: 'Malformed request.' }, { status: 400 });

    try {
      const token = await usableAccessToken(db, userId);
      const page: Page<unknown> =
        request.resource === 'boards'
          ? await listBoards(token, request.bookmark ?? null)
          : await listPins(token, request.boardId, request.bookmark ?? null);
      return Response.json({ ok: true, ...page });
    } catch (err) {
      if (err instanceof PinterestError) {
        // A refused live read means the stored grant is dead; make the row
        // say so, so the client's next status read tells the person honestly.
        if (err.code === 'unauthorized') {
          await db
            .from('pinterest_connections')
            .update({ status: 'revoked', updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        }
        return Response.json({ error: err.code }, { status: failureStatus(err.code) });
      }
      console.error('pinterest-api failed outside the bounded set');
      return Response.json({ error: 'provider_down' }, { status: 503 });
    }
  }),
};
