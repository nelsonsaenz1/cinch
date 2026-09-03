import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GarmentCell } from '@/components/today/garment-cell';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import {
  MAX_PIECES,
  ceilingRefusalLine,
  garmentDisplayName,
  matchesCategoryFilter,
  pieceBoundsLine,
  togglePiece,
  wouldRefuse,
  type PieceCategoryFilter,
} from '@/features/share-look/compose';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

export type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

const FILTERS: PieceCategoryFilter[] = ['All', 'Tops', 'Bottoms', 'Shoes'];

/**
 * S-01 — the Closet's own plate grid at three-up, in numbered selection mode.
 *
 * Deliberately NOT `ClosetGrid`/`ItemCard` (Unit E and D's `components/
 * event-outfits/**` and `(tabs)/closet.tsx` are out of this unit's files):
 * this redraws the same grammar — oat tray, `object-fit: contain`, the
 * hairline well — through `GarmentCell`, the one shared primitive the plate
 * grammar actually promises never to drift, rather than reimplementing plate
 * rendering from scratch.
 *
 * Selection is numbered, not ticked: the badge IS the stack order, so picking
 * and composing are the same act.
 */
export function PiecePicker({
  candidates,
  stack,
  resolveImage,
  onChangeStack,
  onRefused,
  ax = false,
}: {
  candidates: Garment[];
  stack: Garment[];
  resolveImage: ResolveImage;
  onChangeStack: (next: Garment[]) => void;
  /**
   * Correction 27 — "a seventh tap is refused IN THE BAR, in the same place
   * the count lives, and the tile does not take a selection ring it will lose
   * a moment later."
   *
   * So the grid reports the refusal upward instead of showing it: a tile that
   * flashed a ring and then dropped it would be a lie told for one frame, and
   * a refusal shown on the tile is a refusal shown where the user is not
   * looking for the count.
   */
  onRefused?: () => void;
  /** Largest Dynamic Type: two columns, 28 pt selection numbers (SL-01 / AX). */
  ax?: boolean;
}) {
  const [filter, setFilter] = useState<PieceCategoryFilter>('All');

  const visible = useMemo(
    () => candidates.filter((g) => matchesCategoryFilter(g, filter)),
    [candidates, filter],
  );

  const badgeOf = useMemo(() => {
    const map = new Map<string, number>();
    stack.forEach((g, i) => map.set(g.id, i + 1));
    return map;
  }, [stack]);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
            selected={filter === f}
            selectedGround="ink"
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
        {visible.map((g) => (
          // SL-01 / AX — "the three-column grid becomes two so a garment name
          // can be read at 18 pt without wrapping to three lines."
          <View key={g.id} style={{ width: ax ? '50%' : '33.333%', padding: 5 }}>
            <PieceCell
              garment={g}
              badge={badgeOf.get(g.id) ?? null}
              ax={ax}
              resolveImage={resolveImage}
              onPress={() => {
                if (wouldRefuse(stack, g)) {
                  onRefused?.();
                  return;
                }
                onChangeStack(togglePiece(stack, g));
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The foot tray: the running stack's thumbnails, "N picked", and
 * `Compose` — inert below two pieces (`canCompose`), per S-01's own rule that
 * one garment is a piece, not a look. Kept separate from the wizard's header
 * `Next` (which advances the same step) because the atlas draws both: the
 * header is the step-nav grammar every screen in the flow shares, and this
 * tray is S-01's own — the one place a poster can see the stack they are
 * building without leaving the grid.
 */
/** Audit 97 — the bar drops from 148 pt to 88, which is what keeps three full
 *  grid rows on screen against an acceptance floor of one extra row. */
export const SELECTION_BAR_HEIGHT = 88;
/** SL-01 / AX — the bar drops its thumbnails and grows to 138. */
export const SELECTION_BAR_HEIGHT_AX = 138;

export function PickerFooterTray({
  stack,
  resolveImage,
  canCompose,
  onCompose,
  refused = false,
  ax = false,
  showAction = true,
}: {
  stack: Garment[];
  resolveImage: ResolveImage;
  canCompose: boolean;
  onCompose: () => void;
  /** A seventh tap happened. Printed where the count lives, per correction 27. */
  refused?: boolean;
  ax?: boolean;
  /**
   * Whether the tray carries its own Compose control.
   *
   * True on the board wizard, where Compose is the step-nav and the tray is
   * the only place it lives. False on `compose.tsx`, whose own "Wear it today"
   * IS composing — two filled primaries a thumb apart, saying different words
   * for the same act, is the collision directive #36 names. With it off the
   * tray keeps the job only it does: the count, the bounds before they are
   * hit, and the refusal.
   */
  showAction?: boolean;
}) {
  const theme = useTheme();

  /**
   * The line where the count lives — and the one place the refusal appears.
   *
   * Three things share this slot in a fixed priority, because they are three
   * answers to the same question ("what does the bar hold?"): the refusal
   * while it is being refused, the requirement while nothing is picked, the
   * count otherwise. Correction 27's "a user learns the ceiling before hitting
   * it rather than at the refusal" is why the empty case names BOTH bounds.
   */
  const statusLine = refused
    ? ceilingRefusalLine()
    : stack.length === 0
      ? pieceBoundsLine()
      : `${stack.length} ${stack.length === 1 ? 'piece' : 'pieces'}, in this order`;

  return (
    <View
      // The bar keeps its height and its shape with nothing selected — "nothing
      // jumps when the first piece is chosen" (SL-02). A bar that grew on the
      // first tap would move the grid under the finger that just tapped it.
      className="border-t border-hairline bg-canvas"
      // `minHeight`, not `height`. The documented figures are the bar's
      // RESERVED height — what keeps three grid rows on screen and stops the
      // bar jumping when the first piece is picked (SL-02) — and at every size
      // the atlas drew, the content fits inside them, so nothing moves. A hard
      // `height` also made them a ceiling, which at AX5 cropped the status
      // line and the Compose ground off the bottom of their own bar. Text is
      // never given a fixed box; the bar grows past its reserve instead.
      style={{
        minHeight: ax ? SELECTION_BAR_HEIGHT_AX : SELECTION_BAR_HEIGHT,
        paddingTop: 12,
        // Only above the threshold, where the bar can now outgrow its reserve
        // and would otherwise set text on its own bottom edge. At default size
        // the reserve already leaves slack, so adding padding there would move
        // a bar the atlas pins at 88.
        paddingBottom: ax ? 12 : 0,
      }}>
      {/* SL-01 / AX drops the thumbnail strip entirely: "the count and the
          order statement carry the information the thumbnails carried." */}
      {!ax ? (
        <View className="flex-row" style={{ gap: 6, height: 36 }}>
          {/* Sized for the ceiling and never scrolls — `MAX_PIECES` thumbs at
              36 pt is what the bar is built to hold. */}
          {stack.slice(0, MAX_PIECES).map((g) => (
            <View
              key={g.id}
              className="overflow-hidden rounded-md bg-tray"
              style={{ width: 36, height: 36 }}>
              <GarmentCell garment={g} uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)} />
            </View>
          ))}
        </View>
      ) : null}

      {/* Above the threshold the sentence and the action stop sharing a row.
          A status line that can run to four lines at AX5 beside a 56 pt
          button squeezes the button to a sliver of its own row and sets the
          sentence in a two-word column; stacked, both keep their full width
          and the reading order is unchanged. */}
      <View className={ax ? 'mt-2' : 'mt-2 flex-row items-center'} style={{ gap: 12 }}>
        <View className={ax ? undefined : 'flex-1'}>
          <Text
            variant="label"
            accessibilityLiveRegion="polite"
            style={{ color: refused ? theme.critical : theme.muted }}>
            {statusLine}
          </Text>
          {stack.length > 1 && !refused ? (
            <Text variant="noteSmall">Drag to reorder</Text>
          ) : null}
        </View>

        {/*
          Correction 27 — "Compose becomes INERT PAPER with the requirement
          printed beside it rather than a dimmed oxblood button."

          Two different objects, not one object at two opacities: an ink fill
          at 40% still reads as a button somebody dimmed, which is what invites
          the repeated tap. Below the floor it is paper with a hairline; at or
          above it, the filled action.
        */}
        {showAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compose"
            accessibilityHint={canCompose ? undefined : pieceBoundsLine()}
            accessibilityState={{ disabled: !canCompose }}
            disabled={!canCompose}
            onPress={onCompose}
            style={{
              minHeight: ax ? 56 : 44,
              paddingHorizontal: 20,
              backgroundColor: canCompose ? theme.ink : theme.surface,
              borderWidth: canCompose ? 0 : 1,
              borderColor: theme.hairline,
            }}
            className="items-center justify-center rounded-md active:opacity-80">
            {/* Enabled and disabled differ by ground and label colour, never by
                weight — TY-01. */}
            <Text variant="body" style={{ color: canCompose ? theme.canvas : theme.muted }}>
              Compose
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PieceCell({
  garment,
  badge,
  ax = false,
  resolveImage,
  onPress,
}: {
  garment: Garment;
  badge: number | null;
  ax?: boolean;
  resolveImage: ResolveImage;
  onPress: () => void;
}) {
  const theme = useTheme();
  const selected = badge !== null;
  // "Selection numbers grow to 28 pt circles so they remain the second channel
  // at any type size" (SL-01 / AX). 22 otherwise.
  const disc = ax ? 28 : 22;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={garmentDisplayName(garment)}
      accessibilityState={{ selected }}
      accessibilityHint={
        selected
          ? `Piece ${badge} in the stack. Tap to remove.`
          : `Tap to add to the stack, ${MAX_PIECES} pieces at most.`
      }
      onPress={onPress}
      className="active:opacity-70">
      <View
        className="overflow-hidden rounded-md bg-tray"
        style={{
          aspectRatio: 1,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.ink : theme.hairline,
        }}>
        <GarmentCell garment={garment} uri={resolveImage(garment.platePath, garment.cutoutPath, garment.thumbPath)} />
        {/* Audit 97 — "selection carries an OUTLINE and a NUMBER, so it
            survives greyscale and states the order at the same time; no
            colour-only state anywhere in the group." The outline is the
            2 pt ink border above; this is the second channel. */}
        {selected ? (
          <View
            className="absolute right-1.5 top-1.5 items-center justify-center rounded-full"
            style={{ width: disc, height: disc, backgroundColor: theme.ink }}>
            <Text
              variant="label"
              style={{ color: theme.canvas, fontSize: ax ? 14 : 11, lineHeight: ax ? 17 : 13 }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {/* One line is a tidy default at a tidy type size. Above the threshold
          it is a truncation: "Charcoal wool trousers" at AX5 in a half-width
          column is "Charc…", and the caption is the only place the garment's
          name is printed. Two columns buy the width; letting the caption wrap
          buys the rest. Nothing here is height-capped, so a taller caption
          makes a taller cell rather than a cut one. */}
      <Text variant="caption" numberOfLines={ax ? undefined : 1} className="mt-1.5">
        {garmentDisplayName(garment)}
      </Text>
    </Pressable>
  );
}
