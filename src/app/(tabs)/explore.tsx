import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileRow } from '@/components/social/ProfileRow';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Rule } from '@/components/ui/rule';
import { RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { NewAdditionRow, NewAdditionsSkeleton } from '@/features/explore/new-addition-row';
import { useNewAdditions, type NewAddition } from '@/features/explore/queries';
import { groupByDay } from '@/features/explore/timeline';
import { useFollow } from '@/features/social-graph/mutations';
import { useFollowing, useFriends, useProfileSearch } from '@/features/social-graph/queries';
import type { SocialProfile } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/**
 * Explore — what has lately arrived in the closets you can see, and the way to
 * see more of them.
 *
 * Two jobs, one page. The timeline is the page; the search field is the door
 * out of an empty one. That ordering is the product argument for the screen
 * existing at all: a friends list tells you who you know, and this tells you
 * what they have — which is the thing worth opening the app for, and the thing
 * that makes adding a friend feel like it did something.
 *
 * **What this page is allowed to show, and why.** Everything below the search
 * field comes from `friend_items` (plus the caller's own `items`), and that
 * view is gated row-by-row on mutual friendship. So this is a *friends-only*
 * surface, deliberately: the public projections exist but require both
 * `items.is_public` and a public profile, neither of which any screen sets, and
 * opening the boundary is not something a feature branch gets to do. Nothing
 * here can surface a stranger's wardrobe, and the search results below can name
 * only the people `social_profiles` and `public_profiles` already name.
 *
 * The Plate grammar, not the feed grammar: dated headings over a ruled card of
 * catalogue lines, no counts, no likes, no square photo grid. See
 * `new-addition-row.tsx` for the reasoning on the row itself.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const theme = useTheme();
  const searchRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');

  const additions = useNewAdditions();
  const friends = useFriends();
  const following = useFollowing();
  const search = useProfileSearch(query);
  const follow = useFollow();

  const entries = useMemo(() => additions.data ?? [], [additions.data]);

  // Plates first, cutouts next, the photograph last. The storage policies allow
  // friends exactly these three derivatives and never the original.
  const { resolve } = useSignedUrls(
    entries.flatMap((e) => [e.item.platePath, e.item.cutoutPath, e.item.thumbPath]),
  );

  // Identity comes from the friends list rather than a second profile query:
  // `friend_items` and `useFriends` are gated on the same predicate, so anyone
  // who can appear in this timeline is already named there.
  const owners = useMemo(
    () => new Map((friends.data ?? []).map((p) => [p.userId, p])),
    [friends.data],
  );

  const groups = useMemo(() => groupByDay(entries, (e) => e.item.createdAt), [entries]);

  const friendIds = new Set((friends.data ?? []).map((p) => p.userId));
  const followingIds = new Set(following.data ?? []);
  const hasFriends = (friends.data ?? []).length > 0;

  const searching = query.trim().replace(/^@/, '').length >= 2;
  // All three, because `refresh` refetches all three: with `following` left
  // out, a pull whose slowest query was the follow list ended its spinner
  // while that list was still arriving — the gesture reported done before it
  // was, which is the one thing pull-to-refresh must never do.
  const refreshing =
    additions.isRefetching || friends.isRefetching || following.isRefetching;

  const refresh = () => {
    void additions.refetch();
    void friends.refetch();
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

  /** Where a garment leads: their closet, or — for your own piece — the piece. */
  const openEntry = (entry: NewAddition) => {
    if (entry.isSelf) {
      router.push({ pathname: '/item/[id]', params: { id: entry.item.id } });
      return;
    }
    router.push({ pathname: '/friends/[userId]', params: { userId: entry.ownerId } });
  };

  /**
   * The page's one standing link, written once. Requests, blocks and the full
   * friends list live on the Friends screen; this page does not duplicate
   * them, it points at them — from the foot of a full timeline and from under
   * an empty one, which used to be two copies with two different top margins.
   */
  const circleLink = (
    <Pressable
      onPress={() => router.push('/friends')}
      accessibilityRole="button"
      accessibilityLabel="Open your circle"
      className="mt-5 flex-row items-center gap-1.5 py-2 active:opacity-60">
      <Text variant="label" className="text-muted">
        Your circle
      </Text>
      <SymbolView
        name="chevron.right"
        size={11}
        tintColor={theme.faint}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );

  /** What the right edge of a search result says about where things stand. */
  const searchTrailing = (profile: SocialProfile) => {
    if (friendIds.has(profile.userId)) {
      return (
        <Text variant="caption" className="text-muted">
          Friends
        </Text>
      );
    }
    if (followingIds.has(profile.userId)) {
      return (
        <Text variant="caption" className="text-muted">
          Requested
        </Text>
      );
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

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow">Between friends</Text>
        <View style={{ marginTop: 6 }}>
          <Text variant="display" trim accessibilityRole="header">
            Lately
          </Text>
        </View>

        {/* The door in, and the door out of an empty page — the same field the
            Friends screen carries, in the same grammar, reading the same
            query. Duplicating the *composition* rather than extracting a
            component is deliberate: `useProfileSearch` is the shareable part
            and is shared; the field is eight lines of layout that each screen
            spaces for itself. */}
        <View className="mt-4 flex-row items-center gap-2 rounded-md bg-tray px-3.5">
          <SymbolView
            name="magnifyingglass"
            size={15}
            tintColor={theme.faint}
            resizeMode="scaleAspectFit"
          />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Find a friend by username"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Find a friend by username"
            // 17, matching `body` on the type scale — the precedent every
            // free-text field in the app follows.
            style={{
              flex: 1,
              paddingVertical: 11,
              fontFamily: 'HelveticaNeue',
              fontSize: 17,
              color: theme.ink,
            }}
          />
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="pb-10"
        // `flexGrow`, not `flex`: the hero empty and error states centre with
        // `flex-1`, which needs a parent of known height and silently collapses
        // to nothing inside a content-sized scroll container. Growing the
        // content container to the viewport is what lets those states keep
        // their designed composition AND keep pull-to-refresh — the alternative
        // (hoisting them out of the ScrollView) costs the refresh gesture on
        // exactly the screen where "try again" matters most.
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
        }>
        {searching ? (
          <View className="px-gutter">
            <Text variant="eyebrow" className="mb-2.5 mt-6">
              People
            </Text>
            <View className="overflow-hidden rounded-plate border border-rule bg-surface dark:border-rule-dark">
              {search.isLoading ? (
                <View className="px-4 py-3.5">
                  <RowSkeleton isLast />
                </View>
              ) : search.isError ? (
                <ErrorState
                  compact
                  title="Couldn’t search just now."
                  body="This is a connection problem, not an answer about who is on Cinch."
                  onRetry={() => void search.refetch()}
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
            </View>

            <Text variant="caption" className="mt-3 text-muted">
              A friendship is mutual: when they add you back, their closet opens to you and yours
              to them.
            </Text>
          </View>
        ) : additions.isError ? (
          // A failed read is not an empty circle, and must never be dressed as
          // one — the whole `ErrorState` exists for this distinction.
          <View className="flex-1">
            <ErrorState
              title="Couldn’t read your circle."
              body="This didn’t load, which is a connection problem rather than a change to anyone’s closet. Nothing has moved."
              onRetry={() => void additions.refetch()}
            />
          </View>
        ) : additions.isLoading ? (
          <View className="px-gutter">
            <Text variant="eyebrow" className="mb-2.5 mt-6">
              Reading your circle
            </Text>
            <View className="overflow-hidden rounded-plate border border-rule bg-surface dark:border-rule-dark">
              <NewAdditionsSkeleton />
            </View>
          </View>
        ) : entries.length === 0 ? (
          // Two different absences, two different sentences. Neither of them
          // blames the user, and both name the one action that changes it.
          <View className="flex-1">
            <EmptyState
              symbol={hasFriends ? 'tshirt' : 'person.2'}
              title={hasFriends ? 'Nothing new yet' : 'An empty page, for now'}
              body={
                hasFriends
                  ? 'Nobody in your circle has added a piece lately. When they do, it lands here — newest first, with the day it arrived.'
                  : 'This page fills with what your friends add to their closets. Find someone by username; when they add you back, their closet opens to you and yours to them.'
              }
              actionTitle={hasFriends ? 'Find more friends' : 'Find a friend'}
              onAction={() => searchRef.current?.focus()}
            />
            <View className="px-gutter">{circleLink}</View>
          </View>
        ) : (
          <View className="px-gutter">
            {/* Someone with a full closet and no friends never reaches the
                empty state below — their own additions fill the page — so the
                invitation has to travel with the timeline rather than only
                replace it. Compact, and above the first date, because it is
                the one thing on this page they haven't done yet. */}
            {!hasFriends ? (
              <View className="mt-6 overflow-hidden rounded-plate border border-rule bg-surface dark:border-rule-dark">
                <EmptyState
                  compact
                  symbol="person.2"
                  title="Just you, so far"
                  body="Everything below is your own. Add a friend and their new pieces land here too — a friendship is mutual, so their closet opens to you when they add you back."
                  actionTitle="Find a friend"
                  onAction={() => searchRef.current?.focus()}
                />
              </View>
            ) : null}

            {groups.map((group) => (
              <View key={group.key}>
                <Text variant="eyebrow" className="mb-2.5 mt-6">
                  {group.label}
                </Text>
                <View className="overflow-hidden rounded-plate border border-rule bg-surface dark:border-rule-dark">
                  {group.entries.map((entry, i) => (
                    <NewAdditionRow
                      key={entry.item.id}
                      entry={entry}
                      owner={owners.get(entry.ownerId) ?? null}
                      imageUri={resolve(
                        entry.item.platePath,
                        entry.item.cutoutPath,
                        entry.item.thumbPath,
                      )}
                      onPress={openEntry}
                      isLast={i === group.entries.length - 1}
                    />
                  ))}
                </View>
              </View>
            ))}

            {circleLink}
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
