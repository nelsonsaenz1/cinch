import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * The closet's auth lookup, bounded — the fix for the infinite
 * "Reading your wardrobe…" skeleton.
 *
 * ── The bug this file exists to prevent ──────────────────────────────────
 *
 * Every closet query used to open with `await getUserId()`, which calls
 * `supabase.auth.getClaims()`. Two properties of that call combined into a
 * skeleton that never resolved:
 *
 * 1. **It always round-trips to the auth server here.** `getClaims()` verifies
 *    the JWT locally only when `crypto.subtle` exists. Hermes has no WebCrypto,
 *    so on this app it falls back to a network `getUser()` on every single
 *    call — a full extra round trip standing between the user and a closet
 *    that is, for a new user, empty. The field guide's bar is that an empty
 *    closet resolves to the empty design well under a second.
 *
 * 2. **It can pend forever.** Auth calls serialize behind auth-js's internal
 *    initialize/refresh promises. When one of those stalls — a token refresh
 *    whose fetch the OS killed while the app was backgrounded, an auth server
 *    that accepts the connection and never answers — the awaited promise never
 *    settles. React Query's `retry` never engages, because retries fire on
 *    *rejection* and a hung promise never rejects. `isLoading` stays true,
 *    and the screen shows the shimmer bubbles until the app is force-quit.
 *    Server logs showed exactly this shape: sessions of active app use with
 *    auth traffic present and not one `GET /rest/v1/items` ever arriving.
 *
 * ── The two-part fix ─────────────────────────────────────────────────────
 *
 * **Local session, not verified claims.** The user id here is only a query
 * filter; Postgres RLS is what actually decides which rows come back, against
 * the JWT that PostgREST verifies server-side. Client-side signature
 * verification buys nothing for this read path, so the id comes from
 * `getSession()` — the locally persisted session, no verification round trip.
 *
 * **A deadline that REJECTS.** `getSession()` still waits on the client's
 * initialize/refresh internals, so it inherits their failure mode. Racing it
 * against a timer converts "hangs forever" into a thrown error — which is a
 * state the screen already designs for: React Query retries, then `isError`,
 * then `ErrorState` with a working retry button. A skeleton may only ever
 * mean "genuinely loading".
 *
 * Deliberately NOT a change to `lib/supabase.getUserId`: mutations still want
 * `getClaims()`' stricter behaviour before a write, and that helper is shared
 * beyond the closet. This file is the closet's read-path contract only.
 */

/**
 * How long an auth lookup may pend before the query fails honestly. Generous —
 * the normal path is a synchronous read of the in-memory session and resolves
 * in microseconds. The deadline only exists so that "never" becomes "an error
 * with a retry button".
 */
const AUTH_DEADLINE_MS = 8_000;

/** Race a promise against a rejecting timer. The loser is abandoned, not cancelled. */
export function withDeadline<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what} did not respond. Check your connection and try again.`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * The locally persisted session, or null when signed out. Bounded: resolves or
 * rejects within {@link AUTH_DEADLINE_MS}, never pends indefinitely.
 */
export async function closetSession(): Promise<Session | null> {
  const { data } = await withDeadline(supabase.auth.getSession(), AUTH_DEADLINE_MS, 'Sign-in check');
  return data.session ?? null;
}

/** The signed-in user's id for query filters, or null when signed out. */
export async function closetUserId(): Promise<string | null> {
  return (await closetSession())?.user.id ?? null;
}
