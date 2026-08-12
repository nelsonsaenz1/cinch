import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The count masthead every procession card carries — PR-01, PR-03, PR-05.
 *
 * "N of M" is a POSITION, never a bar and never a percentage. Back on the left,
 * the count in the middle, Undo on the right.
 *
 * UNDO CHANGES WEIGHT RATHER THAN APPEARING. It is always drawn, quiet in
 * `muted` regular; when the stack has something in it, it goes Medium ink. A
 * control that appears and disappears would reflow the header on every
 * decision, and the atlas is specific that it does not. At the third undo the
 * stack empties and the control simply stops offering more.
 *
 * One component rather than two, because PR-03's stepper card carries exactly
 * the same header as PR-01's ordinary card and a second copy would drift.
 */
export function ProcessionMasthead({
  index,
  total,
  canUndo,
  onBack,
  onUndo,
}: {
  index: number;
  total: number;
  canUndo: boolean;
  onBack: () => void;
  onUndo: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="flex-row items-center justify-between px-gutter"
      style={{ paddingTop: 4, height: 52 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back one card"
        onPress={onBack}
        hitSlop={12}
        style={{ minWidth: 60, minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
        className="active:opacity-60">
        <Text variant="note" style={{ fontSize: 15 }}>
          Back
        </Text>
      </Pressable>
      <Text
        variant="eyebrow"
        accessibilityLabel={`Garment ${index} of ${total}`}
        style={{ fontVariant: ['tabular-nums'] }}>
        {`${index} of ${total}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        accessibilityHint="Restores the last card you decided"
        accessibilityState={{ disabled: !canUndo }}
        disabled={!canUndo}
        onPress={onUndo}
        hitSlop={12}
        style={{
          minWidth: 60,
          minHeight: MIN_TAP_TARGET,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
        className="active:opacity-60">
        <Text
          style={{
            fontSize: 15,
            fontFamily: canUndo ? 'HelveticaNeue-Medium' : 'HelveticaNeue',
            color: canUndo ? theme.ink : theme.muted,
          }}>
          Undo
        </Text>
      </Pressable>
    </View>
  );
}
