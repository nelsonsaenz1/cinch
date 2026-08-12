import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DoorPlate } from '@/components/ui/door-plate';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * AC-03 — capacity reached, and NOT ONE DOOR CLOSES.
 *
 * This frame was corrected on 2026-08-12 against `src/app/add-clothes.tsx`,
 * `src/app/capture.tsx` and `src/features/ingest/use-capture.ts`, and the
 * correction inverted it. An earlier rendering disabled the doors at the
 * ceiling; that contradicted shipping behaviour, so what a reviewer must now
 * see is all four doors available, in the same order and at the same weight as
 * AC-01.
 *
 * THE REASON IS THE WHOLE FRAME: "acquiring is not adding, so the user cannot
 * lose what they just captured to a door that refused to open." Capacity is
 * resolved AFTER the photograph or description exists — which is W-02, the rule
 * this screen has always held — and the database still refuses the over-ceiling
 * write regardless. The frame changes when the question is asked, not whether
 * the row is allowed.
 *
 * WHAT MUST NOT BE ON THIS CAPTURE: a tier name, a price, an upgrade action, a
 * paywall, or any StoreKit claim. The recovery is the free one — store a piece
 * you are not reaching for — and membership is reached from Profile.
 *
 * The counts are frozen literals at the ceiling (150 of 150); the real screen
 * reads them off the live plan and prints them only when known.
 */
export default function DevW3G3Ac03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between px-gutter">
        <Text variant="title" trim>
          Add clothes
        </Text>
        <Text variant="body">Cancel</Text>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-10 pt-5" contentContainerStyle={{ gap: 12 }}>
        <Text variant="note" className="pt-1">
          Four ways in. All of them file the same kind of piece.
        </Text>

      <DoorPlate
        name="Camera"
        line="Photograph a piece against any wall."
        symbol="camera"
        accessibilityLabel="Camera — photograph a piece"
        onPress={() => {}}
      />
      <DoorPlate
        name="Photo library"
        line="Pick pictures you already have — no permission needed."
        symbol="photo.on.rectangle"
        accessibilityLabel="Photo library — choose pictures you already have, no permission needed"
        onPress={() => {}}
      />
      <DoorPlate
        name="Describe it"
        line="Type what it is, or paste a product link."
        symbol="magnifyingglass"
        accessibilityLabel="Describe it — type what the piece is, or paste a product link"
        onPress={() => {}}
      />
      <DoorPlate
        name="Describe by voice"
        line="Say it out loud instead of typing."
        symbol="waveform"
        accessibilityLabel="Describe by voice — say what you own out loud instead of typing"
        onPress={() => {}}
      />

        <Text variant="noteSmall" className="pt-1">
          150 of 150 active pieces filed.
        </Text>

        {/* Stated ONCE, below the doors. */}
        <View className="rounded-md bg-tray p-3.5">
          <Text variant="label" className="text-ink">
            The active shelf is full
          </Text>
          <Text variant="note" className="mt-1">
            Adding still starts normally. Once the new photograph or description exists, Cinch asks
            you to store a piece you are not reaching for — nothing you just added is lost while you
            decide. Stored pieces keep their photographs, wear history and price.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See stored pieces"
            onPress={() => {}}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-1 justify-center active:opacity-60">
            <Text variant="label" className="text-ink">
              See stored
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
