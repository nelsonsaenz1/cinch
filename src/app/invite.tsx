import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';

import { InvitePage } from '@/components/invite/invite-page';
import { Toast } from '@/components/ui/toast';
import { arrivalName, arrivalSubtitle } from '@/features/invite/arrivals';
import { CLIPBOARD_AVAILABLE, copyText } from '@/features/invite/clipboard';
import { useInviteArrivals, useInviteLink } from '@/features/invite/queries';

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
   * `url` rather than `message`, so iOS raises the link-preview card the atlas
   * draws instead of a bare string, and `title` carries the sentence the
   * recipient reads on the landing page. The atlas is explicit that the two
   * must match: the invite should read the same in Messages as it does in the
   * browser, which is what `shareTitle()` in `link.ts` exists to guarantee.
   *
   * A dismissed sheet is not an error, and neither is a share that never
   * completes — nothing was promised, so nothing is reported.
   */
  const share = useCallback(() => {
    if (!link.url || !link.title) return;
    void Share.share({ url: link.url, title: link.title }).catch(() => {});
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
