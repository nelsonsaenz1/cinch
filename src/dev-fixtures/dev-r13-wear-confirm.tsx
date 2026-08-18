import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_ITEMS } from '@/components/dev/fixtures';
import { WearConfirmationSheet } from '@/components/today/wear-confirmation-sheet';
import { Text } from '@/components/ui/text';
import type { WearFailureKind } from '@/features/styling/wear-failure';
import type { WearPhase } from '@/features/today/wear-confirm-spec';

/**
 * DEV ONLY · Redesign 13 — the wear confirmation, every state one link apart.
 *
 * Deep-linkable — `cinch:///dev-r13-wear-confirm?pose=network`. Not a
 * convenience: `simctl` can open a URL and cannot tap, so a cycler whose only
 * control is a button can be looked at by hand and never photographed. Every
 * accepted state has to be reachable without a finger for the evidence set to
 * be reproducible at all.
 *
 * Deterministic by construction: the garments are the repo's own dev fixtures,
 * `noImages` resolves every path to undefined so every cell takes the neutral
 * fallback, and no phase here performs a write — the sheet cannot, and this
 * hands it a phase rather than a mutation.
 */

const noImages = () => undefined;

const NAME = 'The quiet Wednesday';
const LONG_NAME = 'The long grey Wednesday coat and boots';

type Pose =
  | 'default'
  | 'rating-one'
  | 'rating-three'
  | 'rating-five'
  | 'favorite-on'
  | 'rating-and-favorite'
  | 'confirming'
  | 'settled'
  | 'settled-idempotent'
  | 'network'
  | 'offline'
  | 'signed-out'
  | 'rejected'
  | 'long-name'
  | 'many-garments';

const POSES: readonly Pose[] = [
  'default',
  'rating-one',
  'rating-three',
  'rating-five',
  'favorite-on',
  'rating-and-favorite',
  'confirming',
  'settled',
  'settled-idempotent',
  'network',
  'offline',
  'signed-out',
  'rejected',
  'long-name',
  'many-garments',
];

/**
 * The five states a finger would otherwise be the only way to reach.
 *
 * `simctl` opens URLs and cannot tap, so a rating or a favourite that only
 * exists after a tap has no reproducible evidence. The sheet exposes two
 * documented test-only props for exactly this, defaulting to the unrated,
 * unfavourited wear that opening actually gives you.
 */
const RATING: Partial<Record<Pose, number>> = {
  'rating-one': 1,
  'rating-three': 3,
  'rating-five': 5,
  'rating-and-favorite': 2,
};

const FAVORITE: Partial<Record<Pose, boolean>> = {
  'favorite-on': true,
  'rating-and-favorite': true,
};

const PHASE: Partial<Record<Pose, WearPhase>> = {
  confirming: 'confirming',
  settled: 'settled',
  'settled-idempotent': 'settled',
  network: 'failed',
  offline: 'failed',
  'signed-out': 'failed',
  rejected: 'failed',
};

const ERROR: Partial<Record<Pose, WearFailureKind>> = {
  network: 'network',
  offline: 'network',
  'signed-out': 'signed_out',
  rejected: 'rejected',
};

export default function DevR13WearConfirm() {
  const params = useLocalSearchParams<{ pose?: string }>();
  const linked = (POSES as readonly string[]).includes(params.pose ?? '')
    ? (params.pose as Pose)
    : 'default';

  // The URL is the source of truth; a tap is an override the URL clears.
  // expo-router does not remount a screen when only the query string changes,
  // so seeding `useState` once would ignore every link after the first.
  const [pose, setPose] = useState<Pose>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPose(linked);
  }

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const garments = pose === 'many-garments' ? FIXTURE_ITEMS : FIXTURE_ITEMS.slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="eyebrow">Redesign 13 · Wear confirm</Text>
        <View className="mt-2 flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {POSES.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={p}
              onPress={() => setPose(p)}
              style={{ minHeight: 44, justifyContent: 'center' }}
              className={p === pose ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
              <Text variant="label">{p}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      <WearConfirmationSheet
        // Remounted per pose so each frame starts from the sheet's own
        // defaults — an unrated, unfavourited wear, which is what opening
        // actually gives you.
        key={pose}
        visible
        outfitName={pose === 'long-name' ? LONG_NAME : NAME}
        garments={garments}
        resolveImage={noImages}
        phase={PHASE[pose] ?? 'idle'}
        error={ERROR[pose] ?? null}
        offline={pose === 'offline'}
        idempotent={pose === 'settled-idempotent'}
        initialRating={RATING[pose] ?? null}
        initialFavorite={FAVORITE[pose] ?? false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSignIn={() => {}}
        onDone={() => {}}
      />
    </SafeAreaView>
  );
}
