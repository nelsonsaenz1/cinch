import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useWindowDimensions, View } from 'react-native';

import { ItemCard } from '@/components/closet/item-card';
import { GRID_ROW_GAP, gridColumns } from '@/features/closet/closet-spec';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import type { Item } from '@/schemas/item';
import { GUTTER } from '@/theme/tokens';

export type ClosetGridProps = {
  items: Item[];
  onItemPress?: (item: Item) => void;
  /** Long press on a tile — the way into the closet's selection mode. */
  onItemLongPress?: (item: Item) => void;
  /**
   * The picked ids, or null when the grid is not selecting. A `Set` rather
   * than an array: this is read once per visible cell on every render, and an
   * `includes` over a two-hundred-piece selection is a scroll stutter.
   */
  selectedIds?: ReadonlySet<string> | null;
  /** Storage paths → signed URLs; the grid prefers the thumb, falls back to the cutout. */
  resolveImage?: (...paths: (string | null | undefined)[]) => string | undefined;
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
  // Kept for callers that want to ride content inside the list. The closet's
  // own masthead deliberately sits OUTSIDE it (see (tabs)/closet.tsx): a
  // controlled TextInput in a list header loses focus on every keystroke.
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  /** Passed straight to FlashList — pull-to-refresh for the closet. */
  refreshControl?: React.ReactElement<import('react-native').RefreshControlProps>;
  /** The underlying FlashList, for callers that need to scroll it ("See all"). */
  listRef?: React.Ref<FlashListRef<Item>>;
  /**
   * C-07 — every card in this grid is a stored piece: the well dims to 72% and
   * loses its contact shadow. A property of the GRID rather than of each row,
   * because storage is a place and every piece in it is in that place.
   */
  stored?: boolean;
  /**
   * The metadata sentence, when the calling state has a different one to tell
   * than wear-and-cost-per-wear. C-07 passes `storedMetaLine`.
   */
  metaFor?: (item: Item) => string;
};

/**
 * The Dynamic Type setting at which the grid becomes a list.
 *
 * C-01 / AX: "At the largest supported size the two-column grid changes
 * composition rather than shrinking: one row per piece, garment at 140×170 on
 * the leading edge, name and metadata stacked beside it." Height is allowed;
 * nothing is capped, abbreviated or ellipsised to make two columns fit.
 *
 * The threshold itself is shared with IT-01 / AX and RV-01 / AX rather than
 * chosen here — see `features/closet/dynamic-type.ts` for why all three stress
 * frames have to arrive at the same moment.
 */
const AX_COLUMN_BREAK = AX_STACK_SCALE;

/**
 * FlashList v2 — note there are no size-estimate props any more. v2 is a
 * New-Architecture rewrite that measures automatically, so `estimatedItemSize`
 * and friends from v1 tutorials are gone, not merely optional.
 */
export function ClosetGrid({
  items,
  onItemPress,
  onItemLongPress,
  selectedIds = null,
  resolveImage,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  refreshControl,
  listRef,
  stored = false,
  metaFor,
}: ClosetGridProps) {
  // Read from the system, never guessed: `fontScale` is the user's Dynamic Type
  // setting, and it re-renders on change like any other window dimension.
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= AX_COLUMN_BREAK;

  return (
    <FlashList
      ref={listRef}
      data={items}
      // THREE COLUMNS, not two — redesign 14. A denser grid is what makes this
      // read as a material library rather than a product listing: at two
      // columns a closet of eighty is eight scrolls of large cards, and the
      // thing somebody came here to do — find a piece by looking at it — is
      // faster the more pieces are in one glance.
      //
      // Not two and a half, either. A partially cut third column reads as a
      // horizontal scroll affordance this grid does not have, and it does not
      // reflow cleanly to the one-column accessibility layout.
      numColumns={gridColumns(stacked)}
      // FlashList memoizes cells against the data array; the column count is
      // not part of it, so a Dynamic Type change while the grid is mounted
      // would otherwise leave every cell drawn in the old composition.
      extraData={stacked ? `stacked:${selectedIds?.size ?? -1}` : `grid:${selectedIds?.size ?? -1}`}
      keyExtractor={(item) => item.id}
      // `extraData` above is also what makes a selection visible: FlashList
      // memoizes cells against the data array, which does not change when a
      // tick is toggled.
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          onPress={onItemPress}
          onLongPress={onItemLongPress}
          selecting={selectedIds !== null}
          selected={selectedIds?.has(item.id) ?? false}
          stacked={stacked}
          dense={!stacked}
          stored={stored}
          metaLine={metaFor?.(item)}
          // WHITE-GROUND FIRST, RAW CAMERA LAST.
          //
          // `resolve` is first-hit-wins over this argument order, and the
          // order used to put `thumbPath` — the raw photograph — ahead of the
          // cutout. A grid of three columns is the one place in the app where
          // dozens of pieces are seen at once, so a mixed run of white-ground
          // renders and bedroom-floor snapshots reads as a broken import
          // rather than a wardrobe.
          //
          // The order now is: `listingPath` (the catalogue/stock shot, already
          // shot on white), `platePath` (the scale-normalised render),
          // `cutoutPath` (background removed), and only then `thumbPath`. The
          // raw frame is kept as the final fallback because a piece with no
          // cutout yet must still appear — an empty tile would read as a
          // missing garment. `use-closet-screen.ts` already signs all four
          // paths, so nothing new is fetched by asking for them in this order.
          imageUri={resolveImage?.(
            item.listingPath,
            item.platePath,
            item.cutoutPath,
            item.thumbPath,
          )}
        />
      )}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      // Plain style, deliberately: FlashList is not wrapped by NativeWind, so a
      // contentContainerClassName here is silently dropped — no gutter, no
      // bottom padding, and nothing errors. `GUTTER` is the same measure
      // `px-gutter` gives every other page; 96 = pb-24.
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 96 }}
      // Columns stay minimal — the wells do the separating there — but ROWS
      // part at GRID_ROW_GAP, because a row ends in its captions and 2pt put
      // "Never worn" nearly touching the photograph below it. See the
      // constant's note in closet-spec.ts.
      ItemSeparatorComponent={() => <View style={{ height: stacked ? 8 : GRID_ROW_GAP }} />}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      // Search mode puts a live text field directly above this grid; scrolling
      // the results is how a person says they are done typing.
      keyboardDismissMode="on-drag"
    />
  );
}
