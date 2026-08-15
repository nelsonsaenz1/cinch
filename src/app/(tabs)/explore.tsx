import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Rule } from '@/components/ui/rule';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  CircledExclamationGlyph,
  HangerGlyph,
  HERO_GLYPH_INK,
  TwoPersonGlyph,
} from '@/features/explore/glyphs';
import { NewAdditionRow, NewAdditionsSkeleton } from '@/features/explore/new-addition-row';
import { useNewAdditions, type NewAddition } from '@/features/explore/queries';
import { groupByDay } from '@/features/explore/timeline';
import { useMutedIds } from '@/features/social-graph/muted';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useFollow } from '@/features/social-graph/mutations';
import { useFollowing, useFriends, useProfileSearch } from '@/features/social-graph/queries';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The Lately atlas's local grammar, where it departs from the shared kit.
 *
 * The cards here sit at 16, not the plate's 20 — a ledger line is smaller
 * furniture than an outfit plate. The outline buttons take a 22% ink edge,
 * stronger than `rule`, because they sit inside already-ruled cards; the hero
 * glyphs draw at 28% (`HERO_GLYPH_INK`, named in glyphs.tsx beside the row
 * fallback's 22%). Local constants rather than tokens: no other screen speaks
 * this dialect yet.
 */
const CARD_RADIUS = 16;
/** CX-06 — the air between `Lately` and the search field. */
const EXPLORE_SEARCH_GAP = 20;
const OUTLINE_EDGE = 'rgba(28,26,22,0.22)';

type LatelyButtonProps = {
  title: string;
  onPress: () => void;
  /** The ink fill — hero CTAs only. Everything quieter is the outline. */
  filled?: boolean;
  height?: number;
  radius?: number;
  fontSize?: number;
  paddingX?: number;
  disabled?: boolean;
};

/**
 * The atlas's button, at the atlas's sizes: 44/10 filled for the hero way
 * forward, 40/10 and 36/9 and 34/9 outlined for the quieter commitments. Not
 * the shared `Button`, whose 12pt radius and 17px label are fixed inside its
 * animated ground — this page's controls are drawn smaller than the app's
 * default hand. Press feedback, haptics and the 44pt floor (via hitSlop when
 * the drawn height is under it) match `Button` exactly.
 */
function LatelyButton({
  title,
  onPress,
  filled = false,
  height = 34,
  // `md`, per reference board A: every labelled control is 12. Was 9.
  radius = 12,
  fontSize = 13,
  paddingX = 14,
  disabled = false,
}: LatelyButtonProps) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={height < MIN_TAP_TARGET ? (MIN_TAP_TARGET - height) / 2 : undefined}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          /* haptics are best-effort; never block the action */
        });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      className={disabled ? 'opacity-40' : ''}>
      <Animated.View
        style={[
          press.style,
          {
            height,
            borderRadius: radius,
            paddingHorizontal: paddingX,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          filled
            ? { backgroundColor: theme.ink }
            : { borderWidth: 1, borderColor: OUTLINE_EDGE },
        ]}>
        {/* Filled carries the atlas's 600 through the shared Button's own
            recipe (`font-semibold`, which the type system maps to
            filled and outlined differed by weight. TY-01 removes weight from
            the product, so the fill and the label colour carry it alone. */}
        <Text
          variant={filled ? 'body' : 'label'}
          style={{
            fontSize,
            lineHeight: Math.round(fontSize * 1.3),
            color: filled ? theme.canvas : theme.ink,
          }}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type HeroProps = {
  glyph: ReactNode;
  title: string;
  body: string;
  actionTitle: string;
  onAction: () => void;
  /** True for the failed read — announced, not merely findable. */
  alert?: boolean;
};

/**
 * The full-page state: glyph, serif line, body, one filled way forward —
 * centred, where the shared `EmptyState`/`ErrorState` kit sets its states
 * hard-left. The Lately atlas centres all three of this page's heroes, so the
 * composition is local; the kit's claims discipline still governs which branch
 * renders it — an empty describes the data, an error refuses to.
 */
function Hero({ glyph, title, body, actionTitle, onAction, alert = false }: HeroProps) {
  return (
    <View
      accessibilityRole={alert ? 'alert' : 'summary'}
      className="flex-1 items-center justify-center"
      style={{ paddingHorizontal: 42 }}>
      {glyph}
      <View style={{ marginTop: 18 }}>
        <Text variant="title" trim className="text-center">
          {title}
        </Text>
      </View>
      <Text
        className="mt-2.5 text-center text-muted"
        style={{ fontSize: 15, lineHeight: 23 }}>
        {body}
      </Text>
      <View style={{ marginTop: 20 }}>
        <LatelyButton
          title={actionTitle}
          onPress={onAction}
          filled
          height={44}
          fontSize={15}
          paddingX={20}
        />
      </View>
    </View>
  );
}

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
  const terms = useSocialTermsGate();
  const { muted } = useMutedIds();

  // "Mute in Lately" — device-local, silent, reversible from the friend's
  // overflow on the Friends page. Applied here at the read edge, before the
  // day grouping and the signed-URL work, so a muted friend's rows simply
  // never exist for this page: no day header survives with only their entries
  // behind it, and the query cache keeps the server's unfiltered truth, which
  // is what makes unmuting instant. Your own pieces are never filtered — the
  // control is per-friend and you are not one.
  const entries = useMemo(
    () => (additions.data ?? []).filter((e) => e.isSelf || !muted.has(e.ownerId)),
    [additions.data, muted],
  );

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
        tintColor={theme.byline}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );

  /** What the right edge of a search result says about where things stand. */
  const searchTrailing = (profile: SocialProfile) => {
    if (friendIds.has(profile.userId)) {
      return (
        <Text variant="caption" style={{ fontSize: 12, lineHeight: 16, color: theme.faint }}>
          Friends
        </Text>
      );
    }
    if (followingIds.has(profile.userId)) {
      return (
        <Text variant="caption" style={{ fontSize: 12, lineHeight: 16, color: theme.faint }}>
          Requested
        </Text>
      );
    }
    return (
      <LatelyButton title="Add" disabled={follow.isPending} onPress={() => addFriend(profile)} />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        {/* CX-06. The "Between friends" eyebrow is gone and "Lately" is the
            sole heading. Two labels stacked on one page said the same thing
            twice — the tab is already named, and a colophon above a display
            word is a masthead explaining its own title. Only the masthead
            changed; everything below the field is untouched. */}
        <Text variant="display" trim accessibilityRole="header">
          Lately
        </Text>

        {/* The door in, and the door out of an empty page — the same field the
            Friends screen carries, in the same grammar, reading the same
            query. Duplicating the *composition* rather than extracting a
            component is deliberate: `useProfileSearch` is the shareable part
            and is shared; the field is eight lines of layout that each screen
            spaces for itself. */}
        {/* 20pt of air under the heading, on a wrapper rather than as a `mt-*`
            on the field: `Lately` is cap-trimmed, and a margin utility on the
            sibling competes with the trim's negative optical margin — the trap
            the Today floor documents. `SearchField` takes no `style`, and
            giving it one for a single caller would change a primitive four
            screens draw. */}
        <View style={{ marginTop: EXPLORE_SEARCH_GAP }}>
          <SearchField
            inputRef={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Find a friend by username"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="pb-24"
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
            <SectionHeader title="People" className="mb-2.5 mt-6" />
            <Card style={{ borderRadius: CARD_RADIUS }}>
              {search.isLoading ? (
                // The result row's own geometry — a 36pt disc and two bars —
                // so nothing jumps when the names land.
                <View className="flex-row items-center gap-3 px-4 py-3.5">
                  <Skeleton style={{ width: 36, height: 36, borderRadius: 18 }} />
                  <View className="flex-1" style={{ gap: 7 }}>
                    <Skeleton className="rounded-chip" style={{ height: 13, width: '52%' }} />
                    <Skeleton className="rounded-chip" style={{ height: 10, width: '28%' }} />
                  </View>
                </View>
              ) : search.isError ? (
                // The atlas's section-level failure: grotesque line, quiet
                // body, outlined retry — no glyph, no serif. The shared
                // `ErrorState` speaks the hero grammar; inside a ruled card
                // the failure is a sentence, not a composition. What it still
                // refuses to claim is unchanged: a failed search says nothing
                // about who is on Cinch.
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
                  style={{ fontSize: 15, lineHeight: 20, color: theme.faint }}>
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
                      {/* Set locally rather than with `ProfileRow`: the atlas
                          draws this row smaller than the app's list grammar —
                          36pt sand disc, 15px name, 12px handle — and those
                          sizes are this page's, not the Friends screen's. */}
                      <Pressable
                        accessibilityRole={opens ? 'button' : 'text'}
                        accessibilityLabel={[name, subtitle].filter(Boolean).join(', ')}
                        onPress={
                          opens
                            ? () =>
                                router.push({
                                  pathname: '/friends/[userId]',
                                  params: { userId: profile.userId },
                                })
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
                                color: theme.faint,
                              }}>
                              {subtitle}
                            </Text>
                          ) : null}
                        </View>
                        {searchTrailing(profile)}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </Card>

            <Text
              variant="noteSmall"
              className="mt-3"
              style={{ fontSize: 12, lineHeight: 18, color: theme.faint }}>
              A friendship is mutual: when they add you back, their closet opens to you and yours
              to them.
            </Text>
          </View>
        ) : additions.isError ? (
          // A failed read is not an empty circle, and must never be dressed as
          // one — this hero exists for the same distinction `ErrorState` does,
          // and claims no more than it did: the read failed, nothing moved.
          // The glyph is the circled exclamation in oxblood, not warning
          // amber — the atlas spends the accent on the one state that stops
          // the page.
          <View className="flex-1">
            <Hero
              alert
              glyph={<CircledExclamationGlyph size={34} color={theme.accent} />}
              title="Couldn’t read your circle."
              body="This didn’t load, which is a connection problem rather than a change to anyone’s closet. Nothing has moved."
              actionTitle="Try again"
              onAction={() => void additions.refetch()}
            />
          </View>
        ) : additions.isLoading ? (
          <View className="px-gutter">
            <SectionHeader title="Reading your circle" className="mb-2.5 mt-6" />
            <Card style={{ borderRadius: CARD_RADIUS }}>
              <NewAdditionsSkeleton />
            </Card>
          </View>
        ) : entries.length === 0 ? (
          // Two different absences, two different sentences, two different
          // symbols. Neither blames the user, and both name the one action
          // that changes it.
          <View className="flex-1">
            <Hero
              glyph={
                hasFriends ? (
                  <HangerGlyph size={34} color={HERO_GLYPH_INK} />
                ) : (
                  <TwoPersonGlyph size={34} color={HERO_GLYPH_INK} />
                )
              }
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
              // The atlas's card empty: no glyph, a 22px serif line, quiet
              // body, one outlined door — smaller type than the hero because
              // it shares the page with a real timeline.
              <Card
                accessibilityRole="summary"
                className="mt-6"
                style={{ borderRadius: CARD_RADIUS, paddingVertical: 20, paddingHorizontal: 18 }}>
                <Text variant="plate" style={{ fontSize: 22, lineHeight: 26 }}>
                  Just you, so far
                </Text>
                <Text className="mt-2 text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  Everything below is your own. Add a friend and their new pieces land here too — a
                  friendship is mutual, so their closet opens to you when they add you back.
                </Text>
                <View className="mt-3.5 self-start">
                  <LatelyButton
                    title="Find a friend"
                    height={40}
                    fontSize={14}
                    paddingX={16}
                    onPress={() => searchRef.current?.focus()}
                  />
                </View>
              </Card>
            ) : null}

            {groups.map((group) => (
              <View key={group.key}>
                <SectionHeader title={group.label} className="mb-2.5 mt-6" />
                <Card style={{ borderRadius: CARD_RADIUS }}>
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
                </Card>
              </View>
            ))}

            {circleLink}
          </View>
        )}
      </KeyboardAwareScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
