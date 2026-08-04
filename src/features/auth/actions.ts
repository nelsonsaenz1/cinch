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

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Send a sign-in link to any email address.
 *
 * This is the answer to "I want to sign in with Gmail or Yahoo" without binding
 * the app to one company's OAuth: a link to an inbox works for every provider
 * there is, needs no client IDs, no extra native module, and adds no new
 * third-party processor to the privacy policy.
 *
 * It is a LINK rather than a six-digit code, and that is a platform constraint
 * rather than a choice — Supabase only substitutes `{{ .Token }}` into a custom
 * email template, and template editing requires custom SMTP. The moment SMTP is
 * configured this becomes a code, and `verifyEmailCode` below already handles
 * that shape.
 */
export async function sendEmailLink(email: string): Promise<SignInResult> {
  const address = email.trim().toLowerCase();

  // Cheap client-side shape check. The real validation is the email arriving.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
    return { ok: false, reason: 'failed', message: 'That does not look like an email address.' };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: {
      shouldCreateUser: true,
      // Where the link returns to. `cinch://` is registered in app.config.ts
      // and allow-listed in the Supabase auth settings; without both, the link
      // opens a browser tab that cannot hand the session back to the app.
      emailRedirectTo: 'cinch://auth-callback',
    },
  });

  if (error) {
    // Supabase's built-in mailer is rate limited to a couple of sends an hour.
    // Saying so is far better than a generic failure the user will read as the
    // app being broken.
    const rateLimited = /rate limit|too many/i.test(error.message);
    return {
      ok: false,
      reason: 'failed',
      message: rateLimited
        ? 'Too many sign-in emails just now. Try again in a few minutes.'
        : error.message,
    };
  }

  return { ok: true };
}

/** Verify a numeric code, for once custom SMTP makes codes possible. */
export async function verifyEmailCode(email: string, token: string): Promise<SignInResult> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  if (error) {
    return {
      ok: false,
      reason: 'failed',
      message: /expired/i.test(error.message)
        ? 'That code has expired. Send a new one.'
        : 'That code was not right. Check it and try again.',
    };
  }
  return { ok: true };
}

/**
 * Complete a magic-link sign-in from the URL the link opened.
 *
 * `detectSessionInUrl` is switched off in the Supabase client because it is
 * mandatory to do so on native, which means nothing parses the callback URL
 * automatically — this does it by hand.
 *
 * Supabase sends tokens in the URL FRAGMENT, after the `#`, not the query
 * string. Reading `?` here is the reason most native magic-link integrations
 * appear to do nothing at all.
 */
export async function completeSessionFromUrl(url: string): Promise<boolean> {
  const fragment = url.split('#')[1];
  if (!fragment) return false;

  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}
