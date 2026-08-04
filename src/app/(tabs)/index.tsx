import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { useReactToOutfit, useWearOutfit } from '@/features/styling/mutations';
import {
  canGenerate,
  MIN_CLOSET_FOR_OUTFITS,
  useStyleProfile,
  useWardrobe,
} from '@/features/styling/queries';
import { useOutfits } from '@/features/styling/use-outfits';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/** Stable identity for a candidate: the exact set of garments in it. */
const idOf = (items: { id: string }[]) => items.map((g) => g.id).join('.');

/**
 * The page header, set like a magazine folio: the date as a tracked eyebrow,
 * the section name in the didone, and a structural rule closing the masthead.
 *
 * The trailing icons are the only doors to Stylist and Profile — both lost
 * their tabs in the three-tab restructure. Muted, monochrome: they are
 * chrome, and accent never goes on chrome.
 */
function Masthead() {
  const router = useRouter();
  const theme = useTheme();
  const now = new Date();
  const dateLine = `${now.toLocaleDateString('en-US', { weekday: 'long' })} · ${now.getDate()} ${now
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase()} ${now.getFullYear()}`;

  return (
    <View className="px-gutter pt-2" style={{ paddingBottom: 20 }}>
      <View className="flex-row items-center justify-between">
        <Text variant="eyebrow">{dateLine}</Text>
        <View className="flex-row">
          <Pressable
            // navigate, not push: a fast double-tap must not stack two sheets.
            onPress={() => router.navigate('/stylist')}
            accessibilityRole="button"
            accessibilityLabel="Ask the stylist"
            hitSlop={8}
            className="h-tap w-tap items-center justify-center active:opacity-60">
            <SymbolView
              name="bubble.left.and.text.bubble.right"
              size={20}
              tintColor={theme.muted}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={8}
            className="h-tap w-tap items-center justify-center active:opacity-60">
            <SymbolView
              name="person.crop.circle"
              size={20}
              tintColor={theme.muted}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <Text variant="display" trim accessibilityRole="header">
          Today
        </Text>
      </View>
      <View style={{ marginTop: 14 }}>
        <Rule />
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

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();

  const { context, cityLabel, usingFallbackLocation, calendarEnabled, requestCalendar } =
    useStyleContext({ note: committedNote || null });

  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);

  // Priors until the real profile loads, so generation is never blocked on it.
  const profile = profileQuery.data ?? {
    weights: DEFAULT_WEIGHTS,
    affinities: EMPTY_AFFINITIES,
    feedbackCount: 0,
    summary: [],
  };

  const outfits = useOutfits({
    wardrobe: items,
    context,
    profile,
    enabled: canGenerate(items),
  });

  const shown = outfits.outfits;

  // What the looks are for — the user's own words first, else the day's first
  // calendar event. Printed in each plate's eyebrow.
  const occasion = committedNote || context.events[0]?.title || null;

  // Sign every garment image in one request rather than one per card.
  const { resolve } = useSignedUrls(
    shown.flatMap((o) => o.candidate.items.flatMap((g) => [g.cutoutPath, g.thumbPath])),
  );

  const react = useReactToOutfit();
  const wear = useWearOutfit();

  const handleReact = useCallback(
    (index: number, value: ReactionValue) => {
      const outfit = shown[index];
      if (!outfit) return;

      const key = idOf(outfit.candidate.items);
      setReactions((prev) => ({ ...prev, [key]: value }));

      react.mutate({
        candidate: outfit.candidate,
        // The learner needs everything that was on screen, not just this card.
        // Passing only the reacted outfit makes the baseline equal the sample
        // and every gradient collapses to zero — silently.
        shownAlongside: outfits.shortlist,
        liked: value.liked,
        profile,
        reason: value.reason,
        source: 'today',
      });
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
    void qc.invalidateQueries({ queryKey: ['wardrobe'] });
    void qc.invalidateQueries({ queryKey: ['weather'] });
    void qc.invalidateQueries({ queryKey: ['outfits'] });
  }, [qc]);

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
    const remaining = Math.max(0, MIN_CLOSET_FOR_OUTFITS - items.length);
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <Masthead />
        <EmptyState
          symbol="sparkles"
          title={items.length === 0 ? 'Your first outfit is close' : 'Almost there'}
          body={
            items.length === 0
              ? 'Add about ten pieces and Cinch can start styling you — weather, plans, and everything already in your closet.'
              : `${remaining || 'A few'} more ${remaining === 1 ? 'piece' : 'pieces'} and Cinch can start building outfits. It needs at least a top, a bottom, and something for your feet.`
          }
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      </SafeAreaView>
    );
  }

  const feedbackCount = profile.feedbackCount;

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
        <Masthead />

        <WeatherStrip
          weather={context.weather}
          events={context.events}
          city={cityLabel}
          usingFallbackLocation={usingFallbackLocation}
          calendarEnabled={calendarEnabled}
          onConnectCalendar={() => void requestCalendar()}
        />

        {/* The multi-event differentiator, reachable without the calendar.
            "dinner at 7 then drinks after" is the exact sentence the engine is
            built for, and typing it must not require a permission grant. */}
        <View className="mt-4 flex-row items-center gap-2 px-gutter">
          <SymbolView
            name="text.bubble"
            size={15}
            tintColor={theme.muted}
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
            className="flex-1 rounded-md border border-rule px-3 py-2 font-body text-callout text-ink dark:border-rule-dark dark:text-ink-dark"
          />
        </View>

        <View className="mt-6">
          {shown.length === 0 ? (
            <EmptyState
              symbol="questionmark.circle"
              title="Nothing quite works today"
              body="Cinch could not build an outfit that holds together from what is in your closet right now. A pair of shoes or one more layer usually unlocks it."
              actionTitle="Add clothes"
              onAction={() => router.push('/capture')}
            />
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
