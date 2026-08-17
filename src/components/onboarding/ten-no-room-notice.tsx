import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { noRoomCopy } from '@/features/onboarding/ten-copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The account is at its TOTAL ceiling and a replacement was refused — drawn.
 *
 * WHAT IT REPLACES. `Alert.alert('Nothing changed', …)`, carrying a 44-word
 * paragraph that named an upgrade and offered no way to reach one, in the one
 * surface Cinch does not draw: no Instrument Serif, no tokens, no plate. This
 * is the same fact in the app's own type, under the grid the reader is looking
 * at, with the two remedies as doors rather than as nouns in a sentence.
 *
 * IT ADDS NO OXBLOOD. The screen's single accent belongs to the guided walk's
 * own action; a refusal must not outrank the thing it interrupted. Both doors
 * here are quiet — a ghost pill and a text link — and 'See plans' is the
 * quieter of the two on purpose: the reader came here to change a photograph,
 * not to buy anything.
 *
 * The plate is drawn UNDER the grid, never instead of it, for the same reason
 * T-05 keeps the masthead: nothing that was photographed has moved, and the
 * screen must go on saying so.
 */
export function TenNoRoomNotice({
  slotId,
  onOpenStorage,
  onSeePlans,
}: {
  slotId: number;
  onOpenStorage: () => void;
  /** `AddGarmentOverLimit` — the placement that names the price, so this never does. */
  onSeePlans: () => void;
}) {
  const theme = useTheme();
  const copy = noRoomCopy(slotId);

  return (
    <View
      className="rounded-plate border border-rule bg-surface"
      style={{ padding: 16, marginTop: 20 }}
      accessibilityRole="summary">
      <Text variant="eyebrow">{copy.eyebrow}</Text>
      <View style={{ marginBottom: 8, marginTop: 4 }}>
        <Text variant="heading" trim style={{ fontSize: 22 }}>
          {copy.headline}
        </Text>
      </View>
      <Text variant="note" style={{ fontSize: 15, lineHeight: 22 }}>
        {copy.note}
      </Text>
      {/* Two doors on one row, and the row wraps rather than truncates: at AX
          sizes "Open Storage" is wider than half the plate, and a remedy the
          reader cannot read is not a remedy. */}
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
        }}>
        <Button title={copy.storage} variant="ghost" onPress={onOpenStorage} />
        <Pressable
          onPress={onSeePlans}
          accessibilityRole="button"
          className="justify-center active:opacity-70"
          style={{ minHeight: MIN_TAP_TARGET }}>
          <Text variant="note" style={{ color: theme.muted }}>
            {copy.plans}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
