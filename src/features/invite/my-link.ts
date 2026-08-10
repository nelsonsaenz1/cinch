import { queryClient } from '@/lib/query-client';
import { getUserId, supabase } from '@/lib/supabase';

import { bareHandle, inviteUrl } from './link';

/**
 * The signed-in user's own invite URL, read from outside React.
 *
 * WHY THIS IS NOT `useInviteLink`
 *
 * `sharePlate` composes a share message from a `captureRef` callback, which is
 * not a render. It cannot call a hook, and the two screens that share a card
 * (`components/today/plate.tsx`, `features/plan/packing-trip.tsx`) belong to
 * other units, so the link cannot be threaded down as a prop either. This is
 * the same fact `useInviteLink` reads, in the one shape a non-React caller can
 * use it.
 *
 * NULL IS A REAL ANSWER. `profiles.username` is nullable and nothing forces a
 * handle at sign-up, so a user genuinely may have no link. The share still goes
 * out — one sentence shorter — rather than carrying
 * `cinchstyle.com/i/@undefined`. Same rule as `useInviteLink`.
 */

/**
 * How long a share is allowed to wait on the network for a handle.
 *
 * The share sheet is a response to a tap and has to feel like one. A second and
 * a bit is long enough for a warm request on a bad connection and short enough
 * that nobody reads it as a hang; past it the message ships without its link,
 * which is a smaller failure than a sheet that does not appear.
 */
const DEADLINE_MS = 1200;

export async function myInviteUrl(): Promise<string | null> {
  // The free path, and the usual one. `useMyProfile` caches under this exact
  // key (`features/profile/queries.ts`) and the profile form invalidates it on
  // save (`features/profile/mutations.ts`), so a handle read from here is both
  // present and current on any screen the user reached through the app.
  const cached = queryClient.getQueryData<{ username?: string | null } | null>(['my-profile']);
  const cachedHandle = cached?.username ? bareHandle(cached.username) : null;
  if (cachedHandle) return inviteUrl(cachedHandle);

  // Cold start straight into Today, with the profile never fetched. One narrow
  // select rather than `fetchQuery`, because this must not populate — or worse,
  // half-populate — the key the form owns.
  return await Promise.race([
    fetchInviteUrl(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE_MS)),
  ]);
}

/** Never throws, never rejects: a missing link is not a failed share. */
async function fetchInviteUrl(): Promise<string | null> {
  try {
    const userId = await getUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.username) return null;
    return inviteUrl(bareHandle(data.username));
  } catch {
    return null;
  }
}
