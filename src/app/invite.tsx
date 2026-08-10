import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';

import { InvitePage } from '@/components/invite/invite-page';
import { Toast } from '@/components/ui/toast';
import { arrivalName, arrivalSubtitle } from '@/features/invite/arrivals';
import { CLIPBOARD_AVAILABLE, copyText } from '@/features/invite/clipboard';
import { shareMessage } from '@/features/invite/link';
import { useInviteArrivals, useInviteLink } from '@/features/invite/queries';
import { track } from '@/lib/posthog';

/**
 * Invite a friend — IV-01, IV-02 and IV-03 (atlas 39).
 *
 * The state machine and the two native calls; the render tree lives in
 * `InvitePage`, which `dev-invite-link` mounts over fixtures.
 *
 * ONE LINK PER PERSON, FOREVER. Nothing on this screen creates anything: the
 * link is `https://cinchstyle.com/i/@handle` and the handle is already on the
 * profile row, so opening this page is a read and sharing it is a string. There
 * is no code to mint, nothing to revoke and no expiry — which is why "Share"
 * and "Copy" are the only two controls and neither can fail server-side.
 */

/**
 * How long the Copy button holds "Copied", and how long the toast repeats it.
 *
 * Four seconds is the atlas's number. One timer drives both because they are
 * one event: the button confirming and the toast saying so should arrive and
 * leave together, not stagger.
 */
const COPIED_HOLD_MS = 4000;

export default function InviteScreen() {
  const router = useRouter();

  const { link, loading, error, refetch } = useInviteLink();
  const arrivals = useInviteArrivals();

  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleared on unmount: the hold is chrome, and a timer that outlives its
  // screen would call setState on a torn-down tree.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const rows = useMemo(() => {
    const now = new Date();
    return (arrivals.data ?? []).map((arrival) => ({
      userId: arrival.userId,
      name: arrivalName(arrival),
      subtitle: arrivalSubtitle(arrival, now),
    }));
  }, [arrivals.data]);

  /**
   * IV-02 — the OS share sheet.
   *
   * `url` AND `message`, where this used to send `url` and `title`.
   *
   * The `url` is unchanged and stays in its own slot, because an `NSURL` on its
   * own is what makes Messages raise the link-preview card the atlas draws —
   * and that card's headline is `shareTitle()`, served as `og:title` from
   * `web/api/invite.js`. So the atlas's "the invite reads the same in Messages
   * as in the browser" rule is satisfied by the page, as it always was.
   *
   * `title` was the bug. React Native's iOS branch never forwards it: the
   * payload it builds is `message` / `url` / `subject`, and `content.title` is
   * read only on Android (`Libraries/Share/Share.js`). Every invite this screen
   * has sent went out as a bare link with no framing at all. `shareMessage()`
   * is that framing, and `link.title` moves to `subject`, which iOS does use —
   * it becomes the subject line when the invite goes by Mail.
   *
   * A dismissed sheet is not an error, and neither is a share that never
   * completes — nothing was promised, so nothing is reported. The promise is
   * caught rather than awaited for a second reason: RN's iOS completion handler
   * never fires when an activity is chosen and then cancelled
   * (`RCTActionSheetManager.mm:291-296`), so this promise can legitimately hang
   * forever. Nothing here depends on it settling.
   */
  const share = useCallback(() => {
    if (!link.url) return;
    // After the guard, so a tap that could not produce a share is not counted
    // as one. `has_link` is therefore always true here and is sent anyway: it
    // keeps this event's shape identical to `outfit_shared`'s and
    // `board_shared`'s, so "shares that carried a link" is one query across
    // all three rather than three queries with an exception in the middle.
    track('invite_shared', { has_link: true, surface: 'invite_screen' });
    void Share.share(
      { message: shareMessage(), url: link.url },
      // Undefined rather than an empty string when there is no display name to
      // build it from: an email with a blank subject is better than one headed
      // " added you on Cinch".
      { subject: link.title ?? undefined },
    ).catch(() => {});
  }, [link.url, link.title]);

  /**
   * IV-03 — copy, and say so twice.
   *
   * NOTHING NAVIGATES. Copying is a small act and should feel like one: the
   * button holds its confirmation, a toast repeats it once, and the page is
   * exactly where it was.
   */
  const copy = useCallback(() => {
    if (!link.url) return;
    // `copyText` never throws and never lies: false means the pasteboard was
    // not written, so the button keeps saying "Copy link". Claiming a copy
    // that did not happen is how somebody pastes nothing into a message and
    // blames themselves.
    void copyText(link.url).then((ok) => {
      if (!ok) return;
      // Inside the `ok` branch, beside the confirmation the user sees and not
      // beside the tap. `copyText` returns false when the pasteboard was not
      // written, and the button deliberately keeps saying "Copy link" in that
      // case — an event that fired anyway would claim a link is in circulation
      // that nobody can paste, which is a referral numerator with nothing on
      // the other end of it.
      track('invite_copied');
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_HOLD_MS);
    });
  }, [link.url]);

  return (
    <View className="flex-1 bg-canvas">
      <InvitePage
        link={link.url}
        linkLoading={loading}
        linkError={error}
        onRetryLink={refetch}
        // The handle lives on the profile sheet, which the integrator owns.
        onChooseHandle={() => router.push('/profile')}
        onShare={share}
        // Absent, not inert, on a binary without the clipboard module — the
        // same rule Profile uses for the Notifications row. Share alone is a
        // complete way to send a link, not a degraded one.
        onCopy={CLIPBOARD_AVAILABLE ? copy : undefined}
        copied={copied}
        arrivals={rows}
        arrivalsLoading={arrivals.isPending}
        arrivalsError={arrivals.isError}
        onRetryArrivals={() => void arrivals.refetch()}
        onOpenArrival={(userId) =>
          router.push({ pathname: '/friends/[userId]', params: { userId } })
        }
        onBack={() => router.back()}
      />

      {/* No trailing verb, as the atlas draws it. `Toast` used to require the
          pair — it was invented for BR-06, where the whole object exists to
          offer an undo — and this toast has nothing to offer: it repeats a
          confirmation the button already gave, and a copy to the clipboard is
          not reversible. The verb is optional now rather than filled with a
          "Done" that only dismissed itself. */}
      <Toast message="Link copied to your clipboard" visible={copied} />
    </View>
  );
}
