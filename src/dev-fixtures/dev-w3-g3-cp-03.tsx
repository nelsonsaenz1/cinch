import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { queueCards } from '@/features/ingest/queue-count';

/**
 * CP-03 — captured, processing queue. THE FRAME THAT RETIRES THE BAR.
 *
 * A `ProgressTrack` used to render at `capture.tsx:1025`, filled by
 * settled/total. The constitution refuses it — "Progress is a count, never a
 * bar or percentage" — and this frame's annotation is "Queue is a count". What
 * ships now, and what this poses, is `queueCards`: the garment named on the
 * first card, a spelled remainder on the second, and a card omitted entirely
 * when its count is nought, because zero is quiet.
 *
 * The second annotation is "work continues during processing", which is why the
 * sentence says so and why the shutter above stays live in the real screen.
 *
 * NO SPINNER AND NO SHIMMER inside this viewport: an `ActivityIndicator` spins,
 * and a spinning thing can never reproduce its own bytes.
 */
export default function DevW3G3Cp03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // The frame's own queue: one finished piece with a name, two still working.
  const cards = queueCards({ ready: 1, waiting: 2, firstReadyName: 'Linen blouse' });

  return (
    <SafeAreaView className="flex-1 justify-end bg-canvas">
      <View className="rounded-t-plate bg-surface px-gutter pb-10 pt-4">
        <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>
          Filing this piece
        </Text>
        <Text variant="note" className="mt-1.5">
          Cutting it out and reading its colour. You can keep photographing while this finishes.
        </Text>
        {/* TWO SIDE-BY-SIDE CARDS, not a row of generic units. One card is an
            IDENTITY — the garment by name, so the notice can be told apart from
            the one over the next piece — and the other is a semantic remainder.
            Equal halves, so neither reads as the more important. */}
        <View className="mt-3 flex-row gap-2.5">
          {cards.map((card) => (
            <View key={card.state} className="flex-1 rounded-md bg-tray px-3 py-2.5">
              <Text variant="label" numberOfLines={1} className="text-ink">
                {card.lead}
              </Text>
              <Text variant="note" numberOfLines={1}>
                {card.state}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
