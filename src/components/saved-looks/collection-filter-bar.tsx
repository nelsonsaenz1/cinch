import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { allFilterLabel, filterAccessibilityLabel } from '@/features/saved-looks/copy';
import type { SavedFilter } from '@/features/saved-looks/states';
import type { SavedCollection } from '@/features/saved-looks/types';

/**
 * OS-03's chip row: All, then one chip per collection.
 *
 * ── IT IS A FACET, NOT A FETCH ─────────────────────────────────────────────
 *
 * §10: "Filter is a client-side facet over the loaded set; changing it never
 * refetches." This component emits a `SavedFilter` and nothing else;
 * `filterSaves` in `states.ts` is what narrows the list. A refetch per chip tap
 * would also re-resolve `availability` for every row, which is
 * correct-but-wasteful in a way nobody notices until a revoked look starts
 * flickering between states as somebody browses their own shelves.
 *
 * ── THE CHIP ROW SCROLLS; IT DOES NOT WRAP AND IT DOES NOT HIDE ────────────
 *
 * `horizontal` matches the frame, and every chip is reachable by scrolling —
 * there is no overflow menu and no "+3 more". At AX sizes the chips get wider
 * and the row gets longer, which is the composition change §9 asks for; nothing
 * is capped, and nothing is ellipsised.
 *
 * ── AND EVERY CHIP SAYS ITS COUNT OUT LOUD ─────────────────────────────────
 *
 * The drawn chip carries a numeral only on "All", matching OS-03. The SPOKEN
 * label carries the count on every chip, because a reader who cannot see the
 * grid behind the row is exactly the reader for whom "Fall layering" alone does
 * not say whether tapping it is worth anything. `accessibilityState.selected`
 * carries the choice; the label never repeats it, or VoiceOver announces the
 * change twice.
 */

export type CollectionFilterBarProps = {
  collections: readonly SavedCollection[];
  /** How many saves in total — the numeral on the All chip. */
  total: number;
  value: SavedFilter;
  onChange: (filter: SavedFilter) => void;
};

export function CollectionFilterBar({
  collections,
  total,
  value,
  onChange,
}: CollectionFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-gutter gap-2 pb-3"
      // The row is a set of choices, so it is announced as one thing with parts
      // rather than as a paragraph of chips.
      accessibilityRole="tablist">
      <Chip
        label={allFilterLabel(total)}
        selected={value === null}
        onPress={() => onChange(null)}
        accessibilityHint="Shows every saved look"
      />
      {collections.map((collection) => (
        <View key={collection.id} accessibilityLabel={filterAccessibilityLabel(collection.name, collection.savedCount)}>
          <Chip
            label={collection.name}
            selected={value === collection.id}
            onPress={() => onChange(collection.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}
