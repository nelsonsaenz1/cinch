import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { handleFromUrl, inviteUrl } from '@/features/invite/link';
import { DEFERRED_LINKS_AVAILABLE, deferredLinks } from '@/features/invite/native';
import { rememberInvite } from '@/features/invite/pending-invite';
import { track } from '@/lib/posthog';

/**
 * Turn an incoming invite link into a destination (atlas 39, IV-06).
 *
 * Lives in the root layout beside `useDeepLinkAuth`, and for the same reason:
 * a link can reach the app two ways, and missing either one produces a link
 * that "does nothing".
 *
 *  - The app was already running and iOS delivers the URL to a listener.
 *  - The app was cold-started BY the link, in which case no event ever fires
 *    and the URL is only available from `getInitialURL()`.
 *
 * Every incoming URL is offered here, which is safe because `handleFromUrl`
 * returns null for anything that is not an invite — including the magic-link
 * callback that `useDeepLinkAuth` is watching for on the same stream.
 *
 * ── WHY THE SIGNED-IN CASE BRANCHES ────────────────────────────────────────
 *
 * `apply_invite` needs somebody to be friends on behalf of, so nothing can
 * happen until there is a session. The two cases are genuinely different
 * journeys rather than one journey with a wait in it:
 *
 *  - Already signed in: this is the atlas's "signed in already" row — deep
 *    link straight through, no landing page, no second tap. Pushed rather than
 *    replaced, because the user was in the middle of something and should get
 *    back to it.
 *  - Not signed in: the handle is parked and the handoff spends it after the
 *    session is written, which is where the atlas puts IV-06 — "after sign-in,
 *    before the tour".
 *
 * ── THE COLD-INSTALL PATH ──────────────────────────────────────────────────
 *
 * `deferredLinks` is the attribution SDK, and it answers the one question iOS
 * cannot: what link led to this install. It is behind a guarded require and is
 * normally absent, in which case this does nothing and the landing page's own
 * instruction carries the journey — install, then tap the link again. See
 * `native.ts` for why the package may never ship.
 */
/**
 * Handles already counted as `invite_opened` this launch.
 *
 * Module scope, not a ref, because the effect below RE-RUNS when `signedIn`
 * flips — and `getInitialURL()` keeps returning the launch URL forever. Without
 * this, the most important path in the whole referral loop double-counts by
 * construction: a link opened cold while signed out is offered once as
 * `signed_in: false`, and again as `signed_in: true` the moment the session is
 * written, which is precisely the journey K is supposed to be measuring.
 *
 * The cost is that re-tapping the same person's link later in the same launch
 * is not counted twice. That is the right way round: one systematic doubling
 * on the commonest path would be worse than missing a rare genuine repeat.
 */
const countedOpens = new Set<string>();

export function useInviteDeepLink(signedIn: boolean): void {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const offer = (url: string | null) => {
      if (!url || cancelled) return;
      const handle = handleFromUrl(url);
      if (!handle) return;

      // K's denominator, emitted ONCE, above the branch.
      //
      // Every URL the app receives is offered to this function and `handle` is
      // null for all of them except invites, so this is exactly "an invite
      // link was opened" and never a magic-link callback. `signed_in` is a
      // property rather than the two events the branch below would suggest,
      // because K is links-tapped over invites-sent and it must stay one
      // number: split the event and every query has to remember to add the
      // halves back together, and the first one that forgets under-reports K
      // on the go/no-go date.
      //
      // The handle itself is never sent — it is only the dedupe key. It is
      // another person's public username, which is theirs and not a bounded
      // value.
      if (!countedOpens.has(handle)) {
        countedOpens.add(handle);
        track('invite_opened', { signed_in: signedIn });
      }

      if (signedIn) {
        router.push({ pathname: '/invite-arrival', params: { handle } });
      } else {
        rememberInvite(handle);
      }
    };

    void Linking.getInitialURL().then(offer).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => offer(url));

    // Asked once per mount, and only when the module is actually present.
    // A failure here is not an error worth surfacing: the overwhelmingly
    // common answer is "this install came from nowhere in particular", which
    // is indistinguishable from the SDK being unable to say.
    if (DEFERRED_LINKS_AVAILABLE && deferredLinks) {
      void deferredLinks
        .pendingInviteHandle()
        .then((handle) => {
          if (handle) offer(inviteUrl(handle));
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [signedIn, router]);
}
