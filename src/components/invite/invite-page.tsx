import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ArrivalRow, type ArrivalRowModel } from '@/components/invite/arrival-row';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  ARRIVALS_FAILED_BODY,
  ARRIVALS_FAILED_TITLE,
  ARRIVALS_HEADING,
  COPIED_ACTION,
  COPY_ACTION,
  EARLIER_HEADING,
  EMPTY_BODY,
  EMPTY_TITLE,
  INVITATION_EYEBROW,
  INVITE_TITLE,
  LINK_FAILED_BODY,
  LINK_FAILED_TITLE,
  LINK_NOTE,
  NO_HANDLE_ACTION,
  NO_HANDLE_BODY,
  NO_HANDLE_TITLE,
  OFFLINE_BODY,
  OFFLINE_TITLE,
  SEEDED_SHARE_ACTION,
  SHARE_ACTION,
  SHARE_FAILED_BODY,
  SHARE_FAILED_TITLE,
  SHARE_RETRY_ACTION,
  BACK_SIZE,
  GUTTER_X,
  PLATE_HEIGHT,
  PLATE_HEIGHT_AX,
  PLATE_RADIUS,
  PRIMARY_HEIGHT,
  PRIMARY_HEIGHT_AX,
  SECONDARY_HEIGHT,
  SECONDARY_HEIGHT_AX,
  TRY_AGAIN,
  seededNote,
} from '@/features/invite/invite-lines';
import { MIN_TAP_TARGET, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Invite / Share — the card you hand someone. Redesign 10.
 *
 * Render-only, on the `FriendsPage` precedent: every query, every timer and the
 * two native calls live in the route (`src/app/invite.tsx`), so the accepted
 * frames can be posed without a session.
 *
 * ── THE ONE IDEA ────────────────────────────────────────────────────────────
 *
 * The link is not a field, a code or a control — it is a thing you already own,
 * so the page sets it as a card with your handle on it and offers two ways to
 * hand it over. There is nothing to mint, nothing to revoke, no expiry and no
 * per-invite token, which is why the card can state a fact instead of managing
 * a resource.
 *
 * ── TWO READS THAT NEVER WAIT ON EACH OTHER ─────────────────────────────────
 *
 * The link and `invite_arrivals()` are independent queries and the frames pair
 * every failure of one with a healthy other. A failed link leaves the roster
 * opening profiles; a failed roster leaves both actions fully live. Offline is
 * the asymmetric case and the reason the split matters: the link is permanent
 * so a cached one is still true and still shareable, while the roster can have
 * changed and is withheld rather than shown stale.
 *
 * ── WHAT AN ARRIVAL PROVES ──────────────────────────────────────────────────
 *
 * Exactly one thing: that person joined Cinch through this link.
 * `invite_arrivals()` reads `profiles.invited_by`, which is written once and
 * never cleared — while the friendship `apply_invite` created CAN be undone by
 * a removal or a block. So a row is not evidence of a current friendship, of
 * mutual authorization, or of any closet being visible, and nothing on this
 * page may say it is. The row's tap opens their profile, where the server
 * decides what a visitor may see; the page itself claims nothing.
 */

export type InvitePageProps = {
  /** `https://cinchstyle.com/i/@handle`, or null when no handle is claimed. */
  link: string | null;
  /** The same address without its scheme — what the card prints. */
  linkDisplay: string | null;
  /** `@handle`, set in serif as the card's hero. */
  handle: string | null;
  linkLoading: boolean;
  linkError: boolean;
  onRetryLink: () => void;
  /** The no-handle branch — sends to the profile sheet to claim one. */
  onChooseHandle: () => void;
  /** This visit seeded the handle (A54): the note says so, the action names the closet. */
  seeded: boolean;

  onShare: () => void;
  /**
   * The sheet could not be presented.
   *
   * Distinct from a dismissal, which is not a failure and says nothing: this
   * is the one share outcome the page reports, and it reports it by saying
   * NOTHING WAS SENT first.
   */
  shareFailed: boolean;
  onRetryShare: () => void;

  /** Absent, never disabled, on a binary without the clipboard module. */
  onCopy?: () => void;
  /** Held for exactly four seconds, in a box the same height as the resting one. */
  copied: boolean;

  arrivals: ArrivalRowModel[];
  arrivalsLoading: boolean;
  arrivalsError: boolean;
  /** Offline — the roster is withheld rather than served stale. */
  arrivalsWithheld: boolean;
  onRetryArrivals: () => void;
  onOpenArrival: (userId: string) => void;

  onBack?: () => void;
  /** Dynamic Type past the threshold: the page recomposes rather than shrinks. */
  large: boolean;
};

export function InvitePage(props: InvitePageProps) {
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: GUTTER_X, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        {/* The way back, as a disc rather than a bar. At the accessibility
            sizes the frame drops it — the page is one column of very large
            type by then and a floating control above it is a row of nothing.
            The system's own back gesture is unaffected either way. */}
        {props.onBack && !props.large ? (
          <View style={{ paddingTop: 8, paddingBottom: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={props.onBack}
              className="items-center justify-center bg-tray active:opacity-60"
              style={{ width: BACK_SIZE, height: BACK_SIZE, borderRadius: 14 }}>
              <SymbolView
                name="chevron.left"
                size={17}
                tintColor={theme.ink}
                resizeMode="scaleAspectFit"
              />
            </Pressable>
          </View>
        ) : null}

        {props.linkError ? (
          <View style={{ paddingTop: 12 }}>
            <ErrorState
              title={LINK_FAILED_TITLE}
              body={LINK_FAILED_BODY}
              onRetry={props.onRetryLink}
              retryTitle={TRY_AGAIN}
            />
          </View>
        ) : props.link === null && !props.linkLoading ? (
          <NoHandle onChooseHandle={props.onChooseHandle} large={props.large} />
        ) : (
          <>
            <LinkPlate
              handle={props.handle}
              linkDisplay={props.linkDisplay}
              loading={props.linkLoading}
              large={props.large}
            />
            <Actions {...props} />
          </>
        )}

        <Arrivals {...props} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// The plate — the thing being handed over, made visible
// ---------------------------------------------------------------------------

function LinkPlate({
  handle,
  linkDisplay,
  loading,
  large,
}: {
  handle: string | null;
  linkDisplay: string | null;
  loading: boolean;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        loading || !handle ? INVITE_TITLE : `${INVITATION_EYEBROW}, ${handle}, ${linkDisplay ?? ''}`
      }
      className="items-center justify-center bg-blush"
      style={{
        marginTop: 8,
        minHeight: large ? PLATE_HEIGHT_AX : PLATE_HEIGHT,
        borderRadius: PLATE_RADIUS,
        borderWidth: 1,
        borderColor: theme.blushRule,
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 8,
      }}>
      {/* Dropped at the accessibility sizes: the frame spends that height on
          the handle, which is the thing being shared. */}
      {/* The frame paints this eyebrow in clay. Clay is 2.98:1 and
          `theme/contrast.ts` declares it `text: false`, so it cannot carry
          type — the eyebrow takes `muted`, which is one step darker, the same
          quiet layer, and the substitution the rest of this wave already
          makes. */}
      {large ? null : <Text variant="eyebrow">{INVITATION_EYEBROW}</Text>}

      {loading ? (
        <>
          <Skeleton style={{ height: 44, width: '60%', borderRadius: 12 }} />
          <Skeleton style={{ height: 14, width: '75%', borderRadius: 7 }} />
        </>
      ) : (
        <>
          {/* The handle IS the invitation, so it is the largest thing on the
              page. It wraps rather than truncating: a clipped handle is the one
              string on this screen that would be wrong rather than merely
              short. */}
          <Text variant="display" trim style={{ textAlign: 'center' }}>
            {handle}
          </Text>
          {/* Printed without its scheme: `https://` turns an address a person
              owns into a URL a machine parses. Everything that SENDS the link
              uses the full one. */}
          <Text variant="note" style={{ textAlign: 'center' }}>
            {linkDisplay}
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The two ways to hand it over
// ---------------------------------------------------------------------------

function Actions(props: InvitePageProps) {
  const { large } = props;

  // The sheet failed to present. Copy is promoted to the filled action, the URL
  // stays legible on the card above, and the first thing said is that nothing
  // went out.
  if (props.shareFailed) {
    return (
      <View style={{ marginTop: 16, gap: 10 }}>
        <View
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: warningAlpha(0.22),
            borderRadius: PLATE_RADIUS,
            padding: 16,
            gap: 8,
          }}>
          <Text variant="body" accessibilityRole="header">
            {SHARE_FAILED_TITLE}
          </Text>
          <Text variant="note">{SHARE_FAILED_BODY}</Text>
        </View>
        {props.onCopy ? (
          <Button
            title={props.copied ? COPIED_ACTION : COPY_ACTION}
            variant="primary"
            onPress={props.onCopy}
            className="w-full"
          />
        ) : null}
        <Button
          title={SHARE_RETRY_ACTION}
          variant="secondary"
          onPress={props.onRetryShare}
          className="w-full"
        />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <View style={{ minHeight: large ? PRIMARY_HEIGHT_AX : PRIMARY_HEIGHT }}>
        <Button
          title={props.seeded ? SEEDED_SHARE_ACTION : SHARE_ACTION}
          variant="primary"
          onPress={props.onShare}
          disabled={!props.link}
          className="w-full"
        />
      </View>

      {/* Absent, never disabled, on a binary whose clipboard module is missing.
          Share alone is a complete way to send a link, not a degraded one.

          THE BOX DOES NOT MOVE. Resting and confirming are the same control at
          the same height in the same place: only the word and the fill change,
          so a confirmation that lasts four seconds cannot shift anything above
          or below it. */}
      {props.onCopy ? (
        <View style={{ minHeight: large ? SECONDARY_HEIGHT_AX : SECONDARY_HEIGHT }}>
          <Button
            title={props.copied ? COPIED_ACTION : COPY_ACTION}
            variant="secondary"
            onPress={props.onCopy}
            disabled={!props.link}
            className="w-full"
            accessibilityLabel={props.copied ? COPIED_ACTION : COPY_ACTION}
          />
        </View>
      ) : null}

      <Text variant="note" style={{ marginTop: 2 }}>
        {props.seeded && props.handle ? seededNote(props.handle) : LINK_NOTE}
      </Text>
    </View>
  );
}

/**
 * No handle, so no link. The action goes where one is claimed.
 *
 * AUDIT 100 #32. This used to open with a 214pt tray plate (150pt at AX) —
 * the exact footprint of the LINK plate it stands in for — holding one
 * giant "@" in the display face, then explained the missing handle twice
 * more below it (see `NO_HANDLE_BODY`'s note). That is most of the screen's
 * first fold spent on a placeholder for a state that has nothing to show.
 * The glyph shrinks to the size every other icon-led empty state in the app
 * uses; what is freed goes to reaching the one actual task — choosing a
 * handle — sooner rather than after a hero.
 */
function NoHandle({ onChooseHandle, large }: { onChooseHandle: () => void; large: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ marginTop: 20, gap: 12 }}>
      <SymbolView name="at" size={28} tintColor={theme.muted} resizeMode="scaleAspectFit" />
      <Text variant="title" trim accessibilityRole="header">
        {NO_HANDLE_TITLE}
      </Text>
      <Text variant="note">{NO_HANDLE_BODY}</Text>
      <View style={{ minHeight: large ? PRIMARY_HEIGHT_AX : PRIMARY_HEIGHT, marginTop: 4 }}>
        <Button
          title={NO_HANDLE_ACTION}
          variant="primary"
          onPress={onChooseHandle}
          className="w-full"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Who came in — and the four things this list refuses to be
// ---------------------------------------------------------------------------

function Arrivals(props: InvitePageProps) {
  const fresh = props.arrivals.filter((a) => a.isNew);
  const earlier = props.arrivals.filter((a) => !a.isNew);

  return (
    <View style={{ marginTop: 28 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {ARRIVALS_HEADING}
      </Text>

      <View style={{ marginTop: 10, gap: 8 }}>
        {props.arrivalsWithheld ? (
          // Offline. The link above is still shareable because it never
          // changes; this list could have changed, so it is withheld rather
          // than served stale.
          <Notice title={OFFLINE_TITLE} body={OFFLINE_BODY} />
        ) : props.arrivalsLoading ? (
          [0, 1].map((i) => (
            <Skeleton key={i} style={{ height: 60, borderRadius: 18 }} />
          ))
        ) : props.arrivalsError ? (
          <ErrorState
            title={ARRIVALS_FAILED_TITLE}
            body={ARRIVALS_FAILED_BODY}
            onRetry={props.onRetryArrivals}
            retryTitle={TRY_AGAIN}
          />
        ) : props.arrivals.length === 0 ? (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <Text variant="body" accessibilityRole="header">
              {EMPTY_TITLE}
            </Text>
            {/* Says only that nobody has joined. It does NOT say how many were
                invited, because there is no record of who the link went to —
                by design, and permanently. */}
            <Text variant="note">{EMPTY_BODY}</Text>
          </View>
        ) : (
          <>
            {fresh.map((arrival) => (
              <Animated.View
                key={arrival.userId}
                entering={FadeIn.duration(260)}
                layout={LinearTransition.duration(220)}>
                <ArrivalRow
                  arrival={arrival}
                  onPress={props.onOpenArrival}
                  large={props.large}
                />
              </Animated.View>
            ))}
            {fresh.length > 0 && earlier.length > 0 ? (
              <Text variant="eyebrow" accessibilityRole="header" style={{ marginTop: 12 }}>
                {EARLIER_HEADING}
              </Text>
            ) : null}
            {earlier.map((arrival) => (
              <ArrivalRow
                key={arrival.userId}
                arrival={arrival}
                onPress={props.onOpenArrival}
                large={props.large}
              />
            ))}
          </>
        )}
      </View>
    </View>
  );
}

/** The amber band this page uses for a fact it is withholding on purpose. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: warningAlpha(0.22),
        borderRadius: 18,
        padding: 16,
        gap: 8,
        minHeight: MIN_TAP_TARGET,
      }}>
      <Text variant="body" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="note">{body}</Text>
    </View>
  );
}
