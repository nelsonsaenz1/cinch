import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
    RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  ReduceMotion,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapacityNote } from '@/components/today/capacity-note';
import { ClosetFloor } from '@/components/today/closet-floor';
import { TasteRow, type TasteState } from '@/components/today/taste-row';
import { PlateDots, TodayPlate, WornMark } from '@/components/today/today-plate';
import {
  DEFAULT_CONTEXT,
  TODAY_COPY,
  belowActivationFloor,
  engineFormality,
  engineOccasion,
  daysUntilIso,
  isThinWardrobe,
  MASTHEAD_COLLAPSE_DISTANCE,
  MASTHEAD_GREETING_FADE_TO,
  MASTHEAD_GREETING_RISE,
  pageFromOffset,
  piecesLine,
  piecesRemaining,
  positionLabel,
  resolveWeather,
  tripAhead,
  tripAheadLine,
  type PlateIndex,
  type TodayContextChoice,
} from '@/features/today/today-spec';
import {
  TODAY_EVENTS,
  closetFloorShownProps,
  favoriteSetProps,
  noViableCombinationProps,
  outfitsSourceProps,
  plateViewedProps,
  ratingSetProps,
  repeatExhaustedProps,
  todayOpenedProps,
  wearResultProps,
  wearStartedProps,
  weatherStateProps,
} from '@/features/today/analytics';
import { contextLines, contextRungs, feelsClause } from '@/components/today/context-label';
import { GapCard } from '@/components/today/gap-card';
import { InviteLine } from '@/components/today/invite-line';
import { OccasionInterrupt } from '@/components/today/occasion-interrupt';
import { OFFLINE_ACTIONS_REASON, OfflineNotice } from '@/components/today/offline-notice';
import { PlateSkeleton, SLOW_NOTICE_MS, SlowNotice } from '@/components/today/plate-skeleton';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { AX3_FONT_SCALE } from '@/theme/type-scale';
import { RepeatExhausted } from '@/components/today/repeat-exhausted';
import { TasteMark } from '@/components/today/taste-mark';
import { TodayUpsell } from '@/components/today/upsell-bubble';
import { WeatherStrip } from '@/components/today/weather-strip';
import { WearConfirmationSheet } from '@/components/today/wear-confirmation-sheet';
import { tasteSignal } from '@/features/today/wear-confirm-spec';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { rankGaps, tallyOf } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { startTagSweeper } from '@/features/ingest/upload-queue';
import { Placement } from '@/features/billing/placements';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { PLANS } from '@/features/billing/plans';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { useUnwearEntry } from '@/features/diary/mutations';
import { useMyEvents } from '@/features/events/queries';
import { useAllTrips } from '@/features/plan/use-trips';
import { useReactToOutfit, useWearOutfit } from '@/features/styling/mutations';
import {
  classifyWearFailure,
  wearFailureCopy,
  type WearFailureKind,
} from '@/features/styling/wear-failure';
import { exhaustionProgress, wearsOfCore } from '@/features/styling/repeat';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { useOutfits, type StyledOutfit } from '@/features/styling/use-outfits';
import { nameOutfits } from '@/features/styling/outfit-names';
import { useWornOutfits } from '@/features/styling/use-worn-outfits';
import { useHasUnseenActivity } from '@/features/activity/queries';
import {
  DEFAULT_WEIGHTS,
  EMPTY_AFFINITIES,
  explain,
  targetWarmth,
  type Garment,
  type OutfitCandidate,
  type WeatherContext,
} from '@/lib/styling';
import { describeWeather, formatTemp, weatherSymbol } from '@/features/context/weather';
import { useTripReminder } from '@/features/today/use-trip-reminder';
import { track, trackOnce } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';
import { useTabVisited } from '@/lib/use-tab-visited';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/**
 * The page margin, in points — `tailwind.config.js`'s `gutter` as a number the
 * carousel's paging maths can actually add up. The class and the constant are
 * the same twenty; a card that snapped to a different one would come to rest
 * between two pages, which is the drift that reads as a broken swipe.
 */
const GUTTER = 20;

/**
 * The Repeat's local fallback naming for a "show me another" swap.
 *
 * `useOutfits`'s own `fromEngine` does exactly this and is not exported, so
 * this is a deliberate, minimal duplicate of its naming rule rather than a
 * reach into a private helper — same fallback name ("From your closet"), same
 * `explain()` call, no AI re-rank (a local swap is instant; waiting fifteen
 * seconds for a name defeats the point of "show me another").
 */
function localStyledOutfit(candidate: OutfitCandidate, context: Parameters<typeof nameOutfits>[1]): StyledOutfit {
  return {
    candidate,
    name: nameOutfits([candidate], context).values().next().value ?? 'The Everyday Edit',
    reasoning: explain(candidate),
    swapNote: null,
    source: 'engine',
  };
}

/** Stable identity for a candidate: the exact set of garments in it. */
const idOf = (items: { id: string }[]) => items.map((g) => g.id).join('.');

/**
 * The masthead date line — "Tue 5 Aug · Denver": weekday, day, month, place.
 * The place is the reverse-geocoded city from the device's own position, never
 * a constant; it reads as the fallback city only when location is off, and the
 * strip below says so and offers to turn it on.
 */
export function dayLine(city: string, now: Date = new Date()) {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${now.getDate()} ${month} · ${city}`;
}

/**
 * "Last synced 8:12am" — when the app last actually reached the server.
 *
 * The timestamp is the closet query's own `dataUpdatedAt`: the moment its last
 * *successful* fetch landed, carried across cold starts by the persister. It is
 * never a render clock and never a guess, so it stays truthful on a device that
 * has been offline for a day — which is why it names the weekday once the sync
 * is no longer today's. With no successful fetch ever recorded there is no time
 * to print, and the line simply doesn't claim one.
 */
export function syncedLine(updatedAt: number): string {
  if (!updatedAt) return 'Last synced';

  const at = new Date(updatedAt);
  const time = at
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();

  const sameDay = at.toDateString() === new Date().toDateString();
  return sameDay
    ? `Last synced ${time}`
    : `Last synced ${at.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
}

/**
 * A greeting that is honest about the hour, not always "morning", and about who
 * it is greeting — the name is appended only when the account actually carries
 * one. An invented "Mara" is worse than no name at all.
 */
function greetingForNow(name?: string | null, now: Date = new Date()) {
  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${greeting}, ${name}` : greeting;
}

/**
 * The first name on the account, or null.
 *
 * Read from the session already persisted in storage — the same object the auth
 * gate is holding — so this costs no request. `full_name` is what Apple Sign In
 * writes at first login; accounts created any other way usually have nothing
 * here, and then the greeting simply stays impersonal rather than guessing at a
 * name from an email address.
 */
function useFirstName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const meta = (data.session?.user.user_metadata ?? {}) as {
          full_name?: string;
          name?: string;
        };
        const first = (meta.full_name ?? meta.name ?? '').trim().split(/\s+/)[0] ?? '';
        setName(first || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}

/**
 * The door to Activity, and the only badge in the app.
 *
 * AV-02 states the rule as a promise to the reader: "Requests, borrows,
 * invitations and votes land here. When one does, you will see a dot on Today
 * — and nowhere else." So the dot is here and the tab bar stays clean; a
 * second badge on the tab icon would make the sentence false by addition.
 *
 * A DOT, never a number. The atlas refuses counts three separate times — "the
 * tab shows a dot, never a number", "nothing here is scored", "no unread pill
 * on each row" — and `useHasUnseenActivity` returns a boolean for exactly that
 * reason: there is no count to render even if someone later wanted one.
 *
 * `tray.full`, not a bell. The atlas's empty state specifically refuses "a
 * zero-state illustration of a bell ringing", and a bell is a promise of
 * interruption that this page does not make — nothing here rings, it waits.
 *
 * Same 34pt-with-8pt-hitSlop geometry as its two neighbours, so the three
 * chips read as one row of doors rather than three sizes of importance.
 */
function ActivityButton({ unseen: forced }: { unseen?: boolean } = {}) {
  const router = useRouter();
  const theme = useTheme();
  // The hook still runs — a hook cannot be called conditionally, and skipping
  // the query is not the point. Only the painted value is pinned, and only
  // when a caller asks for it.
  const live = useHasUnseenActivity();
  const unseen = forced ?? live;

  return (
    <PressableSurface
      onPress={() => router.navigate('/activity')}
      accessibilityRole="button"
      accessibilityLabel={unseen ? 'Activity, something waiting' : 'Activity'}
      hitSlop={8}
      fill
      style={{ width: 34, height: 34 }}
      contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      className="rounded-full border border-rule">
      <SymbolView name="tray.full" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
      {unseen ? (
        // Oxblood, and this is the one place it is spent on Today. It is the
        // accent's actual job — "the one thing to attend to" — and the plate's
        // own actions below are ink, so nothing competes with it.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.accent,
            borderWidth: 1.5,
            borderColor: theme.canvas,
          }}
        />
      ) : null}
    </PressableSurface>
  );
}

/**
 * The page header: the day and place as a tracked eyebrow, then the page's
 * name and the one line under it.
 *
 * No rule under it. The design sets the masthead, the weather line and the
 * plans pill as one unbroken block; a hairline here cuts the day in half.
 *
 * The trailing chips are Activity, the occasion composer and Profile. The
 * Stylist door that used to sit among them is GONE: the Stylist got its tab
 * back, and a masthead chip beside a tab bar entry would be two doors to one
 * room on a single screen. Profile still has no tab, so its chip remains the
 * only door there is.
 *
 * ── THE HEADLINE IS THE HOUR AND THE READER ───────────────────────────────
 *
 * LP-06's first pass replaced the serif greeting with the flat word `Today`.
 * The accepted correction restores the greeting: the hour, said correctly, and
 * the name on the account when there is one. `What’s next for you.` stays
 * underneath it verbatim — the support line was never the thing at issue.
 *
 * The two type steps come back with it (TM-01 measures the greeting at 30 pt,
 * TM-02 at 32 "rather than scaling with the width, so the two devices read as
 * the same screen"), and so does `WIDE_DEVICE`, the switch between them.
 *
 * WHAT DOES NOT COME BACK IS THE TRIPWIRE. The old greeting carried
 * `numberOfLines={1}` and was DROPPED ENTIRELY at AX3, on the reasoning that
 * an unbounded name at 30 pt could push the outfit below the fold. Both are
 * refused now: at the standard type sizes the line fits on one line, and at
 * accessibility sizes it REFLOWS rather than clipping or vanishing. A reader
 * at AX5 keeps the page's H1 like everybody else.
 *
 * `trim` goes with the same switch. The cap-trim table collapses the line box
 * to the cap height, which is correct for the single line the standard sizes
 * draw and wrong the moment the greeting takes two — a negative margin sized
 * for one line eats into the second. So it is applied only below AX.
 *
 * `ax3` still governs the calendar chip, which is what TM-03 was actually
 * protecting: four chips on one row at that scale leave the date nothing.
 * The chips themselves stay on the CONTEXT ROW with the date, where TM-01 put
 * them — an eyebrow can lose 150 pt of measure and a serif cannot.
 */

/**
 * The width at which the greeting takes the larger step. 430 is the Pro Max
 * class; 393 and 402 are the two smaller supported iPhones.
 */
const WIDE_DEVICE = 430;

export function Masthead({
  city,
  name,
  /**
   * "Feels 72°F, mild" — the day's weather, stated HERE and nowhere else on
   * the screen (audit 57). Null when the forecast is not known, in which case
   * the label carries the day and the place alone and the plate prints no
   * temperature either: a known-unknown is omitted, never estimated.
   */
  weather = null,
  /**
   * The largest supported type. The context label breaks over two lines rather
   * than truncating, the greeting reflows rather than clipping, and the
   * calendar chip is dropped — four chips on one row at that scale leave the
   * date nothing. Defaults to the device's own font scale.
   */
  stacked,
  /**
   * "Now", for the date line and the greeting. Defaults to the real clock; a
   * fixed value is only ever passed by `dev-today.tsx`, so the byte-exact
   * screen matrix can photograph this masthead without the capture changing at
   * every midnight and again at noon and six. Same idiom, and same reason, as
   * `Plate`'s `repeat.now`.
   */
  now,
  /**
   * Force the activity dot on or off. Defaults to the live query; a fixed
   * value is only ever passed by `dev-today.tsx`, because whether an 8pt
   * oxblood dot is painted otherwise depends on when a Supabase round trip
   * lands relative to the shutter.
   */
  unseen,
  /**
   * The page's scroll offset, shared straight off the UI thread — passed ONLY
   * by the happy-path ScrollView, which is the one surface with content long
   * enough to scroll under a greeting. When present, the greeting block (and
   * only the greeting block) steps back as the page rises; the eyebrow row —
   * date, place, weather, every control — holds still, and the `onTextLayout`
   * rung ladder above is never touched: it is a measurement, not a motion.
   * The loading, offline, floor and reduced states pass nothing and keep the
   * masthead exactly as it was. PROTOTYPE — packet 3, awaiting a taste call.
   */
  collapse,
}: {
  city: string;
  /**
   * The first name on the account, spoken in the greeting — or null, in which
   * case the greeting is the hour alone. Never invented from an email address.
   * Roughly twenty `dev-*` acceptance routes pin it so a capture does not
   * depend on whose session is signed in.
   */
  name?: string | null;
  weather?: string | null;
  stacked?: boolean;
  now?: Date;
  unseen?: boolean;
  collapse?: SharedValue<number>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { fontScale, width } = useWindowDimensions();
  // Two thresholds, two decisions. `ax` decides whether the CONTEXT LABEL
  // breaks over two lines and whether the greeting sheds its cap-trim to
  // reflow; `ax3` decides whether the calendar chip is there at all.
  const ax = stacked ?? fontScale >= AX_FONT_SCALE;
  const ax3 = stacked ?? fontScale >= AX3_FONT_SCALE;

  // ── THE GREETING'S COLLAPSE (prototype) ──────────────────────────────────
  //
  // Reduce Motion is HAND-GATED here, not inherited: `useAnimatedStyle` has no
  // `ReduceMotion.System` the way the `spring` presets do, and a scroll-linked
  // interpolation is exactly the parallax the setting exists to refuse
  // (`the-ten.tsx` names this as the classic omission). Under the setting —
  // or on any state that passed no scroll value — the style collapses to the
  // static masthead: fully visible, nowhere to go.
  //
  // The interpolation reads the shared value on the UI thread; no React state
  // is written per frame, so the `onTextLayout` rung ladder above never
  // re-runs for a scroll.
  const reducedMotion = useReducedMotion();
  const greetingStyle = useAnimatedStyle(() => {
    if (!collapse || reducedMotion) {
      return { opacity: 1, transform: [{ translateY: 0 }] };
    }
    const y = collapse.value;
    return {
      opacity: interpolate(
        y,
        [0, MASTHEAD_COLLAPSE_DISTANCE],
        [1, MASTHEAD_GREETING_FADE_TO],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            y,
            [0, MASTHEAD_COLLAPSE_DISTANCE],
            [0, -MASTHEAD_GREETING_RISE],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [collapse, reducedMotion]);

  const place = dayLine(city, now);

  /**
   * THE CONTEXT LINE SHEDS A CLAUSE RATHER THAN WRAPPING.
   *
   * MEASURED, NOT ESTIMATED. A character budget derived from the eyebrow's
   * 11 px and 1.6 pt tracking would be a guess about Helvetica's uppercase
   * advances, and a guess that came out one character short would ship the
   * exact bug this replaces. `onTextLayout` reports how many lines the text
   * ACTUALLY took, on the actual device, at the reader's actual type size —
   * so this steps down the ladder only when the line really did wrap.
   *
   * It converges: the ladder has at most three rungs, each strictly shorter
   * than the last, and the step is one-way. The cost is one extra layout pass
   * on the devices that need it, which is a frame nobody sees.
   *
   * Reset on the CONTENT, not on the width: a new day, a new city or a
   * temperature arriving all make the line a different length, and a rung
   * chosen for yesterday's string would keep dropping a clause that now fits.
   */
  const rungs = contextRungs(place, weather);
  const [rung, setRung] = useState(0);
  const [measured, setMeasured] = useState<string | null>(null);
  const key = rungs[0];
  if (measured !== key) {
    setMeasured(key);
    setRung(0);
  }

  const lines = ax ? contextLines(place, weather) : [rungs[Math.min(rung, rungs.length - 1)]];

  return (
    <View className="px-gutter pt-2">
      {/* THE CONTEXT ROW — date, place, temperature, and every control.
          The chips live here rather than beside the greeting: an eyebrow can
          lose 150 pt of measure and still read, and a 30 pt serif cannot. */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          {/* One context label: date, place and temperature together, so the
              weather is stated once on the screen and the plate never repeats
              it. At the largest type it breaks over two lines — nothing is
              capped and nothing is ellipsised. */}
          {lines.map((line) => (
            <Text
              key={line}
              variant="eyebrow"
              // AX breaks over two lines on purpose (T-01/AX), so only the
              // standard arrangement watches for a wrap.
              onTextLayout={
                ax
                  ? undefined
                  : (e) => {
                      if (e.nativeEvent.lines.length > 1 && rung < rungs.length - 1) {
                        setRung(rung + 1);
                      }
                    }
              }>
              {line}
            </Text>
          ))}
        </View>
        <View className="flex-row gap-2" style={{ marginTop: 2 }}>
          <ActivityButton unseen={unseen} />
          {/* Correction 07: the occasion composer, restored as a 44×44
              calendar-plus at the trailing edge, opening /event/new. It sits
              inside the existing masthead height — "the 56 pt text field is
              what was wrong, not the entry point".

              TM-03 collapses it into the profile sheet at AX3: four chips on
              one row at that scale leave the date nothing, and /event/new is
              reachable from Plan, so nothing is lost — unlike the profile
              door, which is the only one there is. */}
          {ax3 ? null : (
            <PressableSurface
              onPress={() => router.navigate('/event/new')}
              accessibilityRole="button"
              accessibilityLabel="New occasion"
              hitSlop={8}
              fill
              style={{ width: 34, height: 34 }}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              className="rounded-full border border-rule">
              <SymbolView
                name="calendar.badge.plus"
                size={15}
                tintColor={theme.ink}
                resizeMode="scaleAspectFit"
              />
            </PressableSurface>
          )}
          <PressableSurface
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={8}
            fill
            style={{ width: 34, height: 34 }}
            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            className="rounded-full bg-ink">
            <SymbolView
              name="person.fill"
              size={15}
              tintColor={theme.canvas}
              resizeMode="scaleAspectFit"
            />
          </PressableSurface>
        </View>
      </View>

      {/* THE MASTHEAD — the greeting, and the page's H1.

          NO `numberOfLines`. The old tripwire clipped a long name at exactly
          the sizes where clipping is least forgivable; the line is free to
          take a second one instead, and at the standard sizes it never needs
          to. It is not shed at AX3 either — reflowing is the answer to a long
          name at 30 pt, not deletion.

          Both wrappers use `marginTop` rather than an `mt-*` class, because
          the greeting is cap-trimmed below AX and a margin utility on the
          sibling fights the trim's negative optical margin — and because this
          wrapper is now a Reanimated view, which NativeWind classes do not
          reach anyway. The support line rides inside the same wrapper on
          purpose: it fades and rises WITH the greeting, one block stepping
          back, never a sentence orphaned under a vanished H1. */}
      <Animated.View style={[{ marginTop: 12 }, greetingStyle]}>
        <Text
          variant={width >= WIDE_DEVICE ? 'greetingWide' : 'greeting'}
          trim={!ax}
          accessibilityRole="header">
          {greetingForNow(name, now)}
        </Text>
        <View style={{ marginTop: 6 }}>
          <Text variant="note">What’s next for you.</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * The reduced masthead: the eyebrow and the section name, nothing else.
 *
 * Shared by every state that has no morning to greet — first load, a failed
 * fetch, a brand-new user with no closet, a day the engine could not dress,
 * and offline. It used to carry the ✦ stylist door so those states still had
 * a way to ask; the Stylist has its tab back now, reachable from every one of
 * them through the tab bar, so the row carries no chips at all. The profile
 * avatar stays off it too — there is no fresh morning to attribute to anyone.
 */
export function ReducedMasthead({ eyebrow }: { eyebrow: string }) {
  return (
    <View className="px-gutter pt-2">
      <Text variant="eyebrow">{eyebrow}</Text>
      <View style={{ marginTop: 6 }}>
        <Text variant="display" trim accessibilityRole="header">
          Today
        </Text>
      </View>
    </View>
  );
}

/**
 * Why the engine came back empty, in the engine's own terms rather than a
 * generic apology.
 *
 * `generateOutfits` only ever returns nothing when there is no valid core to
 * build from (no top-and-bottom pairing and no dress) or — on a genuinely cold
 * day — no layer warm enough to wear over one. Both are facts about the
 * wardrobe the caller already has on screen, so this reads them off the same
 * wardrobe and weather rather than inventing a scenario the way a canned
 * "a formal lunch in heavy rain" line would.
 */
export function nothingWorksReason(items: Garment[], weather: WeatherContext | null): string {
  const has = (slot: Garment['slot']) => items.some((g) => g.slot === slot);

  // `mid_layer`, not just `base_top`, counts as a top — a knit worn alone is
  // an outfit (see `canGenerate` in queries.ts). This branch is only reached
  // once `canGenerate` has already passed, so without this a wardrobe of
  // jumpers and trousers would land here and be told it has no top at all.
  if (!has('base_top') && !has('mid_layer') && !has('dress')) {
    return "Your closet doesn’t have a top or a dress in it yet — every outfit needs one of the two.";
  }
  if (!has('bottom') && !has('dress')) {
    return "Your closet doesn’t have bottoms or a dress in it yet — every outfit needs one of the two.";
  }

  const target = weather ? targetWarmth(weather.feelsLikeC, weather.windKph) : null;
  if (target !== null && target >= 9 && !has('outerwear') && !has('mid_layer')) {
    return "Today calls for real warmth, and there’s no coat or heavy layer in your closet yet.";
  }

  return "Cinch couldn’t build an outfit that holds together from what’s in your closet right now. One more layer, or a pair of shoes, usually fixes it.";
}

/**
 * The honest "nothing works" state. Not an apology and not a generic empty
 * icon: the design's whole point here is that Cinch says plainly it could not
 * build something that holds together, then offers the few things that would
 * actually change the answer — ask the stylist, add the missing kind of piece,
 * or try again. Small icon circles are affordances, not an empty-state hero.
 */
export function NothingWorks({
  reason,
  onSeeWorn,
}: {
  reason: string;
  /** The first honest recovery: what this closet has actually worn before. */
  onSeeWorn: () => void;
}) {
  return (
    <View className="px-gutter">
      {/* The refusal, stated as a judgement Cinch is making on the reader's
          behalf, with the evidence beside it — "so it reads as care rather
          than breakage". The reason is computed from this wardrobe and this
          weather; it is never a canned scenario. */}
      <Text variant="title" trim>
        {reason}
      </Text>
      <Text variant="body" className="mt-3.5 text-muted">
        Cinch will not put together a look it does not believe in.
      </Text>

      {/* Correction 08: "Build one anyway" is deleted. A refusal that can be
          overridden is not a refusal, and the engine has no below-threshold
          mode to fall back to. What remains are recoveries that lead somewhere
          real — and the closet is offered before any gap is mentioned. */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel="See what you have worn before"
        onPress={onSeeWorn}
        style={{ minHeight: MIN_TAP_TARGET }}
        contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        className="mt-5 rounded-md border border-rule px-4">
        <Text variant="label">
          See what you&rsquo;ve worn before
        </Text>
      </PressableSurface>
    </View>
  );
}

/**
 * Today — the home tab and the app's activation moment.
 *
 * The render order is the whole point. The on-device engine ranks the entire
 * closet in about ten milliseconds; the model's re-rank takes fifteen to twenty
 * seconds. So outfits appear immediately with the scorer's own explanations,
 * and the model's names and reasoning replace them when they arrive. Blocking
 * on the network would make an instant feature feel broken.
 */
export default function TodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const qc = useQueryClient();

  /**
   * The day's context — redesign 11's three chips.
   *
   * This replaces the free-text composer ON THIS SCREEN, and the reason is a
   * defect rather than a taste: `StyleContext.note` is read by the naming hash
   * and the enhancement gate and by nothing else, so an occasion typed into
   * the field re-rolled three names and changed no outfit. A row that appears
   * to restyle the day has to restyle the day.
   *
   * Both chips ask the scorer something it already knows how to answer —
   * `targetOccasion` through `occasionRule`, `targetFormality` through
   * `resolveTargetFormality` — so the recomposition is real and no new scoring
   * code was written for it.
   */
  // A CONSTANT since the chips were withdrawn (2026-08-18), not a state.
  //
  // The engine is still asked for exactly what it was asked for on an ordinary
  // morning, because `DEFAULT_CONTEXT` is where the chips RESTED and nearly
  // every session sent it unchanged. Kept as a named binding rather than
  // inlined so the two targets below still read as a decision Today makes,
  // and so a future control has one place to write.
  const context11: TodayContextChoice = DEFAULT_CONTEXT;
  const [wornIds, setWornIds] = useState<Set<string>>(new Set());
  // Wear, per outfit rather than per screen. `wear.isPending` is the mutation's
  // global flag, so keying off it froze and spun every plate at once when one
  // was tapped — and a failed write left no trace at all.
  const [wearState, setWearState] = useState<Record<string, 'pending' | WearFailureKind>>({});
  // The diary entry each worn look created — T-14's Undo and its note both
  // address it by id.
  const [wornEntryIds, setWornEntryIds] = useState<Record<string, string>>({});
  // T-08's escape hatch: show the look without waiting for the reasoning.
  const [showWithoutReason, setShowWithoutReason] = useState(false);
  // T-08's notice, which appears only once the wait is genuinely long.
  const [slow, setSlow] = useState(false);
  // An explicit pull-to-refresh that came back with nothing to show for itself.
  // Not a boolean: which kind of nothing it was. A model that ran past its
  // budget is not an outage, and saying so is the difference between blaming
  // the network and owning the slowness.
  const [refreshFailed, setRefreshFailed] = useState<null | 'offline' | 'timeout'>(null);
  const [wearSelection, setWearSelection] = useState<StyledOutfit | null>(null);
  const [wearSheetError, setWearSheetError] = useState<WearFailureKind | null>(null);
  /**
   * The wear landed and the sheet is showing it. Redesign 13.
   *
   * The sheet used to close the instant the transaction returned, which left
   * the reader looking at Today with no evidence that anything had been
   * written. Holding the settled state — one line, one Done — is the difference
   * between a commit somebody watched happen and one they have to trust.
   */
  const [wearSettled, setWearSettled] = useState(false);
  /**
   * The settled write was a RETRY that found the original.
   *
   * Worth telling the reader, because it is the one moment the idempotency
   * guarantee is visible: they pressed twice, or pressed again after a failure,
   * and there is still exactly one wear. `opIds` makes it true; this makes it
   * legible.
   */
  const [wearRetried, setWearRetried] = useState(false);

  const firstName = useFirstName();

  // Items whose photos uploaded but whose tagging never completed are re-driven
  // from here. Today is the first screen behind the auth gate, so it is the
  // earliest point at which the sweep has a session to work with; the function
  // itself is idempotent, consent-gated and rate-limited, so mounting this tab
  // repeatedly costs nothing.
  useEffect(() => {
    startTagSweeper();
  }, []);

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();

  const {
    context,
    cityLabel,
    usingFallbackLocation,
    calendarEnabled,
    requestCalendar,
    requestLocation,
    weatherFailed,
    weatherFetchedAt,
  } =
    useStyleContext({
      // The chips, not a note. `engineOccasion` returns the tagger's own
      // vocabulary and `engineFormality` a 0..1 the scorer already reads, so
      // changing a chip changes the candidate set rather than the names.
      targetOccasion: engineOccasion(context11.occasion),
      targetFormality: engineFormality(context11.feel),
    });

  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);

  // Priors until the real profile loads, so generation is never blocked on it.
  //
  // Memoised because the fallback is an object literal: without this it is a
  // new identity on every render, which re-runs the styling engine and rebuilds
  // every reaction callback on each keystroke in the note field.
  const profile = useMemo(
    () =>
      profileQuery.data ?? {
        weights: DEFAULT_WEIGHTS,
        affinities: EMPTY_AFFINITIES,
        feedbackCount: 0,
        summary: [],
      },
    [profileQuery.data],
  );

  const outfits = useOutfits({
    wardrobe: items,
    context,
    profile,
    enabled: canGenerate(items),
  });
  const { refetch: refetchRerank } = outfits;

  const shown = outfits.outfits;

  // The Repeat's "show me another" — a plate index swapped for the next
  // shortlist candidate not already on screen. Purely local: the shortlist
  // was already computed synchronously by the engine, so there is nothing to
  // wait on and nothing to ask the network for.
  const [shownOverride, setShownOverride] = useState<Record<number, OutfitCandidate>>({});
  const shortlistKey = outfits.shortlist.map((c) => idOf(c.items)).join('|');
  // Retiring a stale override belongs to render, not an Effect — this is
  // React's own "adjusting state when a prop changes" pattern, not a
  // synchronisation with anything external. A new shortlist (a new day, a new
  // note, a changed wardrobe) retires every override in the SAME commit that
  // shows the new shortlist, rather than one render later.
  const [seenShortlistKey, setSeenShortlistKey] = useState(shortlistKey);
  if (shortlistKey !== seenShortlistKey) {
    setSeenShortlistKey(shortlistKey);
    setShownOverride({});
  }

  const effectiveShown = useMemo(
    () => shown.map((o, i) => (shownOverride[i] ? localStyledOutfit(shownOverride[i]!, context) : o)),
    [shown, shownOverride, context],
  );

  const handleShowAnother = useCallback(
    (i: number) => {
      const onScreen = new Set(effectiveShown.map((o) => idOf(o.candidate.items)));
      const next = outfits.shortlist.find((c) => !onScreen.has(idOf(c.items)));
      // Never withhold — if the shortlist has nothing left to offer, the tap
      // simply does nothing rather than repeating the same outfit under a
      // "new" label.
      if (!next) return;
      // No tick. Redesign 11 gives Today exactly one haptic and it is the
      // committed wear — a swap is a swipe-class gesture, and buzzing for every
      // card that changes is how a phone stops meaning anything when it buzzes.
      setShownOverride((prev) => ({ ...prev, [i]: next }));
    },
    [effectiveShown, outfits.shortlist],
  );

  // Offline, honestly sourced. There is no NetInfo/onlineManager in this app,
  // so the truest network signal on this screen is the weather fetch failing:
  // when it errors (after its retry) the device could not reach the forecast,
  // and the outfits on screen are the local engine's set built from the
  // persisted closet — exactly "this morning's set". Never a faked flag.
  //
  // Deliberately NOT gated on `shown.length > 0` any more. It used to be, and
  // an offline user whose local engine produced nothing fell through to
  // "Nothing today feels right" — a claim about her wardrobe, made over a
  // network failure. The network is tested first; when both hold, the banner
  // runs above the card rather than the card standing alone.
  const offline = weatherFailed;

  // ── Analytics: the two denominators this screen owns ──────────────────────
  //
  // Both live here, above every early return, because hooks cannot be called
  // after one — and both are computed from exactly the conditions the returns
  // below branch on, so what is measured is what is rendered rather than a
  // re-derivation that can drift from it.

  // ACTIVATION, observed from the raw-capture route. The Ten has the same
  // observer on the same predicate; `trackOnce` guarantees one event per
  // person across both, so a closet built by photographing garments straight
  // into the closet counts exactly like a closet built by the guided flow.
  useEffect(() => {
    if (wardrobe.isLoading || wardrobe.isError || !canGenerate(items)) return;
    trackOnce('closet_ready', { route: 'capture', pieces: items.length });
  }, [wardrobe.isLoading, wardrobe.isError, items]);

  // OUTFITS GENUINELY ON SCREEN.
  //
  // The condition is the exact conjunction of the four early returns below —
  // not loading, not a failed read, past `canGenerate`, and with a non-empty
  // set — because those are the four ways this screen renders no plates at all
  // while still having asked the engine for some. Both surviving branches (the
  // offline one and the normal one) then map `effectiveShown`, so a non-empty
  // `effectiveShown` here means plates in the tree.
  //
  // The key is the identity of the set, so a re-render is silent and a swapped
  // plate is a new impression. The ref is deliberately per-mount rather than
  // persisted: seeing today's outfits tomorrow IS a new impression, which is
  // the opposite of `closet_ready`'s once-per-person claim.
  //
  // `source` leads the key, and that is not decoration. The screen enhances in
  // place: the local engine's set paints first and the model's re-ranked set
  // replaces it seconds later. Those are two impressions, one of which we paid
  // for — but the re-rank picks from the same shortlist and routinely comes
  // back with the same plates in the same order, so a joined-ids key alone
  // would silently swallow the second. This is the one place the identity of a
  // set is not just its garments.
  /**
   * The four truthful weather states, resolved once — redesign 11.
   *
   * `off` and `unavailable` are kept apart because they are different facts: a
   * permission this reader has not given, and a reading this device could not
   * get. Neither invents a temperature and neither blocks a morning, because
   * the outfits are already built by the time this is asked.
   */
  const weatherRead = useMemo(
    () =>
      resolveWeather({
        conditionLabel: context.weather ? describeWeather(context.weather, 'F') : null,
        temperatureLabel: context.weather
          ? formatTemp(context.weather.feelsLikeC, 'F')
          : null,
        // The card's one glyph. The condition PHRASE above still feeds the
        // chip and the stale wording, but never the mark — the range clause
        // it can carry belongs to the masthead eyebrow alone.
        symbol: context.weather ? weatherSymbol(context.weather) : null,
        fetchedAt: weatherFetchedAt ? new Date(weatherFetchedAt) : null,
        permissionOff: usingFallbackLocation,
        failed: weatherFailed,
        now: new Date(),
      }),
    [context.weather, weatherFetchedAt, usingFallbackLocation, weatherFailed],
  );

  const platesOnScreen =
    !wardrobe.isLoading && !wardrobe.isError && canGenerate(items) && effectiveShown.length > 0;
  const viewedSource = effectiveShown[0]?.source ?? null;

  // ── REDESIGN 11 · THE THIRTEEN EVENTS ─────────────────────────────────────
  //
  // `outfit_set_viewed` is GONE from this screen. It carried a COUNT of the
  // plates on screen, and Today's contract forbids counts — the honest
  // replacement is `plate_viewed`, which reports a POSITION (which of three a
  // reader actually reached) and is emitted by the carousel below. The two
  // facts it also carried survive as their own events: which engine produced
  // the set, and whether the network was there.
  //
  // Every payload is built by `features/today/analytics.ts`, which imports no
  // PostHog and therefore CAN be executed by the node suite — so the property
  // shapes are asserted by a test rather than by a comment.

  // The visit — gated on FOCUS, not mount, because NativeTabs mounts all five
  // tabs at launch and a mount effect here fired for people who never arrived
  // (see use-tab-visited.ts). Once per visit-session, not once per person:
  // opening Today tomorrow is a new morning, which is the whole unit this
  // screen is measured in.
  const visited = useTabVisited();
  const openedRef = useRef(false);
  useEffect(() => {
    if (!visited || openedRef.current) return;
    openedRef.current = true;
    track(TODAY_EVENTS.opened, todayOpenedProps());
  }, [visited]);

  // WHICH ENGINE the reader is actually looking at. The screen enhances in
  // place — the on-device set paints first and the model's re-ranked set may
  // replace it seconds later — so both are reported, and the transition from
  // `local` to `enhanced` is the measurement that tells us whether the paid
  // pass was ever seen.
  const sourceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visited || !platesOnScreen || !viewedSource) return;
    const source = viewedSource === 'ai' ? 'enhanced' : 'local';
    if (sourceRef.current === source) return;
    sourceRef.current = source;
    track(TODAY_EVENTS.outfitsSource, outfitsSourceProps(source));
  }, [visited, platesOnScreen, viewedSource]);

  // WHICH OF FOUR STATES the weather read is in — never the reading, never the
  // place. A temperature and a timestamp are a location to anybody holding
  // enough of them, which is why only the state travels.
  const weatherStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visited || weatherStateRef.current === weatherRead.state) return;
    weatherStateRef.current = weatherRead.state;
    track(TODAY_EVENTS.weatherState, weatherStateProps(weatherRead.state));
  }, [visited, weatherRead.state]);

  // The two refusals and the floor, each observed exactly where it renders and
  // each carrying nothing at all — that a morning had no answer is the whole
  // fact, and any property on it would describe the wardrobe that failed.
  const floorRef = useRef(false);
  const belowFloor =
    !wardrobe.isLoading && !wardrobe.isError && belowActivationFloor(items.length, canGenerate(items));
  useEffect(() => {
    if (!visited || !belowFloor || floorRef.current) return;
    floorRef.current = true;
    track(TODAY_EVENTS.closetFloorShown, closetFloorShownProps());
  }, [visited, belowFloor]);

  // "Show another" ran out of genuinely different looks. Reported once per
  // exhaustion rather than once per render, and carrying nothing — how many
  // cores a wardrobe has is a count, and counts are exactly what this screen
  // refuses to send.
  const exhaustedRef = useRef(false);

  const noViableRef = useRef(false);
  const noViable =
    !wardrobe.isLoading && !wardrobe.isError && canGenerate(items) && effectiveShown.length === 0;
  useEffect(() => {
    if (!noViable) {
      noViableRef.current = false;
      return;
    }
    if (!visited || noViableRef.current) return;
    noViableRef.current = true;
    track(TODAY_EVENTS.noViableCombination, noViableCombinationProps());
  }, [visited, noViable]);

  // Sign every image the shortlist could ever show, not just today's three —
  // "show me another" swaps in a candidate from further down the same list,
  // and its garments need to already be resolvable the moment it appears.
  // The wardrobe is small enough (free and paid alike) that this dedupes to
  // roughly one signed URL per garment, not per candidate.
  const { resolve } = useSignedUrls(
    outfits.shortlist.flatMap((c) =>
      c.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
    ),
  );

  // The Repeat (Directive 5): real marked wears, read once per screen and
  // matched per plate below. `wornOutfits.data` starts undefined before the
  // first fetch, and an empty array is the honest default — no repeat mark
  // can be true before real history has loaded.
  const wornOutfits = useWornOutfits();
  // Memoised so a fresh `[]` identity on every render doesn't invalidate the
  // `exhaustionProgress` memo just below it.
  const wornRecords = useMemo(() => wornOutfits.data ?? [], [wornOutfits.data]);
  const currentTally = useMemo(() => tallyOf(items), [items]);
  const exhaustion = useMemo(
    () => exhaustionProgress(items, wornRecords),
    [items, wornRecords],
  );

  // Placed with the other observers rather than at the render site, so that
  // what is measured is the CONDITION and not whether a particular banner
  // happened to be mounted under it.
  const exhausted = platesOnScreen && exhaustion.exhausted;
  useEffect(() => {
    if (!exhausted) {
      exhaustedRef.current = false;
      return;
    }
    if (!visited || exhaustedRef.current) return;
    exhaustedRef.current = true;
    track(TODAY_EVENTS.repeatExhausted, repeatExhaustedProps());
  }, [visited, exhausted]);

  const topGap = useMemo(() => rankGaps(currentTally)[0] ?? null, [currentTally]);

  const react = useReactToOutfit();
  const wear = useWearOutfit();
  const gate = useGate();
  // TD-00 only. Read here rather than inside `CapacityNote` so the note stays a
  // pure function of two values a fixture can hand it — a hook in there would
  // make the state unphotographable without a session. No extra round trip:
  // `useGate()` above already holds the same query, and react-query dedupes it.
  //
  // `null` while the tier is unread or unreadable. `usePlan` answers `free` in
  // both cases, which is correct for a gate (refuse nothing on an outage) and
  // wrong for a sentence — a Standard closet of exactly ten would otherwise
  // flash a claim that is false for it.
  const planState = usePlan();
  const knownPlan = planState.loading || planState.unconfirmed ? null : planState.plan;
  /**
   * "See plans", from a prompt this screen drew.
   *
   * ONE CALLBACK FOR TWO PROMPTS, and `repeat_upsell` is the right placement for
   * both. `placements.ts` describes it as the one placement offered after copy
   * "has honestly explained why" — nothing has been refused by a server, the
   * user is simply being shown the door — which is exactly the shape of the
   * membership bubble as well as The Repeat's panel. Every alternative is
   * already spoken for and would be a lie about what happened:
   * `add_garment_over_limit` and its siblings fire after a refusal,
   * `trial_expired` after a lapse, `reveal_complete` on the Reveal, and
   * `membership_upgrade` is MB-09's Standard→Pro delta for somebody already
   * paying. No new placement is created for this; an unmatched one would
   * silently do nothing, and a duplicate would split one campaign's numbers in
   * two.
   */
  const openRepeatUpsell = useCallback(() => void gate.present(Placement.RepeatUpsell), [gate]);

  // The pull kicks off three fetches — the re-rank, the closet and the
  // forecast — and the control used to retract when only the first of them
  // settled, which read as "done" while two thirds of the page was still
  // moving. `useIsFetching` is how the weather query is reached from here:
  // it is owned by `useStyleContext`, which exposes no refetch flag.
  const weatherFetching = useIsFetching({ queryKey: ['weather'] }) > 0;
  const refreshing = outfits.isEnhancing || wardrobe.isRefetching || weatherFetching;
  // True only between an explicit pull-to-refresh and the next re-rank result.
  const userAskedRef = useRef(false);

  // ── THE TASTE ROW IS BACK ON TODAY ────────────────────────────────────────
  //
  // Founder order, 2026-08-18, reversing redesign 11's removal.
  //
  // Redesign 11's argument was that the wear sheet's stars would carry the
  // learner instead — one opinion a day, about the outfit actually put on,
  // rather than a bar asking three times a morning about outfits nobody wore.
  // That is a good argument about QUALITY and it ignored VOLUME: a wear is one
  // signal a day and structurally always a positive one, so for three months
  // the two cards passed over every morning taught the learner nothing at all.
  // Those are the cheapest signals the app can collect and the machinery for
  // them — `apply_outfit_reaction`, `favorExactCores` — stayed wired up with
  // no call site on this screen.
  //
  // Both channels run now. `confirmWear` below still reacts off the sheet's
  // rating and favourite; this reacts off the row. They write through the same
  // `react` mutation with the same `source: 'today'`, so nothing downstream
  // can tell them apart or needs to.
  //
  // The state is optimistic and per-card, keyed by the outfit's own core id:
  // the pill fills on the tap and settles to saved or failed when the write
  // answers. A failed write leaves the row pressable so the same tap retries,
  // which is the rule the wear action already follows two blocks down.
  //
  // ── AND THEY UN-TAP ───────────────────────────────────────────────────────
  //
  // Founder defect, 2026-08-18: the pills latched. One handler covers both
  // directions rather than two, because setting and clearing are the same fact
  // about the same outfit and the optimistic state they move is the same entry.
  // A `clear` tap goes through the same mutation with the same `source`, so
  // nothing downstream has to learn a second shape — see `retractOutfitReaction`
  // in `features/styling/mutations.ts` for what the server does with it.
  //
  // A clear that FAILS settles back to `saved`, which is not a consolation
  // state: the reaction genuinely is still recorded on the server, so a filled
  // pill is the true drawing of that failure and the next tap retries the clear.
  const [reactions, setReactions] = useState<Record<string, TasteState>>({});

  const handleReact = useCallback(
    (index: number, choice: 'love' | 'hate', clear = false) => {
      const outfit = effectiveShown[index];
      if (!outfit) return;
      const key = idOf(outfit.candidate.items);
      const liked = choice === 'love';
      const settle = (status: 'saved' | 'failed') =>
        setReactions((prev) => (prev[key] ? { ...prev, [key]: { choice, status } } : prev));
      // The entry is REMOVED rather than set to a cleared value: absence is what
      // the row means by "no reaction", and it is what the server now holds too.
      const forget = () =>
        setReactions((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });

      setReactions((prev) => ({
        ...prev,
        [key]: { choice, status: clear ? 'clearing' : 'pending' },
      }));
      react.mutate(
        {
          candidate: outfit.candidate,
          shownAlongside: outfits.shortlist,
          liked,
          profile,
          source: 'today',
          clear,
        },
        {
          onSuccess: () => (clear ? forget() : settle('saved')),
          onError: () => settle(clear ? 'saved' : 'failed'),
        },
      );
    },
    [effectiveShown, profile, outfits.shortlist, react],
  );

  /**
   * The one way this sheet closes.
   *
   * Cancel, Done and the sign-in exit all come through here, so the reset can
   * never be half-done — a `wearSettled` left true would show the next wear as
   * already logged before it had been.
   */
  const closeWearSheet = useCallback(() => {
    setWearSelection(null);
    setWearSheetError(null);
    setWearSettled(false);
    setWearRetried(false);
  }, []);

  const handleWear = useCallback(
    (index: number) => {
      const outfit = effectiveShown[index];
      if (!outfit) return;
      setWearSheetError(null);
      setWearSettled(false);
      setWearRetried(false);
      setWearSelection(outfit);
      // The INTENT, not the write. Its pair with `wear_result` is what makes
      // an abandoned confirmation legible: a `wear_started` with no result is
      // somebody who opened the sheet and cancelled, and cancelling writes
      // nothing anywhere — including here.
      track(TODAY_EVENTS.wearStarted, wearStartedProps());
    },
    [effectiveShown],
  );

  const confirmWear = useCallback(
    ({ rating, favorite }: { rating: number | null; favorite: boolean }) => {
      const outfit = wearSelection;
      if (!outfit) return;
      const key = idOf(outfit.candidate.items);

      // A confirm that follows a failure is a RETRY, and it reuses the same
      // operation id — `useWearOutfit` holds it until settlement. Recorded here
      // so the settled sheet can say "Logged once. Nothing was duplicated."
      // rather than leaving the guarantee invisible.
      if (wearSheetError !== null) setWearRetried(true);

      // Same shape as `handleReact` above, and for the same reason: the write
      // is an online-only command with no queue behind it, so the card has to
      // be able to say "in flight", "done" and "never landed" as three
      // different things. `wear_count` and cost-per-wear are the numbers the
      // product is about — they must never diverge silently.
      setWearState((prev) => ({ ...prev, [key]: 'pending' }));

      wear.mutate(
        {
          candidate: outfit.candidate,
          context,
          name: outfit.name,
          reasoning: outfit.reasoning,
          rating,
          favorite,
        },
        {
          onSuccess: (outfitId) => {
            setWearState((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setWornIds((prev) => new Set(prev).add(key));
            // The sheet stays open on the settled composition; `onDone` closes
            // it. It used to be closed here, which meant the wear's own
            // confirmation was a screen the reader never saw.
            setWearSettled(true);
            track(TODAY_EVENTS.wearResult, wearResultProps('ok'));
            // THE COMMITTED-WEAR HAPTIC MOVED TO THE SHEET (redesign 13), and
            // it moved for a reason rather than tidiness: it belongs with the
            // state transition the reader actually sees. The sheet now holds
            // the settled composition instead of vanishing, so the buzz, the
            // line and the announcement land together on one screen. Firing it
            // here as well would be two buzzes for one wear.
            //
            // Today therefore has NO haptics at all. Swipes, chips, the
            // enhancement landing and the plate swap were always silent; this
            // was the last one, and `tests/today-redesign-11.test.ts` pins the
            // count at zero so it cannot creep back.
            // Whether feedback was given, never which. An unrated wear is a
            // legal wear and reports `false` rather than going unreported —
            // "how often does anybody rate" is only answerable if both halves
            // are counted.
            track(TODAY_EVENTS.ratingSet, ratingSetProps(rating !== null));
            track(TODAY_EVENTS.favoriteSet, favoriteSetProps(favorite));
            // T-14's Undo and "Add a note" both need the diary entry this
            // wear created. `wear_outfit_tx` returns its id and this is the
            // only moment it is available — nothing else on Today can find it.
            if (typeof outfitId === 'string') {
              setWornEntryIds((prev) => ({ ...prev, [key]: outfitId }));
            }
            setWearSheetError(null);

            // Only explicit feedback teaches taste, and the mapping lives in
            // `wear-confirm-spec.ts` rather than inline here — it is the one
            // place a wear becomes an opinion, and a test should be able to
            // execute it across every input rather than read it.
            //
            // Favourite is the strongest positive signal and overrides a
            // conflicting rating; three stars is neutral; and an UNRATED wear
            // returns null, which means the learner is never called at all.
            const liked = tasteSignal(rating, favorite);
            if (liked !== null) {
              react.mutate({
                candidate: outfit.candidate,
                shownAlongside: outfits.shortlist,
                liked,
                profile,
                outfitId: typeof outfitId === 'string' ? outfitId : null,
                reason: favorite ? 'favorite' : `wear_rating_${rating}`,
                source: 'today',
              });
            }
          },
          onError: (error) => {
            const failure = classifyWearFailure(error);
            setWearState((prev) => ({ ...prev, [key]: failure }));
            setWearSheetError(failure);
            // No haptic on a failure, and no kind of failure in the payload:
            // the reason a write did not land describes the wardrobe's server
            // trip, not the reader, and `ok | failed` is the whole question.
            track(TODAY_EVENTS.wearResult, wearResultProps('failed'));
          },
        },
      );
    },
    [context, outfits.shortlist, profile, react, wear, wearSelection, wearSheetError],
  );

  // ── The day's one statement of the weather (audit 57) ────────────────────
  //
  // Composed once, here, and handed to the masthead. Every other surface on
  // this screen — the plate's old colophon, the weather strip's own line — has
  // stopped printing it. When the forecast is unknown the clause is null and
  // NOTHING stands in for it.
  const weatherClause = context.weather
    ? feelsClause(formatTemp(context.weather.feelsLikeC, 'F'), 'F', describeWeather(context.weather, 'F'))
    : null;


  const { fontScale, width: screenWidth } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  // ── THE CAROUSEL'S GEOMETRY ───────────────────────────────────────────────
  //
  // A page is the full screen width, and the gutter lives INSIDE the page
  // rather than on the list. That is what makes the paging honest: every card
  // snaps to a multiple of the same number the list scrolls by, so a swipe can
  // never come to rest between two of them. Padding the container instead
  // would leave the page width and the snap interval disagreeing by 40pt,
  // which is exactly the drift that reads as a broken swipe.
  const pageWidth = screenWidth;
  const [activePlate, setActivePlate] = useState<PlateIndex>(1);

  // The first plate is an impression too, and nothing scrolls to reach it.
  const firstPlateRef = useRef(false);
  useEffect(() => {
    if (!visited || firstPlateRef.current || effectiveShown.length === 0) return;
    firstPlateRef.current = true;
    track(TODAY_EVENTS.plateViewed, plateViewedProps(1));
  }, [visited, effectiveShown.length]);

  // ── APPLYING A CONTEXT, STATED HONESTLY ───────────────────────────────────
  //
  // The on-device engine has no latency worth a spinner: `localStyledOutfit`
  // runs inside a memo, so by the time this render exists the plates ARE the
  // new context's plates. That is the whole reason nothing empties — there is
  // no gap to empty into.
  //
  // What can still be in flight is the ENHANCED pass, and only when a chip was
  // the thing that started it. So the line is shown for exactly that: cards
  // that already answer the new context, above a note saying a better answer
  // is still being looked for. It is never shown for a background re-rank
  // nobody asked for.
  // ── RETIRED WITH THE CHIPS ────────────────────────────────────────────────
  //
  // `contextDirty` / `applying` existed for one cause and one only: a chip had
  // been pressed and the enhanced pass it started had not landed yet. The
  // comment above says so in as many words — "it is never shown for a
  // background re-rank nobody asked for". With no chip to press there is no
  // such moment, and a flag that can never become true is a line that reads
  // like behaviour and is not. `TODAY_COPY.applying` is left in the spec: it
  // is the sentence any future context control would say, and deleting a
  // string costs nothing to keep.

  // T-02. Read from real occasions rather than the device calendar, because
  // the interrupt's single action lands on the occasion's own outfits page and
  // only a Cinch occasion has one. Today's, soonest first.
  // The other half of the band that replaced the chips: the soonest trip
  // starting inside the week. `useAllTrips` is the one module that reads the
  // table, and it is already cached for the Plan tab — this is a read of the
  // same query, not a second fetch.
  const allTrips = useAllTrips();
  const tripSoon = useMemo(
    () => tripAhead(allTrips.data ?? [], new Date()),
    [allTrips.data],
  );
  // "Got it" — the reminder's acknowledgement, keyed to THIS trip's id. A
  // dismissed trip never returns; a different later trip derives a fresh key
  // and still surfaces. Starts hidden until the read resolves, so the card
  // never flashes at somebody who already dismissed it.
  const tripReminder = useTripReminder(tripSoon?.id ?? null);

  const myEvents = useMyEvents();
  const interrupt = useMemo(() => {
    const today = new Date().toDateString();
    return (
      (myEvents.data ?? []).find((e) => e.startsAt && e.startsAt.toDateString() === today) ?? null
    );
  }, [myEvents.data]);

  const unwear = useUnwearEntry();

  // T-08. The notice appears at six seconds, not at the first frame of the
  // wait: a re-rank that lands in two seconds must not accuse itself of being
  // slow. It retires the moment the reasoning arrives.
  const enhancing = outfits.isEnhancing;
  // Retiring the notice belongs to render, not to an Effect: it is React's own
  // "adjust state when a prop changes" pattern, and the reasoning landing is
  // not an external system to synchronise with. The Effect below only ever
  // starts the clock.
  const [seenEnhancing, setSeenEnhancing] = useState(enhancing);
  if (enhancing !== seenEnhancing) {
    setSeenEnhancing(enhancing);
    if (!enhancing) setSlow(false);
  }
  useEffect(() => {
    if (!enhancing) return;
    const t = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(t);
  }, [enhancing]);

  const refresh = useCallback(() => {
    // Marks the NEXT re-rank failure as user-asked-for. The background re-rank
    // degrades silently by design — its quota refusal must never interrupt
    // someone who merely opened the tab — but a pull-to-refresh is an explicit
    // request for a fresh outfit, and refusing that one deserves an answer.
    userAskedRef.current = true;
    setRefreshFailed(null);
    void qc.invalidateQueries({ queryKey: ['wardrobe'] });
    void qc.invalidateQueries({ queryKey: ['weather'] });
    // `refetch`, not an invalidation: the re-rank's key is content-derived
    // (['outfit-rerank', shortlist…]), so with an unchanged shortlist no key
    // ever goes stale and an invalidation of a guessed name is a no-op. This
    // is the hook's own handle for exactly this moment.
    //
    // The result is read HERE rather than in an effect because a timed-out
    // re-rank never becomes a query error: `generate-outfits` answers it with
    // HTTP 200 and `ok: false`, so nothing throws and the `aiError` effect
    // below never runs. That is precisely why a slow model used to leave an
    // explicit pull with no answer at all. This is also the only place that
    // knows the refresh was asked for.
    void refetchRerank().then((result) => {
      const data = result.data;
      if (!data || data.ok) return;
      // A refusal is not handled here — it arrives as an error and opens the
      // paywall through `classifyDenial` below.
      if (data.error === 'ai_consent_required') return;
      setRefreshFailed(data.reason === 'styling_timeout' ? 'timeout' : 'offline');
    });
  }, [qc, refetchRerank]);

  useEffect(() => {
    if (!outfits.aiError || !userAskedRef.current) return;
    userAskedRef.current = false;
    void classifyDenial(outfits.aiError).then((denial) => {
      // Only a refusal opens the paywall. An offline refresh stays what it
      // already is on this screen: outfits styled on the phone, no drama.
      // No onGranted retry — the local outfits are already up, and the next
      // refresh after an upgrade re-ranks naturally.
      if (denial) void gate.present(Placement.GenerateOutfitOverLimit);
      // Anything else — an outage, a timeout — used to produce nothing at
      // all: the spinner retracted and the same outfits sat there. An
      // explicit request always gets an answer.
      else setRefreshFailed('offline');
    });
  }, [outfits.aiError, gate]);

  // ── THE HAPPY PATH'S SCROLL, SHARED WITH THE MASTHEAD (prototype) ────────
  //
  // The repo's first `useAnimatedScrollHandler` — the offset lives on the UI
  // thread and is read there by the masthead's greeting interpolation, so a
  // scroll never causes a React render. Declared here, above the early
  // returns, because hooks must run in every state; only the happy-path
  // ScrollView below actually drives it, and only that ScrollView's masthead
  // is handed the value. The loading, floor, failed and offline states keep
  // their static mastheads: none of them has a page long enough to earn a
  // collapse.
  const scrollY = useSharedValue(0);
  const onHappyPathScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // --- States --------------------------------------------------------------

  if (wardrobe.isLoading) {
    // T-07. "The masthead is real, because date, place and weather are known
    // before the look is." So this is the full masthead, not the reduced one,
    // and the skeleton below it mirrors the plate's exact geometry so nothing
    // shifts when the real look arrives.
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <Masthead city={cityLabel} name={firstName} weather={weatherClause} />
        {/* Inline style, not `mt-6`: NativeWind's interop is registered for the
            RN primitives only, so a className on a Reanimated component is
            silently dropped. */}
        <Animated.View exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)} style={{ marginTop: 24 }}>
          <PlateSkeleton />
        </Animated.View>
      </SafeAreaView>
    );
  }

  // A failed wardrobe fetch is not an empty closet (T-08). Left unchecked this
  // used to fall through to the empty-closet screen below and tell someone
  // with a full wardrobe "I can't style what I can't see" over a network error
  // that has nothing to do with what she owns. Composed inline rather than via
  // `ErrorState`: the atlas sets this glyph muted and the retry outlined —
  // oxblood stays reserved for a loved look, and `ErrorState`'s full-screen
  // form spends both.
  if (wardrobe.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ReducedMasthead eyebrow={dayLine(cityLabel)} />
        <View accessibilityRole="alert" className="px-gutter" style={{ marginTop: 88 }}>
          <SymbolView
            name="exclamationmark.triangle"
            size={22}
            tintColor={theme.muted}
            resizeMode="scaleAspectFit"
          />
          <View style={{ marginTop: 16 }}>
            <Text variant="title" trim>
              Couldn&rsquo;t read your closet
            </Text>
          </View>
          <Text variant="body" className="mt-3.5 text-muted">
            Check your connection and try again.
          </Text>
          {/* Wrapper carries the offset: `Button` omits `style` from its props. */}
          <View style={{ marginTop: 30 }}>
            <Button
              title="Try again"
              variant="secondary"
              loading={wardrobe.isRefetching}
              onPress={() => void wardrobe.refetch()}
              className="self-stretch"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── THE ACTIVATION FLOOR — TEN, NOT EIGHT ─────────────────────────────────
  //
  // `canGenerate` asks the ENGINE'S question: can a beam search find anything
  // at all in this closet? Its floor is eight, and its own docblock says eight
  // "is internal and is never used as an instruction". This branch was using it
  // as one, and the result was a screen that opened at eight while every other
  // sentence in the app — The Ten, the tour, the free plan — said ten.
  //
  // `belowActivationFloor` asks the PRODUCT'S question, and it is the union of
  // the two: under ten pieces, or over ten but still unstylable. So the gate
  // now matches the instruction above it, and a closet the engine cannot dress
  // still lands here rather than falling through to a plate that is not there.
  if (belowActivationFloor(items.length, canGenerate(items))) {
    // T-10 and T-11 — an empty closet and a closet under the floor, told
    // apart. Both keep the real masthead: the date, the place and the weather
    // are known whether or not there is anything to style, and the reader is
    // greeted either way.
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <Masthead city={cityLabel} name={firstName} weather={weatherClause} />
        {/* A ScrollView, not a plain centred `flex-1` View: at a large Dynamic
            Type setting every piece of this composition grows taller, and a
            fixed viewport has nowhere to put the overflow. */}
        <ScrollView
          contentContainerClassName="flex-grow"
          // 96, matching Closet: below that the floating tab bar occludes this
          // branch's primary action, which is the whole reason the state
          // exists.
          contentContainerStyle={{ paddingBottom: 96 }}>
          <ClosetFloor
            items={items}
            remaining={piecesRemaining(items.length)}
            resolveImage={resolve}
            onStart={() => {
              // The Ten, "resumed at the count rather than restarted" — it
              // hydrates from the closet it finds. A closet already past the
              // free cap has no Ten left to run, and takes the chooser.
              router.push(items.length >= PLANS.free.items ? '/add-clothes' : '/the-ten');
            }}
            onDescribe={() => router.push('/walkthrough')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // T-09 · OFFLINE — a usable plate, honestly labelled.
  //
  // Three refusals compose this branch, and all three are corrections:
  //
  //   * The temperature is DROPPED from the context label rather than shown
  //     stale. "A known-unknown is omitted, never estimated."
  //   * The plate carries the date of the closet it was built from, so what
  //     may be stale is verifiable on the object and not only in the notice.
  //   * The reactions are drawn as tray fills with secondary-ink labels —
  //     "inert by ground rather than by faintness", which keeps the label
  //     above the contrast floor — with a sentence naming why.
  //
  // WHERE THIS DEPARTS FROM THE ATLAS, AND WHY. T-09 draws the wear action as
  // live, on the grounds that "marking it worn is saved here and sent when you
  // are back". There is no such queue in this app: `useWearOutfit` is a single
  // online RPC (`wear_outfit_tx`) with nothing behind it, and the previous
  // version of this screen already made the matching false promise in prose
  // ("Reactions will sync once you're back online" — nothing synced). Drawing
  // a live control over a write that cannot happen is the one thing this lane
  // may not do, so all three controls are unavailable-with-a-reason and the
  // sentence says what is true.
  if (offline) {
    const closetDay = wardrobe.dataUpdatedAt
      ? new Date(wardrobe.dataUpdatedAt).toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : null;

    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScrollView
          contentContainerClassName="pb-24"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
          }>
          {/* No temperature in the label: the forecast is exactly the thing
              that could not be reached. */}
          <Masthead city={cityLabel} name={firstName} weather={null} />

          {/* The notice, in the tray, naming what may be wrong and offering
              the one thing that would fix it. */}
          <OfflineNotice onRetry={refresh} />

          {shown.length === 0 ? (
            /* Offline AND nothing the local engine can build. The notice above
               has already said the network is the reason the page is stale;
               the refusal below is still the honest account of the wardrobe,
               and the two together stop the app blaming the closet for the
               connection. */
            <View className="mt-5">
              <NothingWorks
                reason={nothingWorksReason(items, context.weather)}
                onSeeWorn={() => router.push('/diary')}
              />
            </View>
          ) : (
            <View className="mt-5">
              {/* The same carousel, with the one control that cannot work
                  drawn as unavailable rather than as live.

                  T-09 draws the wear action live here, on the grounds that a
                  wear "is saved and sent when you are back". There is no such
                  queue in this app — `useWearOutfit` is a single online RPC
                  with nothing behind it — and drawing a live control over a
                  write that cannot happen is the one thing this lane may not
                  do. So the button says why instead, and the sentence is
                  true. */}
              <FlatList
                data={effectiveShown}
                keyExtractor={(outfit) => idOf(outfit.candidate.items)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const next = pageFromOffset(e.nativeEvent.contentOffset.x, pageWidth);
                  if (next === activePlate) return;
                  setActivePlate(next);
                  track(TODAY_EVENTS.plateViewed, plateViewedProps(next));
                }}
                renderItem={({ item: outfit, index: i }) => (
                  <View style={{ width: pageWidth, paddingHorizontal: GUTTER }}>
                    <TodayPlate
                      view={{
                        name: outfit.name,
                        piecesLine: piecesLine(outfit.candidate.items),
                        garments: outfit.candidate.items,
                        // No temperature: the forecast is exactly the thing
                        // that could not be reached, and a known-unknown is
                        // omitted rather than shown stale.
                        weatherMark: closetDay ? `Closet as of ${closetDay}` : null,
                        positionLabel: positionLabel((i + 1) as PlateIndex),
                      }}
                      width={pageWidth - GUTTER * 2}
                      large={ax}
                      resolveImage={resolve}
                    />
                    <View style={{ paddingTop: 16 }}>
                      <View
                        accessibilityRole="button"
                        accessibilityState={{ disabled: true }}
                        accessibilityLabel={`${TODAY_COPY.wear}. ${OFFLINE_ACTIONS_REASON}`}
                        className="items-center justify-center rounded-md bg-tray px-6"
                        style={{ minHeight: ax ? 56 : 44 }}>
                        <Text variant="label" className="text-muted">
                          {TODAY_COPY.wear}
                        </Text>
                      </View>
                      <Text variant="note" className="mt-2 text-muted">
                        {OFFLINE_ACTIONS_REASON}
                      </Text>
                    </View>
                  </View>
                )}
              />
              <PlateDots count={effectiveShown.length} active={activePlate} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const feedbackCount = profile.feedbackCount;
  // T-12. The day the engine could not dress — a different fact from an empty
  // closet and from a closet under the floor, with its own next action.
  const nothingWorks = shown.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* `style`, not `flex-1` — NativeWind classes do not reach Reanimated
          components in this project. */}
      <Animated.View // A cross-fade is already the reduced form of this transition — there is no
        // spring, no parallax and no cascade to strip. `ReduceMotion.System` is
        // still declared rather than assumed: the layout-animation builders do
        // NOT inherit the setting the `spring` presets in `theme/tokens.ts` bake
        // in, so an undeclared fade keeps playing for somebody who asked the
        // system for less. The composition is identical either way.
        entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)} style={{ flex: 1 }}>
        {/* `Animated.ScrollView`, because a plain one cannot feed a worklet —
            and `contentContainerStyle` rather than the `pb-24` class it
            replaces, for the standing reason: NativeWind classes do not reach
            Reanimated components in this project. Same 96 (24 × 4). */}
        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 96 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={onHappyPathScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
          }>
          {/* One masthead in every state: one context label carrying date,
              place and temperature, one greeting, the action pair at the
              trailing edge. Capped at 96 pt — `MASTHEAD_CAP`, finally a
              constant (audit 56). `collapse` is the prototype: this call
              site alone hands the scroll over, so every other state's
              masthead stands still. */}
          <Masthead city={cityLabel} name={firstName} weather={weatherClause} collapse={scrollY} />

          {/* T-02 · the occasion interrupt. Above the look it competes with,
              exactly one action, and it takes the frame's oxblood while it is
              there — the plate's wear action falls back to ink below. */}
          {interrupt && !nothingWorks ? (
            <OccasionInterrupt
              occasion={interrupt}
              onDress={() => router.push(`/event/${interrupt.id}/outfits`)}
            />
          ) : null}

          {/* The weather sentence is NOT repeated here — audit 57. What is
              left of this strip is the two permission offers, which are not
              weather facts and have no other door on this screen; it renders
              nothing at all once both have been answered, which is the state
              T-01 draws. */}
          <WeatherStrip
            weather={context.weather}
            events={context.events}
            city={cityLabel}
            showWeather={false}
            usingFallbackLocation={usingFallbackLocation}
            onEnableLocation={() => void requestLocation()}
            calendarEnabled={calendarEnabled}
            onConnectCalendar={() => void requestCalendar()}
          />

          {/* ── THE CONTEXT CHIPS ARE GONE, AND WHAT STANDS HERE INSTEAD ────
              Founder order, 2026-08-18. The full argument is in
              `today-spec.ts` over `TRIP_AHEAD_WINDOW_DAYS`; the short of it is
              that two of the three chips were the app's own defaults drawn as
              controls ("no plans", "easy") and the third put the temperature
              back on a screen audit 57 had just finished removing it from.

              The rule that replaced them: this space says something only when
              the day ahead actually holds something. An occasion TODAY is
              already stated — with its own action, and above the look it
              competes with — by the interrupt further up, so what is left for
              this band is the trip inside the week. When there is neither,
              nothing renders and the plates begin higher.

              `hidden` on the refusal, as the chips were: a closet that could
              not be dressed has a different next action and T-12 owns it. */}
          {!nothingWorks && tripSoon && tripReminder.show ? (
            <View className="mx-gutter rounded-md bg-tray p-3.5" style={{ marginTop: 12 }}>
              <Text variant="eyebrow">{TODAY_COPY.tripAheadKicker}</Text>
              <Text variant="body" className="mt-1.5" numberOfLines={2}>
                {tripAheadLine(
                  tripSoon.destination.name,
                  daysUntilIso(tripSoon.startsOn, new Date()),
                )}
              </Text>
              {/* Two answers to one reminder: the trip's own screen, or an
                  acknowledgement. "Got it" is quiet muted ink beside the
                  accent action — the card's accent stays on the thing that
                  goes somewhere — and it dismisses THIS trip permanently
                  (per-trip AsyncStorage key; see `useTripReminder`). */}
              <View className="flex-row items-center" style={{ gap: 16 }}>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={TODAY_COPY.tripAheadAction}
                  onPress={() => router.push(`/trips/${tripSoon.id}`)}
                  fill
                  style={{ minHeight: ax ? 56 : 44 }}
                  contentStyle={{ flex: 1, justifyContent: 'center' }}
                  className="mt-1">
                  <Text variant="label" style={{ color: theme.accent }}>
                    {TODAY_COPY.tripAheadAction}
                  </Text>
                </PressableSurface>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={`${TODAY_COPY.tripAheadDismiss}, hide this reminder`}
                  onPress={tripReminder.dismiss}
                  fill
                  style={{ minHeight: ax ? 56 : 44, minWidth: MIN_TAP_TARGET }}
                  contentStyle={{ justifyContent: 'center', alignItems: 'center' }}
                  className="mt-1 px-2">
                  <Text variant="label" className="text-muted">
                    {TODAY_COPY.tripAheadDismiss}
                  </Text>
                </PressableSurface>
              </View>
            </View>
          ) : null}

          {/* An explicit pull always gets an answer, even when the answer is
              that nothing changed. Two answers, because "we couldn't reach it"
              over a model that was working and ran past its budget is the app
              blaming the network for its own slowness. Neither line promises a
              retry, and both end on the same reassurance: what is on screen is
              still today's. */}
          {refreshFailed && (outfits.status === 'offline' || outfits.status === 'timeout') ? (
            <Notice
              message={
                refreshFailed === 'timeout'
                  ? 'Styling took too long just now — these are still today’s.'
                  : 'Couldn’t refresh just now — these are still today’s.'
              }
              className="mt-2 px-gutter"
            />
          ) : null}

          {/* T-08 · slow. Additive: it appears UNDER the same layout rather
              than replacing it, which is what stops a slow response reading as
              a different failure. The escape hatch is real. */}
          {slow && !showWithoutReason && !nothingWorks ? (
            <SlowNotice onShowAnyway={() => setShowWithoutReason(true)} />
          ) : null}

          {/* The Repeat's exhausted state (P-03) — every core this closet can
              build already has a real worn record. Additive, above the day's
              plates rather than instead of them. */}
          {!nothingWorks && exhaustion.exhausted ? (
            <RepeatExhausted
              total={exhaustion.total}
              since={exhaustion.since}
              gap={topGap}
              topOutfitName={effectiveShown[0]?.name ?? null}
              topOutfitWearCount={
                effectiveShown[0]
                  ? wearsOfCore(
                      wornRecords,
                      items,
                      effectiveShown[0].candidate.items.map((g) => g.id),
                    ).length
                  : 0
              }
              onSeePlans={openRepeatUpsell}
              onSwapInstead={() => router.push('/closet')}
            />
          ) : null}

          <View className="mt-4">
            {nothingWorks ? (
              <>
                <NothingWorks
                  reason={nothingWorksReason(items, context.weather)}
                  onSeeWorn={() => router.push('/diary')}
                />
                {/* Computed reasoning only — no merchant, no price, no shop
                    word. The gap is named after the two closet-first ways
                    forward, never before them. */}
                {topGap ? (
                  <GapCard
                    tally={currentTally}
                    gain={topGap}
                    onOpen={() => router.push('/gap-feed')}
                  />
                ) : null}
              </>
            ) : (
              /* ── THE CAROUSEL ─────────────────────────────────────────
                 Three cards, side by side, one page at a time — not a stack
                 with parallax. A stack hides the second and third looks behind
                 the first and asks a reader to discover them; a paged row shows
                 that there are three, and the dots below say which one is up.

                 `FlatList` rather than a `ScrollView` of three: the paging
                 maths, the momentum snap and the accessibility of a paged
                 container are all things this component already gets right on
                 iOS, and hand-rolling them is how a swipe ends up landing
                 between two cards.

                 Each page carries its own action. A single shared "Wear this"
                 under the row would be a control whose meaning changes as you
                 scroll, and VoiceOver — which reads the page in order and never
                 scrolls — would announce it after whichever card it happened to
                 be next to. */
              <FlatList
                data={effectiveShown}
                keyExtractor={(outfit) => idOf(outfit.candidate.items)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                // The reader's own position, reported as a POSITION and never
                // as a count. Fired on settle rather than on every frame, so a
                // swipe that passes over card two on its way to card three does
                // not claim card two was read.
                onMomentumScrollEnd={(e) => {
                  const next = pageFromOffset(e.nativeEvent.contentOffset.x, pageWidth);
                  if (next === activePlate) return;
                  setActivePlate(next);
                  track(TODAY_EVENTS.plateViewed, plateViewedProps(next));
                }}
                contentContainerStyle={{ paddingHorizontal: 0 }}
                renderItem={({ item: outfit, index: i }) => {
                  const key = idOf(outfit.candidate.items);
                  // Real previous wears of THIS exact core — null when this is
                  // not a repeat, so the card renders no mark at all.
                  const previousWears = wearsOfCore(
                    wornRecords,
                    items,
                    outfit.candidate.items.map((g) => g.id),
                  );
                  const entryId = wornEntryIds[key];
                  const worn = wornIds.has(key);
                  const wearing = wearState[key] === 'pending';
                  const state = wearState[key];
                  const failure = state && state !== 'pending' ? state : null;
                  const hasAnother = outfits.shortlist.some(
                    (c) => !effectiveShown.some((o) => idOf(o.candidate.items) === idOf(c.items)),
                  );

                  return (
                    <View style={{ width: pageWidth, paddingHorizontal: GUTTER }}>
                      <TodayPlate
                        view={{
                          name: outfit.name,
                          piecesLine: piecesLine(outfit.candidate.items),
                          garments: outfit.candidate.items,
                          weatherMark: weatherRead.mark,
                          weatherSymbol: weatherRead.symbol,
                          positionLabel: positionLabel((i + 1) as PlateIndex),
                          // Nothing to apply since the chips were withdrawn —
                          // see the retirement note above `interrupt`. The
                          // prop stays on the view type for the surfaces that
                          // still compose a context.
                          applyingLabel: null,
                        }}
                        width={pageWidth - GUTTER * 2}
                        large={ax}
                        resolveImage={resolve}
                      />

                      {/* One filled action per card, directly beneath the card
                          it belongs to — which is also the VoiceOver order the
                          contract asks for: the outfit, then Wear this. */}
                      <View style={{ paddingTop: 16 }}>
                        {worn ? (
                          <WornMark
                            entryId={entryId ?? null}
                            undoing={unwear.isPending}
                            onUndo={() => {
                              if (!entryId) return;
                              unwear.mutate(
                                { entryId },
                                {
                                  onSuccess: () => {
                                    setWornIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(key);
                                      return next;
                                    });
                                    setWornEntryIds((prev) => {
                                      const next = { ...prev };
                                      delete next[key];
                                      return next;
                                    });
                                  },
                                },
                              );
                            }}
                            onAddNote={() => entryId && router.push(`/diary/${entryId}`)}
                          />
                        ) : (
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel={TODAY_COPY.wear}
                            busy={wearing}
                            onPress={() => handleWear(i)}
                            fill
                            style={{ minHeight: ax ? 56 : 44 }}
                            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                            className="rounded-md bg-accent px-6">
                            <Text variant="label" style={{ color: theme.canvas }}>
                              {TODAY_COPY.wear}
                            </Text>
                          </PressableSurface>
                        )}

                        {/* ALONGSIDE the day's decision, and under it — the
                            founder's word is "alongside", and on a 393pt
                            column beneath the filled pill IS alongside; two
                            outline pills flanking an oxblood one would make
                            three controls of equal width and no dominant
                            action, which is the one thing every frame on this
                            screen agrees about.

                            Not drawn over a worn card. Once a look has been
                            put on, the sheet has already asked for the opinion
                            that counts, and a second question about the same
                            outfit records two votes for one morning. */}
                        {!worn ? (
                          <TasteRow
                            value={reactions[key] ?? null}
                            large={ax}
                            disabled={outfits.status === 'offline'}
                            onChoose={(choice) => handleReact(i, choice)}
                            onClear={(choice) => handleReact(i, choice, true)}
                          />
                        ) : null}

                        {/* A write that did not land. The card is not lost and
                            nothing was recorded twice — the same tap retries. */}
                        {failure ? (
                          <View accessibilityRole="alert" style={{ paddingTop: 10 }}>
                            <Text variant="note" className="text-muted">
                              {wearFailureCopy(failure).body}
                            </Text>
                          </View>
                        ) : null}

                        {/* "Show another" only while the shortlist genuinely
                            has one left. Withholding a live control over an
                            empty list is how a tap comes to do nothing. */}
                        {!worn && previousWears.length > 0 && hasAnother ? (
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel="Show another"
                            onPress={() => handleShowAnother(i)}
                            fill
                            style={{ minHeight: ax ? 56 : 44 }}
                            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                            className="mt-2 rounded-md">
                            <Text variant="label" className="text-muted">
                              Show another
                            </Text>
                          </PressableSurface>
                        ) : null}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          {/* Decorative, and hidden from VoiceOver — the card speaks its own
              position, so a reader never has to find this row to learn where
              she is. */}
          {nothingWorks ? null : <PlateDots count={effectiveShown.length} active={activePlate} />}

          {/* A thin wardrobe: enough for today, said plainly and with no count.
              Not a refusal and not a floor — the plates above are real. */}
          {!nothingWorks && isThinWardrobe(effectiveShown.length) ? (
            <View className="px-gutter" style={{ paddingTop: 18 }}>
              <Text variant="eyebrow">{TODAY_COPY.thinKicker}</Text>
              <Text variant="body" className="mt-2 text-muted">
                {TODAY_COPY.thinBody}
              </Text>
            </View>
          ) : null}

          {/* TD-00 · the free closet, stated whole.
                 The frame the hallway hands into after MB-07 is closed: the
                 ten pieces the looks above were built from, and the one thing
                 that would change — with no price, no tier name and no action,
                 because "nothing is locked by the dismissal". It renders
                 nothing at all on any other closet; see `capacityNoteApplies`.
                 Not drawn over the refusal: a closet that could not be dressed
                 has a different next action, and T-12 owns it. */}
          {nothingWorks ? null : (
            <CapacityNote activePieces={items.length} plan={knownPlan} />
          )}

          {/* Say plainly how much it has actually learned (S-09/S-10) — as a
              mark rather than a sentence, since a gauge is what the copy was
              describing. The old line survives verbatim as the block's
              accessibilityLabel; see taste-mark.tsx. */}
          {shown.length > 0 && profileQuery.data ? (
            <View className="px-gutter pt-2">
              <TasteMark feedbackCount={feedbackCount} summary={profile.summary[0] ?? null} />
            </View>
          ) : null}

          {/* The page signing off. Only on a day that worked — never over the
              refusal, and the offline and empty-closet branches return long
              before this line. */}
          {nothingWorks ? null : (
            <View className="px-gutter pt-4">
              <InviteLine onInvite={() => router.push('/invite')} />
            </View>
          )}
        </Animated.ScrollView>
      </Animated.View>
      {/* The membership bubble, for an account that is not paying — founder
          order, 2026-08-18. A sibling of the scroll view rather than a child of
          it, so it arrives OVER the morning rather than pushing the outfit down
          the page; `TodayUpsell` is `pointerEvents="box-none"` outside its own
          card, so the carousel behind it still swipes.

          Drawn from this state and only this one. The loading, failed and
          under-the-floor branches return above and none of them mounts it: a
          closet that cannot be read is not a closet anyone can be told about,
          and an account under the activation floor has not met the product yet.

          Everything it says — and whether it says anything at all — is
          `features/billing/upsell-bubble.ts`. This site passes the plan state
          through and nothing else. */}
      <TodayUpsell
        plan={planState.plan}
        trialing={planState.trialing}
        trialEndsAt={planState.trialEndsAt}
        ready={!planState.loading && !planState.unconfirmed}
        onSeePlans={openRepeatUpsell}
      />

      {/* Redesign 13. The sheet is handed a PHASE rather than a boolean and a
          pre-rendered error string: the four states it draws — idle,
          confirming, settled, failed — are distinct compositions, and a
          `pending` boolean could not tell a settled wear from an untouched one.

          `wearSettled` keeps the sheet open after the transaction lands so the
          reader sees the wear become history rather than the sheet vanishing
          underneath them, which is what the accepted frames draw and what
          leaves somebody unsure whether it saved. */}
      <WearConfirmationSheet
        key={wearSelection ? idOf(wearSelection.candidate.items) : 'closed'}
        visible={wearSelection !== null}
        outfitName={wearSelection?.name ?? ''}
        garments={wearSelection?.candidate.items ?? []}
        resolveImage={resolve}
        phase={
          wear.isPending
            ? 'confirming'
            : wearSettled
              ? 'settled'
              : wearSheetError
                ? 'failed'
                : 'idle'
        }
        error={wearSheetError}
        offline={offline}
        idempotent={wearRetried}
        onCancel={() => {
          // Belt and braces: the sheet refuses to offer a dismissal while
          // confirming, and this refuses to act on one. Two guards because the
          // cost of a dismissal landing mid-write is a transaction nobody is
          // waiting for the answer to.
          if (wear.isPending) return;
          closeWearSheet();
        }}
        onConfirm={confirmWear}
        onSignIn={() => {
          closeWearSheet();
          router.push('/(auth)/sign-in');
        }}
        onDone={closeWearSheet}
      />
    </SafeAreaView>
  );
}
