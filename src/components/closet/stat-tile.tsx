import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

export type StatTileProps = {
  label: string;
  /** The headline number, already formatted — this component does no maths. */
  value: string;
  /** One short line under the number, e.g. "navy overcoat". */
  detail?: string | null;
  selected: boolean;
  onPress: () => void;
  size: number;
};

/**
 * A number about the closet, in the same square as a category.
 *
 * These are the sort controls, but a chip that reads "Cost / wear" only names
 * a sort; a tile that reads "$3.41" and "cost / wear" answers the question the
 * user actually had, and sorts as a side effect of being tapped. Same footprint
 * as CategoryTile on purpose — one grid module runs the whole screen, so the
 * page reads as a single board rather than a stack of unrelated widgets.
 *
 * Figures are tabular (the `stat` and `colophon` variants set the feature), so
 * a column of these does not jitter as the values change.
 */
export function StatTile({ label, value, detail, selected, onPress, size }: StatTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      accessibilityHint={`Sort the closet by ${label}`}
      accessibilityState={{ selected }}
      style={{ width: size, height: size }}
      className={`justify-between rounded-plate p-3 active:opacity-80 ${
        selected
          ? 'border-2 border-ink bg-sand dark:border-ink-dark dark:bg-sand-dark'
          : 'border border-hairline bg-tray dark:border-hairline-dark dark:bg-tray-dark'
      }`}>
      <Text variant="colophon" numberOfLines={2} className="text-muted dark:text-muted-dark">
        {label}
      </Text>

      <View>
        <Text variant="stat" numberOfLines={1} className="text-ink dark:text-ink-dark">
          {value}
        </Text>
        {detail ? (
          // `label`, not `colophon`. The colophon variant uppercases and
          // tracks, which is right for a fixed caption and wrong for a garment
          // name: "navy overcoat" became "NAVY OVERCO…" in the same tile that
          // was supposed to be telling you which coat. Two lines, sentence
          // case, so most names land whole.
          <Text variant="label" numberOfLines={2} className="mt-1 text-muted dark:text-muted-dark">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
