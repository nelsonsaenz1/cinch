import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Plate } from '@/components/today/plate';
import type { ReactionValue } from '@/components/today/reaction-bar';
import { closetGap, gapBody, SamplePlate } from '@/components/today/sample-plate';
import { WeatherStrip } from '@/components/today/weather-strip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { PlateSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { startTagSweeper } from '@/features/ingest/upload-queue';
import { Placement } from '@/features/billing/placements';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { useReactToOutfit, useWearOutfit } from '@/features/styling/mutations';
import { canGenerate, MIN_CLOSET_FOR_OUTFITS, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { useOutfits } from '@/features/styling/use-outfits';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES, targetWarmth, type Garment, type WeatherContext } from '@/lib/styling';
import { supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/** Stable identity for a candidate: the exact set of garments in it. */
const idOf = (items: { id: string }[]) => items.map((g) => g.id).join('.');

/**
 * The masthead date line — "Tue 5 Aug · Denver": weekday, day, month, place.
 * The place is the reverse-geocoded city from the device's own position, never
 * a constant; it reads as the fallback city only when location is off, and the
 * strip below says so and offers to turn it on.
 */
function dayLine(city: string) {
  const now = new Date();
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
function syncedLine(updatedAt: number): string {
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
function greetingForNow(name?: string | null) {
  const h = new Date().getHours();
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
      className="items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark">
      <SymbolView name="sparkles" size={16} tintColor={theme.accent} resizeMode="scaleAspectFit" />
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
 */
function Masthead({ city, name }: { city: string; name?: string | null }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View className="px-gutter pt-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="eyebrow">{dayLine(city)}</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="display" trim accessibilityRole="header">
              {greetingForNow(name)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2" style={{ marginTop: 2 }}>
          <StylistButton />
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={8}
            style={{ width: 34, height: 34 }}
            className="items-center justify-center rounded-full bg-ink active:opacity-60 dark:bg-ink-dark">
            <SymbolView
              name="person.fill"
              size={15}
              tintColor={theme.canvas}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </View>
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
function ReducedMasthead({ eyebrow }: { eyebrow: string }) {
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
function nothingWorksReason(items: Garment[], weather: WeatherContext | null): string {
  const has = (slot: Garment['slot']) => items.some((g) => g.slot === slot);

  if (!has('base_top') && !has('dress')) {
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
function NothingWorks({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  const router = useRouter();
  const theme = useTheme();

  const rows: {
    icon: React.ComponentProps<typeof SymbolView>['name'];
    label: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'bubble.left.and.text.bubble.right',
      label: 'Ask the stylist for a way around it',
      onPress: () => router.navigate('/stylist'),
    },
    { icon: 'plus', label: 'Add a piece Cinch is missing', onPress: () => router.push('/capture') },
    { icon: 'arrow.clockwise', label: 'Try again once things change', onPress: onRetry },
  ];

  return (
    <Card padding="xl" className="mx-gutter">
      <Text variant="title">Nothing today feels right — and I won&apos;t pretend it does.</Text>
      <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
        {reason}
      </Text>
      <View className="my-4">
        <Rule />
      </View>
      <SectionHeader title="What might help" className="mb-3" />
      <View className="gap-3">
        {rows.map((r) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            className="flex-row items-center gap-3 active:opacity-60">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-accent-light">
              <SymbolView name={r.icon} size={15} tintColor={theme.accent} resizeMode="scaleAspectFit" />
            </View>
            <Text variant="body">{r.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
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

  // What the looks are for — the user's own words first, else the day's first
  // calendar event. Carried into each plate's share artifact.
  const occasion = committedNote || context.events[0]?.title || null;

  // Sign every garment image in one request rather than one per card.
  const { resolve } = useSignedUrls(
    shown.flatMap((o) => o.candidate.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );

  const react = useReactToOutfit();
  const wear = useWearOutfit();
  const gate = useGate();

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
      const outfit = shown[index];
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
    [shown, profile, outfits.shortlist, react],
  );

  const handleWear = useCallback(
    (index: number) => {
      const outfit = shown[index];
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
          onSuccess: () => {
            setWearState((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setWornIds((prev) => new Set(prev).add(key));
          },
          onError: () => setWearState((prev) => ({ ...prev, [key]: 'failed' })),
        },
      );
    },
    [shown, context, wear],
  );

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
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <ReducedMasthead eyebrow={dayLine(cityLabel)} />
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
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
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
          <Text variant="body" className="mt-3.5 text-muted dark:text-muted-dark">
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
    // The empty-closet ladder (T-04/05/06). Zero items is the only closet the
    // virgin copy ("I can't style what I can't see") is honest about — above
    // zero and below the threshold that same copy reads as a failed upload to
    // someone who just photographed real garments, so the rungs diverge: the
    // sample plate stays, one tile goes dashed and names the missing slot, and
    // the eyebrow prints the count as proof the uploads worked.
    const gap = closetGap(items, MIN_CLOSET_FOR_OUTFITS);
    const empty = gap.kind === 'virgin';
    const pieces = `${items.length} ${items.length === 1 ? 'piece' : 'pieces'} in`;

    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {/* The masthead reduces to the date and the section name; the stylist
            door stays, the profile chip drops (T-04). */}
        <ReducedMasthead eyebrow={dayLine(cityLabel)} />

        {/* A ScrollView, not a plain centred `flex-1` View: at a large Dynamic
            Type setting every piece of this composition grows taller, and a
            fixed viewport has nowhere to put the overflow. `flexGrow` keeps
            the centred composition when it fits and scrolls when it doesn't
            (the atlas calls this out on T-04). */}
        <ScrollView
          contentContainerClassName="flex-grow items-center justify-center px-gutter"
          contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Not an empty tray: a miniature sample plate under a "What your
              mornings become" eyebrow shows the destination — the happy path
              in matchbook form, on clearly-bundled sample data. */}
          <Text variant="colophon" style={{ marginBottom: 10 }}>
            {empty ? 'What your mornings become' : `What your mornings become · ${pieces}`}
          </Text>

          <SamplePlate gap={gap} />

          <View style={{ marginTop: 26 }}>
            <Text variant="title" className="text-center">
              {empty ? (
                <>
                  I can&apos;t style{'\n'}what I can&apos;t see
                </>
              ) : (
                // Always this title on the part-built rungs (T-05/06); the
                // body below carries which slot or count is short.
                <>You&rsquo;re almost there</>
              )}
            </Text>
          </View>

          <Text
            variant="body"
            className="mt-3 text-center text-muted dark:text-muted-dark"
            style={{ maxWidth: 264 }}>
            {gapBody(gap)}
          </Text>

          {/* Ink, not oxblood: the one spent accent is reserved for a loved
              look, and the shared Button has no ink variant — so this is an
              inline pill in the plate grammar, its label lit inline. */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              router.push('/capture');
            }}
            accessibilityRole="button"
            accessibilityLabel={empty ? 'Add your clothes' : 'Add more clothes'}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-7 flex-row items-center justify-center rounded-md bg-ink px-6 active:opacity-70 dark:bg-ink-dark">
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              {empty ? 'Add your clothes' : 'Add more clothes'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Offline is not the normal screen dimmed — it is its own composition
  // (T-10/T-11), and the order says why. The banner comes first, above
  // everything, because the staleness qualifies the entire page; the masthead
  // drops to when the app last reached the server, since there is no fresh
  // morning to greet (the ✦ stylist door stays — it never closes); and every
  // plate loses the parts the network paid for.
  if (offline) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <ScrollView
          contentContainerClassName="pb-10"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
          }>
          {/* Said plainly and once, in ink, so it reads as a state of the whole
              screen rather than a per-card warning. */}
          <View className="mx-gutter mt-1.5 flex-row items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5">
            <View
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accentWarm }}
            />
            <Text variant="label" className="flex-1 font-medium" style={{ color: theme.canvas }}>
              Offline — showing this morning&rsquo;s set. Weather and plans may have moved on.
            </Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <ReducedMasthead eyebrow={syncedLine(wardrobe.dataUpdatedAt)} />
          </View>

          {shown.length === 0 ? (
            /* Offline AND nothing the local engine can build. The banner above
               has already said the network is the reason the page is stale;
               the card below is still the honest account of the wardrobe, and
               the two together stop the app blaming the closet for the
               connection. Not dimmed — the card is not a stale artifact, it is
               a live reading of what is actually in the closet. */
            <View className="mt-5">
              <NothingWorks reason={nothingWorksReason(items, context.weather)} onRetry={refresh} />
            </View>
          ) : (
            /* Dimmed as one block: the set is real, but it is this morning's,
               and so is the note under it. */
            <View className="mt-5" style={{ opacity: 0.62 }}>
              {shown.map((outfit, i) => (
                <Plate
                  key={idOf(outfit.candidate.items)}
                  outfit={outfit}
                  index={i}
                  occasion={occasion}
                  colophon={{ city: cityLabel, feelsLikeC: context.weather?.feelsLikeC }}
                  resolveImage={resolve}
                  offline
                  onWear={() => handleWear(i)}
                  onReact={(value) => handleReact(i, value)}
                />
              ))}

              {/* The reactions are gone from the card because they cannot reach
                  the learner. Say what happens instead. */}
              <Text variant="caption" className="px-gutter text-center">
                Reactions will sync once you&rsquo;re back online.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const feedbackCount = profile.feedbackCount;
  // The day the engine could not dress. Like the empty closet, it drops the
  // greeting and the plans pill: the card below carries the only three things
  // that would change the answer.
  const nothingWorks = shown.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      {/* `style`, not `flex-1` — NativeWind classes do not reach Reanimated
          components in this project. */}
      <Animated.View entering={FadeIn.duration(motion.duration.base)} style={{ flex: 1 }}>
        <ScrollView
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />
          }>
          {nothingWorks ? (
            <ReducedMasthead eyebrow={dayLine(cityLabel)} />
          ) : (
            <Masthead city={cityLabel} name={firstName} />
          )}

          <WeatherStrip
            weather={context.weather}
            events={context.events}
            city={cityLabel}
            usingFallbackLocation={usingFallbackLocation}
            onEnableLocation={() => void requestLocation()}
            calendarEnabled={calendarEnabled}
            onConnectCalendar={() => void requestCalendar()}
            // T-09 keeps the weather line — the card's reason is read against
            // it — and drops the calendar and permission lines with the pill.
            weatherOnly={nothingWorks}
          />

          {/* The plans note, set as the design's tray pill with a leading "+".
              The multi-event differentiator, reachable without the calendar:
              "dinner at 7 then drinks after" is the exact sentence the engine is
              built for, and typing it must not require a permission grant. Clay,
              not oxblood — the one spent accent stays reserved for a loved look. */}
          {nothingWorks ? null : (
            <>
              <View className="mx-gutter mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5 py-2.5 dark:bg-tray-dark">
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
                  placeholderTextColor={theme.faint}
                  accessibilityLabel="Describe your plans today"
                  className="flex-1 font-body text-callout text-ink dark:text-ink-dark"
                />
              </View>

              {/* The sentence went somewhere. Committing the note silently
                  re-runs the whole engine, and the screen used to give no sign
                  it had been read at all — the app's single most differentiating
                  input felt inert. The × puts it back. */}
              {committedNote ? (
                <View
                  className="mx-gutter mt-1.5 flex-row items-center gap-2"
                  accessibilityLiveRegion="polite">
                  <Text variant="caption" numberOfLines={2} className="flex-1">
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
              that nothing changed. Gated on the error still standing, so a
              re-rank that later comes back clean retires the line without
              anyone having to remember to clear it. */}
          {refreshFailed && outfits.aiError ? (
            <Notice
              message="Couldn’t refresh just now — these are still today’s."
              className="mt-2 px-gutter"
            />
          ) : null}

          <View className="mt-4">
            {nothingWorks ? (
              <NothingWorks reason={nothingWorksReason(items, context.weather)} onRetry={refresh} />
            ) : (
              shown.map((outfit, i) => {
                const key = idOf(outfit.candidate.items);
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
                    enhancing={outfits.isEnhancing}
                    onWear={() => handleWear(i)}
                    onReact={(value) => handleReact(i, value)}
                  />
                );
              })
            )}
          </View>

          {/* Say plainly how much it has actually learned (S-09/S-10). Implying
              a rich taste model after two taps is a promise the engine cannot
              keep — and gated on the profile actually having loaded, because
              "8 more reactions" read off the placeholder profile is a claim
              about a count the app has not seen yet. */}
          {shown.length > 0 && profileQuery.data ? (
            <View className="px-gutter pt-2">
              <Text variant="label">
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
