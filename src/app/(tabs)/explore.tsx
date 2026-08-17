import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityEntryButton } from '@/components/activity-center';
import { Card } from '@/components/ui/card';
import {
  CaughtUpLine,
  DailyLookSkeleton,
  DailyOfflineState,
  LookCard,
  NobodySharingState,
  QuietDayState,
} from '@/components/daily-social';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  DAILY_SOCIAL_EVENTS,
  dailySocialCompletedProps,
  dailySocialEmptyProps,
  dailySocialOpenedProps,
  dailySocialReactedProps,
  type DailySocialState,
} from '@/features/daily-social/analytics';
import { DAY_HEADING, daySubtitle } from '@/features/daily-social/copy';
import { useDailyLooks, useFriendsSharingCount } from '@/features/daily-social/queries';
import { useMyDailyReactions, useSetDailyReaction } from '@/features/daily-social/reactions';
import {
  resolveDailyState,
  showsCaughtUpLine,
  showsLooks,
  type DailyState,
} from '@/features/daily-social/states';
import { type DailyReaction } from '@/features/daily-social/types';
import { actionTitle, EXPLORE_ROW_ACTIONS } from '@/features/explore/contextual-actions';
import { CAUGHT_UP_LINE, circleEntries, showsCaughtUp } from '@/features/explore/feed';
import {
  CircledExclamationGlyph,
  HangerGlyph,
  HERO_GLYPH_INK,
  TwoPersonGlyph,
} from '@/features/explore/glyphs';
import { LatelyButton } from '@/features/explore/lately-button';
import { NewAdditionRow, NewAdditionsSkeleton } from '@/features/explore/new-addition-row';
import { useNewAdditions } from '@/features/explore/queries';
import { groupByDay } from '@/features/explore/timeline';
import { useExploreVisit } from '@/features/explore/use-explore-unseen';
import { useMutedIds } from '@/features/social-graph/muted';
import { useFriends } from '@/features/social-graph/queries';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The Lately atlas's local grammar, where it departs from the shared kit.
 *
 * The cards here sit at 16, not the plate's 20 — a ledger line is smaller
 * furniture than an outfit plate. The hero glyphs draw at 28%
 * (`HERO_GLYPH_INK`, named in glyphs.tsx beside the row fallback's 22%). Local
 * constants rather than tokens: no other screen speaks this dialect yet.
 */
const CARD_RADIUS = 16;

/**
 * The state map's names, in the taxonomy's names.
 *
 * `states.ts` speaks in what a state MEANS (`nobody_sharing`) because that is
 * what makes a resolver readable; §5.6 fixed the analytics property as `S-1a`…
 * `S-5` before the resolver existed. Translating here, once, beats either file
 * bending to the other — and beats a screen inventing a third spelling.
 */
const ANALYTICS_STATE: Record<DailyState, DailySocialState> = {
  no_circle: 'S-1a',
  nobody_sharing: 'S-1b',
  quiet_day: 'S-2',
  the_day: 'S-3',
  caught_up: 'S-4',
  offline: 'S-5',
};

/**
 * Which emptinesses are worth a second event, and which is not one.
 *
 * `daily_social_empty` exists to separate three absences that look identical in
 * a funnel: nobody to follow, nobody sharing, and a day where nothing happened.
 * Only one of the three is a content problem. A failed read is not an emptiness
 * at all and deliberately fires nothing here — counting it as one is how an
 * outage comes to read as churn.
 */
const EMPTY_REASON: Partial<Record<DailyState, 'no_friends' | 'nobody_sharing' | 'quiet_day'>> = {
  no_circle: 'no_friends',
  nobody_sharing: 'nobody_sharing',
  quiet_day: 'quiet_day',
};

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
function Hero({ glyph, title, body, actionTitle: action, onAction, alert = false }: HeroProps) {
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
      <Text className="mt-2.5 text-center text-muted" style={{ fontSize: 15, lineHeight: 23 }}>
        {body}
      </Text>
      <View style={{ marginTop: 20 }}>
        <LatelyButton
          title={action}
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
 * UX-10 — the rule between what is new and what you have already seen.
 *
 * A rule with a word on it, not a coloured pill: the boundary is a fact about
 * your last visit, not an alert. It only ever draws when both sides of it
 * exist, which `unseenBoundaryIndex` decides — see `unseen.ts` for why a
 * divider above the first row, or below the last, is nothing worth drawing.
 */
function NewSinceRule() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="New since your last visit, above this line"
      className="flex-row items-center gap-2.5 px-4 py-2.5">
      <View className="h-hair flex-1" style={{ backgroundColor: theme.rule }} />
      <Text variant="colophon" style={{ color: theme.muted, letterSpacing: 1.2 }}>
        Earlier
      </Text>
      <View className="h-hair flex-1" style={{ backgroundColor: theme.rule }} />
    </View>
  );
}

/**
 * Explore — what has lately arrived in the closets you can see.
 *
 * **Feed-first (UX-04).** The timeline is the page. Username search used to sit
 * permanently above it, costing the first fold to a job most sessions do not
 * have; it is now an explicit action in the header and a dedicated sheet
 * (`people-search.tsx`), still the hero button of the empty state, where
 * finding people genuinely is the job.
 *
 * **What this page is allowed to show, and why.** Everything below the masthead
 * comes from `friend_items`, and that view is gated row-by-row on mutual
 * friendship. So this is a *friends-only* surface, deliberately: the public
 * projections exist but require both `items.is_public` and a public profile,
 * neither of which any screen sets, and opening the boundary is not something a
 * feature branch gets to do. Nothing here can surface a stranger's wardrobe.
 *
 * The query still returns the caller's own recent pieces — that contract is
 * untouched — and `circleEntries` drops them here, at the existing `isSelf`
 * seam (Variant A). See `feed.ts` for why a page whose one honest sentence is
 * "New in your circle" may not be half your own uploads.
 *
 * The Plate grammar, not the feed grammar: dated headings over a ruled card of
 * catalogue lines, no counts, no likes, no square photo grid, and — UX-10 — an
 * ending. See `new-addition-row.tsx` for the reasoning on the row itself.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const theme = useTheme();

  const additions = useNewAdditions();
  const friends = useFriends();
  const { muted, isMuted, setMuted } = useMutedIds();

  // The day. Three reads, none of which the additions timeline waits on — a
  // slow friend-worn query must never hold up the page's existing content, and
  // a failed one resolves to S-5 inside its own section rather than taking the
  // page with it.
  const dailyLooks = useDailyLooks();
  const sharingCount = useFriendsSharingCount();
  const myReactions = useMyDailyReactions();
  const setReaction = useSetDailyReaction();

  // Variant A plus the device-local mute, both at the read edge — before the
  // day grouping and the signed-URL work, so a hidden row simply never exists
  // for this page: no day header survives with only its entries behind it, and
  // the query cache keeps the server's unfiltered truth, which is what makes
  // unmuting instant.
  const entries = useMemo(
    () => circleEntries(additions.data ?? [], muted),
    [additions.data, muted],
  );

  // UX-10 — the boundary this visit renders against, frozen on arrival so the
  // rule does not vanish in the same commit that clears the tab dot.
  const { dividerItemId } = useExploreVisit(entries, additions.isSuccess);

  const looks = useMemo(() => dailyLooks.data ?? [], [dailyLooks.data]);

  // Plates first, cutouts next, the photograph last. The storage policies allow
  // friends exactly these three derivatives and never the original.
  //
  // The day's pieces sign in the SAME pass as the timeline's. Two `useSignedUrls`
  // calls would mean two batches over the same bucket, and the collage and the
  // ledger line below it routinely draw the same garment — one list means one
  // signature per path either way.
  const { resolve } = useSignedUrls([
    ...entries.flatMap((e) => [e.item.platePath, e.item.cutoutPath, e.item.thumbPath]),
    ...looks.flatMap((look) =>
      look.pieces.flatMap((piece) => [piece.platePath, piece.cutoutPath, piece.thumbPath]),
    ),
  ]);

  // Identity comes from the friends list rather than a second profile query:
  // `friend_items` and `useFriends` are gated on the same predicate, so anyone
  // who can appear in this timeline is already named there.
  const owners = useMemo(
    () => new Map((friends.data ?? []).map((p) => [p.userId, p])),
    [friends.data],
  );

  const groups = useMemo(() => groupByDay(entries, (e) => e.item.createdAt), [entries]);

  const hasFriends = (friends.data ?? []).length > 0;

  /**
   * S-3 → S-4, measured rather than assumed.
   *
   * "Reached the end" is a fact about the reader, not the data, and hardcoding
   * it true would make `daily_social_completed` answer its own question — the
   * question being whether a finite unit actually gets finished. The day sits
   * at the top of the page, so its end is inside the first viewport whenever it
   * is short, and this is true on the first layout for those readers, which is
   * correct: they have seen the end.
   */
  const [dailyEndSeen, setDailyEndSeen] = useState(false);
  const dailyBottom = useRef(0);

  const dailyFailed = dailyLooks.isError || sharingCount.isError;
  const dailyLoading = dailyLooks.isLoading || sharingCount.isLoading || friends.isLoading;

  const dailyState = resolveDailyState({
    friendCount: (friends.data ?? []).length,
    sharingFriendCount: sharingCount.data ?? 0,
    lookCount: looks.length,
    failed: dailyFailed,
    reachedEnd: dailyEndSeen,
  });

  /**
   * S-1a is not drawn here, and that is deliberate.
   *
   * A reader with no circle already meets this page's own empty hero — an
   * invitation, no stranger suggestions, "Find a friend" as the way out — which
   * is exactly what §4 asks S-1a to be, and it shipped before this unit existed.
   * Mounting a second no-circle screen above it would put two of them on one
   * page, so the day begins where a circle does.
   */
  const showsDaily = hasFriends;

  // Analytics, once the reads have settled — a state reported while loading is
  // a state nobody was ever in. No id of any kind goes with these (§5.6).
  const dailyReported = useRef<DailySocialState | null>(null);
  useEffect(() => {
    if (!showsDaily || dailyLoading) return;

    const reported = ANALYTICS_STATE[dailyState];
    if (dailyReported.current === reported) return;
    dailyReported.current = reported;

    track(DAILY_SOCIAL_EVENTS.opened, dailySocialOpenedProps({
      lookCount: looks.length,
      state: reported,
    }));

    const reason = EMPTY_REASON[dailyState];
    if (reason) track(DAILY_SOCIAL_EVENTS.empty, dailySocialEmptyProps(reason));
  }, [showsDaily, dailyLoading, dailyState, looks.length]);

  useEffect(() => {
    if (!dailyEndSeen || looks.length === 0) return;
    track(
      DAILY_SOCIAL_EVENTS.completed,
      dailySocialCompletedProps({ itemsSeen: looks.length, reachedEnd: true }),
    );
  }, [dailyEndSeen, looks.length]);

  // Both, because `refresh` refetches both: with one left out, a pull whose
  // slowest query was the friends list ended its spinner while that list was
  // still arriving — the gesture reported done before it was, which is the one
  // thing pull-to-refresh must never do.
  //
  // The day joins on the same terms, for the same reason.
  const refreshing =
    additions.isRefetching ||
    friends.isRefetching ||
    dailyLooks.isRefetching ||
    sharingCount.isRefetching;

  const refresh = () => {
    void additions.refetch();
    void friends.refetch();
    void dailyLooks.refetch();
    void sharingCount.refetch();
  };

  /**
   * A reaction, and the one analytics property it may carry.
   *
   * `dailySocialReactedProps` takes the reaction and nothing else — not who
   * gave it, not who received it, not which look. Taking it back fires nothing:
   * there is no `daily_social_unreacted`, because the question §5.6 asks is
   * whether the fixed set of three is the right set, and a withdrawal does not
   * answer it.
   */
  const react = (outfitId: string, ownerId: string, reaction: DailyReaction | null) => {
    setReaction.mutate({ outfitId, ownerId, reaction });
    if (reaction) track(DAILY_SOCIAL_EVENTS.reacted, dailySocialReactedProps(reaction));
  };

  const openSearch = () => router.push('/people-search');

  /**
   * The page's one standing link, written once. Requests, blocks and the full
   * friends list live on the Friends screen; this page does not duplicate
   * them, it points at them — and it is the visible equivalent of the row
   * menu's "Your circle" action (UX-09).
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

  /**
   * UX-09 — the row's context menu, built from the inventory in
   * `contextual-actions.ts` so that "every action is also available visibly"
   * is a tested claim rather than a hopeful one. Nothing destructive: unfriend,
   * block and report keep their confirmations behind the friend's own overflow
   * sheet, where a mis-registered long press cannot reach them.
   */
  const rowMenu = (ownerId: string, ownerName: string) =>
    EXPLORE_ROW_ACTIONS.map((action) => {
      const title = actionTitle(action.id, { ownerName, isMuted: isMuted(ownerId) });
      const onPress = () => {
        if (action.id === 'open-closet') {
          router.push({ pathname: '/friends/[userId]', params: { userId: ownerId } });
        } else if (action.id === 'mute') {
          setMuted(ownerId, !isMuted(ownerId));
        } else if (action.id === 'circle') {
          router.push('/friends');
        }
      };
      return (
        <Link.MenuAction key={action.id} icon={action.icon} onPress={onPress}>
          {title}
        </Link.MenuAction>
      );
    });

  /**
   * THE DAY — S-1b, S-2, S-3, S-4 and S-5, above the timeline that was already
   * here.
   *
   * It sits at the top because it is the perishable half of the page: a look
   * leaves after seven days and a new piece in a closet does not, so the thing
   * with a deadline goes first. It stays inside the one `ScrollView` because
   * the unit is finite (§6) — forty looks at most, ending in a line that says
   * so — and finiteness is precisely what makes a scroll view still the right
   * container.
   *
   * The section never draws a spinner over content it already has: `looks` is
   * whatever the last successful read returned, so a refetch leaves the day on
   * screen and only the pull-to-refresh control moves.
   */
  const dailySection = !showsDaily ? null : (
    <View
      className="px-gutter"
      onLayout={(e) => {
        dailyBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
      }}>
      <View className="mb-2.5 mt-6">
        <SectionHeader title={DAY_HEADING} />

        {/* THE DAY, AND THE FACT THAT IT ENDS — the atlas's "Wednesday · four
            looks, then done".

            The atlas lists this line in its gestures table as the VISIBLE
            EQUIVALENT of scrolling to the bottom: a reader who never reaches
            the end still learns the day is finite and how finite, which is the
            same promise the closure line keeps below, made where it is cheaper
            to act on. It prints only over a loaded day that has looks in it —
            over a quiet day or a failed read it would be counting something
            that is not there, and both of those states already say what they
            are in their own words. */}
        {!dailyLoading && showsLooks(dailyState) ? (
          <Text variant="note" className="mt-1.5">
            {daySubtitle(looks.length)}
          </Text>
        ) : null}
      </View>

      {dailyLoading ? (
        <Card style={{ borderRadius: CARD_RADIUS }}>
          <DailyLookSkeleton />
        </Card>
      ) : dailyState === 'offline' ? (
        <DailyOfflineState
          onRetry={() => {
            void dailyLooks.refetch();
            void sharingCount.refetch();
          }}
          retrying={dailyLooks.isRefetching || sharingCount.isRefetching}
        />
      ) : dailyState === 'nobody_sharing' ? (
        <NobodySharingState onOpenSharing={() => router.push('/privacy/visibility')} />
      ) : dailyState === 'quiet_day' ? (
        <QuietDayState />
      ) : showsLooks(dailyState) ? (
        <View>
          {looks.map((look, index) => {
            const owner = owners.get(look.ownerId) ?? null;
            return (
              <View key={look.outfitId} className="mb-4">
                <LookCard
                  ownerName={owner?.displayName ?? owner?.username ?? 'A friend'}
                  name={look.name}
                  wornAt={look.wornAt}
                  pieces={look.pieces.map((piece) => ({
                    itemId: piece.itemId,
                    name: piece.name,
                    imageUrl: resolve(piece.platePath, piece.cutoutPath, piece.thumbPath) ?? null,
                  }))}
                  reaction={myReactions.data?.[look.outfitId] ?? null}
                  onReact={(next) => react(look.outfitId, look.ownerId, next)}
                  // "Look 1 of 4", spoken. The subtitle above states the same
                  // count once, in words; a reader swiping card by card gets it
                  // per card because that is where an ending can be felt coming.
                  position={{ index: index + 1, total: looks.length }}
                />
              </View>
            );
          })}

          {showsCaughtUpLine(dailyState) ? <CaughtUpLine /> : null}
        </View>
      ) : null}
    </View>
  );

  /**
   * Has the reader seen the bottom of the day?
   *
   * Cheap by design: a ref for the measurement, one boolean of state, and the
   * comparison stops mattering the moment it is true. Nothing re-renders on
   * scroll after that.
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dailyEndSeen || !showsDaily || looks.length === 0) return;
    const { contentOffset, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= dailyBottom.current) setDailyEndSeen(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="display" trim accessibilityRole="header">
              Explore
            </Text>

            {/* UX-04's copy correction. "Looks and ideas to try" described a
                curation surface this app does not have and will not build —
                these are the pieces friends added to their own closets, and
                nothing about them was chosen, styled or recommended for you.
                The support line rides in a wrapper with a `marginTop`, not an
                `mt-*` class: `Explore` is cap-trimmed, and a margin utility on
                the sibling competes with the trim's negative optical margin. */}
            <View style={{ marginTop: 6 }}>
              <Text variant="note">New in your circle.</Text>
            </View>
          </View>

          <View className="flex-row items-center" style={{ marginRight: -11 }}>
            {/* The door out of an empty page, and the way to grow a full one —
                an explicit action rather than a permanent field. 44pt of
                pressable around 17pt of glyph, labelled, because a lone
                magnifying glass tells VoiceOver nothing about what it searches. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find people"
              accessibilityHint="Opens a sheet to search for friends by username"
              onPress={openSearch}
              style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}
              className="items-center justify-center active:opacity-60">
              <SymbolView
                name="magnifyingglass"
                size={17}
                tintColor={theme.ink}
                resizeMode="scaleAspectFit"
              />
            </Pressable>

            {/* The Activity Center's only entry point — AC-01's spec panel.
                A PUSH from this header rather than a fifth tab, so the inbox
                cannot compete for attention with the four destinations that
                do live in the bar (ACTIVITY-CENTER-IMPLEMENTATION.md §13). It
                carries a boolean presence dot and never a number; see
                `components/activity-center/entry-button.tsx`. */}
            <ActivityEntryButton />
          </View>
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
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
        }>
        {dailySection}

        {additions.isError ? (
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
          // Three different absences, told apart. Someone with friends whose
          // circle is quiet is not someone with no friends, and neither is
          // someone who has muted everyone who posts. None blames the user, and
          // each names the one action that changes it.
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
              onAction={openSearch}
            />
            <View className="px-gutter">{circleLink}</View>
          </View>
        ) : (
          <View className="px-gutter">
            {groups.map((group) => (
              <View key={group.key}>
                <SectionHeader title={group.label} className="mb-2.5 mt-6" />
                <Card style={{ borderRadius: CARD_RADIUS }}>
                  {group.entries.map((entry, i) => {
                    const owner = owners.get(entry.ownerId) ?? null;
                    const ownerName = owner?.displayName ?? owner?.username ?? 'their';
                    return (
                      <View key={entry.item.id}>
                        {entry.item.id === dividerItemId ? <NewSinceRule /> : null}
                        <NewAdditionRow
                          entry={entry}
                          owner={owner}
                          imageUri={resolve(
                            entry.item.platePath,
                            entry.item.cutoutPath,
                            entry.item.thumbPath,
                          )}
                          href={{
                            pathname: '/friends/[userId]',
                            params: { userId: entry.ownerId },
                          }}
                          menu={rowMenu(entry.ownerId, ownerName)}
                          isLast={i === group.entries.length - 1}
                        />
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}

            {/* UX-10 — the ending. Explore stops, and says so. */}
            {showsCaughtUp({
              isError: additions.isError,
              isLoading: additions.isLoading,
              visibleCount: entries.length,
            }) ? (
              <Text
                accessibilityRole="summary"
                variant="noteSmall"
                className="mt-6 text-center"
                style={{ fontSize: 13, lineHeight: 18, color: theme.muted }}>
                {CAUGHT_UP_LINE}
              </Text>
            ) : null}

            <View className="items-center">{circleLink}</View>
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
