import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ClosedInvitationRow,
  DeleteGroupDialog,
  GroupsOfflineState,
  LeaveGroupDialog,
  MemberRow,
  PendingInvitationRow,
  RemoveMemberDialog,
} from '@/components/circles';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import {
  CIRCLE_EVENTS,
  circleDeletedProps,
  circleMembershipEndedProps,
} from '@/features/circles/analytics';
import {
  MANAGE,
  manageMemberSubtitle,
  manageOwnerSubtitle,
  membersHeading,
  memberPermissionNote,
  PENDING,
  WRITE_FAILED,
  invitationsWaiting,
} from '@/features/circles/copy';
import { classifyCircleError } from '@/features/circles/errors';
import {
  useDeleteCircle,
  useLeaveCircle,
  useReInviteMember,
  useRemoveMember,
} from '@/features/circles/mutations';
import { useCircle, useCircleMembers } from '@/features/circles/queries';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PC-05 / PC-07 / PC-08 — the roster with its exits, which are different exits
 * for different people.
 *
 * ── THE OWNER IS NEVER OFFERED LEAVE, AND THIS IS THE LOAD-BEARING RULE ─────
 *
 * The transition trigger refuses `owner → left` outright, raising 22023, and
 * `classifyCircleError` maps 22023 to `stale` — which `circleFailureIsSilent`
 * says to swallow and refetch. So an owner handed a Leave control would tap it,
 * watch the sheet close, watch the screen redraw exactly as it was, and be told
 * NOTHING. That is the worst available outcome: a control that does nothing and
 * does not say why. The refusal is therefore drawn as a SENTENCE
 * (`MANAGE.ownerCannotLeave`) instead of a button, and the owner's real exit —
 * deleting — sits beside it. `LeaveGroupDialog` is never mounted on this
 * branch, so there is no path to the mutation at all.
 *
 * ── AND REMOVE IS ABSENT, NOT DISABLED ──────────────────────────────────────
 *
 * `MemberRow` takes `onRemove` as an optional prop precisely so it can be left
 * off. A greyed-out Remove beside another member's name would imply the reader
 * could eject them under some other circumstance, and the only person who ever
 * can is the owner. The owner does not get one against their own row either:
 * removing yourself is leaving, and the owner cannot leave.
 */
export default function ManageGroupScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const terms = useSocialTermsGate();

  const id = circleId ?? null;
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const remove = useRemoveMember();
  const reInvite = useReInviteMember();
  const leave = useLeaveCircle();
  const destroy = useDeleteCircle();

  const [removeFor, setRemoveFor] = useState<{ userId: string; name: string } | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  /** A refusal with no surface of its own — see `WRITE_FAILED`. */
  const [note, setNote] = useState<string | null>(null);

  const isOwner = circle.data?.isOwner ?? false;
  const roster = useMemo(() => members.data ?? [], [members.data]);
  const joined = useMemo(() => roster.filter((row) => row.state === 'joined'), [roster]);
  /**
   * Outstanding invitations — PC-05.
   *
   * Owner-only, and by construction rather than by a check here as well: the
   * roster policy hands every row in every state to somebody who is `joined`,
   * but only the owner has anything to do with an unanswered invitation, and
   * showing a member who has been asked and has not replied would be gossip.
   */
  const pending = useMemo(() => roster.filter((row) => row.state === 'invited'), [roster]);
  /**
   * PC-05's Closed section — the invitations that are over.
   *
   * `declined` AND NOTHING ELSE, which is a deliberate shortfall against the
   * frame. PC-05 also draws "Revoked by you" and "Canceled · no longer a mutual
   * friend"; neither is derivable, because withdrawing an invitation and
   * removing a member are the SAME `removed` state on the same column and the
   * schema keeps no distinguishing field. Guessing between them would put the
   * word "removed" beside somebody who merely never answered. So the section
   * shows the one status this client can stand behind, and asking again — the
   * whole reason a closed row is worth drawing — works for it.
   */
  const closed = useMemo(() => roster.filter((row) => row.state === 'declined'), [roster]);
  /** The owner's own name, for PC-07b's subtitle and permission note. */
  const ownerName = useMemo(
    () => roster.find((row) => row.role === 'owner')?.displayName ?? null,
    [roster],
  );

  const refresh = useCallback(() => {
    void circle.refetch();
    void members.refetch();
  }, [circle, members]);

  /**
   * What a failed remove, withdraw, leave or delete does.
   *
   * `stale` stays silent — the row moved, which is the interface's problem and
   * not something to explain; refetching shows the state that was true all
   * along. Everything else now SAYS SO, because a Delete that quietly does
   * nothing is the same defect as a Leave an owner can tap: a control that
   * fires and reports nothing. `unknown` does not claim the group is untouched,
   * since the reply may have been lost after the server committed — it sends
   * the reader to look, and the refetch below is what they will be looking at.
   */
  const onFailure = useCallback(
    (error: unknown, retry: () => void) => {
      if (terms.intercept(error, retry)) return;
      const failure = classifyCircleError(error);
      if (failure.kind === 'rate_limited') setNote(WRITE_FAILED.rateLimited);
      else if (failure.kind !== 'stale') setNote(WRITE_FAILED.unknown);
      refresh();
    },
    [terms, refresh],
  );

  const confirmRemove = useCallback(() => {
    if (!id || !removeFor) return;
    const userId = removeFor.userId;
    setNote(null);
    const run = () => {
      remove.mutate(
        { circleId: id, userId },
        {
          onSuccess: () => {
            track(CIRCLE_EVENTS.membershipEnded, circleMembershipEndedProps('removed'));
            setRemoveFor(null);
          },
          onError: (error) => {
            setRemoveFor(null);
            onFailure(error, run);
          },
        },
      );
    };
    run();
  }, [id, removeFor, remove, onFailure]);

  const confirmLeave = useCallback(() => {
    // Guarded here as well as by the control's absence. Two guards, because the
    // consequence of this one being wrong is a silent no-op the user cannot
    // interpret — see the header.
    if (!id || isOwner) return;
    setNote(null);
    const run = () => {
      leave.mutate(
        { circleId: id },
        {
          onSuccess: () => {
            track(CIRCLE_EVENTS.membershipEnded, circleMembershipEndedProps('left'));
            setAskLeave(false);
            // Back to the list, popping the group's own screen with it.
            // `dismissTo` rather than `back`: the group underneath is one the
            // reader is no longer in, and `replace` would leave it in the stack
            // for the back gesture to find.
            router.dismissTo('/groups');
          },
          onError: (error) => {
            setAskLeave(false);
            onFailure(error, run);
          },
        },
      );
    };
    run();
  }, [id, isOwner, leave, router, onFailure]);

  const confirmDelete = useCallback(() => {
    if (!id || !isOwner) return;
    setNote(null);
    const run = () => {
      destroy.mutate(
        { circleId: id },
        {
          onSuccess: () => {
            track(CIRCLE_EVENTS.deleted, circleDeletedProps());
            setAskDelete(false);
            // Same reasoning as leaving, and more so: the group does not exist.
            router.dismissTo('/groups');
          },
          onError: (error) => {
            setAskDelete(false);
            onFailure(error, run);
          },
        },
      );
    };
    run();
  }, [id, isOwner, destroy, router, onFailure]);

  /**
   * Asking somebody back, straight off a closed row — PC-05's "Invite again".
   *
   * The UPDATE path (`invited` from `declined`), never the INSERT one: the row
   * already exists, and `invite-routing.ts` argues at length why sending it
   * down the INSERT would raise a unique violation that this app then swallows
   * in silence.
   */
  const inviteAgain = useCallback(
    (userId: string) => {
      if (!id || !isOwner) return;
      setNote(null);
      const run = () => {
        reInvite.mutate({ circleId: id, userId }, { onError: (error) => onFailure(error, run) });
      };
      run();
    },
    [id, isOwner, reInvite, onFailure],
  );

  const groupName = circle.data?.name ?? '';
  const failed = circle.isError || members.isError;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* PC-07's nav row: back, and Done. "Done" rather than a second chevron
          because this surface is a stop — the reader came here to remove
          somebody, leave, or delete, and the way out when they have finished is
          not the way back to a step. No colophon; the title below is the H1. */}
      <ScreenHeader
        backLabel={groupName || 'Back'}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={MANAGE.done}
            onPress={() => router.back()}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="justify-center px-2 active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              {MANAGE.done}
            </Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerClassName={failed ? 'pb-24' : 'px-gutter pb-24'}>
        {circle.isLoading || members.isLoading ? (
          <View className="mt-6">
            <ListSkeleton count={4} />
          </View>
        ) : failed ? (
          <GroupsOfflineState onRetry={refresh} retrying={circle.isRefetching} />
        ) : (
          <>
            {/* TWO TITLES, BECAUSE THESE ARE TWO SCREENS. PC-07 is "Manage" —
                a surface of controls the owner is about to use. PC-07b is "This
                group", a page of facts with one door out, and calling it
                "Manage" would promise a member powers the policies refuse them.
                The line beneath states the role in words either way, which is
                what the access matrix requires of every screen that has one. */}
            <Text variant="display" trim accessibilityRole="header" className="mt-3">
              {isOwner ? MANAGE.ownerTitle : MANAGE.memberTitle}
            </Text>
            <Text variant="note" className="mt-2">
              {isOwner
                ? manageOwnerSubtitle(groupName)
                : manageMemberSubtitle(groupName, ownerName)}
            </Text>

            <SectionHeader title={membersHeading(joined.length)} className="mt-8" />
            <Card className="mt-2.5">
              {joined.map((member) => {
                const name = member.displayName ?? '';
                // The owner may remove anybody but themselves. Everyone else
                // gets no `onRemove` at all — absent, never disabled.
                const removable = isOwner && member.role !== 'owner';
                return (
                  <MemberRow
                    key={member.userId}
                    name={name}
                    isOwner={member.role === 'owner'}
                    joinedAt={member.joinedAt}
                    onRemove={
                      removable ? () => setRemoveFor({ userId: member.userId, name }) : undefined
                    }
                  />
                );
              })}
            </Card>

            {/* PC-07's promise about what a removed person is told, stated
                where the act is, not in a dialog they have already opened. */}
            {isOwner ? (
              <Text variant="note" className="mt-3 text-muted">
                {MANAGE.removalNote}
              </Text>
            ) : null}

            {/* PC-05, on the surface that owns it. Two sections, and the
                heading over the pair carries the count. Owner-only, and by
                construction rather than by this check alone: the roster policy
                hands every row in every state to anybody who is `joined`, but
                only the owner has anything to do with an unanswered
                invitation, and showing a member who has been asked and has not
                replied would be gossip. */}
            {isOwner && (pending.length > 0 || closed.length > 0) ? (
              <View className="mt-8">
                {/* "Waiting" and "Closed" are the sections, and there is no
                    third eyebrow over the pair. PC-05 sets "Invitations" as the
                    SCREEN's 34pt title; borrowing it as a tracked micro-label
                    here would stack two eyebrows of identical weight and leave
                    the reader working out which one governs the card. */}
                {pending.length > 0 ? (
                  <>
                    <SectionHeader
                      title={PENDING.waitingHeading}
                      trailing={<Text variant="note">{invitationsWaiting(pending.length)}</Text>}
                    />
                    <Card className="mt-2.5">
                      {pending.map((member) => (
                        <PendingInvitationRow
                          key={member.userId}
                          name={member.displayName ?? ''}
                          invitedAt={member.invitedAt}
                          // Withdrawing is `invited → removed` in the schema —
                          // the same write as a removal, worded differently on
                          // purpose: nothing was taken away, because nothing
                          // was accepted.
                          onWithdraw={() =>
                            setRemoveFor({ userId: member.userId, name: member.displayName ?? '' })
                          }
                        />
                      ))}
                    </Card>
                  </>
                ) : null}

                {closed.length > 0 ? (
                  <>
                    <SectionHeader title={PENDING.closedHeading} className="mt-6" />
                    <Card className="mt-2.5">
                      {closed.map((member) => (
                        <ClosedInvitationRow
                          key={member.userId}
                          name={member.displayName ?? ''}
                          status={PENDING.declined}
                          onInviteAgain={() => inviteAgain(member.userId)}
                        />
                      ))}
                    </Card>
                  </>
                ) : null}

                {/* The promise about the OTHER invitees, and it is kept by the
                    membership select policy rather than by this screen: an
                    invitee querying the roster is handed exactly their own row. */}
                <Text variant="note" className="mt-3">
                  {PENDING.footnote}
                </Text>
              </View>
            ) : null}

            {note ? <Notice message={note} tone="critical" className="mt-8" /> : null}

            {/* THE EXIT, AS A ROW IN A CARD — PC-07's "Group" section and
                PC-07b's "What you can do".

                A row rather than the full-width bordered button it used to be,
                and the difference is not cosmetic: a page-wide pill reads as
                the screen's primary act, and on this surface the primary act is
                whatever brought the reader here — usually removing somebody. A
                list row is a door, which is what deleting and leaving are.

                `tone="accent"` is the second use in the app of a treatment
                `settings-row.tsx` records as belonging to Delete account alone.
                It is taken deliberately: PC-07 and PC-07b BOTH draw this label
                in oxblood, and the rule the profile atlas states — one
                critical-coloured thing per screen — is kept, because this row
                is the only accent in either version's CONTENT. The oxblood in
                the nav bar is the atlas's chrome tint, which every frame in the
                flow uses for back, Manage, Done, Cancel and Create alike.

                No Rename row. PC-07 draws one; `useRenameCircle` is wired to no
                surface by the accepted record's own decision, and a row that
                opened nothing would be worse than its absence. */}
            <SectionHeader
              title={isOwner ? MANAGE.groupHeading : MANAGE.memberHeading}
              className="mt-10"
            />
            <Card className="mt-2.5">
              {isOwner ? (
                <SettingsRow
                  label={MANAGE.delete}
                  tone="accent"
                  loading={destroy.isPending}
                  onPress={() => setAskDelete(true)}
                />
              ) : (
                <SettingsRow
                  label={MANAGE.leave}
                  tone="accent"
                  loading={leave.isPending}
                  onPress={() => setAskLeave(true)}
                />
              )}
            </Card>

            {/* The footnote states the boundary rather than leaving an absence
                of controls to imply it. For the owner it is the refusal itself,
                as a SENTENCE and not a disabled Leave button: the trigger's
                22023 becomes a silent refetch, so a Leave an owner could tap
                would do nothing and explain nothing. */}
            <Text variant="note" className="mt-3">
              {isOwner ? MANAGE.ownerCannotLeave : memberPermissionNote(ownerName)}
            </Text>
          </>
        )}
      </ScrollView>

      <RemoveMemberDialog
        visible={removeFor !== null}
        memberName={removeFor?.name ?? ''}
        pending={remove.isPending}
        onKeep={() => setRemoveFor(null)}
        onRemove={confirmRemove}
      />

      {/* Mounted only for a non-owner. The owner has no path to this dialog and
          therefore no path to `useLeaveCircle`. */}
      {isOwner ? null : (
        <LeaveGroupDialog
          visible={askLeave}
          groupName={groupName}
          pending={leave.isPending}
          onStay={() => setAskLeave(false)}
          onLeave={confirmLeave}
        />
      )}

      {isOwner ? (
        <DeleteGroupDialog
          visible={askDelete}
          groupName={groupName}
          memberCount={circle.data?.memberCount ?? 0}
          pending={destroy.isPending}
          onKeep={() => setAskDelete(false)}
          onDelete={confirmDelete}
        />
      ) : null}

      {terms.sheet}
    </SafeAreaView>
  );
}
