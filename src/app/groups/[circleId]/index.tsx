import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AcceptRefusedNotice,
  AloneState,
  GroupFullNotice,
  GroupsOfflineState,
  InvitationCard,
  MemberRow,
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
import { ALONE, MANAGE, memberLine, seatsLeftLine } from '@/features/circles/copy';
import { classifyCircleError } from '@/features/circles/errors';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/circles/mutations';
import {
  useCircle,
  useCircleInvitations,
  useCircleMembers,
} from '@/features/circles/queries';
import { canInvite, resolveCircleState, showsRoster } from '@/features/circles/states';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PC-06 — one group: who is in it, and the one or two things you may do about
 * that.
 *
 * ── THE ROSTER IS DRAWN ONLY WHEN `showsRoster` SAYS SO ─────────────────────
 *
 * Which is false for `invited`, and that is the strictest promise on the whole
 * surface: "You will see who else is in it after you accept." The schema keeps
 * it — the membership select policy hands an invitee their own row and nobody
 * else's — so `useCircleMembers` comes back with EXACTLY ONE ROW for a reader
 * who has not accepted. THAT IS THE PROMISE WORKING, NOT A FAILED LOAD, and
 * this screen must never dress it as one: no empty state, no error, no "couldn't
 * load the members". The invitation frame is what an invitee gets, and it is
 * built from the invitation and a scalar count that cannot be decomposed into
 * people.
 *
 * ── `full` IS OWNER-ONLY, AND THE RESOLVER ENFORCES THAT, NOT THIS FILE ─────
 *
 * A member in a twelve-seat group is in an ordinary group. The cap is only ever
 * a fact about INVITING and only the owner invites, so `resolveCircleState`
 * resolves `joined` before it ever reaches the seat check and a member cannot
 * be shown a wall. This screen draws `GroupFullNotice` on the `full` branch and
 * therefore cannot draw it for a member even by accident.
 *
 * ── AND THERE IS NO LEAVE CONTROL ON THIS SCREEN AT ALL ─────────────────────
 *
 * Leaving lives on the manage surface, where the owner's version of that
 * surface says why they cannot. See the note in `manage.tsx`: the transition
 * trigger refuses `owner → left` with a 22023 that the client maps to a silent
 * refetch, so an owner offered a Leave button would tap it and watch nothing
 * happen, with nothing said.
 */
export default function GroupScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const terms = useSocialTermsGate();

  const id = circleId ?? null;
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const invitations = useCircleInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();

  const [refused, setRefused] = useState(false);
  const [answering, setAnswering] = useState(false);

  /** The invitation for THIS group, when the reader has one outstanding. */
  const invitation = useMemo(
    () => (invitations.data ?? []).find((row) => row.circleId === id) ?? null,
    [invitations.data, id],
  );

  // Memoised on its own so the two filters below do not re-run on every render
  // against a fresh `[]` — the same shape `use-swap.ts` and `use-gap-feed.ts`
  // reach for, and the reason the lint rule exists.
  const roster = useMemo(() => members.data ?? [], [members.data]);
  const joined = useMemo(() => roster.filter((row) => row.state === 'joined'), [roster]);
  const pending = useMemo(() => roster.filter((row) => row.state === 'invited'), [roster]);

  const state = useMemo(
    () =>
      resolveCircleState({
        loading: circle.isLoading || invitations.isLoading,
        failed: circle.isError,
        // The list-level counts are not what this screen is about; the focused
        // group outranks them in the resolver either way.
        groupCount: 0,
        invitationCount: invitations.data?.length ?? 0,
        group: circle.data
          ? {
              // The count comes from the RPC on the summary, never from
              // `roster.length` — an invitee can read one row, so counting rows
              // would tell every invitee that the group has one member in it.
              memberCount: circle.data.memberCount,
              pendingCount: pending.length,
              isOwner: circle.data.isOwner,
              awaitingAnswer: invitation !== null,
            }
          : undefined,
      }),
    [circle.isLoading, circle.isError, circle.data, invitations.isLoading, invitations.data, pending.length, invitation],
  );

  const refresh = useCallback(() => {
    void circle.refetch();
    void members.refetch();
    void invitations.refetch();
  }, [circle, members, invitations]);

  const answer = useCallback(
    (choice: 'accepted' | 'declined') => {
      if (!id) return;
      const run = () => {
        setAnswering(true);
        setRefused(false);
        const mutation = choice === 'accepted' ? accept : decline;
        mutation.mutate(
          { circleId: id },
          {
            onSuccess: () => {
              track(CIRCLE_EVENTS.invitationAnswered, circleInvitationAnsweredProps(choice));
              // Declining leaves nothing here to look at: the group is still
              // visible to the server so a later accept works, but this reader
              // has answered and the list is where they belong.
              if (choice === 'declined') router.back();
            },
            onError: (error) => {
              if (terms.intercept(error, run)) return;
              const failure = classifyCircleError(error);
              if (failure.kind === 'group_full' && choice === 'accepted') {
                setRefused(true);
                return;
              }
              refresh();
            },
            onSettled: () => setAnswering(false),
          },
        );
      };
      run();
    },
    [id, accept, decline, terms, refresh, router],
  );

  const title = circle.data?.name ?? '';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={title} backLabel="Back" />

      <ScrollView
        contentContainerClassName="px-gutter pb-24"
        contentContainerStyle={state.kind === 'alone' ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={circle.isRefetching || members.isRefetching}
            onRefresh={refresh}
            tintColor={theme.muted}
          />
        }>
        {state.kind === 'loading' ? (
          <View className="mt-6">
            <ListSkeleton count={4} />
          </View>
        ) : state.kind === 'offline' ? (
          <GroupsOfflineState onRetry={refresh} retrying={circle.isRefetching} />
        ) : state.kind === 'invited' && invitation ? (
          // PC-04. No roster, no seat count, no manage surface — and the members
          // query's single row is never consulted on this branch.
          <View className="mt-6">
            <InvitationCard
              groupName={invitation.name}
              inviterName={invitation.inviterName}
              memberCount={invitation.memberCount}
              pending={answering}
              onAccept={() => answer('accepted')}
              onDecline={() => answer('declined')}
            />
            {refused ? <AcceptRefusedNotice /> : null}
          </View>
        ) : state.kind === 'alone' ? (
          /**
           * The liveness state — a group that exists, is yours, and is waiting
           * for one person. Not empty and not broken.
           *
           * The manage link is drawn UNDER it rather than left off, and that is
           * not decoration: deleting is the owner's only exit, it lives on the
           * manage surface, and a group whose roster is just its owner is the
           * single most likely group to want deleting — made by mistake, named
           * wrong, thought better of. Ending the branch at `AloneState` would
           * have meant the owner had to invite somebody into a group they
           * wanted to be rid of in order to reach the control that gets rid of
           * it.
           */
          <View className="flex-1">
            <AloneState
              onInvite={() =>
                router.push({
                  pathname: '/groups/[circleId]/invite',
                  params: { circleId: id ?? '' },
                })
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={MANAGE.link}
              onPress={() =>
                router.push({
                  pathname: '/groups/[circleId]/manage',
                  params: { circleId: id ?? '' },
                })
              }
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-6 justify-center active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                {MANAGE.link}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text variant="display" trim accessibilityRole="header" className="mt-3">
              {title}
            </Text>
            <Text variant="note" className="mt-2">
              {memberLine(state.kind === 'joined' ? state.memberCount : circle.data?.memberCount ?? 0)}
            </Text>

            {/* PC-10, and only ever for an owner — see the header. */}
            {state.kind === 'full' ? <GroupFullNotice /> : null}

            {showsRoster(state) ? (
              <View className="mt-8">
                {/* The roster gets its real heading now that the link out is
                    its own word. The seats line is the owner's arithmetic and
                    nobody else's: a member is not choosing whether to invite,
                    so a count of free seats is a fact about a decision they do
                    not have.

                    `canInvite` stays the authority on WHETHER that line
                    belongs; the `in` check is only there to narrow the union
                    for the compiler. Re-deriving the condition as
                    `kind === 'alone' || kind === 'owned'` would be this screen
                    deciding for itself something `states.ts` deliberately owns,
                    and the branch it eventually got wrong would be a real one. */}
                <SectionHeader
                  title={MANAGE.heading}
                  trailing={
                    canInvite(state) && 'seatsFree' in state ? (
                      <Text variant="note">{seatsLeftLine(state.seatsFree)}</Text>
                    ) : undefined
                  }
                />
                <Card className="mt-2.5">
                  {joined.map((member) => (
                    <MemberRow
                      key={member.userId}
                      name={member.displayName ?? ''}
                      isOwner={member.role === 'owner'}
                      joinedAt={member.joinedAt}
                      // No `onRemove` anywhere on this screen. Removing is the
                      // manage surface's act, and it carries a confirmation and
                      // the sentence about what the removed person is told.
                    />
                  ))}
                </Card>
              </View>
            ) : null}

            {canInvite(state) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ALONE.action}
                onPress={() =>
                  router.push({
                    pathname: '/groups/[circleId]/invite',
                    params: { circleId: id ?? '' },
                  })
                }
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-8 justify-center active:opacity-60">
                <Text variant="label" style={{ color: theme.accent }}>
                  {ALONE.action}
                </Text>
              </Pressable>
            ) : null}

            {/* Manage is offered to everyone who is actually in the group,
                because it is where a MEMBER leaves as well as where an owner
                removes and deletes. The two versions of the surface differ, and
                `manage.tsx` is where that difference is argued.

                Labelled `MANAGE.link` — "Manage" — and deliberately not
                `MANAGE.heading`: a control saying "Members" directly beneath a
                list of members reads as a heading for the list rather than a
                door out of it, and the screen it opens is where somebody is
                removed and where a group is left or deleted.

                GATED ON `showsRoster`, which is true for exactly the four
                states that mean "you are in this group". Not merely tidy: if
                the group summary has not arrived yet the resolver answers from
                the LIST counts, and it can say `invited` with no invitation for
                THIS group in hand — in which case the branch above falls
                through to here. `showsRoster` is false for `invited`, so that
                reader gets no roster (the privacy promise holds by itself) and
                now no manage link into a group they may not be in either. */}
            {showsRoster(state) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={MANAGE.link}
                onPress={() =>
                  router.push({
                    pathname: '/groups/[circleId]/manage',
                    params: { circleId: id ?? '' },
                  })
                }
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-6 justify-center active:opacity-60">
                <Text variant="label" style={{ color: theme.accent }}>
                  {MANAGE.link}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
