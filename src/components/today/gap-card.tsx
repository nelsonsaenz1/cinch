import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { gapLabel } from '@/features/closet/gap-feed';
import type { Gain, Tally } from '@/features/closet/outfit-count';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { gapSentence } from './gap-copy';

/**
 * THE GAP CARD — T-12, and the one place Today may mention a gap at all.
 *
 * "No merchant row, price or purchase language appears on Today; that belongs
 * to the Gap Feed, one tap away." So this card carries no merchant, no price,
 * no shop word and no image — only the computed reasoning and the link.
 *
 * Rendered only when there is a real gain to state. A gap that unlocks nothing
 * is not a gap, and "+0 outfit cores" is not a sentence anybody should read.
 */
export function GapCard({
  tally,
  gain,
  onOpen,
}: {
  tally: Tally;
  gain: Gain;
  onOpen: () => void;
}) {
  const theme = useTheme();
  if (gain.gain <= 0) return null;

  return (
    <View className="mx-gutter mt-4 rounded-plate border border-rule bg-surface p-3.5">
      <Text variant="eyebrow">What your closet is missing</Text>
      <Text variant="label" className="mt-2.5">
        The gap
      </Text>
      <Text variant="plate" className="mt-1" numberOfLines={2}>
        {gapLabel(tally, gain.kind)}
      </Text>
      <Text variant="note" className="mt-1.5">
        {gapSentence(gain)}
      </Text>
      {/* The frame's one oxblood, spent on the gap link — the single thing
          left to do on a day nothing works. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Look at the gap"
        onPress={onOpen}
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-2 justify-center active:opacity-60">
        <Text variant="label" style={{ color: theme.accent }}>
          Look at the gap
        </Text>
      </Pressable>
    </View>
  );
}
