import { View } from 'react-native';

import { SeatMarks } from '@/components/circles/room-parts';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { groupRowAccessibilityLabel, groupRowLine } from '@/features/circles/copy';
import { MIN_TAP_TARGET } from '@/theme/metrics';

/**
 * ONE GROUP IN THE LIST — PC-06, redesigned as a plate.
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
 * ── WHY IT IS A PLATE NOW, AND NOT A ROW IN A CARD ──────────────────────────
 *
 * Redesign 27 draws each group as its own warm slab on the canvas with air
 * between them, rather than as hairline-separated rows inside one white card.
 * The change is not decoration. A card of rows says "one list, several
 * entries"; separate plates say "several rooms". These groups have nothing to
 * do with one another — different people, different names, no ordering that
 * means anything — and the shipped card implied a set where there is only a
 * collection.
 *
 * The name takes the serif at plate size, which is what the frames give it: on
 * a screen whose entire content is four or five names, the names ARE the
 * design. The data line stays `note` underneath, and the marks beside it are
 * the count as a picture — see `SeatMarks` for why they are unnamed discs and
 * not the faces the frames draw.
 *
 * ── NOTHING HERE IS CAPPED ──────────────────────────────────────────────────
 *
 * No `numberOfLines`, no height, no `maxFontSizeMultiplier`. A group's name is
 * the whole of what the row identifies, so a truncated one is a clipped meaning
 * — and at AX-XXXL the plate simply grows, which is the only answer the
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
      haptic="selection"
      style={{ minHeight: MIN_TAP_TARGET }}
      className="rounded-plate bg-tray px-5 py-4">
      {/* One accessible element: the two decks are one sentence to VoiceOver,
          composed above, so a reader hears the fact once rather than swiping
          through a name and then a data line. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {/* `trim` collapses the serif line box to the cap height — safe here
            because the name is the plate's own heading on its own line, and it
            is what keeps the disc row below from drifting away from it. */}
        <Text variant="plate" trim>
          {name}
        </Text>
        <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-2">
          <SeatMarks memberCount={memberCount} />
          <Text variant="note">{groupRowLine(memberCount, isOwner)}</Text>
        </View>
      </View>
    </PressableSurface>
  );
}
