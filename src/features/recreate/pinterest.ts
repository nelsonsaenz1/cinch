import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * The Pinterest connection, client half.
 *
 * The server half (`pinterest-oauth`, `pinterest-api`) owns every secret and
 * every Pinterest byte at rest; this file owns what the app may know — that a
 * connection exists, its status, and pages of live, allowlisted board and Pin
 * summaries that are displayed and then let go. Nothing fetched here is
 * cached beyond React Query's in-memory page state, persisted, or sent to
 * any model: the no-storage posture is the server's, and the client keeps it
 * by having nowhere to put the data either.
 *
 * Analytics: connection lifecycle and bounded outcome codes only. Board
 * names, Pin ids, titles, URLs, and imagery never reach `track` — the same
 * counts-only rule the recreate flow already lives by.
 */

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

export type PinterestConnection = {
  status: 'connected' | 'expired' | 'revoked';
  scopes: string[];
  connectedAt: string;
};

export function usePinterestConnection() {
  return useQuery({
    queryKey: ['pinterest-connection'],
    queryFn: async (): Promise<PinterestConnection | null> => {
      const userId = await getUserId();
      if (!userId) return null;
      // Only the columns the grant exposes; the token columns are not merely
      // unselected here, they are unselectable (column-level privileges).
      const { data, error } = await supabase
        .from('pinterest_connections' as never)
        .select('status, scopes, connected_at')
        .eq('user_id', userId)
        .maybeSingle<{ status: string; scopes: string[]; connected_at: string }>();
      if (error) throw error;
      if (!data) return null;
      const status =
        data.status === 'expired' || data.status === 'revoked' ? data.status : 'connected';
      return { status, scopes: data.scopes ?? [], connectedAt: data.connected_at };
    },
  });
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

/** Where the callback lands; also the auth-session's completion filter. */
const RETURN_URL = 'cinch://pinterest-callback';

export type ConnectOutcome = 'connected' | 'canceled' | 'denied' | 'failed' | 'not_configured';

/**
 * The OAuth round trip: ask the server for the authorize URL (which mints the
 * state), hand it to the system auth session, and read the deep-linked
 * outcome. The tokens themselves never pass through here — the server's
 * /callback exchanged and stored them before the browser bounced back.
 */
export function useConnectPinterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ConnectOutcome> => {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'pinterest-oauth/start',
        { body: {} },
      );
      if (error || !data?.url) {
        const ctx = (error as { context?: unknown })?.context;
        if (ctx instanceof Response && ctx.status === 503) return 'not_configured';
        return 'failed';
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, RETURN_URL);
      if (result.type !== 'success') return 'canceled';

      const params = new URL(result.url).searchParams;
      if (params.get('connected') === '1') return 'connected';
      if (params.get('error') === 'denied') return 'denied';
      return 'failed';
    },
    onSettled: (outcome) => {
      // Outcome code only — nothing about the account that was or was not
      // linked.
      track('pinterest_connect_settled', { outcome: outcome ?? 'failed' });
      void qc.invalidateQueries({ queryKey: ['pinterest-connection'] });
    },
  });
}

export function useDisconnectPinterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(
        'pinterest-oauth/disconnect',
        { body: {} },
      );
      if (error || !data?.ok) throw new Error('Could not disconnect.');
    },
    onSuccess: () => {
      track('pinterest_disconnected');
      void qc.invalidateQueries({ queryKey: ['pinterest-connection'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Live content
// ---------------------------------------------------------------------------

/** Mirrors of the server's allowlisted shapes — see _shared/pinterest.ts. */
export type PinterestBoard = {
  id: string;
  name: string;
  description: string | null;
  pinCount: number | null;
};

export type PinterestPin = {
  id: string;
  title: string | null;
  description: string | null;
  altText: string | null;
  pinUrl: string;
  imageUrl: string | null;
  dominantColor: string | null;
};

/** The server's bounded vocabulary, passed through untranslated. */
export type PinterestFailure =
  | 'not_connected'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'provider_down'
  | 'offline';

export class PinterestRequestError extends Error {
  constructor(readonly code: PinterestFailure) {
    super(`pinterest:${code}`);
  }
}

async function readFailure(error: unknown): Promise<PinterestFailure> {
  const response = (error as { context?: unknown })?.context;
  if (!(response instanceof Response)) return 'offline';
  try {
    const body = (await response.clone().json()) as { error?: string };
    const code = body.error;
    if (
      code === 'not_connected' ||
      code === 'unauthorized' ||
      code === 'forbidden' ||
      code === 'not_found' ||
      code === 'rate_limited' ||
      code === 'provider_down'
    ) {
      return code;
    }
  } catch {
    // Fall through to the status-shaped answer below.
  }
  return response.status >= 500 ? 'provider_down' : 'offline';
}

async function callApi<T>(body: Record<string, unknown>): Promise<{ items: T[]; bookmark: string | null }> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    items?: T[];
    bookmark?: string | null;
  }>('pinterest-api', { body });
  if (error) throw new PinterestRequestError(await readFailure(error));
  if (!data?.ok) throw new PinterestRequestError('provider_down');
  return { items: data.items ?? [], bookmark: data.bookmark ?? null };
}

export function fetchBoardsPage(bookmark: string | null): Promise<{ items: PinterestBoard[]; bookmark: string | null }> {
  return callApi<PinterestBoard>({ resource: 'boards', bookmark });
}

export function fetchPinsPage(
  boardId: string,
  bookmark: string | null,
): Promise<{ items: PinterestPin[]; bookmark: string | null }> {
  return callApi<PinterestPin>({ resource: 'pins', boardId, bookmark });
}

/**
 * Every board, across pages, with a hard ceiling. The ceiling is generous —
 * a person with more than eight pages of boards still gets their first two
 * hundred — and it exists so a pathological account cannot spin the client
 * through unbounded round trips.
 */
export async function fetchAllBoards(): Promise<PinterestBoard[]> {
  const all: PinterestBoard[] = [];
  let bookmark: string | null = null;
  for (let page = 0; page < 8; page++) {
    const result = await fetchBoardsPage(bookmark);
    all.push(...result.items);
    bookmark = result.bookmark;
    if (!bookmark) break;
  }
  return all;
}

/** The first pages of a board, ceiling-bounded the same way. */
export async function fetchPins(boardId: string, maxPages = 2): Promise<PinterestPin[]> {
  const all: PinterestPin[] = [];
  let bookmark: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPinsPage(boardId, bookmark);
    all.push(...result.items);
    bookmark = result.bookmark;
    if (!bookmark) break;
  }
  return all;
}
