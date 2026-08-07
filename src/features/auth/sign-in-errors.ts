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
export function describeThrownSignInError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const isStorageFailure = /secure ?store|keychain|entitlement|storage/i.test(message);
  return isStorageFailure
    ? 'Cinch couldn’t store your sign-in securely on this device, so no code was sent. Restart the app and try again — if it keeps happening, this build can’t reach the device’s keychain.'
    : message || 'Please try again.';
}
