/**
 * Where `auth: 'user'` gets the keys it verifies JWT signatures against.
 *
 * `@supabase/server`'s `auth: 'user'` mode resolves its JWKS from the
 * `SUPABASE_JWKS` (inline JSON) or `SUPABASE_JWKS_URL` environment variables
 * and from nothing else. Two facts make that resolution a trap on this
 * platform:
 *
 * 1. The Edge Functions runtime *injects* `SUPABASE_JWKS` — as a snapshot
 *    taken at some point in the project's life, not a live view. When the
 *    project's JWT signing key rotated (2026-08-05, the security-review
 *    remediation moved signing to a new asymmetric ES256 key), the snapshot
 *    kept the old keys. Result: every function that let the library resolve
 *    its own JWKS rejected every request — including perfectly valid user
 *    JWTs — with 401 `INVALID_CREDENTIALS`, before the handler ever ran.
 *    `ai_calls` was empty across the project's whole lifetime.
 *
 * 2. The `SUPABASE_` secret prefix is reserved, so no operator can ever set
 *    a correcting `SUPABASE_JWKS_URL` from outside. The fix has to live in
 *    code, and it has to *win* over the injected snapshot — deferring to
 *    `SUPABASE_JWKS` when present is exactly the bug.
 *
 * So: always hand the library the live well-known endpoint derived from
 * `SUPABASE_URL`. The endpoint is authoritative by definition — it serves
 * whatever keys Auth is signing with *right now* — and it cannot go stale
 * across a rotation. Every `auth: 'user'` function in this project must pass
 * `env: jwksEnv()` to `withSupabase`; a new function that forgets is not
 * broken today, but it is one key rotation away from rejecting everyone.
 */
export function jwksEnv(): { jwks: URL } | undefined {
  const projectUrl = Deno.env.get('SUPABASE_URL');
  if (!projectUrl) return undefined;

  try {
    return { jwks: new URL('/auth/v1/.well-known/jwks.json', projectUrl) };
  } catch {
    // A malformed SUPABASE_URL is the platform's problem, not something to
    // crash the module over at import time — the library's own resolution
    // (and its 401) is no worse than a throw here.
    return undefined;
  }
}
