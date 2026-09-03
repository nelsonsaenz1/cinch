import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityCenterEmptyGlyph, CircleMark } from '@/components/activity-center';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { ListSkeleton } from '@/components/ui/skeleton';
import { BOUNDED_TIMEOUT_COPY } from '@/lib/bounded-load';
import { useBoundedLoad } from '@/lib/use-bounded-load';
import {
  DISMISS_SCOPE,
  INVITATION_PROMISE,
  INVITATION_TITLE,
  invitationMembers,
  INVITE_ACCEPT_LONG,
  INVITE_DECLINE,
  INVITE_REVERSIBLE,
  invitedYou,
  NAV_TITLE,
  NEUTRAL_CIRCLE,
  NEUTRAL_NAME,
  REVOKED_DISMISS,
  REVOKED_PROVENANCE,
  REVOKED_TITLE,
  revokedInvitationBody,
} from '@/features/activity-center/copy';
import {
  activityActionProps,
  ACTIVITY_EVENTS,
} from '@/features/activity-center/analytics';
import {
  useDismissActivityEvent,
} from '@/features/activity-center/mutations';
import { useActivityActors, useActivityEvent } from '@/features/activity-center/queries';
import { spokenElapsed } from '@/features/activity-center/sentence';
import {
  useAcceptInvitation,
  useDeclineInvitation,
} from '@/features/circles/mutations';
import { useCircle, useCircleInvitations } from '@/features/circles/queries';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';
import { useTheme } from '@/theme/tokens';

/**
 * AC-03 — one invitation, in full — and AC-05 when there is nothing left to
 * accept.
 *
 * `cinch://activity/invitation/:id`, where `:id` IS THE EVENT'S ID and never
 * the group's. That choice is what makes "a deep link to a revoked item
 * resolves to AC-05, never a dead end" true by construction: an event id is
 * readable for exactly as long as the row is, and the row carries `revoked_at`
 * — so this screen can always answer. A group id could not; `can_see_circle`
 * stops showing a removed person the room they were removed from, and the only
 * possible response to `…/invitation/<circle>` at that point is a 404, which is
 * the dead end the rule forbids.
 *
 * ── THE THREE WAYS THIS RESOLVES TO AC-05 ─────────────────────────────────
 *
 *  1. `revoked_at` is set — the owner rescinded it, or the reader has already
 *     answered it. Written by `fan_out_circle_transition` in the same
 *     transaction as the membership change.
 *  2. The event is gone entirely — cleared, dismissed, or purged past thirty
 *     days. `useActivityEvent` resolves to `null` and this treats that as the
 *     same fact, because from the reader's side it IS the same fact: there is
 *     nothing left to accept. Two screens for that would be inventing a
 *     distinction the reader does not have.
 *  3. The invitation is no longer pending in `circle_members`, whatever the
 *     event says. This is the belt to (1)'s braces — a live re-read of the
 *     membership itself — and it exists because an invitation answered on
 *     another device is a race the row alone cannot win.
 *
 * ── THE ONE OXBLOOD ACTION ON THE SURFACE ─────────────────────────────────
 *
 * The timeline draws its inline affirmatives in INK, because a page of rows
 * each spending the accent is how the one-accent-per-screen rule dies. This is
 * one screen with one decision on it, so the accent is spent here — which is
 * both AC-03's own drawing and the reason the rule holds everywhere else.
 */
export default function InvitationDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const event = useActivityEvent(id ?? null);
  const actors = useActivityActors(event.data ? [event.data] : []);
  const circleId = event.data?.circleId ?? null;

  const circle = useCircle(circleId);
  const invitations = useCircleInvitations();

  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const dismiss = useDismissActivityEvent();

  const actor = event.data?.actorId ? actors.data?.get(event.data.actorId) : undefined;
  const actorName = actor?.name?.trim() || NEUTRAL_NAME;

  // The group's live name when the reader can still see it; the denormalised
  // one on the row when they cannot. AC-05 depends on the second half.
  const circleName =
    circle.data?.name ?? event.data?.payload.circle_name?.trim() ?? NEUTRAL_CIRCLE;

  const stillPending = useMemo(
    () => (invitations.data ?? []).some((invitation) => invitation.circleId === circleId),
    [invitations.data, circleId],
  );

  const loading = event.isLoading || (Boolean(circleId) && invitations.isLoading);

  /**
   * UX #59 — the activity detail's skeleton is bounded now.
   *
   * The header and the retry were already here; the wait was not. A read that
   * never settles left three placeholder rows shimmering under "Loading your
   * activity…" with nothing to press, which is the finding's "no progress or
   * timeout signal" exactly.
   */
  const load = useBoundedLoad({
    loading,
    error: event.isError,
    retrying: event.isRefetching || invitations.isRefetching,
    onRetry: () => void event.refetch(),
  });
  // Resolved and not answerable, by any of the three routes above.
  const revoked =
    !loading && (!event.data || Boolean(event.data.revokedAt) || !stillPending);

  const back = () => router.back();

  const remove = () => {
    if (event.data) {
      dismiss.mutate({ id: event.data.id, eventType: event.data.type });
    }
    back();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title={INVITATION_TITLE}
        align="center"
        onBack={back}
        backLabel={NAV_TITLE}
      />

      {load.state === 'skeleton' ? (
        <ListSkeleton count={3} label="Loading your activity…" />
      ) : load.failed ? (
        // A failed READ is not a revoked event. Rendering the revoked state
        // here asserted "no longer available" over a connection problem
        // (2026-09-02 audit); this says only that the read failed, and offers it
        // again. UX #59 adds the second half: a read that never returns now ends
        // here too, in the timeout's own words, rather than shimmering forever.
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <ErrorState
            {...(load.timedOut ? BOUNDED_TIMEOUT_COPY : {})}
            onRetry={load.retry}
            retrying={load.retrying}
          />
        </View>
      ) : revoked ? (
        // AC-05. Inert, explained, and dismissible — never an error and never a
        // blank screen.
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}>
          <View className="flex-1 items-center pt-2">
            <ActivityCenterEmptyGlyph size={34} color={theme.muted} />
            <View style={{ marginTop: 16 }}>
              <Text variant="title" trim className="text-center text-muted">
                {REVOKED_TITLE}
              </Text>
            </View>
            <Text
              className="mt-2.5 text-center text-muted"
              style={{ fontSize: 15, lineHeight: 23, maxWidth: 300 }}>
              {revokedInvitationBody(circleName)}
            </Text>

            {/* AC-05's provenance card. The name is prepended only when it
                resolves — "Withdrawn by A Cinch member" is worse than the
                sentence on its own. */}
            <View
              className="mt-6 w-full flex-row items-start gap-2.5 rounded-lg p-4"
              style={{ backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule }}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  backgroundColor: theme.muted,
                }}
              />
              <Text variant="note" style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>
                {actor?.name ? `Withdrawn by ${actor.name}. ` : ''}
                {REVOKED_PROVENANCE}
              </Text>
            </View>

            <View className="flex-1" />

            <View className="w-full pb-2">
              <Button title={REVOKED_DISMISS} variant="secondary" onPress={remove} />
              <Text variant="note" className="mt-3.5 text-center" style={{ fontSize: 13 }}>
                {DISMISS_SCOPE}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}>
          <View className="flex-1 items-center pt-2">
            <CircleMark />
            <View style={{ marginTop: 16 }}>
              <Text variant="title" trim className="text-center" accessibilityRole="header">
                {circleName}
              </Text>
            </View>
            {/* `circle_member_count` counts JOINED only, so it never discloses
                that other invitations are pending — which is the line PC-04
                draws and this screen inherits. */}
            <Text variant="note" className="mt-1.5" style={{ fontSize: 15 }}>
              {invitationMembers(circle.data?.memberCount ?? 0)}
            </Text>

            <View
              className="mt-5 w-full flex-row items-center gap-3 rounded-lg p-4"
              style={{ backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule }}>
              <Avatar name={actor?.name ?? null} size={40} imageUri={actor?.avatarUrl ?? null} />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontSize: 15, lineHeight: 21 }}>
                  {invitedYou(actorName)}
                </Text>
                {event.data ? (
                  <Text variant="note" style={{ marginTop: 2, fontSize: 13 }}>
                    {spokenElapsed(event.data.occurredAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* NO ROSTER, and no stacked avatars standing in for one. AC-03
                draws three discs beside this line; they are anonymous in the
                frame and they have to stay anonymous here, because
                `circle_members` shows an invitee exactly one row — their own —
                until they join. Drawing named faces would be promising a list
                the membership policy withholds, so the sentence carries the
                promise on its own. */}
            <Text variant="note" className="mt-3.5 self-start" style={{ fontSize: 13 }}>
              {INVITATION_PROMISE}
            </Text>

            <View className="flex-1" />

            <View className="w-full pb-2" style={{ gap: 10 }}>
              <Button
                title={INVITE_ACCEPT_LONG}
                variant="primary"
                loading={accept.isPending}
                disabled={decline.isPending}
                onPress={() => {
                  if (!circleId) return;
                  track(
                    ACTIVITY_EVENTS.action,
                    activityActionProps({
                      action: 'accept',
                      surface: 'detail',
                      eventType: event.data?.type,
                    }),
                  );
                  accept.mutate(
                    { circleId },
                    {
                      onSuccess: () => {
                        haptics.success();
                        back();
                      },
                      onError: () => haptics.failure(),
                    },
                  );
                }}
              />
              <Button
                title={INVITE_DECLINE}
                variant="secondary"
                loading={decline.isPending}
                disabled={accept.isPending}
                onPress={() => {
                  if (!circleId) return;
                  track(
                    ACTIVITY_EVENTS.action,
                    activityActionProps({
                      action: 'decline',
                      surface: 'detail',
                      eventType: event.data?.type,
                    }),
                  );
                  haptics.commit();
                  decline.mutate({ circleId }, { onSettled: back });
                }}
              />
              {/* The reason the affirmative is safe to tap, stated where the
                  decision is made rather than discovered afterwards. It is true
                  of the schema: the transition trigger permits `joined → left`
                  for the member themselves. */}
              <Text variant="note" className="mt-1 text-center" style={{ fontSize: 13 }}>
                {INVITE_REVERSIBLE}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
