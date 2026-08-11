import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { pieceName } from '@/features/closet/item-name';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useLocalPhoto } from '@/features/ingest/local-photos';
import { type Item, costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE } from '@/theme/type-scale';

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

/** `$78`, not `$78.00` — the atlas writes whole prices without cents. */
function formatPrice(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

/**
 * The C-01 grid card — a single garment in the closet grid (and, via
 * `ClosetGrid`, Plan's packing screen: same card, same story).
 *
 * Cutouts sit on a neutral warm tray so nothing tints the garment — the tray
 * colour is the one surface in the app that must never carry the accent.
 * Geometry is the atlas's, literally: 196pt well, 12pt radius, hairline
 * border, name 13/600 at 7pt, meta row at 3pt.
 */
function ItemCardComponent({
  item,
  onPress,
  imageUri,
  onLongPress,
  selecting = false,
  selected = false,
}: ItemCardProps) {
  /**
   * Whether the picture on this card is the shop's rather than the user's.
   *
   * Read off the row instead of taken as a prop: every caller already resolves
   * `listingPath` first, so a separate flag would be a second source of truth
   * that could disagree with the URI actually being drawn.
   */
  const wearsListing = item.listingPath !== null;
  const theme = useTheme();
  const press = usePressFeedback();
  // A local item — `imagePath` null, its photo never uploaded — has no signed
  // URL for the grid to resolve, so the tile reads the on-device copy instead.
  // Keyed to null for every uploaded item so a 200-tile grid subscribes only
  // for the rows that are actually local; when the file is gone (another
  // device, a reinstall) this resolves null and the placeholder below stands,
  // never a broken image.
  const localPhoto = useLocalPhoto(item.imagePath === null ? item.id : null);
  const displayUri =
    imageUri ?? (item.imagePath === null ? (localPhoto.thumbUri ?? localPhoto.imageUri ?? undefined) : undefined);
  const cpw = costPerWear(item);
  const needsReview = item.status === 'needs_review';
  const neverWorn = item.wearCount === 0;

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

  // The atlas dims the WELL of an unselected card to 55%, not the name — the
  // caption stays legible so the grid is still browsable while picking.
  const dimmed = selecting && !selected;

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
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // No width class: FlashList's two-column layout already sizes the cell.
      // px-1.5 both sides = the atlas's 12pt column gap; pb + the grid's h-1
      // separator = its 14pt row gap.
      className="px-1.5 pb-2.5">
      <Animated.View style={press.style}>
        <View
          className={`h-[196px] w-full overflow-hidden rounded-md ${
            // A confirmed listing photo is a product shot the retailer already
            // set on white, so it sits on white and is CONTAINED — cropping it
            // to fill would cut the garment the shop framed deliberately. A
            // photograph the user took keeps the warm tray it has always had.
            // Same frame, same radius, same caption either way: the atlas asks
            // for one closet, not two (M-10).
            wearsListing ? 'bg-surface p-3' : 'bg-tray'
          } ${
            // Selection is the border, not just the tick — readable at a glance
            // across a whole grid where a 22pt glyph is not. Drawn as a border,
            // which RN insets rather than adding to the box, so a selected cell
            // never shifts its neighbours.
            selecting && selected
              ? 'border-2 border-ink'
              : 'border border-hairline'
          }`}
          style={dimmed ? { opacity: 0.55 } : undefined}>
          {displayUri ? (
            <Image
              source={stableImageSource(displayUri)}
              recyclingKey={item.id}
              contentFit={wearsListing ? 'contain' : 'cover'}
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

          {/* One badge only, and never while selecting — the mode is about
              picking, not diagnosing. A needs-review flag is the more urgent
              thing to say, so it wins the corner; otherwise the never-worn flag
              — in the accent — is the whole "get more from what you own" pitch
              made visible. */}
          {!selecting && needsReview ? (
            <View className="absolute left-2 top-2 rounded-sm bg-warning px-[7px] py-[3px]">
              {/* INK on the warning fill: canvas-on-warning is 2.85:1 — below AA
                  — on the one badge whose whole job is to be noticed. The
                  never-worn badge below keeps canvas; oxblood carries it. */}
              <Text
                variant="colophon"
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
                style={{ color: theme.ink, fontSize: 9, letterSpacing: 1.1, lineHeight: 12 }}>
                Needs review
              </Text>
            </View>
          ) : !selecting && neverWorn ? (
            <View className="absolute left-2 top-2 rounded-sm bg-accent px-[7px] py-[3px]">
              {/* 9/600 tracked uppercase per the atlas. Fixed-well constraint:
                  a wrapped badge gets sliced by overflow-hidden, so one line,
                  capped multiplier. */}
              <Text
                variant="colophon"
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
                style={{ color: theme.canvas, fontSize: 9, letterSpacing: 1.1, lineHeight: 12 }}>
                Never worn
              </Text>
            </View>
          ) : null}

          {/* The pick disc, top RIGHT — badges own the left corner. Hidden
              entirely outside selection mode: nothing about a garment is
 "unselected" when there is no selection. */}
          {selecting ? (
            selected ? (
              <View className="absolute right-2 top-2 h-[22px] w-[22px] items-center justify-center rounded-full bg-ink">
                <SymbolView
                  name="checkmark"
                  size={11}
                  tintColor={theme.canvas}
                  weight="bold"
                  resizeMode="scaleAspectFit"
                />
              </View>
            ) : (
              <View
                className="absolute right-2 top-2 h-[22px] w-[22px] rounded-full"
                // Ink at 35% / canvas at 70%, composed from the tokens rather
                // than typed as new hexes (hex + alpha suffix).
                style={{
                  borderWidth: 1.5,
                  borderColor: `${theme.ink}59`,
                  backgroundColor: `${theme.canvas}B3`,
                }}
              />
            )
          ) : null}
        </View>

        <View className="mt-[7px]">
          {/* The shared name derivation (features/closet/item-name.ts) — colour,
              kind, capitalised — so the grid and the rails never disagree about
              what a garment is called. 13/600: `label` is 13pt and font-medium
              resolves to HelveticaNeue-Medium, the face the design's "600" maps
              to (there is no true 600 cut — see tailwind.config.js). */}
          <Text variant="label" numberOfLines={1} className="text-ink">
            {pieceName(item)}
          </Text>
          {/* Meta hides while selecting — name only, per C-04: the row stays
              scannable when the job is picking, not reading. */}
          {selecting ? null : (
            // `shrink` on both children, not just `numberOfLines`. A Text that
            // cannot shrink reports its full intrinsic width to the row, so at
            // large Dynamic Type the row grew WIDER THAN THE CARD: the meta
            // escaped the tile, collided with the neighbouring card's meta and
            // ran off the right edge of the screen. `numberOfLines` does
            // nothing until something has constrained the width. Measured at
            // AX5 before and after — see docs/design/dynamic-type-walk.md.
            //
            // This contains it. It does NOT make the figures readable at the
            // largest setting: they now ellipsize instead ("1284…", "$1.01 /…")
            // and a truncated number does not look truncated. Wrapping the row
            // was tried and backed out — it also wrapped at the DEFAULT size,
            // which changes the single-line meta the atlas draws, and that is a
            // design decision rather than a defect fix. Recorded as open.
            <View className="mt-[3px] flex-row items-baseline justify-between gap-2">
              <Text variant="caption" numberOfLines={1} className="shrink">
                {`${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
              </Text>
              {/* Right meta, per the atlas: cost-per-wear in ink when it exists;
                  a never-worn piece with a price shows what that price hasn't
                  earned, in muted; no price → nothing to say. */}
              {neverWorn && item.purchasePrice !== null ? (
                <Text variant="caption" numberOfLines={1} className="shrink">
                  {`${formatPrice(item.purchasePrice)} unearned`}
                </Text>
              ) : cpw !== null ? (
                <Text variant="caption" numberOfLines={1} className="shrink text-ink">
                  {`$${cpw.toFixed(2)} / wear`}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// The grid can hold hundreds of these; re-rendering them all on a filter change
// is the difference between smooth and janky.
export const ItemCard = memo(ItemCardComponent);
