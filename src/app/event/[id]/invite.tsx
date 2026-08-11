import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InviteFriendRow } from '@/components/events/InviteFriendRow';
import { LeaveWithoutInvitingSheet } from '@/components/events/leave-without-inviting-sheet';
import { isSocialTermsError } from '@/features/auth/use-social-terms';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { RowSkeleton } from '@/components/ui/skeleton';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { whenLabel } from '@/components/events/EventCard';
import {
  buildInviteRows,
  everyoneAlreadyInvited,
  failedSends,
  filterInviteRows,
  partitionInviteRows,
  sendResultBody,
  sendResultTitle,
  standingSummary,
  type InviteFriend,
  type SendOutcome,
} from '@/features/events/invite-rows';
import { useInviteMembers } from '@/features/events/mutations';
import { useEvent, useEventInviteRoster } from '@/features/events/queries';
import { profileName } from '@/features/social-graph/types';
import { useFriends } from '@/features/social-graph/queries';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Invite Friends State Atlas — IF-01…IF-06.
 *
 * A batch picker over the friendship graph and nothing else: no contact
 * upload, no phone number, no directory search. Checkmarks are a draft;
 * nothing is sent until Done, and the send is reported per person, never as
 * one rolled-up error (event-social-contract.md §3).
 */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const terms = useSocialTermsGate();

  const eventQuery = useEvent(id ?? null);
  const friendsQuery = useFriends();
  const rosterQuery = useEventInviteRoster(id ?? '');
  const inviteMembers = useInviteMembers();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<SendOutcome[] | null>(null);
  const [askLeave, setAskLeave] = useState(false);

  const friends: InviteFriend[] = useMemo(
    () =>
      (friendsQuery.data ?? []).map((f) => ({
        userId: f.userId,
        name: profileName(f),
        username: f.username,
      })),
    [friendsQuery.data],
  );

  const nameByUserId = useMemo(() => {
    const map = new Map(friends.map((f) => [f.userId, f.name]));
    return (userId: string) => map.get(userId) ?? 'A friend';
  }, [friends]);

  const allRows = useMemo(
    () => buildInviteRows(friends, rosterQuery.data ?? []),
    [friends, rosterQuery.data],
  );
  const filteredRows = useMemo(() => filterInviteRows(allRows, query), [allRows, query]);
  const { alreadyInvited, yourFriends } = useMemo(
    () => partitionInviteRows(filteredRows),
    [filteredRows],
  );

  const subtitle = useMemo(() => {
    const event = eventQuery.data;
    if (!event) return '';
    return [event.occasion ?? event.title, event.startsAt ? whenLabel(event.startsAt, event.endsAt) : null]
      .filter(Boolean)
      .join(' · ');
  }, [eventQuery.data]);

  const toggle = (userId: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const closeWithoutSending = () => router.back();

  const requestClose = () => {
    if (picked.size > 0) {
      setAskLeave(true);
      return;
    }
    closeWithoutSending();
  };

  const send = () => {
    if (!id) return;
    const userIds = [...picked];
    setSending(true);
    inviteMembers.mutate(
      { eventId: id, userIds },
      {
        onSuccess: (results) => {
          // A terms refusal is not a per-person send failure — every row in
          // the batch will have hit the same gate, and reporting it as N
          // failed invitations would be inventing N different reasons for
          // one cause. Intercept once and retry the whole batch on accept.
          const gated = results.find((r) => !r.ok && isSocialTermsError(r.error));
          if (gated) {
            setSending(false);
            terms.intercept(
              gated.error,
              () => send(),
              () => setSending(false),
            );
            return;
          }
          setOutcomes(
            results.map((r) => ({ userId: r.userId, name: nameByUserId(r.userId), ok: r.ok })),
          );
          setSending(false);
        },
        onError: () => {
          setOutcomes(userIds.map((userId) => ({ userId, name: nameByUserId(userId), ok: false })));
          setSending(false);
        },
      },
    );
  };

  const retryOne = (userId: string) => {
    if (!id) return;
    inviteMembers.mutate(
      { eventId: id, userIds: [userId] },
      {
        onSuccess: (results) => {
          const [result] = results;
          if (!result) return;
          setOutcomes((prev) =>
            (prev ?? []).map((o) =>
              o.userId === userId ? { ...o, ok: result.ok } : o,
            ),
          );
        },
      },
    );
  };

  // IF-06 — no friends at all. Says the opposite of a contacts-permission
  // prompt, out loud, where that prompt would have sat.
  if (friendsQuery.isSuccess && friends.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
        <View className="flex-row items-center justify-between px-gutter pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={12}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            <Text variant="body" style={{ color: theme.muted }}>
              Cancel
            </Text>
          </Pressable>
        </View>

        <View className="px-gutter pt-3">
          <Text variant="display" trim>
            Invite friends
          </Text>
          {subtitle ? (
            <Text variant="label" className="mt-1.5">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="flex-1 items-center justify-center px-10">
          <Text variant="title" trim className="text-center">
            Nobody to invite yet
          </Text>
          <Text variant="body" className="mt-2.5 text-center" style={{ color: theme.muted }}>
            Invitations go to friends on Cinch. Add someone by their username, and once they add
            you back you can put them on the list.
          </Text>
          <Button
            title="Add a friend"
            variant="ink"
            haptic
            className="mt-5"
            onPress={() => router.push('/friends')}
          />
          <Pressable
            onPress={() => router.push('/friends')}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="mt-3.5 active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              Share your username
            </Text>
          </Pressable>
        </View>

        {/* `caption` already carries `text-muted` — real content, not
 `faint`, which fails AA on canvas. */}
        <Text
          variant="caption"
          className="px-10 text-center"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          Cinch doesn’t read your contacts, and an occasion can’t be shared as a link.
        </Text>
      </SafeAreaView>
    );
  }

  // Once every send has resolved: IF-05's "Sent" / "Partly failed" panel
  // replaces the picker. A failure lists who failed with a retry beside
  // them, never one rolled-up error.
  if (outcomes) {
    const failed = failedSends(outcomes);
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
        <View className="flex-1 items-center justify-center px-gutter">
          <View className="w-full rounded-plate border border-rule bg-surface p-5">
            <Text variant="body" className="font-semibold">
              {sendResultTitle(outcomes)}
            </Text>
            {sendResultBody(outcomes) ? (
              <Text variant="label" className="mt-1.5">
                {sendResultBody(outcomes)}
              </Text>
            ) : null}

            {failed.length > 0 ? (
              <View className="mt-3 -mx-5 border-t border-hairline">
                {failed.map((f, i) => (
                  <View
                    key={f.userId}
                    className={[
 'flex-row items-center gap-3 px-5 py-3',
                      i === failed.length - 1 ? '' : 'border-b border-hairline',
                    ].join(' ')}>
                    <View className="flex-1">
                      <Text variant="body" numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Text variant="caption" className="mt-0.5" style={{ color: theme.critical }}>
                        Couldn’t invite just now
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => retryOne(f.userId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Retry inviting ${f.name}`}
                      style={{
                        minHeight: 36,
                        borderColor: theme.ruleStrong,
                        borderWidth: 1,
                      }}
                      className="items-center justify-center rounded-md px-3.5 active:opacity-60">
                      <Text variant="label">Retry</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Button title="Done" variant="ink" haptic className="mt-5 self-stretch" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const nothingFiltered = query.trim().length > 0 && filteredRows.length === 0;
  const allInvited = query.trim().length === 0 && everyoneAlreadyInvited(allRows);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="body" style={{ color: theme.muted }}>
            Cancel
          </Text>
        </Pressable>
        {/* Present but dimmed at zero — the same target as Cancel in
            outcome, so it never disappears and moves the header around. */}
        <Pressable
          onPress={picked.size > 0 ? send : closeWithoutSending}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={12}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text
            variant="body"
            className={picked.size > 0 ? 'font-semibold' : ''}
            style={{ color: picked.size > 0 ? theme.ink : theme.byline }}>
            Done
          </Text>
        </Pressable>
      </View>

      <View className="px-gutter pt-3">
        <Text variant="display" trim>
          Invite friends
        </Text>
        {subtitle ? (
          <Text variant="label" className="mt-1.5">
            {subtitle}
          </Text>
        ) : null}
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Filter your friends"
          className="mt-3.5 h-11"
        />
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="px-gutter pb-10"
        showsVerticalScrollIndicator={false}>
        {friendsQuery.isLoading || rosterQuery.isLoading ? (
          <View className="mt-5" accessibilityLabel="Reading your friends">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton isLast />
          </View>
        ) : allInvited ? (
          // IF-03 — every friend is already on the list. No empty checkbox
          // list, no prompt to invite more people from elsewhere.
          <View className="mt-5 rounded-plate border border-rule bg-surface p-5">
            <Text variant="plate">
              {allRows.length === 1 ? 'Your one friend is in' : `All ${allRows.length} are in`}
            </Text>
            <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
              Every friend you have is on the list for this one. {standingSummary(allRows)}
            </Text>
          </View>
        ) : nothingFiltered ? (
          // IF-03 — the filter matches nobody. The way out is a link, not a
          // button: leaving this sheet loses the checkmarks.
          <View className="mt-5 items-center rounded-plate border border-rule bg-surface p-6">
            <Text variant="body" className="font-semibold text-center">
              No friend called “{query.trim()}”
            </Text>
            <Text variant="label" className="mt-2 text-center">
              You can only invite people you’re already friends with on Cinch.
            </Text>
            <Pressable
              onPress={() => router.push('/friends')}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className="mt-3 active:opacity-60">
              <Text variant="label" className="font-semibold" style={{ color: theme.accent }}>
                Add a friend
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {alreadyInvited.length > 0 ? (
              <>
                <SectionHeader
                  title="Already invited"
                  className="mb-2 mt-5"
                  trailing={<Text variant="label">{alreadyInvited.length}</Text>}
                />
                <View className="overflow-hidden rounded-plate border border-rule">
                  {alreadyInvited.map((row, i) => (
                    <InviteFriendRow
                      key={row.userId}
                      row={row}
                      selected={picked.has(row.userId)}
                      isLast={i === alreadyInvited.length - 1}
                      onToggle={() => toggle(row.userId)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {yourFriends.length > 0 ? (
              <>
                <SectionHeader
                  title="Your friends"
                  className="mb-2 mt-6"
                  trailing={<Text variant="label">{yourFriends.length}</Text>}
                />
                <View className="overflow-hidden rounded-plate border border-rule">
                  {yourFriends.map((row, i) => (
                    <InviteFriendRow
                      key={row.userId}
                      row={row}
                      selected={picked.has(row.userId)}
                      isLast={i === yourFriends.length - 1}
                      onToggle={() => toggle(row.userId)}
                    />
                  ))}
                </View>
                <Text variant="caption" className="mt-4">
                  Only friends can be invited. To add someone new, add them as a friend first.
                </Text>
              </>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>

      {picked.size > 0 ? (
        <View
          className="border-t border-hairline bg-canvas px-gutter pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Pressable
            onPress={send}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={`Invite ${picked.size} ${picked.size === 1 ? 'friend' : 'friends'}`}
            accessibilityState={{ busy: sending }}
            style={{ minHeight: 50, backgroundColor: theme.ink, opacity: sending ? 0.7 : 1 }}
            className="flex-row items-center justify-center rounded-md active:opacity-80">
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              {sending ? 'Inviting…' : `Invite ${picked.size} ${picked.size === 1 ? 'friend' : 'friends'}`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {terms.sheet}

      <LeaveWithoutInvitingSheet
        visible={askLeave}
        pickedCount={picked.size}
        onKeepChoosing={() => setAskLeave(false)}
        onDiscard={() => {
          setAskLeave(false);
          closeWithoutSending();
        }}
      />
    </SafeAreaView>
  );
}
