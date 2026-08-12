import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';
import { stopSheetCopy } from '@/features/onboarding/ten-copy';
import { useTheme } from '@/theme/tokens';

/**
 * T-06's card content, with no `Modal` around it — see `SubstitutionSheetBody`
 * for why the split exists.
 */
export function TenStopSheetBody({
  count,
  onSeeOutfits,
  onBackToGrid,
}: {
  count: number;
  onSeeOutfits: () => void;
  /**
   * The way out that is not forward. It closes the sheet and leaves the grid
   * exactly as it was — the atlas's own second action, and a smaller promise
   * than the swap flow that used to be here: nothing on this sheet claims a
   * piece is about to be replaced, so nothing should route as if it were.
   */
  onBackToGrid: () => void;
}) {
  const theme = useTheme();
  // Both sentences name the size of the free closet, so both are read from the
  // one place that defines it rather than typed (positioning-contract.md §7).
  // Read here rather than taken as a prop: the number is not a property of
  // this card, it is a property of the tier, and every caller would otherwise
  // have to pass the same constant.
  const copy = stopSheetCopy(PLANS.free.items, count);
  return (
    <View
      className="rounded-t-sheet border-t border-rule bg-surface"
      style={{ paddingHorizontal: 22, paddingTop: 22 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.rule,
          alignSelf: 'center',
          marginBottom: 18,
        }}
      />
      {/* "Ten of ten", in words. Never "10/10" — a score is a mark out of
          something, and this is a position the reader has arrived at. */}
      <Text variant="eyebrow">{copy.eyebrow}</Text>
      <View style={{ marginBottom: 8, marginTop: 4 }}>
        <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 30 }}>
          {copy.title}
        </Text>
      </View>
      <Text variant="note" style={{ fontSize: 16, lineHeight: 25 }}>
        {copy.body}
      </Text>

      <View style={{ marginTop: 18, gap: 4, paddingBottom: 20 }}>
        <Button title="See what they make" onPress={onSeeOutfits} haptic className="self-stretch" />
        <Button
          title="Back to the grid"
          variant="ghost"
          onPress={onBackToGrid}
          className="self-stretch"
        />
      </View>
    </View>
  );
}

/**
 * T-06 — the tenth piece lands, and the flow stops. A STOP, not a paywall:
 * the user has not seen a single outfit yet, and asking for money before the
 * payoff is how a good first hour turns cheap (free-tier-contract.md's
 * hard rule 10, and The Ten atlas's own note on T-06).
 */
export function TenStopSheet({
  visible,
  count,
  onSeeOutfits,
  onBackToGrid,
}: {
  visible: boolean;
  /** The headline number this closet makes — from `countOutfits`, never typed. */
  count: number;
  onSeeOutfits: () => void;
  onBackToGrid: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBackToGrid}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <SafeAreaView edges={['bottom']}>
          <TenStopSheetBody
            count={count}
            onSeeOutfits={onSeeOutfits}
            onBackToGrid={onBackToGrid}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
