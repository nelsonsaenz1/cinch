import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedList } from '@/components/social/BlockedList';
import { ProfileRow } from '@/components/social/ProfileRow';
import { Button } from '@/components/ui/button';
// Pre-declared seam (docs/design/field-guide-audit.md, Batch 1): `RowSkeleton`
// lands alongside `Skeleton`'s export. Code against the contract.
import { RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import {
  useFollowing,
  useFriendRequests,
  useFriends,
  useProfileSearch,
} from '@/features/social-graph/queries';
import { useFollow } from '@/features/social-graph/mutations';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/** The report vocabulary Guideline 1.2 asks for, as one-tap choices. */
const REPORT_REASONS = ['Harassment', 'Inappropriate content', 'Spam', 'Impersonation', 'Other'];

/**
 * Friends — the circle, its requests, and the door in.
 *
 * The vocabulary here is deliberately "friend", never "follow": under the hood
 * a request is one follow edge and accepting is following back (the mutual
 * pair IS the friendship), but the one-way verb belongs to a public-closet
 * phase this screen predates. Requests sit above friends because they are the
 * only thing here that asks for a decision; ignoring one is doing nothing,
 * which is exactly what the product promises the sender can't detect.
 */
export default function FriendsScreen() {
  const router = useRouter();
  const theme = useTheme();
  // Profile's "Blocked users" row lands here with ?blocked=1 — same screen,
  // scrolled to the section it named rather than a fourth route.
  const { blocked: blockedParam } = useLocalSearchParams<{ blocked?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [query, setQuery] = useState('');

  const friends = useFriends();
  const requests = useFriendRequests();
  const following = useFollowing();
  const search = useProfileSearch(query);
  const follow = useFollow();
  const block = useBlockUser();
  const report = useReportContent();

  const friendIds = new Set((friends.data ?? []).map((p) => p.userId));
  const followingIds = new Set(following.data ?? []);

  const refreshing = friends.isRefetching || requests.isRefetching;
  const refresh = () => {
    void friends.refetch();
    void requests.refetch();
    void following.refetch();
  };

  const addFriend = (profile: SocialProfile) => {
    follow.mutate(
      { userId: profile.userId },
      {
        onError: (err) =>
          Alert.alert(
            'Could not send that request',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const promptReport = (profile: SocialProfile) => {
    Alert.alert('Report', `Report ${profileName(profile)}'s profile?`, [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          report.mutate(
            {
              subject: 'profile' as const,
              subjectId: profile.userId,
              subjectUserId: profile.userId,
              reason,
            },
            {
              onSuccess: () => Alert.alert('Reported', 'Thank you — we review every report.'),
              onError: (err) =>
                Alert.alert(
                  'Could not send that report',
                  err instanceof Error ? err.message : 'Something went wrong. Try again.',
                ),
            },
          ),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const promptBlock = (profile: SocialProfile) => {
    const name = profileName(profile);
    Alert.alert(
      `Block ${name}`,
      'She won’t be able to find you, message you, or see your closet — and she won’t be told. This also ends any friendship.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            block.mutate(
              { userId: profile.userId },
              {
                onError: (err) =>
                  Alert.alert(
                    'Could not block',
                    err instanceof Error ? err.message : 'Something went wrong. Try again.',
                  ),
              },
            ),
        },
      ],
    );
  };

  const requestOptions = (profile: SocialProfile) => {
    Alert.alert(profileName(profile), 'Wants to be friends.', [
      { text: 'Accept', onPress: () => addFriend(profile) },
      { text: 'Report', onPress: () => promptReport(profile) },
      { text: 'Block', style: 'destructive', onPress: () => promptBlock(profile) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /** What the right edge of a search result says about where things stand. */
  const searchTrailing = (profile: SocialProfile) => {
    if (friendIds.has(profile.userId)) {
      return <Text variant="caption" className="text-faint">Friends</Text>;
    }
    if (followingIds.has(profile.userId)) {
      return <Text variant="caption" className="text-faint">Requested</Text>;
    }
    return (
      <Button
        title="Add"
        variant="secondary"
        disabled={follow.isPending}
        haptic
        onPress={() => addFriend(profile)}
      />
    );
  };

  const searching = query.trim().replace(/^@/, '').length >= 2;
  const hasCircle = (friends.data ?? []).length > 0 || (requests.data ?? []).length > 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">Your circle</Text>
        <View style={{ width: 36 }} />
      </View>

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Friends
        </Text>

        {/* Find by username — the second door in, after invite links. */}
        <View className="mt-4 flex-row items-center gap-2 rounded-md bg-tray px-3.5">
          <SymbolView name="magnifyingglass" size={15} tintColor={theme.faint} resizeMode="scaleAspectFit" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a friend by username"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Find a friend by username"
            // 17, not 15: 15 sits off the type scale (17/16/13/11). This is a
            // free-text field, so it takes `body`'s 17px, matching the
            // precedent set by the other free-text input in the app
            // (garment-search-sheet.tsx).
            style={{ flex: 1, paddingVertical: 11, fontFamily: 'HelveticaNeue', fontSize: 17, color: theme.ink }}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerClassName="px-gutter pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onContentSizeChange={() => {
          if (blockedParam === '1') scrollRef.current?.scrollToEnd({ animated: false });
        }}>
        {searching ? (
          <>
            <Text variant="eyebrow" className="mb-2.5 mt-6">
              People
            </Text>
            <View className="overflow-hidden rounded-plate border border-rule bg-surface">
              {search.isLoading ? (
                <View className="px-4 py-3.5">
                  <RowSkeleton />
                </View>
              ) : search.isError ? (
                <View className="px-4 py-3.5">
                  <Text variant="body" className="text-critical">
                    Couldn’t search right now.
                  </Text>
                  <Button
                    title="Try again"
                    variant="ghost"
                    onPress={() => void search.refetch()}
                    className="mt-2 self-start"
                  />
                </View>
              ) : (search.data ?? []).length === 0 ? (
                <Text variant="body" className="px-4 py-3.5 text-faint">
                  No one by that username.
                </Text>
              ) : (
                (search.data ?? []).map((profile, i) => (
                  <View key={profile.userId}>
                    {i > 0 ? <View className="h-px bg-hairline" /> : null}
                    <ProfileRow
                      profile={profile}
                      subtitle={profile.username ? `@${profile.username}` : null}
                      onPress={
                        friendIds.has(profile.userId)
                          ? (p) =>
                              router.push({
                                pathname: '/friends/[userId]',
                                params: { userId: p.userId },
                              })
                          : undefined
                      }
                      trailing={searchTrailing(profile)}
                    />
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {/* A failed requests fetch used to hide the whole section — the same
            shape of bug as the empty-on-error problem, just invisible instead
            of misleading. It gets a row now, same as everything else. */}
        {(requests.data ?? []).length > 0 || requests.isError ? (
          <>
            <Text variant="eyebrow" className="mb-2.5 mt-6">
              Requests
            </Text>
            <View className="overflow-hidden rounded-plate border border-rule bg-surface">
              {requests.isError ? (
                <View className="px-4 py-3.5">
                  <Text variant="body" className="text-critical">
                    Couldn’t load your requests.
                  </Text>
                  <Button
                    title="Try again"
                    variant="ghost"
                    onPress={() => void requests.refetch()}
                    className="mt-2 self-start"
                  />
                </View>
              ) : (
                (requests.data ?? []).map((profile, i) => (
                  <View key={profile.userId}>
                    {i > 0 ? <View className="h-px bg-hairline" /> : null}
                    <ProfileRow
                      profile={profile}
                      subtitle="Wants to be friends"
                      onPress={requestOptions}
                      trailing={
                        <Button
                          title="Accept"
                          variant="secondary"
                          disabled={follow.isPending}
                          haptic
                          onPress={() => addFriend(profile)}
                        />
                      }
                    />
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        <Text variant="eyebrow" className="mb-2.5 mt-6">
          Friends
        </Text>
        <View className="overflow-hidden rounded-plate border border-rule bg-surface">
          {friends.isError ? (
            <View className="px-4 py-3.5">
              <Text variant="body" className="text-critical">
                Couldn’t load your friends. This doesn’t mean your circle is empty.
              </Text>
              <Button
                title="Try again"
                variant="ghost"
                onPress={() => void friends.refetch()}
                className="mt-2 self-start"
              />
            </View>
          ) : friends.isLoading ? (
            <View className="px-4 py-3.5">
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : (friends.data ?? []).length === 0 ? (
            <Text variant="body" className="px-4 py-3.5 text-faint">
              {hasCircle
                ? 'No friends yet — accept a request above.'
                : 'No friends yet. Search a username above; when she adds you back, her closet opens to you and yours to her.'}
            </Text>
          ) : (
            (friends.data ?? []).map((profile, i) => (
              <View key={profile.userId}>
                {i > 0 ? <View className="h-px bg-hairline" /> : null}
                <ProfileRow
                  profile={profile}
                  subtitle={profile.username ? `@${profile.username}` : null}
                  onPress={(p) =>
                    router.push({ pathname: '/friends/[userId]', params: { userId: p.userId } })
                  }
                  showsChevron
                />
              </View>
            ))
          )}
        </View>

        {/* Blocked lives at the bottom of the same page — findable (Apple asks
            that blocks be manageable) without giving the unhappy path its own
            room in the house. */}
        <Text variant="eyebrow" className="mb-2.5 mt-7">
          Blocked
        </Text>
        <View className="overflow-hidden rounded-plate border border-rule bg-surface">
          <BlockedList />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
