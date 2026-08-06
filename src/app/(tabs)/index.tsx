import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Plate } from '@/components/today/plate';
import type { ReactionValue } from '@/components/today/reaction-bar';
import { WeatherStrip } from '@/components/today/weather-strip';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { startTagSweeper } from '@/features/ingest/upload-queue';
import { Placement } from '@/features/billing/placements';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { useReactToOutfit, useWearOutfit } from '@/features/styling/mutations';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { useOutfits } from '@/features/styling/use-outfits';
import { track } from '@/lib/posthog';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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
          <Pressable
            // navigate, not push: a fast double-tap must not stack two sheets.
            onPress={() => router.navigate('/stylist')}
            accessibilityRole="button"
            accessibilityLabel="Ask the stylist"
            hitSlop={8}
            style={{ width: 34, height: 34 }}
            className="items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark">
            <SymbolView
              name="sparkles"
              size={16}
              tintColor={theme.accent}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
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
 * The reduced masthead: the eyebrow and the section name, nothing else.
 *
 * Shared by the two states that have no morning to greet — a brand-new user
 * with no closet, and a day the engine could not dress. Both are moments where
 * a cheerful "Good afternoon, Mara" over bad news reads as a machine that has
 * not noticed.
 */
function ReducedMasthead({ eyebrow }: { eyebrow: string }) {
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
 * The honest "nothing works" state. Not an apology and not a generic empty
 * icon: the design's whole point here is that Cinch says plainly it could not
 * build something that holds together, then offers the few things that would
 * actually change the answer — ask the stylist, add the missing kind of piece,
 * or try again. Small icon circles are affordances, not an empty-state hero.
 */
function NothingWorks({ onRetry }: { onRetry: () => void }) {
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
    <View className="mx-gutter rounded-plate border border-rule bg-surface p-5 dark:border-rule-dark dark:bg-surface-dark">
      <Text variant="title">Nothing today feels right — and I won&apos;t pretend it does.</Text>
      <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
        Cinch couldn&apos;t build an outfit that holds together from what&apos;s in your closet right
        now. One more layer, or a pair of shoes, usually unlocks it.
      </Text>
      <View className="my-4">
        <Rule />
      </View>
      <Text variant="eyebrow" className="mb-3">
        What might help
      </Text>
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
  const offline = weatherFailed && shown.length > 0;

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

      wear.mutate(
        { candidate: outfit.candidate, context, reasoning: outfit.reasoning },
        { onSuccess: () => setWornIds((prev) => new Set(prev).add(key)) },
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
    });
  }, [outfits.aiError, gate]);

  /**
   * The impression event — `outfit_reacted`'s missing denominator.
   *
   * Keyed on the set, not fired per card and not per render: the screen paints
   * three plates and re-renders on every keystroke in the plans field, and one
   * event per card would make the like rate come out at a third of its real
   * value with nothing to signal it was wrong.
   *
   * TWO impressions per morning are correct and are not deduplicated. The
   * screen enhances in place — the local engine's set appears in about ten
   * milliseconds and the model's re-ranked set replaces it fifteen seconds
   * later — and those are two different things shown to the user, one of which
   * we paid for. Distinguishing them is the point of the `source` property.
   *
   * `source` is therefore part of the KEY as well as a property. The re-rank
   * picks from the same shortlist the engine did, so it routinely comes back
   * with the same three candidates in the same order and a joined-ids key
   * alone would never see the second set. This is the one place the identity
   * of a set is not just its garments.
   *
   * Ref written in an effect. The React Compiler rejects a ref write during
   * render outright, and this repo has it enabled.
   */
  const impressionRef = useRef<string | null>(null);
  useEffect(() => {
    const first = shown[0];
    if (!first) return;

    const key = `${first.source}|${shown.map((o) => idOf(o.candidate.items)).join('/')}`;
    if (impressionRef.current === key) return;
    impressionRef.current = key;

    track('outfits_shown', {
      count: shown.length,
      source: first.source,
      closetSize: items.length,
    });
  }, [shown, items.length]);

  // --- States --------------------------------------------------------------

  if (wardrobe.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.muted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {/* The masthead reduces to the date and the section name: a brand-new
            user has no morning to greet yet, and no stylist to ask. */}
        <ReducedMasthead eyebrow={dayLine(cityLabel)} />

        {/* Not the old flat-lay hero, which promised a look the closet cannot
            yet produce. An honest empty tray instead: Cinch cannot style a
            wardrobe it has never seen, and it says exactly that. */}
        <View className="flex-1 items-center justify-center px-gutter" style={{ paddingBottom: 48 }}>
          <View
            className="items-center justify-end bg-tray dark:bg-tray-dark"
            style={{
              width: 132,
              height: 152,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: theme.rule,
              borderStyle: 'dashed',
              paddingBottom: 12,
            }}>
            <Text variant="colophon">Nothing to style yet</Text>
          </View>

          <View style={{ marginTop: 26 }}>
            <Text variant="title" className="text-center">
              I can&apos;t style{'\n'}what I can&apos;t see
            </Text>
          </View>

          <Text
            variant="body"
            className="mt-3 text-center text-muted dark:text-muted-dark"
            style={{ maxWidth: 264 }}>
            Photograph your wardrobe once and I&apos;ll build outfits from your real clothes each
            morning. No shopping, ever.
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
            accessibilityLabel="Add your clothes"
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-7 flex-row items-center justify-center rounded-md bg-ink px-6 active:opacity-70 dark:bg-ink-dark">
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              Add your clothes
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Offline is not the normal screen dimmed — it is its own composition, and
  // the order says why. The banner comes first, above everything, because the
  // staleness qualifies the entire page; the masthead drops to when the app
  // last reached the server, since there is no fresh morning to greet and no
  // stylist to ask; and every plate loses the parts the network paid for.
  if (offline) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <ScrollView
          contentContainerClassName="pb-10"
          refreshControl={
            <RefreshControl
              refreshing={outfits.isEnhancing}
              onRefresh={refresh}
              tintColor={theme.muted}
            />
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

          {/* Dimmed as one block: the set is real, but it is this morning's,
              and so is the note under it. */}
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
      <ScrollView
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={outfits.isEnhancing}
            onRefresh={refresh}
            tintColor={theme.muted}
          />
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
        />

        {/* The plans note, set as the design's tray pill with a leading "+".
            The multi-event differentiator, reachable without the calendar:
            "dinner at 7 then drinks after" is the exact sentence the engine is
            built for, and typing it must not require a permission grant. Clay,
            not oxblood — the one spent accent stays reserved for a loved look. */}
        {nothingWorks ? null : (
          <View className="mx-gutter mt-4 flex-row items-center gap-2 rounded-md bg-tray px-3.5 py-2.5 dark:bg-tray-dark">
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
              placeholder="What's on today? Tell Cinch"
              placeholderTextColor={theme.faint}
              accessibilityLabel="Describe your plans today"
              className="flex-1 font-body text-callout text-ink dark:text-ink-dark"
            />
          </View>
        )}

        <View className="mt-6">
          {nothingWorks ? (
            <NothingWorks onRetry={refresh} />
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
                  wearing={wear.isPending}
                  enhancing={outfits.isEnhancing}
                  onWear={() => handleWear(i)}
                  onReact={(value) => handleReact(i, value)}
                />
              );
            })
          )}
        </View>

        {/* Say plainly how much it has actually learned. Implying a rich taste
            model after two taps is a promise the engine cannot keep. */}
        {shown.length > 0 ? (
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
    </SafeAreaView>
  );
}
