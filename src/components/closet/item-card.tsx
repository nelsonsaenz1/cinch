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
import { pieceCardAnnouncement, pieceMetaLine } from '@/features/closet/piece-meta';
import type { Item } from '@/schemas/item';
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
  /**
   * C-01 / AX. At the largest Dynamic Type the grid becomes one row per piece
   * and the card changes composition with it: garment at 140×170 on the leading
   * edge, name and metadata stacked beside it. Set by `ClosetGrid` off the
   * system font scale, never guessed at here.
   */
  stacked?: boolean;
  /**
   * C-07 — the STORED state of this card, which the component inventory lists
   * alongside photo, silhouette, selected and skeleton.
   *
   * "The photographs are dimmed to 72% and lose their contact shadow — asleep,
   * not degraded". Only the WELL dims: the name and the metadata under it stay
   * at full strength, because a stored piece is a piece you are still meant to
   * be able to read. Opacity is never applied to type in this group.
   *
   * There is no contact shadow to lose — this card has never drawn one — so
   * that half of the annotation is satisfied by construction rather than by a
   * conditional.
   */
  stored?: boolean;
  /**
   * The metadata sentence, when the caller's state has a different one to tell.
   *
   * C-07 swaps cost-per-wear for what matters in storage. Passed in rather than
   * branched on `stored` inside the card, so the derivation stays a pure,
   * testable function (`storedMetaLine`) and the card keeps exactly one job.
   */
  metaLine?: string;
};

/**
 * The C-01 grid card — a single garment in the closet grid (and, via
 * `ClosetGrid`, Plan's packing screen: same card, same story).
 *
 * ── Wave 3 geometry (audit 60, 62, 63) ───────────────────────────────────
 *
 * The well is 168pt, down from 196, and the tile now ends 10pt under the
 * metadata line rather than carrying dead space below it — "audit 62 is
 * answered by geometry, not by cropping: the well is 168 pt against a 14 pt
 * gutter... so a card is mostly garment."
 *
 * The name is the ONLY label on the card (15pt, Medium). Everything under it
 * is prose in the regular cut at 13pt — audit 60 asks that "no metadata uses
 * Medium", which is why the line below is `note` and not `caption`.
 *
 * Wear count and cost-per-wear are ONE sentence in one place (`pieceMetaLine`),
 * not two figures pushed to opposite edges of the tile.
 *
 * NO OXBLOOD IS SPENT HERE. The accent badge that used to sit on the well for a
 * never-worn piece is gone: C-01's annotation is "No oxblood spent", and C-08
 * moves the fact into the metadata sentence as words, "never as 0 — a zero
 * here would read as a score."
 *
 * A silhouetted piece "sits in the same well at the same scale — the silhouette
 * gets the sand ground and a 2 pt stroke rather than a lighter box, so an
 * unphotographed piece reads as filed, not as missing."
 */
function ItemCardComponent({
  item,
  onPress,
  imageUri,
  onLongPress,
  selecting = false,
  selected = false,
  stacked = false,
  stored = false,
  metaLine,
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
  const needsReview = item.status === 'needs_review';
  const name = pieceName(item);
  const meta = metaLine ?? pieceMetaLine(item);

  // VoiceOver: a grid of garment cutouts is meaningless to a screen reader
  // without this. §9 wants the card announced as ONE element saying what a
  // person would say — name, then the metadata sentence, then whether there is
  // a photograph — rather than an image node followed by two unrelated labels.
  const a11yLabel = [
    // The overridden line rides the announcement too — a stored card that
    // SAID one thing and ANNOUNCED another would be two different facts about
    // one garment, which is the split §9 exists to prevent.
    metaLine
      ? [name, metaLine, displayUri ? 'photograph' : 'silhouette, no photograph yet'].join(', ')
      : pieceCardAnnouncement(item, name, { hasPhoto: Boolean(displayUri) }),
    stored ? 'stored' : null,
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
      {/* C-01 / AX: at the largest type the card is a ROW — garment on the
          leading edge, name and metadata stacked beside it, "metadata wraps to
          two lines", "no truncation, no ellipsis". The composition changes;
          nothing shrinks. */}
      <Animated.View style={press.style} className={stacked ? 'flex-row items-center' : undefined}>
        <View
          className={`overflow-hidden rounded-md ${stacked ? '' : 'h-[168px] w-full'} ${
            // A confirmed listing photo is a product shot the retailer already
            // set on white, so it sits on white and is CONTAINED — cropping it
            // to fill would cut the garment the shop framed deliberately. A
            // photograph the user took keeps the warm tray it has always had.
            // Same frame, same radius, same caption either way: the atlas asks
            // for one closet, not two (M-10).
            wearsListing ? 'bg-surface p-3' : displayUri ? 'bg-tray' : 'bg-sand'
          } ${
            // Selection is the border, not just the tick — readable at a glance
            // across a whole grid where a 22pt glyph is not. Drawn as a border,
            // which RN insets rather than adding to the box, so a selected cell
            // never shifts its neighbours. C-04 draws it at 2.5pt; the tick and
            // the word "Selected" below are the other two channels, so the
            // state survives greyscale and a colour-blind reading.
            //
            // A silhouetted piece keeps a 2pt stroke on the sand ground rather
            // than a lighter box — "an unphotographed piece reads as filed, not
            // as missing" (C-01).
            selecting && selected
              ? 'border-[2.5px] border-ink'
              : displayUri || wearsListing
                ? 'border border-hairline'
                : 'border-2 border-rule'
          }`}
          style={[
            stacked ? { width: 140, height: 170 } : null,
            dimmed ? { opacity: 0.55 } : null,
            // C-07's own value. After the selection dim, so a stored card in a
            // selection would not compound the two — the two states never
            // co-occur today, and if they ever do the louder one should win.
            !dimmed && stored ? { opacity: 0.72 } : null,
          ]}>
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

          {/* One badge, and never while selecting — the mode is about picking,
              not diagnosing.

              THE NEVER-WORN BADGE IS GONE. It was an oxblood pill on the well,
              and C-01's annotation is "No oxblood spent"; C-08 moves the fact
              into the metadata sentence, in words, where it reads as a
              description rather than a mark against the garment. Nothing is
              lost — the line under the name says "Never worn" for exactly the
              pieces the badge used to flag.

              The needs-review flag stays. It is warning-toned rather than
              accent, it says something the metadata line cannot, and the atlas
              never asked for its removal. */}
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

        {/* 10pt under the well, and the tile ends 10pt under the metadata
            line — audit 62's "the tile loses its lower dead space". At AX the
            block moves to the side of the garment instead of under it. */}
        <View className={stacked ? 'ml-3.5 flex-1' : 'mt-2.5'}>
          {/* The shared name derivation (features/closet/item-name.ts) — colour,
              kind, capitalised — so the grid and the rails never disagree about
              what a garment is called. THE ONLY LABEL ON THE CARD, at the
              atlas's 15pt: `label` is 13pt, so the size rides inline rather
              than as a second `text-*` class (NativeWind gives no precedence
              between two size utilities on one element). */}
          <Text
            variant="label"
            // AX frame: "Nothing is capped, abbreviated or ellipsised to make
            // this fit." In the two-column grid a name still has to hold one
            // line, because the tile is 168pt wide and a wrapped name would
            // push the metadata out of alignment across the row.
            numberOfLines={stacked ? undefined : 1}
            className="text-ink"
            style={{ fontSize: 15, lineHeight: 20 }}>
            {name}
          </Text>

          {/* C-04: while picking, the metadata line is REPLACED by the word
              Selected rather than hidden — that word is the third channel of
              the selection, beside the outline and the tick, and it is what
              keeps the state readable in greyscale. An unpicked card keeps its
              metadata, so the grid is still browsable while choosing. */}
          <Text
            variant={selecting && selected ? 'label' : 'note'}
            numberOfLines={stacked ? undefined : 1}
            className={`mt-[3px] ${selecting && selected ? 'text-ink' : ''}`}>
            {selecting && selected ? 'Selected' : meta}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// The grid can hold hundreds of these; re-rendering them all on a filter change
// is the difference between smooth and janky.
export const ItemCard = memo(ItemCardComponent);
