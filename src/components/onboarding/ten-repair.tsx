import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { repairCopy } from '@/features/onboarding/ten-copy';
import type { StarterReadiness } from '@/features/onboarding/starter-readiness';

/**
 * Ten pieces filed, and the closet still cannot be styled.
 *
 * A state the named template could not produce and therefore never had: ten
 * positions that each demanded a category always finished with a top, a bottom
 * and a pair of shoes in them. Generic positions carry no such guarantee — ten
 * watches is ten pieces — so this is where a full grid stands when the
 * arithmetic has not arrived.
 *
 * WHAT IT IS NOT. It is not the stop sheet: nothing has been earned, and
 * "That's the ten — see what they make" over a closet that makes nothing is
 * the single most damaging sentence this flow could print. It is also not a
 * dead end. The grid stays live underneath, every tile still opens its piece,
 * and the one action here goes to the same place — `/item/[id]`, where a
 * mis-read garment can be re-read, renamed or swapped out.
 *
 * THE TONE IS CINCH'S FAULT, not the reader's. The likeliest cause by a wide
 * margin is the classifier calling a hoodie something it isn't, so the copy
 * offers to read the piece again before it suggests the reader change
 * anything.
 */
export function TenRepair({
  readiness,
  onCheckPiece,
}: {
  readiness: StarterReadiness;
  /** Opens the newest filed piece. The grid's own tiles are the other door. */
  onCheckPiece: () => void;
}) {
  const copy = repairCopy(readiness);

  return (
    <View
      className="rounded-plate border border-rule bg-surface"
      style={{ padding: 16, marginTop: 20 }}
      accessibilityRole="summary">
      <Text variant="eyebrow">Ten of ten</Text>
      <View style={{ marginBottom: 8, marginTop: 4 }}>
        <Text variant="heading" trim style={{ fontSize: 22 }}>
          {copy.title}
        </Text>
      </View>
      <Text variant="note" style={{ fontSize: 15, lineHeight: 22 }}>
        {copy.body}
      </Text>
      <View style={{ marginTop: 14 }}>
        <Button title={copy.action} onPress={onCheckPiece} className="self-stretch" />
      </View>
    </View>
  );
}
