import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlotCard } from '@/components/onboarding/slot-card';
import { SubstitutionSheet } from '@/components/onboarding/substitution-sheet';
import { TenCamera } from '@/components/onboarding/ten-camera';
import { TenGrid } from '@/components/onboarding/ten-grid';
import { TenStopSheet } from '@/components/onboarding/ten-stop-sheet';
import { Text } from '@/components/ui/text';
import { countOutfits } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  declineSlot,
  fillSlot,
  hydrateFromWardrobe,
  isComplete,
  nextSlot,
  plannedTally,
  settledCount,
  type CountedKind,
  type TenSlot,
} from '@/features/onboarding/ten-slots';
import { useWardrobe } from '@/features/styling/queries';
import type { Garment } from '@/lib/styling';

/**
 * The Ten — Directive 1's guided capture, states T-01…T-06.
 *
 * A single screen with three layers of state on top of the wardrobe query:
 * which ten positions are filled (`slots`), which one the user is looking at
 * (`foregroundedId`, defaulting to `nextSlot` but overridable by a direct
 * tap — "order is a suggestion"), and whichever modal is open on top of it
 * (the camera, the substitution sheet, or the stop sheet once the ten is
 * complete). See docs/design/free-tier-contract.md and
 * design-refs/html/The Ten State Atlas for the states this renders.
 */
export default function TheTenScreen() {
  const router = useRouter();
  const wardrobe = useWardrobe();

  const [slots, setSlots] = useState<TenSlot[] | null>(null);
  const hydrated = useRef(false);

  // Resume at the count, not at the start (free-tier-contract.md §2) — once
  // the real closet loads, any already-tagged garment fills its matching
  // slot exactly once.
  useEffect(() => {
    if (hydrated.current || !wardrobe.data) return;
    hydrated.current = true;
    setSlots(hydrateFromWardrobe(wardrobe.data));
  }, [wardrobe.data]);

  const [foregroundedOverride, setForegroundedOverride] = useState<number | null>(null);
  const [cameraSlotId, setCameraSlotId] = useState<number | null>(null);
  const [declineSlotId, setDeclineSlotId] = useState<number | null>(null);
  const stopShown = useRef(false);
  const [showStop, setShowStop] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<string, Garment>();
    for (const g of wardrobe.data ?? []) m.set(g.id, g);
    return m;
  }, [wardrobe.data]);

  const { resolve } = useSignedUrls(
    (wardrobe.data ?? []).flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
  );

  useEffect(() => {
    if (slots && isComplete(slots) && !stopShown.current) {
      stopShown.current = true;
      setShowStop(true);
    }
  }, [slots]);

  if (!slots) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Loading your closet…</Text>
      </SafeAreaView>
    );
  }

  const foregrounded = slots.find((s) => s.id === foregroundedOverride) ?? nextSlot(slots);
  const cameraSlot = slots.find((s) => s.id === cameraSlotId) ?? null;
  const declining = slots.find((s) => s.id === declineSlotId) ?? null;

  const garmentNames: Record<number, string | null> = {};
  const imageUris: Record<number, string | undefined> = {};
  for (const s of slots) {
    if (s.status !== 'filled' || !s.garmentId) continue;
    const g = byId.get(s.garmentId);
    if (!g) continue;
    garmentNames[s.id] = g.subcategory
      ? g.subcategory.charAt(0).toUpperCase() + g.subcategory.slice(1)
      : null;
    imageUris[s.id] = resolve(g.platePath, g.cutoutPath, g.thumbPath);
  }

  const filled = settledCount(slots);
  const isFirstSuggestion = filled === 0;

  if (cameraSlot) {
    return (
      <TenCamera
        slot={cameraSlot}
        slots={slots}
        onCancel={() => setCameraSlotId(null)}
        onFilled={(itemId) => {
          setSlots((prev) => (prev ? fillSlot(prev, cameraSlot.id, itemId) : prev));
          setCameraSlotId(null);
          setForegroundedOverride(null);
        }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-8" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-baseline justify-between pt-1">
          <Text variant="display" trim accessibilityRole="header">
            The Ten
          </Text>
          <Text
            variant="label"
            style={{ fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`${filled} of ${slots.length} filled`}>
            {`${filled} of 10`}
          </Text>
        </View>
        <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
          {isFirstSuggestion
            ? 'Ten pieces is enough for Cinch to style you properly. Photograph these, in any order.'
            : filled === 9
              ? "One left. Cinch can't style you until the bag is in — every outfit it builds finishes with one."
              : `${10 - filled} to go. Nothing here is final — you can swap any piece later.`}
        </Text>

        <View className="mt-4">
          <TenGrid
            slots={slots}
            foregroundedId={foregrounded?.id ?? null}
            garmentNames={garmentNames}
            imageUris={imageUris}
            onSlotPress={(id) => setForegroundedOverride(id)}
          />
        </View>

        {foregrounded ? (
          <View className="mt-5">
            <SlotCard
              slot={foregrounded}
              slots={slots}
              isFirstSuggestion={isFirstSuggestion && foregrounded.id === 1}
              onPhotograph={() => setCameraSlotId(foregrounded.id)}
              onSkip={
                foregrounded.kind === 'bag' ? undefined : () => setDeclineSlotId(foregrounded.id)
              }
            />
          </View>
        ) : null}
      </ScrollView>

      <SubstitutionSheet
        visible={declining !== null}
        slot={declining}
        slots={slots}
        onDismiss={() => setDeclineSlotId(null)}
        onKeepOpen={() => {
          if (!declining) return;
          setSlots((prev) => (prev ? declineSlot(prev, declining.id, { open: true }) : prev));
          setDeclineSlotId(null);
          setForegroundedOverride(null);
        }}
        onRedirect={(to: CountedKind) => {
          if (!declining) return;
          setSlots((prev) => (prev ? declineSlot(prev, declining.id, { to }) : prev));
          setDeclineSlotId(null);
          setForegroundedOverride(null);
        }}
      />

      <TenStopSheet
        visible={showStop}
        count={countOutfits(plannedTally(slots))}
        onSeeOutfits={() => {
          setShowStop(false);
          // The dress redirect, if the user took one — the one fact about
          // *why* the tally changed shape that only this screen's slot state
          // knows. The Reveal cannot recover it from the finished wardrobe
          // alone, so it rides along as a param rather than being re-guessed.
          const dressSlot = slots.find((s) => s.originalKind === 'dresses');
          const redirectedDressTo =
            dressSlot && dressSlot.kind !== 'dresses' ? dressSlot.kind : '';
          router.replace({ pathname: '/reveal', params: { redirectedDressTo } });
        }}
        onSwapPiece={() => setShowStop(false)}
      />
    </SafeAreaView>
  );
}
