import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AcceptRefusedNotice,
  GroupRow,
  GroupsOfflineState,
  InvitationCard,
  NoGroupsState,
} from '@/components/circles';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import {
  CIRCLE_EVENTS,
  circleInvitationAnsweredProps,
} from '@/features/circles/analytics';
import {
  GROUPS_TITLE,
  INVITATION,
  NO_GROUPS,
  invitationsWaiting,
} from '@/features/circles/copy';
import { classifyCircleError } from '@/features/circles/errors';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/circles/mutations';
import { useCircleInvitations, useCircles } from '@/features/circles/queries';
import { resolveCircleState } from '@/features/circles/states';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PC-01 / PC-04 / PC-06 — the groups you are in, and the invitations you have
 * not answered, on one screen.
 *
 * ── THE FIVE STATES THIS SCREEN CAN BE IN ARE NOT DECIDED HERE ──────────────
 *
 * `resolveCircleState` decides them, and the ordering it applies is the whole
 * reason it exists: loading outranks failure, failure outranks emptiness, and a
 * screen that has not heard back must never draw "No groups yet" with a Create
 * button under it — that offers somebody a second copy of the group they
 * already have. This file passes the two queries in and draws what comes back.
 *
 * ── AN UNANSWERED INVITATION IS NOT AN EMPTY LIST ───────────────────────────
 *
 * Somebody with no groups and one invitation resolves to `invited`, not
 * `no_groups`. PC-01's "No groups yet" would be true and useless: their next
 * act is to answer the invitation, not to create something.
 *
 * ── AND THE CARD NEVER SHOWS A ROSTER ───────────────────────────────────────
 *
 * `InvitationCard` takes a count and no names, because that is all
 * `useCircleInvitations` has: the membership select policy hands an invitee
 * their own row and nothing else, and the count arrives from a scalar RPC that
 * cannot be decomposed into people. "You will see who else is in it after you
 * accept" is kept by the shape of the data rather than by this screen
 * remembering to keep it.
 */
export default function GroupsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const terms = useSocialTermsGate();

  const circles = useCircles();
  const invitations = useCircleInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();

  /**
   * The invitation whose seat was gone by the time it was answered — PC-10's
   * second half, held per group id.
   *
   * Kept here rather than as a screen-wide flag because two invitations can be
   * on screen at once and only one of them lost its seat; a single flag would
   * print the notice under both.
   */
  const [refusedFor, setRefusedFor] = useState<string | null>(null);
  /** The group id whose answer is in flight, so only that card goes inert. */
  const [answering, setAnswering] = useState<string | null>(null);

  const groups = circles.data ?? [];
  const waiting = invitations.data ?? [];

  const state = useMemo(
    () =>
      resolveCircleState({
        loading: circles.isLoading || invitations.isLoading,
        // Either read failing is a failed read. A list drawn from one of two
        // queries would be a partial truth presented as the whole one.
        failed: circles.isError || invitations.isError,
        groupCount: groups.length,
        invitationCount: waiting.length,
      }),
    [circles.isLoading, circles.isError, invitations.isLoading, invitations.isError, groups.length, waiting.length],
  );

  const refresh = useCallback(() => {
    void circles.refetch();
    void invitations.refetch();
  }, [circles, invitations]);

  const openGroup = useCallback(
    (circleId: string) => {
      router.push({ pathname: '/groups/[circleId]', params: { circleId } });
    },
    [router],
  );

  /**
   * Answering, with the three failures that are not the user's fault.
   *
   * `stale` says nothing and refetches — the row already moved, which is the
   * interface's problem and not something to explain. `group_full` on an
   * ACCEPT is the one refusal this screen can state, and it states it without
   * naming who took the seat: that is a roster fact and this reader is not on
   * the roster. `terms_required` routes into the app's one terms sheet rather
   * than beside it, and agreeing re-runs the answer they were already giving.
   */
  const answer = useCallback(
    (circleId: string, choice: 'accepted' | 'declined') => {
      const run = () => {
        setAnswering(circleId);
        setRefusedFor(null);
        const mutation = choice === 'accepted' ? accept : decline;
        mutation.mutate(
          { circleId },
          {
            onSuccess: () => {
              track(CIRCLE_EVENTS.invitationAnswered, circleInvitationAnsweredProps(choice));
            },
            onError: (error) => {
              if (terms.intercept(error, run)) return;
              const failure = classifyCircleError(error);
              if (failure.kind === 'group_full' && choice === 'accepted') {
                setRefusedFor(circleId);
                return;
              }
              // Everything else — stale included — refetches and redraws. The
              // act simply did not happen, and the card is live again.
              refresh();
            },
            onSettled: () => setAnswering(null),
          },
        );
      };
      run();
    },
    [accept, decline, terms, refresh],
  );

  const invitationCards = waiting.map((invitation) => (
    <View key={invitation.circleId} className="mt-3">
      <InvitationCard
        groupName={invitation.name}
        inviterName={invitation.inviterName}
        memberCount={invitation.memberCount}
        pending={answering === invitation.circleId}
        onAccept={() => answer(invitation.circleId, 'accepted')}
        onDecline={() => answer(invitation.circleId, 'declined')}
      />
      {refusedFor === invitation.circleId ? <AcceptRefusedNotice /> : null}
    </View>
  ));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={GROUPS_TITLE} backLabel="Back" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {GROUPS_TITLE}
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-24"
        contentContainerStyle={state.kind === 'no_groups' ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={circles.isRefetching || invitations.isRefetching}
            onRefresh={refresh}
            tintColor={theme.muted}
          />
        }>
        {state.kind === 'loading' ? (
          <View className="mt-6">
            <ListSkeleton count={3} avatar={false} />
          </View>
        ) : state.kind === 'offline' ? (
          <GroupsOfflineState onRetry={refresh} retrying={circles.isRefetching} />
        ) : state.kind === 'no_groups' ? (
          <NoGroupsState onCreate={() => router.push('/groups/create')} />
        ) : state.kind === 'invited' ? (
          // No groups, so no list and no heading over a single section — the
          // invitations ARE the screen. `NoGroupsState` is deliberately absent:
          // this reader's next act is to answer, not to create.
          <View>{invitationCards}</View>
        ) : (
          <>
            <Card className="mt-6">
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  name={group.name}
                  memberCount={group.memberCount}
                  isOwner={group.isOwner}
                  onOpen={() => openGroup(group.id)}
                />
              ))}
            </Card>

            {waiting.length > 0 ? (
              <View className="mt-8">
                {/* The READER'S invitations, so `INVITATION.heading` —
                    "Waiting for you" — and deliberately not `PENDING.heading`,
                    which is the same noun for the opposite direction and sits
                    over the owner's OUTGOING invitations two taps away. */}
                <SectionHeader
                  title={INVITATION.heading}
                  trailing={
                    <Text variant="note">{invitationsWaiting(waiting.length)}</Text>
                  }
                />
                {invitationCards}
              </View>
            ) : null}

            {/* The way in for a second group, in the resting state as well as
                the empty one — the same argument `FriendsPage` makes for its
                foot link: somebody with one group is exactly as able to want
                another as somebody with none, and the empty state is not the
                only moment the thought occurs. PC-01's string, because this is
                PC-01's act: an offer to start something, not the commit on the
                create screen ("Create THE group"). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={NO_GROUPS.action}
              onPress={() => router.push('/groups/create')}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-8 justify-center active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                {NO_GROUPS.action}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
