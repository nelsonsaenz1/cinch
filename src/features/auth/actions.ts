import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '@/lib/supabase';

/**
 * Sign in with Apple, then hand the identity token to Supabase.
 *
 * Two things about this flow that are easy to get wrong:
 *
 *  1. **No manual nonce.** The Expo path takes the identity token verbatim —
 *     Supabase does the nonce handshake against Apple's JWKS server-side.
 *     Passing a nonce here would cause verification to fail.
 *
 *  2. **`credential.fullName` is populated exactly once.** Apple returns it
 *     only on the very first authorization — every subsequent sign-in returns
 *     null, forever, unless the user revokes access in iOS Settings and
 *     re-authorizes. Persisting it into the user's profile has to happen
 *     right here, inside the same sign-in call, or the name is gone.
 */

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'canceled' | 'unavailable' | 'failed'; message?: string };

export async function signInWithApple(): Promise<SignInResult> {
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, reason: 'unavailable' };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      // Should not happen when requestedScopes includes at least one scope,
      // but the type is nullable and shipping a crash here is worse than a
      // clear error message.
      return { ok: false, reason: 'failed', message: 'Apple did not return an identity token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) {
      return { ok: false, reason: 'failed', message: error.message };
    }

    // Persist the name right now — it is only in `credential.fullName` on this
    // first sign-in, and never returned again. Fire-and-forget: a failure here
    // means we lose the name, not the session.
    if (credential.fullName) {
      const parts = [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (parts.length > 0) {
        void supabase.auth.updateUser({
          data: {
            full_name: parts,
            given_name: credential.fullName.givenName ?? null,
            family_name: credential.fullName.familyName ?? null,
          },
        });
      }
    }

    return { ok: true };
  } catch (err) {
    // ERR_REQUEST_CANCELED is the user tapping cancel; that is not an error
    // condition and should never surface as one in the UI.
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, reason: 'canceled' };
    }
    return {
      ok: false,
      reason: 'failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
