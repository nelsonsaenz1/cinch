import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Rule } from '@/components/ui/rule';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { LatelyButton } from '@/features/explore/lately-button';
import { useFollow } from '@/features/social-graph/mutations';
import { useFollowing, useFriends, useProfileSearch } from '@/features/social-graph/queries';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Finding people — UX-04's other half.
 *
 * Explore used to carry this as a permanent masthead block: a labelled field
 * sitting above the timeline on every visit, whether or not anybody was looking
 * for anyone. It cost roughly a fifth of the first fold to a job most sessions
 * do not have, and it pushed the thing the page is *for* — what your friends
 * have added — below the fold on the smallest iPhone. The accepted design moves
 * it here, behind an explicit search action in the header, and keeps it
 * prominent in exactly the one state where finding people IS the job: the empty
 * circle, whose hero button opens this sheet.
 *
 * Nothing about *what* can be searched changed. `useProfileSearch` reads the
 * same `social_profiles`/`public_profiles` projections it always did, under the
 * same contract, and a friendship is still mutual. The composition below —
 * 36pt disc, 15px name, 12px handle, the outlined Add — is the one Explore used
 * to draw, moved rather than redesigned.
 *
 * A sheet rather than a tab or a pushed page: this is a task you complete and
 * dismiss, which is the same argument `stylist` and `profile` already make in
 * the root layout, and it is registered there in the same dialect.
 */
export default function PeopleSearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const searchRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');

  const search = useProfileSearch(query);
  const friends = useFriends();
  const following = useFollowing();
  const follow = useFollow();
  const terms = useSocialTermsGate();

  const friendIds = new Set((friends.data ?? []).map((p) => p.userId));
  const followingIds = new Set(following.data ?? []);

  const searching = query.trim().replace(/^@/, '').length >= 2;

  const addFriend = (profile: SocialProfile) => {
    follow.mutate(
      { userId: profile.userId },
      {
        onError: (err) => {
          if (terms.intercept(err, () => addFriend(profile))) return;
          Alert.alert(
            'Could not send that request',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          );
        },
      },
    );
  };

  /** What the right edge of a result says about where things stand. */
  const trailing = (profile: SocialProfile) => {
    if (friendIds.has(profile.userId)) {
      return (
        <Text variant="caption" style={{ fontSize: 12, lineHeight: 16, color: theme.muted }}>
          Friends
        </Text>
      );
    }
    if (followingIds.has(profile.userId)) {
      return (
        <Text variant="caption" style={{ fontSize: 12, lineHeight: 16, color: theme.muted }}>
          Requested
        </Text>
      );
    }
    return (
      <LatelyButton title="Add" disabled={follow.isPending} onPress={() => addFriend(profile)} />
    );
  };

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-gutter pt-5">
        <View className="flex-row items-start justify-between gap-3">
          <Text variant="title" trim accessibilityRole="header">
            Find people
          </Text>
          {/* Cancel, not a chevron: the sheet has no page behind it to go back
              to, and iOS's own search sheets end this way. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close search"
            onPress={() => router.back()}
            hitSlop={12}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              Cancel
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 14 }}>
          <SearchField
            inputRef={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Find a friend by username"
            accessibilityLabel="Find a friend by username"
            // The sheet exists because the user asked to search; opening it
            // with the keyboard down would make them ask twice.
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        {!searching ? null : (
          <>
            <Card style={{ borderRadius: 16 }}>
              {search.isLoading ? (
                // The result row's own geometry — a 36pt disc and two bars — so
                // nothing jumps when the names land.
                <View className="flex-row items-center gap-3 px-4 py-3.5">
                  <Skeleton style={{ width: 36, height: 36, borderRadius: 18 }} />
                  <View className="flex-1" style={{ gap: 7 }}>
                    <Skeleton className="rounded-chip" style={{ height: 13, width: '52%' }} />
                    <Skeleton className="rounded-chip" style={{ height: 10, width: '28%' }} />
                  </View>
                </View>
              ) : search.isError ? (
                // What it still refuses to claim is unchanged: a failed search
                // says nothing about who is on Cinch.
                <View accessibilityRole="alert" style={{ padding: 16 }}>
                  <Text style={{ fontFamily: 'HelveticaNeue', fontSize: 15, lineHeight: 20 }}>
                    Couldn’t search just now.
                  </Text>
                  <Text
                    className="text-muted"
                    style={{ marginTop: 6, fontSize: 13, lineHeight: 20 }}>
                    This is a connection problem, not an answer about who is on Cinch.
                  </Text>
                  <View className="self-start" style={{ marginTop: 12 }}>
                    <LatelyButton
                      title="Try again"
                      height={36}
                      onPress={() => void search.refetch()}
                    />
                  </View>
                </View>
              ) : (search.data ?? []).length === 0 ? (
                // A sentence, not an empty state — the page is not empty, the
                // query is.
                <Text
                  variant="body"
                  className="px-4 py-3.5"
                  style={{ fontSize: 15, lineHeight: 20, color: theme.muted }}>
                  No one by that username.
                </Text>
              ) : (
                (search.data ?? []).map((profile, i) => {
                  const name = profileName(profile);
                  const subtitle = profile.username ? `@${profile.username}` : null;
                  const opens = friendIds.has(profile.userId);
                  return (
                    <View key={profile.userId}>
                      {i > 0 ? <Rule tone="hairline" /> : null}
                      <Pressable
                        accessibilityRole={opens ? 'button' : 'text'}
                        accessibilityLabel={[name, subtitle].filter(Boolean).join(', ')}
                        onPress={
                          opens
                            ? () => {
                                // Dismiss first: a closet pushed from inside a
                                // sheet would stack a page on top of one.
                                router.back();
                                router.push({
                                  pathname: '/friends/[userId]',
                                  params: { userId: profile.userId },
                                });
                              }
                            : undefined
                        }
                        disabled={!opens}
                        style={{ minHeight: MIN_TAP_TARGET }}
                        className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-60">
                        <Avatar name={name} size={36} imageUri={profile.avatarUrl} />
                        <View className="flex-1">
                          <Text
                            variant="body"
                            numberOfLines={1}
                            style={{ fontSize: 15, lineHeight: 20 }}>
                            {name}
                          </Text>
                          {subtitle ? (
                            <Text
                              variant="caption"
                              numberOfLines={1}
                              style={{
                                marginTop: 1,
                                fontSize: 12,
                                lineHeight: 16,
                                color: theme.muted,
                              }}>
                              {subtitle}
                            </Text>
                          ) : null}
                        </View>
                        {trailing(profile)}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </Card>

          </>
        )}
      </KeyboardAwareScrollView>

      {terms.sheet}
    </View>
  );
}
