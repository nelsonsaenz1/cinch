import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Text } from '@/components/ui';
import type { Place } from '@/features/context/weather';
import { PackingGate } from '@/features/plan/packing-tab';
import { PlaceRow, RecentChips, TripQuestionnaire } from '@/features/plan/trip-questionnaire';
import { useTheme } from '@/theme/tokens';

/**
 * The packing-questionnaire fixture — `cinch://dev-packing-questions`.
 *
 * K-01 through K-03 (docs/design/membership-packing-contract.md, the atlas's
 * own numbering). K-04's research beats and K-05/K-06's memo and failures
 * belong to Unit L's `packing-trip.tsx` — this route is Unit Q's territory
 * only: the gate and the four-question run.
 *
 * K-01 and K-02 are driven against the REAL, exported presentational pieces
 * (`PackingGate`, `PlaceRow`, `RecentChips`) with fixture data and no network
 * — the same split `dev-comments.tsx` uses for `CommentRow`. K-03 mounts the
 * real `TripQuestionnaire`, seeded via the hook's dev-only `devSeed` so the
 * summary rows and the running arithmetic are the actual state machine's
 * output, not a redrawn approximation.
 */

const LISBON_PT: Place = { name: 'Lisbon', country: 'Portugal', admin1: 'Lisbon', latitude: 38.72, longitude: -9.14 };
const LISBON_OH: Place = { name: 'Lisbon', country: 'United States', admin1: 'Ohio', latitude: 40.77, longitude: -80.77 };

const RECENTS: Place[] = [
  { name: 'Mexico City', country: 'Mexico', admin1: 'Mexico City', latitude: 19.43, longitude: -99.13 },
  { name: 'Chicago', country: 'United States', admin1: 'Illinois', latitude: 41.88, longitude: -87.63 },
  { name: 'Marfa', country: 'United States', admin1: 'Texas', latitude: 30.31, longitude: -104.02 },
];

const FRAMES = [
  'K-01 · history',
  'K-01 · first trip',
  'K-02 · results',
  'K-02 · no results',
  'K-02 · recents',
  'K-03 · answered',
] as const;
type Frame = (typeof FRAMES)[number];

export default function DevPackingQuestions() {
  const [frame, setFrame] = useState<Frame>(FRAMES[0]);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerClassName="pb-32 pt-3">
          <View className="px-gutter">
            <Text variant="colophon">{frame}</Text>
          </View>

          <View className="mt-3">
            {frame === 'K-01 · history' ? <K01History /> : null}
            {frame === 'K-01 · first trip' ? <K01FirstTrip /> : null}
            {frame === 'K-02 · results' ? <K02Results /> : null}
            {frame === 'K-02 · no results' ? <K02NoResults /> : null}
            {frame === 'K-02 · recents' ? <K02Recents /> : null}
            {frame === 'K-03 · answered' ? <K03Answered /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5 dark:border-rule-dark dark:bg-canvas-dark">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {FRAMES.map((f) => (
              <Chip key={f} label={f} selected={frame === f} selectedGround="ink" onPress={() => setFrame(f)} />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** K-01, with `useLastPackedTrip()` resolved to a real Lisbon trip. */
function K01History() {
  return (
    <PackingGate
      lastTrip={{
        destination: LISBON_PT,
        startsOn: '2026-04-12',
        endsOn: '2026-04-15',
        pieceCount: 11,
        lookCount: 9,
      }}
      onUnlock={() => {}}
      unlockState="idle"
    />
  );
}

/** K-01, a first-time user — the history line drops entirely, not an invented Lisbon. */
function K01FirstTrip() {
  return <PackingGate lastTrip={null} onUnlock={() => {}} unlockState="idle" />;
}

/** K-02 — two Lisbons, told apart by climate rather than a guessed range. */
function K02Results() {
  const theme = useTheme();
  return (
    <View className="px-gutter">
      <Text variant="eyebrow">Packing · 1 of 4</Text>
      <View className="mt-3">
        <Text variant="title" trim>
          Where are you going?
        </Text>
      </View>
      <View className="mt-6">
        <TextInput
          value="Lisbo"
          editable={false}
          placeholderTextColor={theme.muted}
          className="rounded-md border border-hairline px-3.5 py-3 text-ink dark:border-hairline-dark dark:text-ink-dark"
        />
        <View className="mt-3 overflow-hidden rounded-md border border-hairline dark:border-hairline-dark">
          <PlaceRow place={LISBON_PT} band={{ lowC: 18, highC: 24 }} onPick={() => {}} />
          <PlaceRow place={LISBON_OH} band={{ lowC: 6, highC: 14 }} onPick={() => {}} />
        </View>
        <RecentChips places={RECENTS} onPick={() => {}} />
      </View>
    </View>
  );
}

/** K-02 — a query that matches nothing. No spinner, no error, nothing shown. */
function K02NoResults() {
  const theme = useTheme();
  return (
    <View className="px-gutter">
      <Text variant="eyebrow">Packing · 1 of 4</Text>
      <View className="mt-3">
        <Text variant="title" trim>
          Where are you going?
        </Text>
      </View>
      <View className="mt-6">
        <TextInput
          value="Quxlandia"
          editable={false}
          placeholderTextColor={theme.muted}
          className="rounded-md border border-hairline px-3.5 py-3 text-ink dark:border-hairline-dark dark:text-ink-dark"
        />
        <Text variant="body" className="mt-6 text-muted dark:text-muted-dark">
          Cinch reads the place — how warm it is, how dressed-up it is, what people
          actually wear there — and packs from what you already own.
        </Text>
      </View>
    </View>
  );
}

/** K-02 — before anything is typed, the last three distinct destinations. */
function K02Recents() {
  const theme = useTheme();
  return (
    <View className="px-gutter">
      <Text variant="eyebrow">Packing · 1 of 4</Text>
      <View className="mt-3">
        <Text variant="title" trim>
          Where are you going?
        </Text>
      </View>
      <View className="mt-6">
        <TextInput
          value=""
          placeholder="Lisbon, Tokyo, Aspen…"
          editable={false}
          placeholderTextColor={theme.muted}
          className="rounded-md border border-hairline px-3.5 py-3 text-ink dark:border-hairline-dark dark:text-ink-dark"
        />
        <RecentChips places={RECENTS} onPick={() => {}} />
      </View>
    </View>
  );
}

/** K-03 — the last question, the three prior answers visible above it. */
function K03Answered() {
  return (
    <TripQuestionnaire
      onComplete={() => {}}
      devSeed={{
        index: 3,
        draft: {
          destination: LISBON_PT,
          companions: 'friends',
          friendIds: ['nadia', 'tom'],
          friendNames: ['Nadia', 'Tom'],
          startsOn: '2026-09-12',
          endsOn: '2026-09-15',
          vibes: ['warm-city', 'long-dinners', 'walking'],
          parts: ['daytime', 'evening'],
        },
      }}
    />
  );
}
