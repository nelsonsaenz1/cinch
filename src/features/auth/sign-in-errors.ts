/**
 * Turn a THROWN sign-in failure into a message worth showing.
 *
 * The auth actions return `{ ok: false }` for every failure they can name, so
 * anything that arrives here escaped them — in practice the session-storage
 * layer. Under PKCE, `signInWithOtp` persists state through the Supabase
 * client's storage adapter BEFORE the request goes out; on a build whose
 * keychain entitlement is missing (a dev build, most commonly), SecureStore
 * rejects, supabase-js rethrows the non-auth error, and without a catch the
 * tap on Continue does nothing at all — no message, busy stuck. The
 * entitlement itself is a build problem fixed elsewhere; the contract HERE is
 * that no storage failure is ever silent.
 */
/**
 * The bounded diagnosis of an Apple sign-in failure — a CLOSED set, safe for
 * analytics precisely because none of it is a sentence.
 *
 * Written for the 2026-08-30 lockout investigation: nine users across ten
 * days failed `apple/failed` on the welcome screen, every one on iOS 26.6.1,
 * every one retrying and none ever completing — and the funnel could not say
 * WHY, because `reportAuth` (rightly) refuses to forward `result.message` to
 * PostHog. This code is the piece of the failure that is not a message: the
 * thrown `err.code` is expo-apple-authentication's own enum, `no_identity_token`
 * and `supabase_<status>` name the two returned failures, and anything
 * unrecognised collapses to `thrown_other` rather than leaking text. One of
 * these values beside the next failure turns a mystery into a diagnosis —
 * ERR_REQUEST_UNKNOWN is a device not signed into an Apple account,
 * ERR_REQUEST_FAILED is the module's own credential validation refusing a
 * response missing authorizationCode/identityToken/user.
 */
const APPLE_ERROR_CODES = new Set([
  'ERR_REQUEST_FAILED',
  'ERR_REQUEST_UNKNOWN',
  'ERR_REQUEST_NOT_HANDLED',
  'ERR_REQUEST_NOT_INTERACTIVE',
  'ERR_INVALID_RESPONSE',
  'ERR_INVALID_OPERATION',
  'ERR_INVALID_SCOPE',
]);

export function appleFailureCode(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' && APPLE_ERROR_CODES.has(code) ? code : 'thrown_other';
}

export function describeThrownSignInError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const isStorageFailure = /secure ?store|keychain|entitlement|storage/i.test(message);
  return isStorageFailure
    ? 'Cinch couldn’t store your sign-in securely on this device, so no code was sent. Restart the app and try again — if it keeps happening, this build can’t reach the device’s keychain.'
    : message || 'Please try again.';
}
