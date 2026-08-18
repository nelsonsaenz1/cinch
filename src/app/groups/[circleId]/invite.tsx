import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupFullNotice, GroupsOfflineState, PickerRow } from '@/components/circles';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { CIRCLE_EVENTS, circleInviteBlockedProps } from '@/features/circles/analytics';
import {
  groupSeatLine,
  PICKER,
  pickerSubtitle,
  SEND_UNAVAILABLE_FULL,
  sendInvitationsLabel,
  WRITE_FAILED,
} from '@/features/circles/copy';
import { circleInviteRows, circleSeatsRemaining, circleSeatsTaken } from '@/features/circles/eligibility';
import { routeCircleInvites } from '@/features/circles/invite-routing';
import { classifyCircleError } from '@/features/circles/errors';
import { useInviteMembers, useReInviteMember } from '@/features/circles/mutations';
import { useCircle, useCircleMembers } from '@/features/circles/queries';
import type { InviteIneligibility } from '@/features/circles/types';
import { useFriends } from '@/features/social-graph/queries';
import { profileName } from '@/features/social-graph/types';
import { track } from '@/lib/posthog';

/**
 * PC-03 — choosing who, out of the people you have both added.
 *
 * ── THE ROWS ARE DECIDED BY `circleInviteRows`, NOT HERE ────────────────────
 *
 * It drops everyone who already holds a seat, keeps everyone who is `removed`,
 * `left` or `declined` (asking them back is what makes one mis-tapped Remove
 * undoable), counts ticks against the cap so the twelfth tick is refused where
 * the owner can see the cause, and keeps a ticked row tickable so an over-full
 * selection can be undone without leaving the screen.
 *
 * ── ONE REASON, AND IT DOES NOT SAY "BLOCKED" ───────────────────────────────
 *
 * There are two ineligibilities and no third. A block permanently severs both
 * follow edges, so a blocked pair simply stop being mutual friends and the row
 * reads `not_mutual` — TRUE, SUFFICIENT, AND DISCLOSING NOTHING. This screen
 * does not branch on the difference and must not be given the ability to: a
 * branch that could tell them apart would be a block oracle, and PC-10 draws
 * exactly these two.
 *
 * ── NOTHING IS SENT UNTIL CONFIRM ───────────────────────────────────────────
 *
 * Ticks are a draft. `useInviteMembers` then sends them ONE AT A TIME, which is
 * B's deliberate design rather than an oversight: a row-level BEFORE trigger
 * cannot see the other rows of its own multi-row INSERT, so a batch could slip
 * past the seat cap. The first refusal stops the run and the invitations that
 * already landed stay landed — there is no DELETE on `circle_members` to roll
 * them back with, and there must not be.
 */
export default function InviteToGroupScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const terms = useSocialTermsGate();

  const id = circleId ?? null;
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const friends = useFriends();
  const invite = useInviteMembers();
  const reInvite = useReInviteMember();

  const [picked, setPicked] = useState<readonly string[]>([]);
  /** A refusal with no surface of its own — see `WRITE_FAILED`. */
  const [note, setNote] = useState<string | null>(null);

  const friendList = useMemo(() => friends.data ?? [], [friends.data]);
  const friendIds = useMemo(() => friendList.map((f) => f.userId), [friendList]);
  const nameFor = useMemo(() => {
    const map = new Map(friendList.map((f) => [f.userId, profileName(f)]));
    return (userId: string) => map.get(userId) ?? '';
  }, [friendList]);
  const avatarFor = useMemo(() => {
    const map = new Map(friendList.map((f) => [f.userId, f.avatarUrl ?? null]));
    return (userId: string) => map.get(userId) ?? null;
  }, [friendList]);

  /**
   * The roster in the shape both the eligibility and the routing want.
   *
   * One projection, used twice, so the rows a person sees and the writes their
   * ticks turn into can never be computed from two different readings of the
   * same roster.
   */
  const seats = useMemo(
    () => (members.data ?? []).map((row) => ({ userId: row.userId, state: row.state })),
    [members.data],
  );

  const rows = useMemo(
    () =>
      circleInviteRows({
        candidateIds: friendIds,
        // Membership of the friends list IS eligibility — the mutual check
        // happens once, at the invitation, exactly as the INSERT policy does it.
        mutualFriendIds: friendIds,
        members: seats,
        selectedIds: picked,
      }),
    [friendIds, seats, picked],
  );

  /**
   * The cap, read off the roster rather than off the drawn rows.
   *
   * It used to be "every row says group_full", which was true only by accident:
   * the picker now KEEPS the people who already hold a seat, saying "Already a
   * member" and "Invite pending", so a full group's rows are a mixture and that
   * test would have gone quietly false exactly when the notice mattered most.
   * The seats are the fact; the rows are a drawing of it.
   */
  const seatsTaken = circleSeatsTaken(seats);
  const full = circleSeatsRemaining(seats) === 0;

  const toggle = useCallback(
    (userId: string, selectable: boolean, reason: InviteIneligibility) => {
      if (!selectable) {
        // A refused tap is the one moment a reason is worth recording: it is
        // how "is twelve the right number" gets answered. The property is the
        // reason and nothing else — never who, never which group. Only the two
        // reasons that are refusals go; "Already a member" is the reader
        // tapping somebody they already asked, which measures nothing.
        if (reason === 'group_full' || reason === 'not_mutual') {
          track(CIRCLE_EVENTS.inviteBlocked, circleInviteBlockedProps(reason));
        }
        return;
      }
      setPicked((prev) =>
        prev.includes(userId) ? prev.filter((row) => row !== userId) : [...prev, userId],
      );
    },
    [],
  );

  const send = useCallback(() => {
    if (!id || picked.length === 0) return;

    /**
     * Split by the verb each row needs — `invite-routing.ts` argues why, and
     * the argument is that the other way round is silently broken forever.
     *
     * The fresh ones go in ONE `useInviteMembers` call because B loops INSIDE
     * it deliberately: a row-level BEFORE trigger cannot see the other rows of
     * its own multi-row INSERT, so the seat cap is only enforceable if the
     * client sends them one at a time, and that loop is where it happens.
     * Asking somebody back is an UPDATE and carries no such hazard, so those
     * go one call each.
     */
    const { invite: fresh, reinvite: again } = routeCircleInvites({
      selectedIds: picked,
      members: seats,
    });

    const run = async () => {
      setNote(null);
      // Fresh first, then the re-invitations. Both consume seats and the
      // picker has already refused a selection wider than the seats free, so
      // the order is not load-bearing for the cap — it is fixed only so that a
      // partial failure is the same partial failure every time.
      if (fresh.length > 0) await invite.mutateAsync({ circleId: id, userIds: fresh });
      for (const userId of again) {
        await reInvite.mutateAsync({ circleId: id, userId });
      }
      // Nothing is tracked here: `useInviteMembers` fires `circle_invite_sent`
      // per landed insert from inside its own loop, and `useReInviteMember`
      // fires `circle_member_reinvited` in its `onSuccess`. Counting again out
      // here would double every invitation in the funnel.
      router.back();
    };

    run().catch((error: unknown) => {
      if (terms.intercept(error, () => void run().catch(() => {}))) return;
      const failure = classifyCircleError(error);
      if (failure.kind === 'group_full' || failure.kind === 'not_mutual') {
        // Both are already sayable on the rows themselves, and refetching is
        // what makes them appear there: the roster moved, so the seat
        // arithmetic and the eligibility both need redoing. The selection is
        // cleared because it is now a draft written against a roster that no
        // longer exists.
        setPicked([]);
      } else if (failure.kind === 'rate_limited') {
        setNote(WRITE_FAILED.rateLimited);
      } else if (failure.kind !== 'stale') {
        setNote(WRITE_FAILED.unknown);
      }
      // `stale` stays silent and merely redraws — and after the routing above
      // it is once again only reachable as a genuine race, never as the
      // ordinary act of asking somebody back.
      void members.refetch();
      void circle.refetch();
    });
  }, [id, picked, seats, invite, reInvite, terms, members, circle, router]);

  const loading = friends.isLoading || members.isLoading;
  const failed = friends.isError || members.isError;
  const groupName = circle.data?.name ?? '';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader backLabel={PICKER.cancel} />

      <ScrollView contentContainerClassName={failed ? 'pb-24' : 'px-gutter pb-24'}>
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {PICKER.title}
        </Text>
        {/* PC-03's line under the title, and PC-10's when the room is closed.
            Two sentences for two questions: how close am I to filling it, and
            (once it is full) whose group is this and how many are in it. */}
        <Text variant="note" className="mt-2">
          {full ? groupSeatLine(groupName, seatsTaken) : pickerSubtitle(picked.length)}
        </Text>

        {/* PC-10, at the top of the picker — which is the whole reason the seat
            count includes outstanding invitations. Counting only members would
            push this sentence onto the twelfth person to tap Accept, who cannot
            see the cause and could not have avoided it. The remedy the sentence
            names is attached to it as a control, because an instruction whose
            screen the reader then has to go and find is half an instruction. */}
        {full ? (
          <GroupFullNotice
            onManage={() =>
              router.push({
                pathname: '/groups/[circleId]/manage',
                params: { circleId: id ?? '' },
              })
            }
          />
        ) : null}

        {loading ? (
          <View className="mt-6">
            <ListSkeleton count={5} />
          </View>
        ) : failed ? (
          <GroupsOfflineState
            onRetry={() => {
              void friends.refetch();
              void members.refetch();
            }}
            retrying={friends.isRefetching || members.isRefetching}
          />
        ) : (
          <>
            {/* Plates with air between them rather than rows inside one card.
                The picker deliberately KEEPS the people who cannot be chosen —
                a row that vanished would answer nobody looking for a friend who
                is not there — so the list is a mixture, and the ground is what
                makes the chooseable half findable at a glance. It is never the
                only signal: every unavailable row still prints its reason. */}
            <View className="mt-6">
              {rows.map((row) => (
                <PickerRow
                  key={row.userId}
                  name={nameFor(row.userId)}
                  avatarUrl={avatarFor(row.userId)}
                  selected={row.selected}
                  reason={row.ineligibility}
                  onToggle={() => toggle(row.userId, row.selectable, row.ineligibility)}
                />
              ))}
            </View>

            {/* PC-03 sets this UNDER the list, not over it: it explains a list
                the reader is already looking at, and above one it would be
                explaining nothing yet. The second sentence is the one people
                actually wonder about — nothing here is a suggestion. */}
            <Text variant="note" className="mt-3">
              {PICKER.body}
            </Text>
          </>
        )}

        {/* A refusal with nowhere else to sit. Above the button rather than
            below it, so it is between the reader and the control they are
            about to press again, and `Notice` is a polite live region so it is
            announced rather than silently appearing under a thumb. */}
        {note ? <Notice message={note} tone="critical" className="mt-8" /> : null}

        {/* The count is ON the control — PC-03's own label. This is the one tap
            in the flow that writes to other people's accounts, and a button
            saying only "Send" would leave the reader to remember how many rows
            they ticked. Disabled, it says WHY in the spoken label rather than
            leaving `accessibilityState.disabled` to be the whole message. */}
        <Button
          title={sendInvitationsLabel(picked.length)}
          variant="primary"
          onPress={send}
          disabled={picked.length === 0 || invite.isPending || reInvite.isPending}
          loading={invite.isPending || reInvite.isPending}
          accessibilityLabel={full ? SEND_UNAVAILABLE_FULL : sendInvitationsLabel(picked.length)}
          // A SAND SLAB WHEN THERE IS A REASON, A DIMMED PILL WHEN THERE IS NOT
          // — `button-spec.ts`'s own distinction, and PC-10 draws the first.
          // A 40% pill above a fully-opaque sentence explaining the refusal
          // reads as two different levels of switched-off; a solid ground reads
          // as a control that is simply waiting on the sentence above it. With
          // nothing ticked and no notice on screen there is no such sentence,
          // so the ordinary dim is right.
          disabledTone={full ? 'filled' : 'dim'}
          className="mt-8"
        />
      </ScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
