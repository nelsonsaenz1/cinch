import Constants from 'expo-constants';

import { pushTokenRegisteredProps } from '@/features/push/ask-spec';
import { PUSH_AVAILABLE, push } from '@/features/push/native';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * The device token — one row per install, upserted on the token itself.
 *
 * `push_tokens` is keyed by token, not by user: a person with a phone and an
 * iPad has two, and both should ring. A device that reinstalls and is issued
 * the same token updates its row rather than growing a second one, which is why
 * the conflict target is `token` and not `user_id`.
 *
 * Called from exactly one place — `askPushPermission`, immediately after a
 * grant. Never on launch: registering a token is not a thing to do to somebody
 * who has not asked for a notification, and on the binary in the field there is
 * no module to ask for one from. (`touchPushToken`, below, is not a
 * registration: it UPDATES a row that a grant already wrote, and writes nothing
 * for anyone else.)
 */

/**
 * EAS needs the project id to mint an Expo push token in a bare/dev-client
 * build; `app.config.ts` carries it under `extra.eas.projectId`.
 */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Registers this install's token, or does nothing at all.
 *
 * Returns the token when one was written, `null` otherwise — no module, no
 * session, or a mint that failed. A failure here is deliberately quiet: the
 * user has just granted permission and moved a switch, and the honest state of
 * their preference is what they set. A red alert about a token would be the app
 * reporting its own plumbing.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!PUSH_AVAILABLE || !push) return null;

  const userId = await getUserId();
  if (!userId) return null;

  let token: string;
  try {
    const result = await push.getExpoPushTokenAsync({ projectId: projectId() });
    token = result.data;
  } catch {
    // No APNs entitlement yet, no network, a simulator with no push support —
    // all the same outcome: this device cannot be reached, and saying so in the
    // database would be worse than saying nothing. Said in analytics instead
    // (A14): a grant followed by `ok: false, reason: 'mint'` is the one
    // signature that means the entitlement or the Expo project id is wrong.
    track('push_token_registered', pushTokenRegisteredProps({ ok: false, reason: 'mint' }));
    return null;
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: 'ios', last_seen_at: new Date().toISOString() },
      { onConflict: 'token' },
    );

  if (error) {
    track('push_token_registered', pushTokenRegisteredProps({ ok: false, reason: 'write' }));
    return null;
  }
  track('push_token_registered', pushTokenRegisteredProps({ ok: true }));
  return token;
}

/**
 * A granted device says it is still here (A87b, 2026-09-17).
 *
 * `push_tokens.last_seen_at` used to be written once, at the grant, so it was
 * a fact about the day someone said yes and nothing about whether the phone was
 * still opening the app. The first three morning notes ever went to three
 * devices last seen 5–11 days earlier, and none answered. The floor note's
 * claim now asks for a device seen inside 72 hours; this is what makes that
 * timestamp mean "opened recently".
 *
 * UPDATE, never upsert: a permission granted in iOS Settings without the card
 * ever being answered has no row, and must not gain one here — registering is
 * the card's job (the docblock above). A row that is not there is a no-op.
 * Quiet on every failure, and no analytics: `push_token_registered` means a
 * grant, and a heartbeat must not inflate it.
 */
export async function touchPushToken(): Promise<void> {
  if (!PUSH_AVAILABLE || !push) return;
  try {
    const { status } = await push.getPermissionsAsync();
    if (status !== 'granted') return;
    const userId = await getUserId();
    if (!userId) return;
    const { data: token } = await push.getExpoPushTokenAsync({ projectId: projectId() });
    await supabase
      .from('push_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('token', token)
      .eq('user_id', userId);
  } catch {
    // A heartbeat that could not be sent is the previous timestamp standing —
    // the claim reads that as "not warm", which is the safe direction.
  }
}
