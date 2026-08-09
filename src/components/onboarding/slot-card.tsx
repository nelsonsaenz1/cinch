import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { slotCopy, slotOrdinalWithinKind } from '@/features/onboarding/ten-copy';
import { settledCount, type TenSlot } from '@/features/onboarding/ten-slots';
import { useTheme } from '@/theme/tokens';

/**
 * The card beneath the grid — one slot's single line of reasoning, per
 * free-tier-contract.md §2 ("each slot justifies itself in one sentence, and
 * only while it is the foregrounded slot"). T-01's very first suggestion
 * carries its own eyebrow ("Start anywhere · suggested first"); every other
 * slot reads "Slot N · phrase".
 *
 * The bag cannot be declined — Cinch has nowhere to put a look without one —
 * so it is the one slot with no Skip beside its button (T-05).
 */
export function SlotCard({
  slot,
  slots,
  isFirstSuggestion,
  onPhotograph,
  onSkip,
}: {
  slot: TenSlot;
  /** The full ten, so this card can rank itself among same-kind siblings. */
  slots: readonly TenSlot[];
  /** True only for The Ten's very first render, nothing photographed yet. */
  isFirstSuggestion: boolean;
  onPhotograph: () => void;
  onSkip?: () => void;
}) {
  const theme = useTheme();
  const n = slotOrdinalWithinKind(slots, slot.id);
  const copy = slotCopy(slot.kind, n);
  const isLast = settledCount(slots) === slots.length - 1;
  const canSkip = slot.kind !== 'bag' && Boolean(onSkip);

  return (
    <View className="rounded-md border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          // `muted`, not the atlas's literal `faint` — this eyebrow is the
          // slot's real name, not decoration (free-tier-contract.md §4).
          color: theme.muted,
        }}>
        {isFirstSuggestion ? 'Start anywhere · suggested first' : `Slot ${slot.id} · ${copy.phrase}`}
      </Text>
      <View style={{ marginBottom: 6 }}>
        <Text variant="plate" trim>
          {copy.title}
        </Text>
      </View>
      <Text variant="callout" className="text-muted dark:text-muted-dark">
        {copy.body}
      </Text>
      <View className="mt-3.5 flex-row gap-2.5">
        <Button
          title={isLast ? 'Photograph the last piece' : 'Photograph it'}
          onPress={onPhotograph}
          className={canSkip ? 'flex-1' : 'flex-1 self-stretch'}
        />
        {canSkip ? <Button title="Skip" variant="secondary" onPress={onSkip} /> : null}
      </View>
    </View>
  );
}
