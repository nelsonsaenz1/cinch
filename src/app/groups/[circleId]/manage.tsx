import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DeleteGroupDialog,
  GroupsOfflineState,
  LeaveGroupDialog,
  MemberRow,
  PendingInvitationRow,
  RemoveMemberDialog,
} from '@/components/circles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import {
  CIRCLE_EVENTS,
  circleDeletedProps,
  circleMembershipEndedProps,
} from '@/features/circles/analytics';
import { MANAGE, PENDING, WRITE_FAILED, invitationsWaiting } from '@/features/circles/copy';
import { classifyCircleError } from '@/features/circles/errors';
import {
  useDeleteCircle,
  useLeaveCircle,
  useRemoveMember,
} from '@/features/circles/mutations';
import { useCircle, useCircleMembers } from '@/features/circles/queries';
import { track } from '@/lib/posthog';

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
  const terms = useSocialTermsGate();

  const id = circleId ?? null;
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const remove = useRemoveMember();
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

  const groupName = circle.data?.name ?? '';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={MANAGE.heading} backLabel="Back" />

      <ScrollView contentContainerClassName="px-gutter pb-24">
        {circle.isLoading || members.isLoading ? (
          <View className="mt-6">
            <ListSkeleton count={4} />
          </View>
        ) : circle.isError || members.isError ? (
          <GroupsOfflineState onRetry={refresh} retrying={circle.isRefetching} />
        ) : (
          <>
            <Text variant="display" trim accessibilityRole="header" className="mt-3">
              {MANAGE.heading}
            </Text>

            <Card className="mt-6">
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

            {isOwner && pending.length > 0 ? (
              <View className="mt-8">
                <SectionHeader
                  title={PENDING.heading}
                  trailing={<Text variant="note">{invitationsWaiting(pending.length)}</Text>}
                />
                <Card className="mt-2.5">
                  {pending.map((member) => (
                    <PendingInvitationRow
                      key={member.userId}
                      name={member.displayName ?? ''}
                      // Withdrawing is `invited → removed` in the schema — the
                      // same write as a removal, worded differently on purpose:
                      // nothing was taken away, because nothing was accepted.
                      onWithdraw={() =>
                        setRemoveFor({ userId: member.userId, name: member.displayName ?? '' })
                      }
                    />
                  ))}
                </Card>
              </View>
            ) : null}

            {note ? <Notice message={note} tone="critical" className="mt-8" /> : null}

            <View className="mt-10">
              {isOwner ? (
                <>
                  {/* THE OWNER'S REFUSAL, AS A SENTENCE. Not a disabled Leave
                      button: the trigger's 22023 becomes a silent refetch, so a
                      Leave an owner could tap would do nothing and explain
                      nothing. This says why, and says plainly that handing the
                      group on is not a thing yet rather than implying it might
                      be. */}
                  <Text variant="body" className="text-muted">
                    {MANAGE.ownerCannotLeave}
                  </Text>
                  <Button
                    title={MANAGE.delete}
                    variant="secondary"
                    onPress={() => setAskDelete(true)}
                    loading={destroy.isPending}
                    className="mt-5"
                  />
                </>
              ) : (
                <Button
                  title={MANAGE.leave}
                  variant="secondary"
                  onPress={() => setAskLeave(true)}
                  loading={leave.isPending}
                />
              )}
            </View>
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
