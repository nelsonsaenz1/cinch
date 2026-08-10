import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { ArrivalPage, type ArrivalPageState } from '@/components/invite/arrival-page';
import { bareHandle } from '@/features/invite/link';
import { useApplyInvite } from '@/features/invite/mutations';

/**
 * After install — the pending friendship (atlas 39, IV-06).
 *
 * Reached with the inviter's handle: `cinch://invite-arrival?handle=sophie`,
 * or from whatever the universal-link handler resolves
 * `https://cinchstyle.com/i/@sophie` to. `handleFromUrl()` in
 * `features/invite/link.ts` is the parser; wiring it to the deep-link listener
 * belongs to `_layout.tsx`, which this unit does not own.
 *
 * THE FRIENDSHIP IS MADE HERE, NOT REQUESTED. `apply_invite()` writes both
 * `follows` rows, so by the time the ready state paints the two people are
 * already friends — the tap on the link was the consent, and the screen
 * reports it. It is idempotent, so arriving twice is a no-op rather than a
 * second friendship or an error.
 *
 * The render tree lives in `ArrivalPage`; `dev-invite-link` mounts it over
 * fixtures.
 */

export default function InviteArrivalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handle?: string }>();
  const handle = params.handle ? bareHandle(params.handle) : '';

  const apply = useApplyInvite();

  // Fired once per handle. `mutate` is stable but the effect is not: without
  // the guard, any re-render that changes params identity would re-run a write
  // — harmless, because the RPC is idempotent, but a write fired on every
  // render is a habit that stops being harmless the moment something else
  // reuses this shape.
  const applied = useRef<string | null>(null);
  const { mutate } = apply;
  useEffect(() => {
    if (!handle || applied.current === handle) return;
    applied.current = handle;
    mutate(handle);
  }, [handle, mutate]);

  const retry = useCallback(() => {
    if (!handle) return;
    mutate(handle);
  }, [handle, mutate]);

  /**
   * Where this screen lets go.
   *
   * `replace`, not `push`: IV-06 is shown once, after sign-in and before the
   * tour, and it should not sit on the back stack afterwards — the same
   * reasoning the first-run tour uses when it hands off to the camera.
   */
  const toCloset = useCallback(() => router.replace('/(tabs)'), [router]);
  const toCapture = useCallback(() => router.replace('/capture'), [router]);

  const state: ArrivalPageState = !handle
    ? 'unavailable'
    : apply.isPending || apply.isIdle
      ? 'applying'
      : apply.isError
        ? 'error'
        : apply.data
          ? 'ready'
          : 'unavailable';

  // Falls back to the handle rather than to a placeholder person: "@sophie is
  // waiting for you" is true and specific, where "Your friend is waiting" is
  // neither. A display name is optional on `profiles` and plenty of accounts
  // have none.
  const inviterName = apply.data?.displayName ?? (handle ? `@${handle}` : '');

  return (
    <ArrivalPage
      state={state}
      inviterName={inviterName}
      onAddFirstPiece={toCapture}
      onSeeCloset={() => {
        const userId = apply.data?.inviterId;
        if (!userId) {
          toCloset();
          return;
        }
        // The tabs go underneath first, so the back chevron on their closet
        // has somewhere to return to. Both navigations are applied in order
        // within the same commit.
        router.replace('/(tabs)');
        router.push({ pathname: '/friends/[userId]', params: { userId } });
      }}
      onRetry={retry}
      onContinue={toCloset}
    />
  );
}
