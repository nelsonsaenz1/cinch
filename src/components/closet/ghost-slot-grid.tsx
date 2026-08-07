import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PRESSED_OPACITY, useTheme } from '@/theme/tokens';

/**
 * C-05 — the empty closet (Closet State Atlas).
 *
 * The ghosted grid shows the shape the screen wants to take rather than a
 * blank field: four dashed cells in the real grid's geometry, a canvas
 * gradient pooling over them, and the invitation — serif line, one sentence,
 * one ink button — centred in the pool.
 *
 * The previous version of this file ghosted licensed garment photographs
 * through the cells. The atlas supersedes that: cells are plain near-canvas
 * fills with dashed borders, and the atlas wins.
 *
 * Composition contract: this component renders the GRID BLOCK ONLY (cells +
 * gradient + centred copy + button). The screen composes the rest of C-05
 * itself — eyebrow header, then the identity row using {@link GhostAvatar}
 * exported below next to the real name and the `0 pieces · nothing computed
 * yet` sub-line — because the name comes from `useClosetIdentity`, which is
 * the screen's business, not this component's.
 *
 * The button is ink, not oxblood — the atlas draws it `#1C1A16` on `#FBFAF6`,
 * so it is deliberately NOT `ui/button.tsx`'s accent primary; a local
 * pressable keeps the atlas's ground without teaching Button a fourth variant.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Atlas cell height — pt-for-px at 393pt width, used literally. */
const CELL_HEIGHT = 170;

/**
 * The dashed empty avatar circle for C-05's identity row — 66pt, `tray` fill,
 * dashed border. Exported for the screen to place beside the real name; kept
 * here so both dashed-ghost treatments (avatar and cells) live in one file.
 */
export function GhostAvatar({ size = 66 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-tray dark:bg-tray-dark"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.rule,
      }}
    />
  );
}

/** One dashed ghost cell — near-canvas fill (tray thinned over canvas). */
function GhostCell() {
  const theme = useTheme();
  return (
    <View
      className="rounded-md"
      style={{
        height: CELL_HEIGHT,
        backgroundColor: withAlpha(theme.tray, 0.6),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.rule,
      }}
    />
  );
}

export type GhostSlotGridProps = {
  /** Routes to the capture flow — the existing add-pieces destination. */
  onAddPieces: () => void;
};

export function GhostSlotGrid({ onAddPieces }: GhostSlotGridProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });

  return (
    <View className="px-gutter">
      <View
        onLayout={(e) =>
          setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }>
        {/* The four ghost cells — two rows of the real grid's geometry
            (14pt row gap / 12pt column gap, 12pt radius). Decorative: hidden
            from VoiceOver and from touch entirely. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ gap: 14 }}>
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1">
              <GhostCell />
            </View>
            <View className="flex-1">
              <GhostCell />
            </View>
          </View>
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1">
              <GhostCell />
            </View>
            <View className="flex-1">
              <GhostCell />
            </View>
          </View>
        </View>

        {/* Canvas gradient pooling over the cells so the copy sits on what
            reads as paper, not on top of furniture. Skia, same reasoning as
            sign-in's HeroScrim: it is already in the bundle, and
            expo-linear-gradient would be a dependency for one rectangle.
            Stops transcribed from the atlas overlay. */}
        {size.h > 0 ? (
          <Canvas
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h }}>
            <Rect x={0} y={0} width={size.w} height={size.h}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, size.h)}
                colors={[
                  withAlpha(theme.canvas, 0.15),
                  withAlpha(theme.canvas, 0.86),
                  withAlpha(theme.canvas, 0.94),
                  withAlpha(theme.canvas, 0.86),
                ]}
                positions={[0, 0.34, 0.7, 1]}
              />
            </Rect>
          </Canvas>
        ) : null}

        {/* The invitation, centred in the pool. */}
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ paddingBottom: 24 }}>
          <Text variant="title" className="text-center">
            Add your closet
          </Text>
          <Text
            variant="callout"
            className="mt-3 text-center text-muted dark:text-muted-dark"
            style={{ maxWidth: 270 }}>
            Photograph what you own and Cinch starts counting wears, colours and cost-per-wear
            from day one.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add pieces"
            onPress={onAddPieces}
            className="mt-6 items-center justify-center rounded-md px-6"
            style={({ pressed }) => ({
              height: 44,
              backgroundColor: theme.ink,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            {/* Inline colour, never a second `text-*` class — the Button
                precedence lesson (ui/button.tsx `labelKey`) applies here too. */}
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              Add pieces
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
