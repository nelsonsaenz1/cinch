import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapacityNote } from '@/components/today/capacity-note';
import { ClosetFloor } from '@/components/today/closet-floor';
import { contextLines, contextRungs, feelsClause } from '@/components/today/context-label';
import { GapCard } from '@/components/today/gap-card';
import { OccasionInterrupt } from '@/components/today/occasion-interrupt';
import { OFFLINE_ACTIONS_REASON, OfflineNotice } from '@/components/today/offline-notice';
import { Plate } from '@/components/today/plate';
import { PlateSkeleton, SLOW_NOTICE_MS, SlowNotice } from '@/components/today/plate-skeleton';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { AX3_FONT_SCALE } from '@/theme/type-scale';
import type { ReactionValue } from '@/components/today/reaction-bar';
import { RepeatExhausted } from '@/components/today/repeat-exhausted';
import { WeatherStrip } from '@/components/today/weather-strip';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { countOutfits, rankGaps, tallyOf } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { startTagSweeper } from '@/features/ingest/upload-queue';
import { Placement } from '@/features/billing/placements';
import { PLANS } from '@/features/billing/plans';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { useUnwearEntry } from '@/features/diary/mutations';
import { useMyEvents } from '@/features/events/queries';
import { useReactToOutfit, useWearOutfit } from '@/features/styling/mutations';
import { exhaustionProgress, wearsOfCore } from '@/features/styling/repeat';
import { canGenerate, MIN_CLOSET_FOR_OUTFITS, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { useOutfits, type StyledOutfit } from '@/features/styling/use-outfits';
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
import { describeWeather, formatTemp } from '@/features/context/weather';
import { track, trackOnce } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/**
 * The Repeat's local fallback naming for a "show me another" swap.
 *
 * `useOutfits`'s own `fromEngine` does exactly this and is not exported, so
 * this is a deliberate, minimal duplicate of its naming rule rather than a
 * reach into a private helper — same fallback name ("From your closet"), same
 * `explain()` call, no AI re-rank (a local swap is instant; waiting fifteen
 * seconds for a name defeats the point of "show me another").
 */
function localStyledOutfit(candidate: OutfitCandidate): StyledOutfit {
  return {
    candidate,
    name: candidate.notes.weather ?? 'From your closet',
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
 * The stylist door, per the field guide's masthead row (§02): the ✦ glyph,
 * always reachable, in every state the screen can be in.
 *
 * Extracted so every masthead — full and reduced alike — carries it. Before
 * this it lived only inside `Masthead`, which renders exclusively on a normal
 * day with outfits on screen; every other state (loading, a failed fetch, an
 * empty closet, "nothing works", offline) fell back to `ReducedMasthead`,
 * which never had it. A founder opening the app new, or on a day the engine
 * came back empty, had no way to reach the stylist at all — not subtle,
 * simply absent. `navigate`, not `push`: a fast double-tap must not stack two
 * sheets. 34pt with 8pt of hitSlop clears the 44pt minimum tap target on
 * every side.
 */
function StylistButton() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.navigate('/stylist')}
      accessibilityRole="button"
      accessibilityLabel="Ask the stylist"
      hitSlop={8}
      style={{ width: 34, height: 34 }}
      className="items-center justify-center rounded-full border border-rule active:opacity-60">
      <SymbolView name="sparkles" size={16} tintColor={theme.accent} resizeMode="scaleAspectFit" />
    </Pressable>
  );
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
    <Pressable
      onPress={() => router.navigate('/activity')}
      accessibilityRole="button"
      accessibilityLabel={unseen ? 'Activity, something waiting' : 'Activity'}
      hitSlop={8}
      style={{ width: 34, height: 34 }}
      className="items-center justify-center rounded-full border border-rule active:opacity-60">
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
    </Pressable>
  );
}

/**
 * The page header: the day and place as a tracked eyebrow, and a serif greeting.
 *
 * No rule under it. The design sets the greeting, the weather line and the
 * plans pill as one unbroken block; a hairline here cuts the day in half.
 *
 * The trailing chips are the only doors to Stylist and Profile — both lost
 * their tabs in the three-tab restructure. The stylist is the app's sparkle
 * (the same oxblood mark the stylist screen carries); the profile is the ink
 * avatar well.
 *
 * ── TM-01 / TM-02 / TM-03 — ONE LINE FOR THE GREETING, AT EVERY WIDTH ─────
 *
 * "Good morning, Nelson." must not wrap or clip at 393 pt or at 430 pt, and
 * the fix is hierarchy rather than truncation. Two things were wrong.
 *
 * FIRST, the four control chips sat in a column BESIDE the greeting, taking
 * about 150 pt off the measure the serif had to fit into. They now sit on the
 * CONTEXT ROW with the date, which is where an eyebrow can happily lose the
 * width and where the 44 pt targets are unaffected — and the greeting gets the
 * whole gutter beneath them.
 *
 * SECOND, the greeting was set at `display`'s 40 px. TM-01 measures it at 30
 * and TM-02 at 32, "rather than scaling with the width, so the two devices read
 * as the same screen". Hence the two type steps and the width switch below.
 *
 * At AX3 the greeting is REMOVED rather than wrapped and the calendar control
 * goes with it — the outfit becomes the first thing on the screen. That was
 * already the strategy; what changed is the threshold, which used to be the top
 * of the standard type range and is now the accessibility size the frame names.
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
   * The largest supported type. The greeting is the first thing dropped — "a
   * name the user already knows is the first thing worth spending to keep the
   * outfit above the fold" — and the context label breaks over two lines
   * rather than truncating. Defaults to the device's own font scale.
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
}: {
  city: string;
  name?: string | null;
  weather?: string | null;
  stacked?: boolean;
  now?: Date;
  unseen?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { fontScale, width } = useWindowDimensions();
  // Two thresholds, two decisions. `ax` decides whether the CONTEXT LABEL
  // breaks over two lines; `ax3` decides whether the greeting is there at all.
  const ax = stacked ?? fontScale >= AX_FONT_SCALE;
  const ax3 = stacked ?? fontScale >= AX3_FONT_SCALE;

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
          <StylistButton />
          {/* Correction 07: the occasion composer, restored as a 44×44
              calendar-plus at the trailing edge, opening /event/new. It sits
              inside the existing masthead height — "the 56 pt text field is
              what was wrong, not the entry point".

              TM-03 collapses it into the profile sheet at AX3: four chips on
              one row at that scale leave the date nothing, and /event/new is
              reachable from Plan, so nothing is lost — unlike the profile
              door, which is the only one there is. */}
          {ax3 ? null : (
            <Pressable
              onPress={() => router.navigate('/event/new')}
              accessibilityRole="button"
              accessibilityLabel="New occasion"
              hitSlop={8}
              style={{ width: 34, height: 34 }}
              className="items-center justify-center rounded-full border border-rule active:opacity-60">
              <SymbolView
                name="calendar.badge.plus"
                size={15}
                tintColor={theme.ink}
                resizeMode="scaleAspectFit"
              />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={8}
            style={{ width: 34, height: 34 }}
            className="items-center justify-center rounded-full bg-ink active:opacity-60">
            <SymbolView
              name="person.fill"
              size={15}
              tintColor={theme.canvas}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </View>

      {/* THE GREETING — full width, one line, removed rather than wrapped.
          `numberOfLines={1}` is a tripwire, not a truncation strategy: at 30 pt
          with 118 pt of headroom nothing reaches it, and if a name ever did,
          one clipped line is a visible bug where a silent second line is not. */}
      {ax3 ? null : (
        <View style={{ marginTop: 12 }}>
          <Text
            variant={width >= WIDE_DEVICE ? 'greetingWide' : 'greeting'}
            trim
            numberOfLines={1}
            accessibilityRole="header">
            {greetingForNow(name, now)}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The reduced masthead: the eyebrow and the section name, plus the same ✦
 * stylist door the full masthead carries.
 *
 * Shared by every state that has no morning to greet — first load, a failed
 * fetch, a brand-new user with no closet, a day the engine could not dress,
 * and offline. All of them still need a stylist to ask (the honest
 * "nothing works" card even names it as the first thing that might help), so
 * the door stays lit even when there is no greeting to put it next to. Only
 * the profile avatar drops — there is no fresh morning to attribute to
 * anyone.
 */
export function ReducedMasthead({ eyebrow }: { eyebrow: string }) {
  return (
    <View className="px-gutter pt-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="eyebrow">{eyebrow}</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="display" trim accessibilityRole="header">
              Today
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 2 }}>
          <StylistButton />
        </View>
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
    return "Your closet doesn't have a top or a dress in it yet — every outfit needs one of the two.";
  }
  if (!has('bottom') && !has('dress')) {
    return "Your closet doesn't have bottoms or a dress in it yet — every outfit needs one of the two.";
  }

  const target = weather ? targetWarmth(weather.feelsLikeC, weather.windKph) : null;
  if (target !== null && target >= 9 && !has('outerwear') && !has('mid_layer')) {
    return "Today calls for real warmth, and there's no coat or heavy layer in your closet yet.";
  }

  return "Cinch couldn't build an outfit that holds together from what's in your closet right now. One more layer, or a pair of shoes, usually fixes it.";
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See what you have worn before"
        onPress={onSeeWorn}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-5 items-center justify-center rounded-md border border-rule px-4 active:opacity-70">
        <Text variant="label">
          See what you&rsquo;ve worn before
        </Text>
      </Pressable>
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

  const [note, setNote] = useState('');
  const [committedNote, setCommittedNote] = useState('');
  const [reactions, setReactions] = useState<Record<string, ReactionValue>>({});
  const [wornIds, setWornIds] = useState<Set<string>>(new Set());
  // Wear, per outfit rather than per screen. `wear.isPending` is the mutation's
  // global flag, so keying off it froze and spun every plate at once when one
  // was tapped — and a failed write left no trace at all.
  const [wearState, setWearState] = useState<Record<string, 'pending' | 'failed'>>({});
  // The diary entry each worn look created — T-14's Undo and its note both
  // address it by id.
  const [wornEntryIds, setWornEntryIds] = useState<Record<string, string>>({});
  // T-08's escape hatch: show the look without waiting for the reasoning.
  const [showWithoutReason, setShowWithoutReason] = useState(false);
  // T-08's notice, which appears only once the wait is genuinely long.
  const [slow, setSlow] = useState(false);
  // An explicit pull-to-refresh that came back with nothing to show for itself.
  const [refreshFailed, setRefreshFailed] = useState(false);

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
  } =
    useStyleContext({ note: committedNote || null });

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
    () => shown.map((o, i) => (shownOverride[i] ? localStyledOutfit(shownOverride[i]!) : o)),
    [shown, shownOverride],
  );

  const handleShowAnother = useCallback(
    (i: number) => {
      const onScreen = new Set(effectiveShown.map((o) => idOf(o.candidate.items)));
      const next = outfits.shortlist.find((c) => !onScreen.has(idOf(c.items)));
      // Never withhold — if the shortlist has nothing left to offer, the tap
      // simply does nothing rather than repeating the same outfit under a
      // "new" label.
      if (!next) return;
      void Haptics.selectionAsync().catch(() => {});
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
  const viewedRef = useRef<string | null>(null);
  const platesOnScreen =
    !wardrobe.isLoading && !wardrobe.isError && canGenerate(items) && effectiveShown.length > 0;
  const viewedSource = effectiveShown[0]?.source ?? null;
  const viewedCount = effectiveShown.length;
  const viewedKey = platesOnScreen
    ? `${viewedSource}|${effectiveShown.map((o) => idOf(o.candidate.items)).join('/')}`
    : null;
  useEffect(() => {
    if (!viewedKey || viewedRef.current === viewedKey) return;
    viewedRef.current = viewedKey;
    track('outfit_set_viewed', {
      surface: 'today',
      // The number of plates, never anything about what is on them.
      count: viewedCount,
      // Which engine produced the set the reader is actually looking at.
      source: viewedSource ?? 'engine',
      offline,
    });
    // `offline`, `viewedCount` and `viewedSource` are read, not depended on:
    // all three belong to the moment the set first appeared, and every one of
    // them is already folded into `viewedKey` or fixed by it. Adding them here
    // would only re-run an effect the ref already blocks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedKey]);

  // What the looks are for — the user's own words first, else the day's first
  // calendar event. Carried into each plate's share artifact.
  const occasion = committedNote || context.events[0]?.title || null;

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
  const totalCores = useMemo(() => countOutfits(currentTally), [currentTally]);
  const exhaustion = useMemo(
    () => exhaustionProgress(items, wornRecords),
    [items, wornRecords],
  );
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

  const handleReact = useCallback(
    (index: number, value: ReactionValue) => {
      // `effectiveShown`, not `shown` — after a "show me another" tap the
      // plate at this index is the swapped-in candidate, and a reaction has
      // to be recorded against what the user is actually looking at.
      const outfit = effectiveShown[index];
      if (!outfit) return;

      const key = idOf(outfit.candidate.items);

      // Optimistic, but honest about it. The card acknowledges the tap
      // immediately — anything slower feels broken — while carrying `pending`
      // until the write is confirmed, and flipping to `failed` rather than
      // silently claiming to have learned something it never received.
      const settle = (status: 'saved' | 'failed') =>
        setReactions((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], status } } : prev));

      setReactions((prev) => ({ ...prev, [key]: { ...value, status: 'pending' } }));

      react.mutate(
        {
          candidate: outfit.candidate,
          // The learner needs everything that was on screen, not just this card.
          // Passing only the reacted outfit makes the baseline equal the sample
          // and every gradient collapses to zero — silently.
          shownAlongside: outfits.shortlist,
          liked: value.liked,
          profile,
          reason: value.reason,
          source: 'today',
        },
        {
          onSuccess: () => settle('saved'),
          onError: () => settle('failed'),
        },
      );
    },
    [effectiveShown, profile, outfits.shortlist, react],
  );

  const handleWear = useCallback(
    (index: number) => {
      const outfit = effectiveShown[index];
      if (!outfit) return;
      const key = idOf(outfit.candidate.items);

      // Same shape as `handleReact` above, and for the same reason: the write
      // is an online-only command with no queue behind it, so the card has to
      // be able to say "in flight", "done" and "never landed" as three
      // different things. `wear_count` and cost-per-wear are the numbers the
      // product is about — they must never diverge silently.
      setWearState((prev) => ({ ...prev, [key]: 'pending' }));

      wear.mutate(
        { candidate: outfit.candidate, context, reasoning: outfit.reasoning },
        {
          onSuccess: (outfitId) => {
            setWearState((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setWornIds((prev) => new Set(prev).add(key));
            // T-14's Undo and "Add a note" both need the diary entry this
            // wear created. `wear_outfit_tx` returns its id and this is the
            // only moment it is available — nothing else on Today can find it.
            if (typeof outfitId === 'string') {
              setWornEntryIds((prev) => ({ ...prev, [key]: outfitId }));
            }
          },
          onError: () => setWearState((prev) => ({ ...prev, [key]: 'failed' })),
        },
      );
    },
    [effectiveShown, context, wear],
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

  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  // T-02. Read from real occasions rather than the device calendar, because
  // the interrupt's single action lands on the occasion's own outfits page and
  // only a Cinch occasion has one. Today's, soonest first.
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
    setRefreshFailed(false);
    void qc.invalidateQueries({ queryKey: ['wardrobe'] });
    void qc.invalidateQueries({ queryKey: ['weather'] });
    // `refetch`, not an invalidation: the re-rank's key is content-derived
    // (['outfit-rerank', shortlist…]), so with an unchanged shortlist no key
    // ever goes stale and an invalidation of a guessed name is a no-op. This
    // is the hook's own handle for exactly this moment.
    void refetchRerank();
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
      else setRefreshFailed(true);
    });
  }, [outfits.aiError, gate]);


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
        <Animated.View exiting={FadeOut.duration(motion.duration.fast)} style={{ marginTop: 24 }}>
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

  if (!canGenerate(items)) {
    // T-10 and T-11 — an empty closet and a closet under the engine's floor,
    // told apart. Both keep the real masthead: the date, the place and the
    // weather are known whether or not there is anything to style, and the
    // reader is greeted either way.
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
            remaining={Math.max(0, MIN_CLOSET_FOR_OUTFITS - items.length)}
            resolveImage={resolve}
            onStart={() => {
              void Haptics.selectionAsync().catch(() => {});
              // The Ten, "resumed at the count rather than restarted" — it
              // hydrates from the closet it finds. A closet already past the
              // free cap has no Ten left to run, and takes the chooser.
              router.push(items.length >= PLANS.free.items ? '/add-clothes' : '/the-ten');
            }}
            onDescribe={() => {
              void Haptics.selectionAsync().catch(() => {});
              router.push('/walkthrough');
            }}
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
              {effectiveShown.map((outfit, i) => (
                <Plate
                  key={idOf(outfit.candidate.items)}
                  outfit={outfit}
                  index={i}
                  occasion={occasion}
                  colophon={{ city: cityLabel, feelsLikeC: null }}
                  resolveImage={resolve}
                  offline
                  dated={closetDay ? `Closet as of ${closetDay}` : null}
                  stacked={ax}
                  actionsUnavailable={OFFLINE_ACTIONS_REASON}
                  onWear={() => handleWear(i)}
                  onReact={(value) => handleReact(i, value)}
                />
              ))}
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
      <Animated.View entering={FadeIn.duration(motion.duration.base)} style={{ flex: 1 }}>
        <ScrollView
          contentContainerClassName="pb-24"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
          }>
          {/* One masthead in every state: one context label carrying date,
              place and temperature, one greeting, the action pair at the
              trailing edge. Capped at 96 pt (audit 56). */}
          <Masthead city={cityLabel} name={firstName} weather={weatherClause} />

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

          {/* THE OCCASION COMPOSER — kept, and reported as a conflict.
              T-01 does not draw this field, and correction 07 restores the
              calendar-plus in the masthead in its place. But §11 of the atlas
              explicitly does NOT authorise where the free-text composer goes,
              and it is the only permission-free path the day's plans have into
              the engine: `/event/new` writes a Cinch occasion, which
              `useStyleContext` never reads, while this field and the device
              calendar are the two inputs it does. Deleting it would silently
              remove the ability to say "dinner at 7 then drinks after", which
              is the sentence the engine exists for. It stays where it was
              until the IA decision is made by someone authorised to make it. */}
          {nothingWorks ? null : (
            <>
              <View className="mx-gutter mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5 py-2.5">
                <SymbolView
                  name="plus"
                  size={15}
                  tintColor={theme.accentWarm}
                  resizeMode="scaleAspectFit"
                />
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  onSubmitEditing={() => setCommittedNote(note.trim())}
                  onBlur={() => setCommittedNote(note.trim())}
                  returnKeyType="done"
                  placeholder="What's on today?"
                  placeholderTextColor={theme.muted}
                  accessibilityLabel="Describe your plans today"
                  className="flex-1 font-body text-callout text-ink"
                />
              </View>

              {committedNote ? (
                <View
                  className="mx-gutter mt-1.5 flex-row items-center gap-2"
                  accessibilityLiveRegion="polite">
                  <Text variant="note" numberOfLines={2} className="flex-1">
                    Styling for &ldquo;{committedNote}&rdquo;.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setNote('');
                      setCommittedNote('');
                    }}
                    hitSlop={14}
                    accessibilityRole="button"
                    accessibilityLabel="Clear your plans for today"
                    className="active:opacity-60">
                    <SymbolView
                      name="xmark"
                      size={11}
                      tintColor={theme.muted}
                      resizeMode="scaleAspectFit"
                    />
                  </Pressable>
                </View>
              ) : null}
            </>
          )}

          {/* An explicit pull always gets an answer, even when the answer is
              that nothing changed. */}
          {refreshFailed && outfits.aiError ? (
            <Notice
              message="Couldn’t refresh just now — these are still today’s."
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
              currentCountOfKind={topGap ? currentTally[topGap.kind] : 0}
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
              effectiveShown.map((outfit, i) => {
                const key = idOf(outfit.candidate.items);
                // Real previous wears of THIS exact core — null when this is
                // not a repeat, so the plate renders no mark at all.
                const previousWears = wearsOfCore(
                  wornRecords,
                  items,
                  outfit.candidate.items.map((g) => g.id),
                );
                const entryId = wornEntryIds[key];
                return (
                  <Plate
                    key={key}
                    outfit={outfit}
                    index={i}
                    occasion={occasion}
                    colophon={{ city: cityLabel, feelsLikeC: context.weather?.feelsLikeC }}
                    resolveImage={resolve}
                    reacted={reactions[key] ?? null}
                    worn={wornIds.has(key)}
                    wearing={wearState[key] === 'pending'}
                    wearFailed={wearState[key] === 'failed'}
                    stacked={ax}
                    // One accent per frame: the interrupt takes it when it is
                    // on screen.
                    accent={!interrupt}
                    hideRationale={showWithoutReason}
                    onOpenPiece={(g) => router.push(`/item/${g.id}`)}
                    // T-14 · what the wear changed, and the 24 hours in which
                    // it can be changed back. Only offered once the write has
                    // actually landed and returned its diary entry — an Undo
                    // with nothing to address is a dead control.
                    wornBand={
                      entryId
                        ? {
                            undoing: unwear.isPending,
                            onUndo: () => {
                              void Haptics.selectionAsync().catch(() => {});
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
                            },
                            onAddNote: () => router.push(`/diary/${entryId}`),
                          }
                        : null
                    }
                    onWear={() => handleWear(i)}
                    onReact={(value) => handleReact(i, value)}
                    repeat={
                      previousWears.length > 0
                        ? {
                            previousWears,
                            pieceCount: items.length,
                            totalCores,
                            onSeePlans: openRepeatUpsell,
                            onShowAnother: () => handleShowAnother(i),
                          }
                        : null
                    }
                  />
                );
              })
            )}
          </View>

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

          {/* Say plainly how much it has actually learned (S-09/S-10). */}
          {shown.length > 0 && profileQuery.data ? (
            <View className="px-gutter pt-2">
              <Text variant="note">
                {feedbackCount < 8
                  ? `${8 - feedbackCount} more reactions and Cinch will start recognising your taste.`
                  : profile.summary.length
                    ? `Learning from ${feedbackCount} reactions — it thinks you ${profile.summary[0]}.`
                    : `Learning from ${feedbackCount} reactions.`}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
