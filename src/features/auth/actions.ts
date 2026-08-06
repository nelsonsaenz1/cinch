import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';

import { track } from '@/lib/posthog';
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

type AuthMethod = 'apple' | 'email';

/**
 * Report a finished sign-in attempt, and hand the result straight back.
 *
 * Returning the result is what lets this wrap a `return` in place, so no path
 * out of a function can be added later without going past it — the failure
 * modes here are one-line early returns and they are exactly the ones that get
 * missed.
 *
 * `reason` is the existing enum and nothing else. `result.message` is
 * DELIBERATELY not forwarded: it is assembled from Supabase and Apple error
 * strings, which routinely contain the email address that was being signed in
 * with, and sending that to an analytics vendor contradicts both the privacy
 * manifest and the App Store answers. See the header of lib/posthog.tsx.
 */
function reportAuth(method: AuthMethod, result: SignInResult): SignInResult {
  if (result.ok) track('auth_completed', { method });
  else track('auth_failed', { method, reason: result.reason });
  return result;
}

export async function signInWithApple(): Promise<SignInResult> {
  track('auth_started', { method: 'apple' });
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return reportAuth('apple', { ok: false, reason: 'unavailable' });
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
      return reportAuth('apple', {
        ok: false,
        reason: 'failed',
        message: 'Apple did not return an identity token.',
      });
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) {
      return reportAuth('apple', { ok: false, reason: 'failed', message: error.message });
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

    return reportAuth('apple', { ok: true });
  } catch (err) {
    // ERR_REQUEST_CANCELED is the user tapping cancel; that is not an error
    // condition and should never surface as one in the UI.
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      return reportAuth('apple', { ok: false, reason: 'canceled' });
    }
    return reportAuth('apple', {
      ok: false,
      reason: 'failed',
      message: err instanceof Error ? err.message : String(err),
    });
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
  // Started, not completed — no matter how this returns. A sent link is not a
  // session; the completion for this method is `verifyEmailCode` or
  // `completeSessionFromUrl`, possibly in a later run of the app.
  track('auth_started', { method: 'email' });

  const address = email.trim().toLowerCase();

  // Cheap client-side shape check. The real validation is the email arriving.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
    track('auth_failed', { method: 'email', reason: 'failed' });
    return { ok: false, reason: 'failed', message: 'That does not look like an email address.' };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: {
      shouldCreateUser: true,
      // Where the link returns to, and the only URL `completeSessionFromUrl`
      // will act on. Three separate things have to agree or the link dead-ends
      // in a browser tab that cannot hand the session back:
      //
      //  1. `cinch` is registered as a scheme in app.config.ts (it is);
      //  2. this exact string is on the allow-list under Supabase Dashboard →
      //     Authentication → URL Configuration → Redirect URLs. It is NOT
      //     configurable from this repository — if it is missing, Supabase
      //     silently substitutes the project Site URL and the link opens the
      //     website instead of the app;
      //  3. the email template links `{{ .ConfirmationURL }}`, so Supabase
      //     verifies the one-time token before redirecting here.
      //
      // Under PKCE this callback carries `?code=`, which is redeemable only on
      // the device that made this call.
      emailRedirectTo: CALLBACK_URL,
    },
  });

  if (error) {
    // Supabase's built-in mailer is rate limited to a couple of sends an hour.
    // Saying so is far better than a generic failure the user will read as the
    // app being broken.
    track('auth_failed', { method: 'email', reason: 'failed' });
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

/**
 * Verify a numeric code, for once custom SMTP makes codes possible.
 *
 * A completion path, so it reports an outcome but never `auth_started` —
 * `sendEmailLink` already opened this attempt.
 */
export async function verifyEmailCode(email: string, token: string): Promise<SignInResult> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  if (error) {
    return reportAuth('email', {
      ok: false,
      reason: 'failed',
      message: /expired/i.test(error.message)
        ? 'That code has expired. Send a new one.'
        : 'That code was not right. Check it and try again.',
    });
  }
  return reportAuth('email', { ok: true });
}

// ---------------------------------------------------------------------------
// Magic-link callback
// ---------------------------------------------------------------------------

export const CALLBACK_SCHEME = 'cinch';
export const CALLBACK_ROUTE = 'auth-callback';
export const CALLBACK_URL = `${CALLBACK_SCHEME}://${CALLBACK_ROUTE}`;

/**
 * The outcome of handling one incoming URL.
 *
 * `ignored` and `failed` are kept apart on purpose. Every deep link the app
 * receives is offered to this function, so "this was not a sign-in link" is the
 * common case and must not surface as an error; "this was a sign-in link and it
 * did not work" always must.
 */
export type AuthCallbackResult =
  | { status: 'signed-in' }
  | { status: 'ignored'; reason: string }
  | { status: 'failed'; message: string };

/**
 * Results, not just in-flight promises, keyed by authorization code.
 *
 * The same callback reaches us twice — once from the deep-link listener and
 * once from the `/auth-callback` screen expo-router mounts for it. A code is
 * single-use, so the second caller must be handed the first caller's outcome
 * rather than attempting an exchange Supabase would (correctly) reject. Codes
 * are short-lived and a run of the app sees a handful, so nothing is evicted.
 */
const exchanges = new Map<string, Promise<AuthCallbackResult>>();

function describeCallbackError(
  error: string | null,
  code: string | null,
  description: string | null,
): string {
  const all = `${error ?? ''} ${code ?? ''} ${description ?? ''}`;
  if (/expired/i.test(all)) {
    return 'That sign-in link has expired. Send yourself a new one.';
  }
  if (/access_denied|used/i.test(all)) {
    return 'That sign-in link has already been used. Send yourself a new one.';
  }
  // URLSearchParams has already percent-decoded this; Supabase still sends `+`
  // for spaces, which decoding does not touch.
  const readable = description?.replace(/\+/g, ' ').trim();
  return readable && readable.length > 0
    ? readable
    : 'That sign-in link could not be used. Send yourself a new one.';
}

function exchangeOnce(code: string): Promise<AuthCallbackResult> {
  const existing = exchanges.get(code);
  if (existing) return existing;

  const attempt = supabase.auth
    .exchangeCodeForSession(code)
    .then(({ error }): AuthCallbackResult => {
      if (!error) return { status: 'signed-in' };
      if (/verifier|code challenge|pkce/i.test(error.message)) {
        // The verifier lives only on the device that requested the link. This
        // is the message a user gets when they tap the link on their laptop, or
        // after reinstalling — and it is also what an attacker's forged link
        // produces here, which is the intended outcome.
        return {
          status: 'failed',
          message:
            'This link has to be opened on the device that asked for it. Request a new link here and open it on this device.',
        };
      }
      return { status: 'failed', message: describeCallbackError(null, null, error.message) };
    })
    .catch((err): AuthCallbackResult => ({
      status: 'failed',
      message: err instanceof Error ? err.message : 'Could not complete sign-in.',
    }))
    // Reported HERE, inside the memoised chain, and not at the call site. The
    // same callback reaches `completeSessionFromUrl` twice by design — once
    // from the deep-link listener, once from the /auth-callback screen — so a
    // call-site emit would double every magic-link outcome in the funnel and
    // halve the apparent conversion. This runs once per code, which is once
    // per real attempt.
    .then((result) => {
      if (result.status === 'signed-in') {
        track('auth_completed', { method: 'email' });
      } else if (result.status === 'failed') {
        track('auth_failed', { method: 'email', reason: 'failed' });
      }
      return result;
    });

  exchanges.set(code, attempt);
  return attempt;
}

/**
 * Callback URLs whose failure has already been reported.
 *
 * The double-delivery above is handled by the `exchanges` memo for anything
 * that reaches an exchange, but the pre-exchange refusals — an expired link, a
 * forged fragment token — never get that far and would otherwise be counted
 * once per delivery. Same lifetime argument as `exchanges`: a run of the app
 * sees a handful of callbacks, so nothing is evicted. It stays on the device
 * and is never sent anywhere.
 */
const reportedFailures = new Set<string>();

function reportCallbackFailure(url: string): void {
  if (reportedFailures.has(url)) return;
  reportedFailures.add(url);
  track('auth_failed', { method: 'email', reason: 'failed' });
}

/**
 * Complete a magic-link sign-in from the URL the link opened.
 *
 * `detectSessionInUrl` is switched off in the Supabase client because it is
 * mandatory to do so on native, which means nothing parses the callback URL
 * automatically — this does it by hand.
 *
 * Two rules make this safe, and both matter:
 *
 *  - **Only `cinch://auth-callback` is acted on.** Any other scheme or route is
 *    ignored outright, so an arbitrary `cinch://…` link cannot reach the auth
 *    client at all.
 *  - **Fragment tokens are refused, never redeemed.** Under the implicit flow a
 *    URL carries a ready-made `access_token`/`refresh_token` that anyone can
 *    put in a link, which is exactly how a victim gets signed into an
 *    attacker's account. The client uses PKCE now, so a genuine callback
 *    carries `?code=` and nothing else; a fragment token is by definition
 *    unsolicited.
 */
export async function completeSessionFromUrl(url: string): Promise<AuthCallbackResult> {
  const [beforeHash, fragment = ''] = url.split('#');

  const parsed = Linking.parse(beforeHash);
  const scheme = parsed.scheme?.toLowerCase() ?? null;
  // `cinch://auth-callback` parses the route as the hostname; `cinch:///auth-callback`
  // parses it as the path. Both shapes occur in the wild depending on who built
  // the URL, and only the route itself is being checked here.
  const route = (parsed.hostname ?? parsed.path ?? '').replace(/^\/+|\/+$/g, '').toLowerCase();

  if (scheme !== CALLBACK_SCHEME || route !== CALLBACK_ROUTE) {
    return { status: 'ignored', reason: 'not-the-sign-in-callback' };
  }

  const query = new URLSearchParams(beforeHash.split('?')[1] ?? '');
  const hash = new URLSearchParams(fragment);
  // Supabase puts errors in the query string for PKCE and in the fragment for
  // implicit; accepting either means an expired link reads the same both ways.
  const pick = (name: string) => query.get(name) ?? hash.get(name);

  const error = pick('error');
  const errorCode = pick('error_code');
  if (error || errorCode) {
    reportCallbackFailure(url);
    return {
      status: 'failed',
      message: describeCallbackError(error, errorCode, pick('error_description')),
    };
  }

  if (hash.get('access_token') || hash.get('refresh_token')) {
    reportCallbackFailure(url);
    return {
      status: 'failed',
      message:
        'That link tried to sign you into an account without your permission, so it was refused. Ask for a new sign-in link from this screen.',
    };
  }

  const code = pick('code');
  if (!code) return { status: 'ignored', reason: 'callback-carried-no-code' };

  return exchangeOnce(code);
}
