import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupFullNotice, GroupsOfflineState, PickerRow } from '@/components/circles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import {
  CIRCLE_EVENTS,
  circleInviteBlockedProps,
  circleInviteSentProps,
} from '@/features/circles/analytics';
import { PICKER, PICKER_HINT } from '@/features/circles/copy';
import { circleInviteRows } from '@/features/circles/eligibility';
import { classifyCircleError } from '@/features/circles/errors';
import { useInviteMembers } from '@/features/circles/mutations';
import { useCircle, useCircleMembers } from '@/features/circles/queries';
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

  const [picked, setPicked] = useState<readonly string[]>([]);

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

  const rows = useMemo(
    () =>
      circleInviteRows({
        candidateIds: friendIds,
        // Membership of the friends list IS eligibility — the mutual check
        // happens once, at the invitation, exactly as the INSERT policy does it.
        mutualFriendIds: friendIds,
        members: (members.data ?? []).map((row) => ({ userId: row.userId, state: row.state })),
        selectedIds: picked,
      }),
    [friendIds, members.data, picked],
  );

  /** Every row refused for room — the cap, reached in the picker. */
  const full = rows.length > 0 && rows.every((row) => row.ineligibility === 'group_full');

  const toggle = useCallback(
    (userId: string, selectable: boolean, reason: 'group_full' | 'not_mutual' | null) => {
      if (!selectable) {
        // A refused tap is the one moment the reason is worth recording: it is
        // how "is twelve the right number" gets answered. The property is the
        // reason and nothing else — never who, never which group.
        if (reason) track(CIRCLE_EVENTS.inviteBlocked, circleInviteBlockedProps(reason));
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
    const run = () => {
      invite.mutate(
        { circleId: id, userIds: picked },
        {
          onSuccess: ({ invited }) => {
            for (let i = 0; i < invited; i += 1) {
              track(CIRCLE_EVENTS.inviteSent, circleInviteSentProps());
            }
            router.back();
          },
          onError: (error) => {
            if (terms.intercept(error, run)) return;
            const failure = classifyCircleError(error);
            if (failure.kind === 'group_full' || failure.kind === 'not_mutual') {
              // Both are already sayable on the rows themselves, and refetching
              // is what makes them appear there: the roster moved, so the seat
              // arithmetic and the eligibility both need redoing. The selection
              // is cleared because it is now a draft written against a roster
              // that no longer exists.
              setPicked([]);
            }
            void members.refetch();
            void circle.refetch();
          },
        },
      );
    };
    run();
  }, [id, picked, invite, terms, members, circle, router]);

  const loading = friends.isLoading || members.isLoading;
  const failed = friends.isError || members.isError;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={PICKER.title} backLabel={PICKER.cancel} />

      <ScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {PICKER.title}
        </Text>
        <Text variant="body" className="mt-3 text-muted" accessibilityHint={PICKER_HINT}>
          {PICKER.body}
        </Text>

        {/* PC-10, at the top of the picker — which is the whole reason the seat
            count includes outstanding invitations. Counting only members would
            push this sentence onto the twelfth person to tap Accept, who cannot
            see the cause and could not have avoided it. */}
        {full ? <GroupFullNotice /> : null}

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
          <Card className="mt-6">
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
          </Card>
        )}

        <Button
          title={PICKER.action}
          variant="primary"
          onPress={send}
          disabled={picked.length === 0 || invite.isPending}
          loading={invite.isPending}
          className="mt-8"
        />
      </ScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
