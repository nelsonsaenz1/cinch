import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * T-06's card content, with no `Modal` around it — see `SubstitutionSheetBody`
 * for why the split exists.
 */
export function TenStopSheetBody({
  count,
  onSeeOutfits,
  onSwapPiece,
}: {
  count: number;
  onSeeOutfits: () => void;
  onSwapPiece: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      className="rounded-t-sheet border-t border-rule bg-surface dark:border-rule-dark dark:bg-surface-dark"
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
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          // `muted`, not the atlas's literal `faint` (free-tier-contract.md §4).
          color: theme.muted,
        }}>
        Ten of ten
      </Text>
      <View style={{ marginBottom: 8 }}>
        <Text variant="title" trim style={{ fontSize: 26, lineHeight: 30 }}>
          That&rsquo;s the ten. There&rsquo;s room for an eleventh on a larger closet.
        </Text>
      </View>
      <Text variant="callout" className="text-muted dark:text-muted-dark">
        {`Your ten make ${count} outfit${count === 1 ? '' : 's'}. Nothing you’ve photographed goes anywhere — you can swap a piece out whenever you like.`}
      </Text>

      <View style={{ marginTop: 18, gap: 8, paddingBottom: 24 }}>
        <Button title="See what your ten make" onPress={onSeeOutfits} haptic />
        <Button title="Swap a piece out" variant="secondary" onPress={onSwapPiece} />
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
  onSwapPiece,
}: {
  visible: boolean;
  /** The headline number this closet makes — from `countOutfits`, never typed. */
  count: number;
  onSeeOutfits: () => void;
  onSwapPiece: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <SafeAreaView edges={['bottom']}>
          <TenStopSheetBody count={count} onSeeOutfits={onSeeOutfits} onSwapPiece={onSwapPiece} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
