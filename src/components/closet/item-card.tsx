import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { pieceName } from '@/features/closet/item-name';
import { type Item, costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';
import { stableImageSource } from '@/features/closet/use-image-urls';

export type ItemCardProps = {
  item: Item;
  onPress?: (item: Item) => void;
  /** Signed URL for the thumb/cutout — storage paths are not URLs. */
  imageUri?: string;
  /** Enters selection mode from the grid. Absent = the grid has no such mode. */
  onLongPress?: (item: Item) => void;
  /** True while the grid is picking pieces rather than opening them. */
  selecting?: boolean;
  /** Whether this piece is one of the picked ones. Only read while selecting. */
  selected?: boolean;
};

/**
 * A single garment in the closet grid.
 *
 * Cutouts sit on a neutral warm tray so nothing tints the garment — the tray
 * colour is the one surface in the app that must never carry the accent.
 */
function ItemCardComponent({
  item,
  onPress,
  imageUri,
  onLongPress,
  selecting = false,
  selected = false,
}: ItemCardProps) {
  const theme = useTheme();
  const cpw = costPerWear(item);
  const needsReview = item.status === 'needs_review';

  // VoiceOver: a grid of garment cutouts is meaningless to a screen reader
  // without this. Build the sentence a person would actually say.
  const a11yLabel = [
    item.subcategory ?? item.category,
    item.colors[0]?.name,
    item.brand,
    item.wearCount > 0 ? `worn ${item.wearCount} times` : 'never worn',
    needsReview ? 'needs review' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const neverWorn = item.wearCount === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      // Announced only in selection mode: a grid of two hundred garments that
      // all report "not selected" is noise on every other visit.
      accessibilityState={selecting ? { selected } : undefined}
      accessibilityHint={selecting ? undefined : onLongPress ? 'Long press to select pieces' : undefined}
      onPress={() => onPress?.(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      // No width class: FlashList's two-column layout already sizes the cell —
      // a w-1/2 here would render every card at a quarter of the screen.
      className="p-1.5 active:opacity-80">
      <View
        className={`aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray dark:bg-tray-dark ${
          // The ring is the selection, not the tick — it is readable at a
          // glance across a whole grid where a 20pt glyph is not. Drawn as a
          // border, which RN insets rather than adding to the box, so a
          // selected cell never shifts its neighbours.
          selecting && selected ? 'border-2 border-ink dark:border-ink-dark' : ''
        }`}>
        {imageUri ? (
          <Image
            source={stableImageSource(imageUri)}
            recyclingKey={item.id}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // No cutout yet. This is the default in the Simulator, where subject
          // lifting cannot run — so it has to look considered, not broken.
          <View className="flex-1 items-center justify-center">
            <SymbolView
              name={needsReview ? 'exclamationmark.triangle' : 'tshirt'}
              size={26}
              tintColor={needsReview ? theme.warning : theme.hairline}
              resizeMode="scaleAspectFit"
            />
          </View>
        )}

        {/* One badge only. A needs-review flag is the more urgent thing to say,
            so it wins the corner; otherwise the never-worn flag — in the accent
            — is the whole "get more from what you own" pitch made visible. */}
        {needsReview ? (
          <View className="absolute left-2 top-2 rounded-sm bg-warning px-2 py-0.5">
            {/* The card around this badge is a fixed-aspect tray (`aspect-[4/5]`)
                with `overflow-hidden` — a badge that wraps to a second line at a
                large Dynamic Type setting doesn't grow the card, it gets sliced
                by it. Two words genuinely cannot wrap here, so the line is
                capped rather than allowed to grow past its own pill: the tighter
                1.4 multiplier text.tsx reserves for exactly this — content
                pinned inside a fixed-size cell (see its `statFigure` note). */}
            {/* INK on the warning fill, not canvas. `canvas`-on-`warning` was
                2.85:1 — below AA at any size — on the one badge in the app
                whose whole job is to be noticed. The palette is locked, so the
                fix is usage: the same amber ground read in ink clears at
                5.83:1. (The never-worn badge below keeps `canvas`, which is
                correct — the accent is dark enough to carry it.) */}
            <Text
              variant="caption"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={{ color: theme.ink }}>
              Needs review
            </Text>
          </View>
        ) : neverWorn ? (
          <View className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-0.5">
            {/* Same fixed-tray constraint as the needs-review badge above. */}
            <Text
              variant="colophon"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={{ color: theme.canvas }}>
              Never worn
            </Text>
          </View>
        ) : null}

        {/* The pick mark, top RIGHT — the badge above owns the left corner, and
            two marks in one corner is how a grid stops being readable. Hidden
            entirely outside selection mode: nothing about a garment is
            "unselected" when there is no selection. */}
        {selecting ? (
          <View className="absolute right-2 top-2">
            <SymbolView
              name={selected ? 'checkmark.circle.fill' : 'circle'}
              size={22}
              tintColor={selected ? theme.ink : theme.faint}
              resizeMode="scaleAspectFit"
            />
          </View>
        ) : null}
      </View>

      <View className="mt-2 px-0.5">
        {/* The shared name, not the bare `subcategory` column: the tile used
            to read "sweater" while the highlights rail ten points above it
            said "Cream sweater" for the same garment. One derivation now
            (features/closet/item-name.ts) — colour, kind, capitalised. */}
        <Text variant="label" numberOfLines={1} className="text-ink dark:text-ink-dark">
          {pieceName(item)}
        </Text>
        {/* wears on the left, cost-per-wear on the right in the serif — the
            garment's whole story in one line. Never-worn reads in the accent. */}
        <View className="mt-1 flex-row items-baseline justify-between">
          <Text
            variant="caption"
            className={neverWorn ? 'text-accent dark:text-accent-dark' : 'text-muted dark:text-muted-dark'}>
            {neverWorn ? 'Never worn' : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
          </Text>
          {/* `statSmall` names the 13px serif figure once, rather than stacking
              an inline `fontSize` on the `stat` variant — see text.tsx. */}
          <Text variant="statSmall" className="text-ink dark:text-ink-dark">
            {cpw !== null ? `$${cpw.toFixed(2)}` : '—'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// The grid can hold hundreds of these; re-rendering them all on a filter change
// is the difference between smooth and janky.
export const ItemCard = memo(ItemCardComponent);
