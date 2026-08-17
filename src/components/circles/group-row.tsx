import { View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { groupRowAccessibilityLabel, groupRowLine } from '@/features/circles/copy';
import { MIN_TAP_TARGET } from '@/theme/metrics';

/**
 * ONE GROUP IN THE LIST — PC-06.
 *
 * Presentational only: props in, no query, no navigation, no mutation. `onOpen`
 * is a callback the integration owner wires, which is what lets every state in
 * this kit be exercised without a renderer or a network.
 *
 * ── WHY THIS IS NOT `SettingsRow` OR `ValueRow` ─────────────────────────────
 *
 * Both were the obvious reach and both are the wrong shape, on their own terms.
 * `ValueRow` is "a fact" — it declares `accessibilityRole="text"` and carries no
 * affordance at all, so a group row built from it would not be pressable.
 * `SettingsRow` is the same row with a chevron, and its label and value share a
 * line and wrap sideways; this row is a NAME over a quiet data line, which is a
 * two-deck vertical block, not a label/value pair. Growing either to hold a
 * second deck would make it a component that does three things — the exact
 * argument `settled-row.tsx`'s own header makes about why it did not absorb
 * `SettingsRow`.
 *
 * What IS reused is the press: `PressableSurface` carries the compression, the
 * dim, the 44pt floor and Reduce Motion safety by construction (UX-07), so this
 * file hand-rolls none of it.
 *
 * ── NOTHING HERE IS CAPPED ──────────────────────────────────────────────────
 *
 * No `numberOfLines`, no height, no `maxFontSizeMultiplier`. A group's name is
 * the whole of what the row identifies, so a truncated one is a clipped meaning
 * — and at AX-XXXL the row simply grows, which is the only answer the
 * accessibility contract permits.
 */
export function GroupRow({
  name,
  memberCount,
  isOwner,
  onOpen,
}: {
  name: string;
  /** `joined` only — `circle_member_count`. Says how many, never who. */
  memberCount: number;
  isOwner: boolean;
  onOpen: () => void;
}) {
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={groupRowAccessibilityLabel({ name, memberCount, isOwner })}
      onPress={onOpen}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="px-4 py-3.5">
      {/* One accessible element: the two decks are one sentence to VoiceOver,
          composed above, so a reader hears the fact once rather than swiping
          through a name and then a data line. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="body">{name}</Text>
        <Text variant="note" className="mt-0.5">
          {groupRowLine(memberCount, isOwner)}
        </Text>
      </View>
    </PressableSurface>
  );
}
