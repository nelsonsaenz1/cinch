import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pushPermissionResultProps } from '@/features/push/ask-spec';
import { PUSH_AVAILABLE, push } from '@/features/push/native';
import { registerPushToken } from '@/features/push/token';
import { track } from '@/lib/posthog';

/**
 * The system permission — read, and asked for **in context**.
 *
 * Atlas 37's rule, in as many words: "the system permission is requested the
 * first time a channel is switched on, not at launch and not during the tour."
 * So nothing in this file runs on mount of anything except the Notifications
 * screen, and `askPushPermission` is called from exactly one place: a switch
 * being moved to on.
 *
 * Everything keys off `PUSH_AVAILABLE`. On the binary in the field today the
 * native module is absent, so the answer is `unsupported`, no permission is
 * ever requested, and no token is ever registered — see native.ts for why the
 * package may not be imported anywhere but there.
 */

/**
 * `unsupported` is a fact about the binary, not about the user: this build has
 * no notification module at all. The other three are iOS's own answers.
 */
export type PushPermission = 'unsupported' | 'undetermined' | 'granted' | 'denied';

/**
 * iOS's `status` string, narrowed. Anything unrecognised is treated as
 * `undetermined` — the state in which we may still ask — rather than as denied,
 * which would silently strand a user behind a banner about their own Settings.
 */
function toPermission(status: string): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/** Reads without asking. Safe to call on mount; asks nothing of the user. */
export async function readPushPermission(): Promise<PushPermission> {
  if (!PUSH_AVAILABLE || !push) return 'unsupported';
  const { status } = await push.getPermissionsAsync();
  return toPermission(status);
}

/**
 * The ask, and the only place in the app that raises the system prompt.
 *
 * Three branches, and each one matters:
 *
 *  * **Already granted** — no prompt (iOS would not show one anyway), but the
 *    token is registered, because a granted permission with no row in
 *    `push_tokens` is a device nothing can reach.
 *  * **Undetermined** — the prompt. Granting registers the token.
 *  * **Denied, or denied with `canAskAgain: false`** — no prompt, because iOS
 *    will not show one a second time and calling it anyway resolves instantly
 *    with the same denial, which would read as a tap that did nothing. NP-03's
 *    banner is the route out, and it goes to Settings.
 *
 * Never throws for the ordinary refusal: a person declining a prompt is not an
 * error, and the switch stays where they put it.
 */
export async function askPushPermission(): Promise<PushPermission> {
  if (!PUSH_AVAILABLE || !push) return 'unsupported';

  const current = await push.getPermissionsAsync();
  if (current.status === 'granted') {
    track('push_permission_result', pushPermissionResultProps('granted', false));
    await registerPushToken();
    return 'granted';
  }
  if (!current.canAskAgain) {
    track('push_permission_result', pushPermissionResultProps('denied', false));
    return 'denied';
  }

  const asked = await push.requestPermissionsAsync();
  const result = toPermission(asked.status);
  // `undetermined` after a prompt is a dismissal without an answer — iOS
  // reports it as a denial the next time it is read, so it is one here too.
  // A14: whichever surface asked, the system's answer is one number.
  track(
    'push_permission_result',
    pushPermissionResultProps(result === 'granted' ? 'granted' : 'denied', true),
  );
  if (result === 'granted') await registerPushToken();
  return result;
}

export const pushPermissionKey = ['push-permission'] as const;

export function usePushPermission() {
  return useQuery({
    queryKey: pushPermissionKey,
    queryFn: readPushPermission,
    // The answer changes in iOS Settings, outside this app entirely, so it is
    // never fresh for long. Cheap to re-read; nothing is asked of the user.
    staleTime: 0,
  });
}

/**
 * The mutation the switch calls. Separate from the read so a component can
 * show the read's answer while an ask is in flight, and so the ask is
 * impossible to trigger by rendering.
 */
export function useAskPushPermission() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: askPushPermission,
    onSuccess: (result) => {
      qc.setQueryData(pushPermissionKey, result);
    },
  });
}
