import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, useWindowDimensions, View } from 'react-native';

import { InvitePage } from '@/components/invite/invite-page';
import { arrivalName } from '@/features/invite/arrivals';
import { CLIPBOARD_AVAILABLE, copyText } from '@/features/invite/clipboard';
import { inviteUrlForDisplay, shareMessage } from '@/features/invite/link';
import {
  COPIED_HOLD_MS,
  INVITE_STACK_SCALE,
  isFreshArrival,
} from '@/features/invite/invite-lines';
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
// Exactly four seconds, from the copy module so the test asserts the shipped
// number rather than a second copy of it.

export default function InviteScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();

  const { link, loading, error, refetch } = useInviteLink();
  const arrivals = useInviteArrivals();

  const [copied, setCopied] = useState(false);
  /** The sheet could not be presented — distinct from being dismissed. */
  const [shareFailed, setShareFailed] = useState(false);
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
      // The accepted row's second line is the handle, not a join date: the
      // date was the only thing on the row that could go stale, and a handle
      // is what somebody would actually recognise. `arrivalSubtitle` stays
      // exported — the arrival page still speaks in dates.
      handle: arrival.username ? `@${arrival.username}` : null,
      // A missing or unparseable timestamp is not fresh; the row already
      // declines to claim a date, and a mark is a claim about a date.
      isNew: isFreshArrival(arrival.joinedAt, now),
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
    setShareFailed(false);
    void Share.share(
      { message: shareMessage(), url: link.url },
      // Undefined rather than an empty string when there is no display name to
      // build it from: an email with a blank subject is better than one headed
      // " added you on Cinch".
      { subject: link.title ?? undefined },
    )
      // A DISMISSAL IS NOT A FAILURE AND IS NOT A SUCCESS.
      //
      // `dismissedAction` resolves — it lands here, in the fulfilled branch,
      // and does nothing at all: no toast, no "sent", no arrival row, nothing
      // beyond the enum React Native already returned. The page is left
      // exactly as it was, which is the only honest report of a share that did
      // not happen.
      .then(() => {})
      // Only a REJECTION means the sheet could not be presented, and that is
      // the one share outcome worth telling somebody about — because in that
      // case they may believe something went out. Nothing did.
      .catch(() => setShareFailed(true));
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
        // The card prints the address without its scheme and the handle in
        // serif above it; the two come from the same `link`, derived once here
        // rather than string-edited in the render tree.
        linkDisplay={link.handle ? inviteUrlForDisplay(link.handle) : null}
        handle={link.handle ? `@${link.handle}` : null}
        linkLoading={loading}
        linkError={error}
        onRetryLink={refetch}
        // The handle lives on the profile sheet, which the integrator owns.
        onChooseHandle={() => router.push('/profile')}
        onShare={share}
        shareFailed={shareFailed}
        onRetryShare={share}
        // Absent, not inert, on a binary without the clipboard module — the
        // same rule Profile uses for the Notifications row. Share alone is a
        // complete way to send a link, not a degraded one.
        onCopy={CLIPBOARD_AVAILABLE ? copy : undefined}
        copied={copied}
        arrivals={rows}
        arrivalsLoading={arrivals.isPending}
        arrivalsError={arrivals.isError}
        // Offline withholds the roster and keeps the link: the link is
        // permanent so a cached one is still true, while who came in can have
        // changed since.
        arrivalsWithheld={arrivals.isError && !arrivals.isRefetching && arrivals.isPaused}
        onRetryArrivals={() => void arrivals.refetch()}
        large={fontScale >= INVITE_STACK_SCALE}
        onOpenArrival={(userId) =>
          router.push({ pathname: '/friends/[userId]', params: { userId } })
        }
        onBack={() => router.back()}
      />

      {/* NO TOAST. The accepted frames confirm on the control and nowhere else:
          the button's own box swaps its word and its fill for four seconds and
          nothing else on the page moves. A toast over the top would be a second
          confirmation of one act, and it was the only thing on this page that
          could cover a row. */}
    </View>
  );
}
