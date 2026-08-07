import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedList } from '@/components/social/BlockedList';
import { ProfileRow } from '@/components/social/ProfileRow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
// Pre-declared seam (docs/design/field-guide-audit.md, Batch 1): `RowSkeleton`
// lands alongside `Skeleton`'s export. Code against the contract.
import { ListSkeleton, RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { REPORT_REASONS, useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import {
  useFollowing,
  useFriendRequests,
  useFriends,
  useProfileSearch,
} from '@/features/social-graph/queries';
import { useFollow } from '@/features/social-graph/mutations';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/**
 * Requests the recipient has waved off, kept on the device and nowhere else.
 *
 * "Not now" writes nothing to the server, and that is the whole design: the
 * screen's own docblock promises the sender cannot detect being ignored, and
 * a `declined` row or a delete would be detectable. What the recipient gets
 * back is their screen — the row goes, quietly, on this phone. Re-sending
 * after a block or an unfollow produces a new edge and a new id, so a waved
 * request never traps a genuine second approach.
 */
const DISMISSED_KEY = 'cinch.friends.dismissedRequests.v1';

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

  // Waved-off requests, read once on mount and written back on each change.
  // A read that fails leaves the set empty, which shows every request — the
  // safe direction to fail in: a request nobody can see is worse than one
  // somebody has to wave off twice.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids)) setDismissed(new Set(ids.filter((id) => typeof id === 'string')));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const dismissRequest = useCallback((userId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(userId);
      void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const friendIds = new Set((friends.data ?? []).map((p) => p.userId));
  const followingIds = new Set(following.data ?? []);
  const openRequests = (requests.data ?? []).filter((p) => !dismissed.has(p.userId));

  // All three, because `refresh` refetches all three — a pull that reports
  // done while one of its queries is still arriving is a lie about the data.
  const refreshing =
    friends.isRefetching || requests.isRefetching || following.isRefetching;
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
              // One promise, everywhere, and one the operator can keep: the
              // app used to say "reviewed within 24 hours" on two surfaces
              // and "we review every report" on two others.
              onSuccess: () => Alert.alert('Thank you', 'Every report is reviewed.'),
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
      'They won’t be able to find you, message you, or see your closet — and they won’t be told. This also ends any friendship.',
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

  /**
   * "Not now" is the option this screen was missing.
   *
   * The docblock above is right that ignoring a request is doing nothing, and
   * right that the sender must not be able to tell — but that left the
   * recipient with a row they could never clear, forever, and the only ways
   * out of it were Report and Block, which are both accusations. "Not now"
   * writes nothing to the server: it hides the row on this device and keeps
   * every promise the paragraph above makes.
   */
  const requestOptions = (profile: SocialProfile) => {
    Alert.alert(profileName(profile), 'Wants to be friends.', [
      { text: 'Accept', onPress: () => addFriend(profile) },
      { text: 'Not now', onPress: () => dismissRequest(profile.userId) },
      { text: 'Report', onPress: () => promptReport(profile) },
      { text: 'Block', style: 'destructive', onPress: () => promptBlock(profile) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /** What the right edge of a search result says about where things stand. */
  const searchTrailing = (profile: SocialProfile) => {
    if (friendIds.has(profile.userId)) {
      return <Text variant="caption" className="text-muted">Friends</Text>;
    }
    if (followingIds.has(profile.userId)) {
      return <Text variant="caption" className="text-muted">Requested</Text>;
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
      <ScreenHeader title="Your circle" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Friends
        </Text>

        {/* Find by username — the second door in, after invite links. */}
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Find a friend by username"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-4"
        />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerClassName="px-gutter pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
        }
        onContentSizeChange={() => {
          if (blockedParam === '1') scrollRef.current?.scrollToEnd({ animated: false });
        }}>
        {searching ? (
          <>
            <SectionHeader title="People" className="mb-2.5 mt-6" />
            <Card>
              {search.isLoading ? (
                <View className="px-4 py-3.5">
                  <RowSkeleton />
                </View>
              ) : search.isError ? (
                <ErrorState
                  compact
                  title="Couldn’t search just now."
                  body="This is a connection problem, not an answer about who is on Cinch."
                  onRetry={() => void search.refetch()}
                  retrying={search.isRefetching}
                />
              ) : (search.data ?? []).length === 0 ? (
                <Text variant="body" className="px-4 py-3.5 text-muted">
                  No one by that username.
                </Text>
              ) : (
                (search.data ?? []).map((profile, i) => (
                  <View key={profile.userId}>
                    {i > 0 ? <Rule tone="hairline" /> : null}
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
            </Card>
          </>
        ) : null}

        {/* A failed requests fetch used to hide the whole section — the same
            shape of bug as the empty-on-error problem, just invisible instead
            of misleading. It gets a row now, same as everything else. */}
        {openRequests.length > 0 || requests.isError ? (
          <>
            <SectionHeader title="Requests" className="mb-2.5 mt-6" />
            <Card>
              {requests.isError ? (
                <ErrorState
                  compact
                  title="Couldn’t load your requests."
                  body="This didn’t load. It doesn’t mean nobody has asked."
                  onRetry={() => void requests.refetch()}
                  retrying={requests.isRefetching}
                />
              ) : (
                openRequests.map((profile, i) => (
                  <View key={profile.userId}>
                    {i > 0 ? <Rule tone="hairline" /> : null}
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
            </Card>
          </>
        ) : null}

        <SectionHeader title="Friends" className="mb-2.5 mt-6" />
        <Card>
          {friends.isError ? (
            <ErrorState
              compact
              title="Couldn’t load your friends."
              body="This is a connection problem. It doesn’t mean your circle is empty — nothing has changed."
              onRetry={() => void friends.refetch()}
              retrying={friends.isRefetching}
            />
          ) : friends.isLoading ? (
            // The shared list skeleton, ragged-width, instead of two identical
            // bars: a column of matching bars reads as a loading graphic, a
            // ragged one reads as names about to arrive.
            <View className="-mx-gutter py-2">
              <ListSkeleton count={2} />
            </View>
          ) : (friends.data ?? []).length === 0 ? (
            <EmptyState
              compact
              symbol="person.2"
              title={hasCircle ? 'No friends yet' : 'Nobody here yet'}
              body={
                hasCircle
                  ? 'Accept a request above and your circle starts here.'
                  : 'Search a username above. A friendship is mutual: when they add you back, their closet opens to you and yours to them.'
              }
            />
          ) : (
            (friends.data ?? []).map((profile, i) => (
              <View key={profile.userId}>
                {i > 0 ? <Rule tone="hairline" /> : null}
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
        </Card>

        {/* Blocked lives at the bottom of the same page — findable (Apple asks
            that blocks be manageable) without giving the unhappy path its own
            room in the house. */}
        <SectionHeader title="Blocked" className="mb-2.5 mt-7" />
        <Card>
          <BlockedList />
        </Card>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
