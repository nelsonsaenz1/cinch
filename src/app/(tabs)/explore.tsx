import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityEntryButton } from '@/components/activity-center';
import { NobodySharingState, QuietDayState } from '@/components/daily-social';
import {
  AdditionsEndMark,
  CaughtUpMark,
  CircleErrorBand,
  CircleSheet,
  EarlierRule,
  LookEntryCard,
  LookFeedSkeleton,
  NewSinceRule,
  type CircleRow,
} from '@/components/explore';
import { Card } from '@/components/ui/card';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  DAILY_SOCIAL_EVENTS,
  dailySocialCompletedProps,
  dailySocialEmptyProps,
  dailySocialOpenedProps,
  type DailySocialState,
} from '@/features/daily-social/analytics';
import { daySubtitle } from '@/features/daily-social/copy';
import { useDailyLooks, useFriendsSharingCount } from '@/features/daily-social/queries';
import { useMyDailyReactions, useSetDailyReaction } from '@/features/daily-social/reactions';
import { useWornSharing } from '@/features/daily-social/use-worn-sharing';
import {
  resolveDailyState,
  showsLooks,
  type DailyState,
} from '@/features/daily-social/states';
import { type DailyReaction } from '@/features/daily-social/types';
import { actionTitle, EXPLORE_ROW_ACTIONS } from '@/features/explore/contextual-actions';
import {
  ADDITION_CARD_RADIUS,
  EXPLORE_COPY,
  FEED_GAP,
  newSinceLabel,
} from '@/features/explore/explore-spec';
import { circleEntries, showsCaughtUp } from '@/features/explore/feed';
import {
  CircledExclamationGlyph,
  HangerGlyph,
  HERO_GLYPH_INK,
  TwoPersonGlyph,
} from '@/features/explore/glyphs';
import { LatelyButton } from '@/features/explore/lately-button';
import { NewAdditionRow } from '@/features/explore/new-addition-row';
import { useNewAdditions } from '@/features/explore/queries';
import { groupByDay } from '@/features/explore/timeline';
import { unseenBoundaryIndex } from '@/features/explore/unseen';
import { useExploreVisit } from '@/features/explore/use-explore-unseen';
import { useMutedIds } from '@/features/social-graph/muted';
import { useFriends } from '@/features/social-graph/queries';
import { track } from '@/lib/posthog';
import { useTabVisited } from '@/lib/use-tab-visited';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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
  /**
   * Oxblood rather than ink under the hero's one control. Off by default, and
   * taken by exactly one state: the circle with nobody in it. See
   * `lately-button.tsx`'s `tone`.
   */
  accentAction?: boolean;
};

/**
 * The full-page state: glyph, serif line, body, one filled way forward.
 *
 * Hard-left on the gutter rather than centred, which is where redesign 17 puts
 * it and where the shared `EmptyState`/`ErrorState` kit already sets its own —
 * the old centring was this page's private dialect and there was never a
 * reason for it. The kit's claims discipline still governs which branch
 * renders it: an empty describes the data, an error refuses to.
 */
function Hero({
  glyph,
  title,
  body,
  actionTitle: action,
  onAction,
  alert = false,
  accentAction = false,
}: HeroProps) {
  return (
    <View accessibilityRole={alert ? 'alert' : 'summary'} className="px-gutter pt-8">
      {glyph}
      <View style={{ marginTop: 22 }}>
        <Text variant="title" trim>
          {title}
        </Text>
      </View>
      <Text className="mt-3.5 text-muted" style={{ fontSize: 17, lineHeight: 26 }}>
        {body}
      </Text>
      <View style={{ marginTop: 24 }}>
        <LatelyButton
          title={action}
          onPress={onAction}
          filled
          tone={accentAction ? 'accent' : 'ink'}
          height={56}
          fontSize={17}
          paddingX={24}
        />
      </View>
    </View>
  );
}

/**
 * EXPLORE — what your circle wore.
 *
 * ── REDESIGN 17: THE LOOKS ARE THE PAGE ─────────────────────────────────────
 *
 * The page used to be a timeline of pieces friends ADDED to their closets,
 * with the day's looks bolted above it as a section. That was backwards on the
 * unit's own terms: a look leaves after seven days and a garment in a closet
 * does not, so the perishable thing is the page and the durable thing is the
 * appendix. Redesign 17 makes each look a LARGER, PHOTO-FIRST card
 * (`LookEntryCard`), and the additions timeline becomes "Also new in your
 * circle" underneath — same query, same rows, same context menu, less
 * furniture.
 *
 * ── THE PRIVACY CONSTITUTION, UNCHANGED BY ANY OF IT ────────────────────────
 *
 * Nothing in this redesign moves a default, a visibility or a boundary:
 *
 * · **Sharing is OFF by default.** No control on this page turns anybody's
 *   sharing on; the one state whose action is about the reader (S-1b) sends
 *   them to their own switch, and the circle sheet only ever links to it.
 * · **Seven days, exactly as queried.** `useDailyLooks` decides the window;
 *   this file neither widens nor narrows it, and the ending says the number
 *   out loud so a reader knows what they have seen the whole of.
 * · **Reactions are the owner's to see.** RLS shows a reactor their own row
 *   and shows an owner the reactions on their own looks. There is no count
 *   anywhere on this page — not on a card, not in a label, not in a hint — and
 *   the control shows the reader's own state and nobody else's. There is
 *   nothing to aggregate by construction, which is what makes the absence a
 *   guarantee rather than an omission.
 * · **A hidden piece is silently absent.** The well simply does not draw, and
 *   nothing marks that it did not.
 * · **Friends only.** Everything below the masthead comes from views gated row
 *   by row on mutual friendship; the public projections require both
 *   `items.is_public` and a public profile, neither of which any screen sets.
 *   Nothing here can surface a stranger's wardrobe.
 *
 * All data flows through the hooks that already existed. No server change, no
 * new table, no new query.
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

  // Read-only, and only so the circle sheet can say "Off" beside the door to
  // the switch. Nothing on this page writes it.
  const sharing = useWornSharing();

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
  // rule does not vanish in the same commit that clears the tab dot. The
  // machinery is untouched: `unseen.ts` still proves the boundary from an
  // authoritative `created_at`, still reports nothing when it cannot, and
  // still advances only when the visit ends.
  const { boundary, dividerItemId } = useExploreVisit(entries, additions.isSuccess);

  const looks = useMemo(() => dailyLooks.data ?? [], [dailyLooks.data]);

  /**
   * Where the rule falls in the LOOK feed — the accepted
   * `feed-new-since-divider` frame.
   *
   * The same proven boundary and the same pure function the timeline has
   * always used; nothing about how a boundary is established, stored or
   * advanced changes. `unseenBoundaryIndex` returns `null` in all three cases
   * that should draw the same nothing — no boundary, nothing new, nothing old
   * — so an unproven reader sees no rule, and a rule never separates the page
   * from itself.
   */
  const lookDividerIndex = useMemo(
    () => unseenBoundaryIndex(looks, (look) => look.wornAt, boundary),
    [looks, boundary],
  );

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
   * question being whether a finite unit actually gets finished.
   */
  const [dailyEndSeen, setDailyEndSeen] = useState(false);
  const dailyBottom = useRef(0);

  /**
   * Which look's last reaction write failed.
   *
   * One id, not a set: a reader taps one chip at a time, and a page that
   * remembered every failure would keep showing a strip for a card they have
   * long since scrolled past. It clears on the next attempt, and the retry
   * replays the exact reaction that did not land.
   */
  const [reactionFailure, setReactionFailure] = useState<{
    outfitId: string;
    ownerId: string;
    reaction: DailyReaction | null;
  } | null>(null);

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
   * S-1a is not drawn by the Daily Social kit, and that is deliberate.
   *
   * A reader with no circle meets this page's own empty hero — an invitation,
   * no stranger suggestions, "Find a friend" as the way out — which is exactly
   * what §4 asks S-1a to be. Mounting a second no-circle screen above it would
   * put two of them on one page, so the day begins where a circle does.
   */
  const showsDaily = hasFriends;

  // Analytics, once the reads have settled — a state reported while loading is
  // a state nobody was ever in. No id of any kind goes with these (§5.6).
  // Gated on FOCUS as well: NativeTabs mounts this screen at launch, and
  // "opened" must mean somebody arrived (see use-tab-visited.ts).
  const visited = useTabVisited();
  const dailyReported = useRef<DailySocialState | null>(null);
  useEffect(() => {
    if (!visited || !showsDaily || dailyLoading) return;

    const reported = ANALYTICS_STATE[dailyState];
    if (dailyReported.current === reported) return;
    dailyReported.current = reported;

    track(DAILY_SOCIAL_EVENTS.opened, dailySocialOpenedProps({
      lookCount: looks.length,
      state: reported,
    }));

    const reason = EMPTY_REASON[dailyState];
    if (reason) track(DAILY_SOCIAL_EVENTS.empty, dailySocialEmptyProps(reason));
  }, [visited, showsDaily, dailyLoading, dailyState, looks.length]);

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

  const retryDaily = () => {
    void dailyLooks.refetch();
    void sharingCount.refetch();
  };

  /**
   * A reaction, and the one analytics property it may carry.
   *
   * The event is fired by the MUTATION (`useSetDailyReaction`'s `onSuccess`),
   * not here. It used to be fired in both places, which double-counted every
   * reaction in the funnel and made the only question §5.6 asks — whether the
   * fixed set of three is the right set — answerable only by halving a number
   * nobody documented. Taking a reaction back stays silent: there is no
   * `daily_social_unreacted`, because a withdrawal does not answer that
   * question either.
   *
   * The failure is caught per look so the card can offer a retry that says
   * NOTHING WAS SENT — which is true, and is the fact a reader whose tap
   * visibly undid itself actually needs.
   */
  const react = (outfitId: string, ownerId: string, reaction: DailyReaction | null) => {
    setReactionFailure(null);
    setReaction.mutate(
      { outfitId, ownerId, reaction },
      { onError: () => setReactionFailure({ outfitId, ownerId, reaction }) },
    );
  };

  const openSearch = () => router.push('/people-search');

  const [circleOpen, setCircleOpen] = useState(false);

  /**
   * The circle sheet's three doors — the accepted `friend-management-reachable`
   * frame.
   *
   * Built here rather than in the sheet because every one of them is a
   * NAVIGATION, and navigation is the route's job: the component takes rows
   * and draws them, which is what lets the frame be posed as a fixture without
   * a navigator. It is also the visible equivalent of the row menu's "Your
   * circle" action (UX-09) and the same destination.
   *
   * The search row reads "Find someone" and is labelled "Find people": the
   * visible word is the invitation, and the spoken one names the noun a reader
   * is hunting for in a rotor list. It is the same explicit action UX-04
   * replaced the permanent search field with — a job most sessions do not
   * have, one tap away instead of one fold wide.
   */
  const circleRows: CircleRow[] = [
    {
      id: 'friends',
      title: EXPLORE_COPY.circleFriends,
      accessibilityLabel: 'Open your circle',
      onPress: () => {
        setCircleOpen(false);
        router.push('/friends');
      },
    },
    {
      id: 'find',
      title: EXPLORE_COPY.circleFind,
      accessibilityLabel: 'Find people',
      accessibilityHint: 'Opens a sheet to search for friends by username',
      onPress: () => {
        setCircleOpen(false);
        openSearch();
      },
    },
    {
      id: 'sharing',
      title: EXPLORE_COPY.circleSharing,
      // Read-only, and the only state this sheet reports. Whether it is on is
      // a fact about the reader's own switch; the sheet shows it and the
      // screen behind the chevron is the only thing that can change it.
      value: sharing.data ? EXPLORE_COPY.circleSharingOn : EXPLORE_COPY.circleSharingOff,
      onPress: () => {
        setCircleOpen(false);
        router.push('/privacy/visibility');
      },
    },
  ];

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
   * THE LOOKS — the page.
   *
   * One `ScrollView`, because the unit is finite (§6): forty looks at most,
   * ending in a mark that says the week is over. Finiteness is precisely what
   * makes a scroll view still the right container, and it is why there is no
   * sentinel, no pager and no "load more" anywhere below.
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
      {dailyLoading ? (
        <View className="pt-4">
          <LookFeedSkeleton />
        </View>
      ) : dailyState === 'offline' ? (
        <View className="pt-4">
          <CircleErrorBand
            onRetry={retryDaily}
            onBack={() => router.push('/')}
            retrying={dailyLooks.isRefetching || sharingCount.isRefetching}
          />
        </View>
      ) : dailyState === 'nobody_sharing' ? (
        <NobodySharingState onOpenSharing={() => router.push('/privacy/visibility')} />
      ) : dailyState === 'quiet_day' ? (
        <QuietDayState />
      ) : showsLooks(dailyState) ? (
        <View className="pt-4" style={{ gap: FEED_GAP }}>
          {/* THE DAY'S LENGTH, ONCE, BEFORE THE CARDS.
              The atlas lists this line in its gestures table as the VISIBLE
              EQUIVALENT of scrolling to the bottom: a reader who never reaches
              the end still learns the day is finite and how finite. It counts
              LOOKS — a fact about this page — and never garments, which would
              be a measurement of what an owner chose to hide. */}
          <Text variant="note" accessibilityRole="summary">
            {daySubtitle(looks.length)}
          </Text>

          {looks.map((look, index) => {
            const owner = owners.get(look.ownerId) ?? null;
            const ownerName = owner?.displayName ?? owner?.username ?? 'A friend';
            return (
              <View key={look.outfitId} style={{ gap: FEED_GAP }}>
                {index === lookDividerIndex ? <EarlierRule /> : null}
                <LookEntryCard
                  ownerName={ownerName}
                  name={look.name}
                  wornAt={look.wornAt}
                  pieces={look.pieces.map((piece) => ({
                    itemId: piece.itemId,
                    name: piece.name,
                    imageUrl: resolve(piece.platePath, piece.cutoutPath, piece.thumbPath) ?? null,
                  }))}
                  reaction={myReactions.data?.[look.outfitId] ?? null}
                  onReact={(next) => react(look.outfitId, look.ownerId, next)}
                  reactionFailed={reactionFailure?.outfitId === look.outfitId}
                  onRetryReaction={() =>
                    reactionFailure
                      ? react(
                          reactionFailure.outfitId,
                          reactionFailure.ownerId,
                          reactionFailure.reaction,
                        )
                      : undefined
                  }
                  // "Look 1 of 4", spoken. The line above states the same count
                  // once, in words; a reader swiping card by card gets it per
                  // card because that is where an ending can be felt coming.
                  position={{ index: index + 1, total: looks.length }}
                />
              </View>
            );
          })}
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

  /** Will anything print an ending? One page, one full stop. */
  const timelineClosed = showsCaughtUp({
    isError: additions.isError,
    isLoading: additions.isLoading,
    visibleCount: entries.length,
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="display" trim accessibilityRole="header">
              Explore
            </Text>

            {/* ── THE SUPPORT EYEBROW IS GONE ────────────────────────────────
                Struck 2026-08-18 by founder order.

                "WHAT YOUR CIRCLE WORE" was a caption for the page written
                above the page. Everything under this masthead is already a
                dated run of looks with a friend's name on each one, so the
                eyebrow spent the first line of the screen restating what the
                second line demonstrates — and it did it in the loudest
                register the app has for a quiet role: uppercase, tracked out,
                sitting directly under a 40pt serif. Explore now opens on
                `Explore` and then on the looks themselves.

                `EXPLORE_COPY.support` is deliberately NOT deleted. It is still
                the day heading `features/daily-social/copy.ts` prints over a
                day's group of looks, which is the place that sentence was
                always true; `tests/cx-corrections.test.ts` still pins its
                wording there. What was removed is one RENDER of it, not the
                line. */}
          </View>

          <View className="flex-row items-center" style={{ marginRight: -11 }}>
            {/* FRIEND MANAGEMENT, REACHABLE AND NOT COMPETING.
                One control, always here, whether the page is full or empty; it
                opens three doors and no fourth (`CircleSheet`). It is not a
                permanent search field — UX-04 removed exactly that, because a
                search block on a feed page spends the first fold on a job most
                sessions do not have — and it is not a second tab. 44pt of
                pressable around 17pt of glyph, labelled, because a lone
                ellipsis tells VoiceOver nothing about what it opens. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your circle"
              accessibilityHint={EXPLORE_COPY.circleActionHint}
              onPress={() => setCircleOpen(true)}
              style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}
              className="items-center justify-center active:opacity-60">
              <SymbolView
                name="ellipsis"
                size={17}
                tintColor={theme.ink}
                resizeMode="scaleAspectFit"
              />
            </Pressable>

            {/* The Activity Center's only entry point — AC-01's spec panel.
                A PUSH from this header rather than a fifth tab, so the inbox
                cannot compete for attention with the four destinations that
                do live in the bar. It carries a boolean presence dot and never
                a number. Kept through this redesign deliberately: removing it
                would delete the Activity Center's only door, which is a
                feature decision and not a presentation one. */}
            <ActivityEntryButton />
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="pb-24"
        // `flexGrow`, not `flex`: the hero states need a parent of known
        // height and silently collapse to nothing inside a content-sized
        // scroll container. Growing the content container to the viewport is
        // what lets them keep their designed composition AND keep
        // pull-to-refresh — the alternative costs the refresh gesture on
        // exactly the screen where "try again" matters most.
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
        }>
        {/* UX-10 — the rule between what is new and what you have already seen,
            over the looks. It draws above the FIRST card, which is where the
            accepted frame puts it, and only when `unseen.ts` has proven a
            boundary and there is something on both sides of it. */}
        {showsDaily && !dailyLoading && showsLooks(dailyState) && lookDividerIndex !== null ? (
          <View className="px-gutter pt-4">
            <NewSinceRule label={newSinceLabel(boundary)} />
          </View>
        ) : null}

        {dailySection}

        {!hasFriends && !friends.isLoading ? (
          // S-1a. The copy is typed here rather than imported because this is
          // the page that ships it; `daily-social/copy.ts` keeps a transcript
          // so the contract's claims about this state can be tested beside the
          // other two emptinesses. Both must say the same words, and a test
          // asserts they do.
          <Hero
            glyph={<TwoPersonGlyph size={40} color={HERO_GLYPH_INK} />}
            title="Explore is just your people"
            body="Add a friend you already know and you’ll see what they wore — only if you’re both friends, and only if they’ve turned sharing on."
            actionTitle="Find a friend"
            onAction={openSearch}
            // Oxblood, by founder order 2026-08-18. This is the only control
            // on a page that otherwise has nothing on it, and the accent is
            // what the app spends on an action it wants taken.
            accentAction
          />
        ) : additions.isError ? (
          // A failed read is not an empty circle and must never be dressed as
          // one. This hero claims no more than `ErrorState` does: the read
          // failed, nothing moved. Oxblood, not warning amber — the timeline
          // failing while the looks loaded is the one case where the whole
          // secondary section is gone rather than merely stale.
          <View className="pt-2">
            <Hero
              alert
              glyph={<CircledExclamationGlyph size={34} color={theme.accent} />}
              title="Couldn’t reach your circle"
              body={EXPLORE_COPY.offlineBody}
              actionTitle={EXPLORE_COPY.offlineRetry}
              onAction={() => void additions.refetch()}
            />
          </View>
        ) : additions.isLoading ? (
          <View className="px-gutter">
            <SectionHeader title={EXPLORE_COPY.loadingHeading} className="mb-2.5 mt-8" />
            <Card style={{ borderRadius: ADDITION_CARD_RADIUS }}>
              <LookFeedSkeleton count={1} />
            </Card>
          </View>
        ) : entries.length === 0 ? (
          hasFriends ? (
            // Friends, but nothing added lately — and nothing to do about it.
            // Not an error, not an empty-styled apology, and no action: the
            // read succeeded and a retry would return the same nothing.
            <View className="px-gutter pt-8">
              <HangerGlyph size={28} color={HERO_GLYPH_INK} />
              <Text variant="note" className="mt-4">
                Nobody in your circle has added a piece lately.
              </Text>
            </View>
          ) : null
        ) : (
          <View className="px-gutter pt-2">
            {/* THE SECONDARY LIST — pieces friends added to their closets.
                Demoted, not deleted: it is the durable half of the circle and
                still the only place a new garment shows up, but it is not what
                the page is about. Same query, same rows, same UX-09 context
                menu, and the same day headings it always had. */}
            <SectionHeader title={EXPLORE_COPY.additionsHeading} className="mb-2.5 mt-8" />

            {groups.map((group) => (
              <View key={group.key}>
                <SectionHeader title={group.label} className="mb-2 mt-4" />
                <Card style={{ borderRadius: ADDITION_CARD_RADIUS }}>
                  {group.entries.map((entry, i) => {
                    const owner = owners.get(entry.ownerId) ?? null;
                    const ownerName = owner?.displayName ?? owner?.username ?? 'their';
                    return (
                      <View key={entry.item.id}>
                        {/* The timeline's own side of the same boundary,
                            driven by the same untouched machinery: `unseen.ts`
                            names the row the rule sits above, and the screen
                            draws it there. */}
                        {entry.item.id === dividerItemId ? (
                          <View className="px-4">
                            <EarlierRule />
                          </View>
                        ) : null}
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

            {timelineClosed ? (
              <View className="mt-8">
                <AdditionsEndMark />
              </View>
            ) : null}
          </View>
        )}

        {/* THE ENDING — one page, one full stop, and it belongs to the week.
            It prints under everything, over a page that actually loaded and
            actually has looks on it. A closure over a failed read would be a
            claim the app cannot make, and a closure over a page with nothing
            on it would be closing nothing. */}
        {showsDaily && !dailyLoading && showsLooks(dailyState) ? (
          <View className="px-gutter pt-10">
            <CaughtUpMark />
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <CircleSheet
        visible={circleOpen}
        rows={circleRows}
        onDismiss={() => setCircleOpen(false)}
      />
    </SafeAreaView>
  );
}
