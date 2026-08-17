import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AcceptRefusedNotice,
  AloneState,
  GroupFullNotice,
  GroupGoneNotice,
  GroupsOfflineState,
  InvitationCard,
  MemberRow,
  SCREEN_STATE_OWNS_GUTTER,
} from '@/components/circles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import {
  CIRCLE_EVENTS,
  circleInvitationAnsweredProps,
} from '@/features/circles/analytics';
import {
  GROUPS_TITLE,
  groupSubtitle,
  INVITATION,
  invitationsWaitingRow,
  MANAGE,
  OVERVIEW,
} from '@/features/circles/copy';
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

  const openManage = useCallback(
    () =>
      router.push({
        pathname: '/groups/[circleId]/manage',
        params: { circleId: id ?? '' },
      }),
    [router, id],
  );

  const openInvite = useCallback(
    () =>
      router.push({
        pathname: '/groups/[circleId]/invite',
        params: { circleId: id ?? '' },
      }),
    [router, id],
  );

  /**
   * The group was deleted, or the reader's membership ended — and `useCircle`
   * answers `null` for both, deliberately and identically.
   *
   * Guarded on `isSuccess` rather than on `!circle.data`, which would also be
   * true of a read that has not answered: PC-09b is a fact about a group that
   * came back missing, and drawing it over a pending fetch would tell somebody
   * their group was gone every time they opened it on a slow connection.
   */
  const gone = circle.isSuccess && circle.data === null;

  const selfGuttered =
    (SCREEN_STATE_OWNS_GUTTER as readonly string[]).includes(state.kind) && !gone;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* No colophon: PC-06 sets the group's name as the page's 34pt heading
          and leaves the nav row to the back control and Manage. A colophon
          here would print the name twice. Manage is offered to everyone who is
          actually in the group — it is where a MEMBER leaves as well as where
          an owner removes and deletes — and gated on `showsRoster`, which is
          false for `invited`, so somebody who has not accepted gets no door
          into a room they may not be in. */}
      <ScreenHeader
        backLabel={GROUPS_TITLE}
        trailing={
          showsRoster(state) && !gone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={MANAGE.manageSpoken}
              onPress={openManage}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="justify-center px-2 active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                {MANAGE.link}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerClassName={selfGuttered ? 'pb-24' : 'px-gutter pb-24'}
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
        ) : gone ? (
          // PC-09b. The read worked and there is nothing behind the id — a
          // deleted group, or a membership that ended. Drawn before every other
          // branch below, because each of them would otherwise describe a group
          // that is not there: the old code fell through to the resting frame
          // and set an empty name over "0 members · private".
          <GroupGoneNotice onBack={() => router.dismissTo('/groups')} />
        ) : state.kind === 'invited' && invitation ? (
          // PC-04. No roster, no seat count, no manage surface — and the members
          // query's single row is never consulted on this branch.
          <View className="mt-3">
            <Text variant="display" trim accessibilityRole="header">
              {INVITATION.title}
            </Text>
            <View className="mt-6">
              <InvitationCard
                groupName={invitation.name}
                inviterName={invitation.inviterName}
                invitedAt={invitation.invitedAt}
                memberCount={invitation.memberCount}
                pending={answering}
                onAccept={() => answer('accepted')}
                onDecline={() => answer('declined')}
              />
            </View>
            {refused ? <AcceptRefusedNotice /> : null}
          </View>
        ) : state.kind === 'alone' ? (
          /**
           * The liveness state — a group that exists, is yours, and is waiting
           * for one person. Not empty and not broken.
           *
           * The manage link that used to be drawn under it has moved into the
           * nav bar with every other state's, which is where PC-06 puts it —
           * and the argument for having it at all is unchanged: deleting is the
           * owner's only exit, it lives on the manage surface, and a group
           * whose roster is just its owner is the single most likely group to
           * want deleting. It is simply no longer a second, differently-placed
           * copy of a control the rest of the screen has at the top.
           */
          <View className="flex-1">
            <Text variant="display" trim accessibilityRole="header" className="mt-3">
              {title}
            </Text>
            <Text variant="note" className="mt-2">
              {groupSubtitle(circle.data?.memberCount ?? 1, true)}
            </Text>
            <AloneState onInvite={openInvite} />
          </View>
        ) : (
          <>
            <Text variant="display" trim accessibilityRole="header" className="mt-3">
              {title}
            </Text>
            {/* "4 members · you own this group" — the role in words, which the
                access matrix requires on every screen that has one. */}
            <Text variant="note" className="mt-2">
              {groupSubtitle(
                state.kind === 'joined' ? state.memberCount : circle.data?.memberCount ?? 0,
                circle.data?.isOwner ?? false,
              )}
            </Text>

            {/* PC-10, and only ever for an owner — see the header. No manage
                action on it: the manage surface is one control away in the nav
                bar above, and two doors to one room is a choice nobody wants. */}
            {state.kind === 'full' ? <GroupFullNotice /> : null}

            {showsRoster(state) ? (
              <View className="mt-8">
                {/* A bare eyebrow, as PC-06 draws it. The seat arithmetic that
                    used to sit here has moved to the picker's own subtitle
                    ("3 of 12 chosen"), which is where PC-03 puts it and where
                    it is about a decision the reader is actually making. */}
                <SectionHeader title={OVERVIEW.membersHeading} />
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

            {/* PC-06's Waiting section. Owner-only, and by construction as well
                as by the check: the roster policy hands every row to anybody
                who is `joined`, but only the owner has anything to do with an
                unanswered invitation, and telling a member who has been asked
                and not replied would be gossip. The row leads to the manage
                surface, which is where the invitations are. */}
            {(circle.data?.isOwner ?? false) && pending.length > 0 ? (
              <View className="mt-8">
                <SectionHeader title={OVERVIEW.waitingHeading} />
                <Card className="mt-2.5">
                  <SettingsRow
                    label={invitationsWaitingRow(pending.length)}
                    onPress={openManage}
                  />
                </Card>
              </View>
            ) : null}

            {canInvite(state) ? (
              // A bordered pill, not a text link: PC-06 draws it as a control
              // the width of the page. `secondary` rather than the accent —
              // this screen spends no oxblood, and the group's own name is the
              // thing the eye should land on.
              <Button
                title={OVERVIEW.invite}
                variant="secondary"
                onPress={openInvite}
                accessibilityLabel={OVERVIEW.invite}
                className="mt-8 self-stretch"
              />
            ) : null}

            {/* The closing promise, and it is true by construction rather than
                by assertion: `circles`' select policy is `can_see_circle(id)`,
                so a non-member's query returns nothing at all. */}
            {showsRoster(state) ? (
              <Text variant="note" className="mt-3">
                {OVERVIEW.footnote}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
