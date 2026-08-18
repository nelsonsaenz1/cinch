import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  NO_PAIRING_COPY,
  RAIL_HEADING,
  RAIL_QUALIFIER,
} from '@/features/item/item-spec';
import { GUTTER, useTheme } from '@/theme/tokens';

export type RailPiece = {
  id: string;
  name: string;
  imageUri: string | null;
  /** Times worn in the same outfit. Absent in harmony mode. */
  coWearCount?: number;
};

export type WearsWellWithProps = {
  pieces: RailPiece[];
  /**
   * 'coWear'  — real shared wear history; caption reads "Worn together 11×".
   * 'harmony' — no wear history yet; these are colour-matched pairings.
   */
  mode: 'coWear' | 'harmony';
  onPressPiece: (id: string) => void;
};

const TILE_WIDTH = 88;
const TILE_HEIGHT = 104;

/**
 * The two modes make DIFFERENT CLAIMS, and the copy is where that is kept
 * honest.
 *
 * `coWear` is a count of outfits this piece and that piece were both in. It is
 * a record. `harmony` is the OKLCH engine's opinion about two colours, offered
 * because there is no record yet — the piece is new, or it has never left the
 * wardrobe. Printing "Wears well with" over the second set would be the app
 * inventing a history for a garment that has none, and "Worn together" per
 * tile would be a flat lie about a specific pairing.
 *
 * So harmony gets its own header — "Pairs by colour" names the basis of the
 * suggestion in the header itself, which is the strongest place to put it: a
 * reader who takes nothing else from the rail has already been told these are
 * colour matches, not memories.
 *
 * Harmony tiles carry NO caption. The alternative — "Colour match" repeated
 * nine times down a rail whose header already says exactly that — is noise
 * that adds no per-tile information, and the empty line under each tile is
 * itself the signal that there is no number here to report. In `coWear` the
 * caption is per-tile DATA (11× against 4×), which earns its line.
 */
/**
 * The headings and their qualifiers live in `features/item/item-spec.ts` now —
 * pure, and therefore assertable by a test that runs them rather than one that
 * greps this file. The claim a heading makes is policy, not presentation.
 */

/** The tile's image well — tray ground, hairline ring, 10px radius, per I-01. */
function Well({ piece }: { piece: RailPiece }) {
  const theme = useTheme();
  return (
    <View
      className="overflow-hidden rounded-md border border-hairline bg-tray"
      style={{ width: TILE_WIDTH, height: TILE_HEIGHT }}>
      {piece.imageUri ? (
        <Image
          source={{ uri: piece.imageUri }}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{ flex: 1 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        // No cutout yet — the norm in the Simulator, and the norm for a few
        // seconds after a capture. The same considered placeholder the closet
        // grid and the masthead rails draw, never a broken image.
        <View className="flex-1 items-center justify-center">
          <SymbolView name="tshirt" size={20} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
        </View>
      )}
    </View>
  );
}

function Tile({
  piece,
  mode,
  onPress,
}: {
  piece: RailPiece;
  mode: WearsWellWithProps['mode'];
  onPress: (id: string) => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback();

  // Guarded on the number, not on the mode alone: `coWearCount` is optional on
  // the type, and "Worn together undefined×" is exactly the kind of thing that
  // ships. No count, no caption.
  const caption =
    mode === 'coWear' && typeof piece.coWearCount === 'number'
      ? `Worn together ${piece.coWearCount}×`
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[piece.name, caption].filter(Boolean).join(', ')}
      accessibilityHint="Opens this piece"
      onPress={() => onPress(piece.id)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // The 88×104 well clears the 44pt floor on both axes on its own; no
      // hitSlop is needed and none is added, because a slop that overlapped the
      // neighbouring tile would make the rail ambiguous under a thumb.
      style={{ width: TILE_WIDTH }}>
      <Animated.View style={press.style}>
        <Well piece={piece} />
        {/* Colour by inline style, never a second `text-*` class: `caption`
            already carries `text-muted`, and NativeWind gives no precedence
            between two colour utilities on one element. */}
        <Text
          variant="caption"
          numberOfLines={2}
          className="mt-[6px]"
          style={{ color: theme.ink }}>
          {piece.name}
        </Text>
        {caption ? (
          <Text variant="caption" numberOfLines={1} className="mt-[2px]" style={{ fontSize: 10 }}>
            {caption}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The horizontal rail of pieces this one is actually worn with — I-01's
 * "Wears well with", and its honest fallback.
 *
 * Purely presentational: the caller decides which pieces qualify, resolves
 * their image URLs, and — critically — decides which MODE the rail is in.
 * That decision is a claim about the user's data and belongs where the data
 * is; this component only guarantees that the claim it is handed is the one it
 * prints. See `HEADERS` for the argument.
 *
 * Renders NOTHING when there are no pieces. The atlas draws no empty state for
 * this rail, and that is the correct reading rather than an omission: an
 * eyebrow over an empty shelf tells the reader about a feature they cannot
 * use, on a page that is supposed to be about their coat. Absence is quieter
 * than an apology.
 *
 * LAYOUT CONTRACT: the header carries `px-gutter` and the rail carries its
 * gutter as content inset, so the last tile can scroll off the right edge
 * instead of stopping at a margin. Expects a full-bleed parent — a scroll
 * container with NO horizontal padding.
 */
export function WearsWellWith({ pieces, mode, onPressPiece }: WearsWellWithProps) {
  // ── THE NO-DATA STATE IS A STATE, NOT AN ABSENCE — redesign 15 ───────────
  //
  // This returned null, so a piece with no co-wear and no colour peers simply
  // had no section at all. That reads as a screen that failed to finish rather
  // than as an honest answer, and it teaches nothing: somebody who has worn a
  // coat alone every time never learns that wearing it WITH something is what
  // fills the rail.
  //
  // What it must never become is filler. The copy says outright that there is
  // nothing to show that would be true.
  if (pieces.length === 0) {
    return (
      <View className="px-gutter">
        <SectionHeader title={RAIL_HEADING.coWear} className="px-0" />
        <Text variant="label" className="mt-2">
          {NO_PAIRING_COPY.title}
        </Text>
        <Text variant="note" className="mt-1.5">
          {NO_PAIRING_COPY.body}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader
        title={RAIL_HEADING[mode]}
        trailing={<Text variant="caption">{`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`}</Text>}
        className="px-gutter"
      />
      {/* THE QUALIFIER. A heading is easy to skim past, so the claim is made
          again in prose: co-wear says these were worn together, and colour
          says explicitly that they were NOT. Without this line "Pairs by
          colour" could still be read as a record. */}
      {RAIL_QUALIFIER[mode] ? (
        <Text variant="note" className="px-gutter">
          {RAIL_QUALIFIER[mode]}
        </Text>
      ) : null}
      {/* ScrollView, not FlatList — the same shape the closet masthead's rails
          use, and a co-wear rail is a handful of tiles rather than a list worth
          virtualising. The 10px lead sits in `contentContainerStyle` with the
          gutter and the gap so the whole rail's measure is readable in one
          place. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 10, paddingTop: 10 }}>
        {pieces.map((piece) => (
          <Tile key={piece.id} piece={piece} mode={mode} onPress={onPressPiece} />
        ))}
      </ScrollView>
    </View>
  );
}
