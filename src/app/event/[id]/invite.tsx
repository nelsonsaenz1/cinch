import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RosterRow } from '@/components/events/RosterRow';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
// Batch-1 seam: the shared states kit.
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { socialDenialCopy, useInviteMember } from '@/features/events/mutations';
import { useEventMembers, useInviteCandidates } from '@/features/events/queries';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The invite sheet. Search runs over `social_profiles` — the view already
 * limits results to people the caller is legitimately related to and screens
 * blocked pairs, so this screen adds nothing but a typeahead over it. The
 * insert is what actually invites; RLS pins every column of it to "the host,
 * inviting" and the database rate limit has the final word on volume.
 */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();

  const [search, setSearch] = useState('');
  const candidates = useInviteCandidates(search);
  const members = useEventMembers(id ?? '');
  const invite = useInviteMember();

  // Who was invited from THIS sheet, so a fresh invite reads "Invited" in
  // place rather than vanishing when the roster refetch reclassifies them.
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());

  const onList = new Set((members.data ?? []).map((m) => m.userId));

  const rows = (candidates.data ?? []).filter((p) => p.user_id !== session.userId);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={[]}>
      <View className="flex-row items-baseline justify-between px-gutter pt-6">
        <Text variant="title" trim>
          Invite friends
        </Text>
        {/* Ink, not the accent. This sheet's one oxblood action is Invite, on
            the rows; a dismiss control that shares the accent with it spends
            the colour twice on one screen against the house rule. */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={12}
          className="py-2 active:opacity-60">
          <Text variant="body" className="font-semibold">
            Done
          </Text>
        </Pressable>
      </View>

      <View className="mt-4 px-gutter">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or username"
          placeholderTextColor={theme.muted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people to invite"
          className="rounded-md border border-hairline px-3.5 py-2.5 font-body text-body text-ink dark:border-hairline-dark dark:text-ink-dark"
        />
      </View>

      {invite.isError ? (
        <Text
          variant="label"
          accessibilityLiveRegion="polite"
          className="mt-3 px-gutter text-critical dark:text-critical">
          {socialDenialCopy(invite.error) ?? 'That invite didn’t send. Try again.'}
        </Text>
      ) : null}

      <KeyboardAwareScrollView
        contentContainerClassName="px-gutter pb-10"
        showsVerticalScrollIndicator={false}>
        {candidates.isError ? (
          // A failed search is not "nobody by that name" — that sentence tells
          // a woman her friend isn't on Cinch when the network simply blinked.
          <View className="mt-6">
            <Text variant="body">That search didn’t go through</Text>
            <Text variant="caption" className="mt-1.5">
              Your friends are still there. Try again in a moment.
            </Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => void candidates.refetch()}
              className="mt-4 self-start"
            />
          </View>
        ) : candidates.isLoading ? (
          <View className="mt-4" accessibilityLabel="Searching your friends">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-row items-center gap-3 py-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <View className="flex-1">
                  <Skeleton className="h-4 w-1/2 rounded-sm" />
                  <Skeleton className="mt-1.5 h-3 w-1/3 rounded-sm" />
                </View>
              </View>
            ))}
          </View>
        ) : rows.length > 0 ? (
          <View className="mt-4">
            {rows.map((p, i) => {
              const already = onList.has(p.user_id) || justInvited.has(p.user_id);
              const sending = invite.isPending && invite.variables?.userId === p.user_id;
              return (
                <View
                  key={p.user_id}
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className={[
                    'flex-row items-center gap-3 py-2.5',
                    i === rows.length - 1 ? '' : 'border-b border-hairline dark:border-hairline-dark',
                  ].join(' ')}>
                  <Avatar name={p.display_name ?? p.username} size={32} tone="sand" />
                  <View className="flex-1">
                    <Text variant="body" numberOfLines={1}>
                      {p.display_name ?? p.username ?? 'A friend'}
                    </Text>
                    {p.username && p.display_name ? (
                      <Text variant="caption" className="text-faint dark:text-faint-dark">
                        @{p.username}
                      </Text>
                    ) : null}
                  </View>
                  {already ? (
                    <Text variant="label" className="text-faint dark:text-faint-dark">
                      Invited
                    </Text>
                  ) : sending ? (
                    <ActivityIndicator size="small" color={theme.muted} />
                  ) : (
                    <Pressable
                      onPress={() =>
                        id &&
                        invite.mutate(
                          { eventId: id, userId: p.user_id },
                          {
                            onSuccess: () =>
                              setJustInvited((prev) => new Set(prev).add(p.user_id)),
                          },
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Invite ${p.display_name ?? p.username ?? 'this friend'}`}
                      hitSlop={8}
                      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                      className="active:opacity-60">
                      <Text variant="label" className="text-accent dark:text-accent-dark">
                        Invite
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : search.trim().length >= 2 && candidates.isFetched ? (
          // Empty copy on the `EmptyState` scale (17px), not the 13px label
          // this screen used to whisper it at.
          <Text variant="body" className="mt-6 text-muted dark:text-muted-dark">
            Nobody by that name yet. Friends appear here once you’re connected
            on Cinch.
          </Text>
        ) : (
          <Text variant="body" className="mt-6 text-muted dark:text-muted-dark">
            Search your friends by name or username. Only people you invite can
            see this occasion.
          </Text>
        )}

        {(members.data ?? []).length > 0 ? (
          <>
            <Text variant="eyebrow" className="mb-1 mt-8">
              On the list
            </Text>
            {(members.data ?? []).map((m, i, list) => (
              <RosterRow
                key={m.userId}
                member={m}
                isSelf={m.userId === session.userId}
                isLast={i === list.length - 1}
              />
            ))}
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
