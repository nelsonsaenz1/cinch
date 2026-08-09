import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { canvasAlpha, useTheme } from '@/theme/tokens';

/**
 * C-05 — the empty closet (Closet State Atlas, 2026-08-08 cut).
 *
 * This supersedes the dashed ghost-slot grid the screen shipped with before:
 * the atlas no longer shows the SHAPE of a closet, it shows one — four real,
 * full-colour garment photographs at the grid's own 196pt card size, carrying
 * the wear count, cost-per-wear and look-count chips a piece earns once it has
 * history. The payoff renders before any work is done, on the same argument
 * the free tier already makes: show the product working, then ask for the
 * six photographs it takes to make it true.
 *
 * It is labelled "An example closet" once, truthfully, in the pill above the
 * copy — an unlabelled grid of clothes would read as someone else's wardrobe
 * already sitting in this account, which is the one confusion this screen
 * cannot afford (the same reasoning `ui/ghosted-rail.tsx` documents at
 * length for its own, fully-ghosted band). The whole tile — photos, chips,
 * the pill — is one decorative image to VoiceOver: nothing here is real data
 * a person could act on, so nothing here is individually focusable.
 *
 * Composition contract: this component renders the FULL C-05 tile — grid,
 * scrim, pill, copy, the "Add your first piece" button and the six-pip
 * progress row. The screen only supplies the eyebrow header above it and the
 * `onAddPieces` handler; "0 of 6" needs no prop because this component only
 * ever mounts when the closet is empty, i.e. when it is always true.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Atlas cell height — the same 196pt the real grid's `ItemCard` uses. */
const CELL_HEIGHT = 196;

/** How many photographs the invitation asks for, transcribed from the atlas. */
const PIECES_ASKED = 6;

type ExampleCell = {
  key: string;
  source: number;
  /** What the bottom-left chip says — the earned stat a real piece would show. */
  chip: string | null;
};

/**
 * Four of the licensed photographs in `assets/garments/` (that folder's
 * MANIFEST.md — sourced for exactly this purpose), the same set
 * `today/sample-plate.tsx` draws its sample plate from. Chips are sample
 * values transcribed from the atlas card, the same convention as that
 * component's `SAMPLE_COST` — not a computation, because there is no real
 * item behind any of these four photographs.
 */
const CELLS: ExampleCell[] = [
  { key: 'coat', source: require('@/assets/garments/cognac-shearling-coat.jpg'), chip: 'worn 9×' },
  { key: 'sweater', source: require('@/assets/garments/cream-mohair-sweater.jpg'), chip: '$4.20 / wear' },
  { key: 'trousers', source: require('@/assets/garments/charcoal-tailored-trousers.jpg'), chip: 'in 4 looks' },
  { key: 'loafers', source: require('@/assets/garments/brown-leather-loafers.jpg'), chip: null },
];

/** One 2×2 grid cell — a full-bleed photograph and its optional stat chip. */
function ExampleCellView({ cell }: { cell: ExampleCell }) {
  const theme = useTheme();
  return (
    <View
      className="flex-1 overflow-hidden rounded-[14px] bg-tray dark:bg-tray-dark"
      style={{ height: CELL_HEIGHT }}>
      <Image
        source={cell.source}
        contentFit="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
        style={{ width: '100%', height: '100%' }}
      />
      {cell.chip ? (
        <View
          className="absolute rounded-[8px]"
          style={{
            left: 10,
            bottom: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: canvasAlpha(0.92),
          }}>
          <Text variant="label" style={{ fontSize: 11, lineHeight: 14, color: theme.ink }}>
            {cell.chip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type ExampleClosetProps = {
  /** Routes to the capture flow — the existing add-pieces destination. */
  onAddPieces: () => void;
};

export function ExampleCloset({ onAddPieces }: ExampleClosetProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  /**
   * How tall the invitation actually is, measured rather than guessed.
   *
   * The invitation is pinned to the bottom of this tile and the tile's height
   * comes from the photo grid, so without room reserved for it the copy lands
   * on top of the second row of photographs — which is exactly what happened
   * once the button started rendering and got its 52pt back. Reserving a fixed
   * number would break the moment the body copy wrapped to a different number
   * of lines on a narrower phone, so the block reports its own height and the
   * grid pads by it.
   */
  const [invitationHeight, setInvitationHeight] = useState(0);

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'relative', overflow: 'hidden' }}>
      {/* The four photographs — one grouped, decorative image to VoiceOver.
          Individually inaccessible and untappable: nothing here is a garment
          this account owns, so nothing here should announce or open like one. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Sample closet: a cognac shearling coat worn 9 times, a cream mohair sweater at $4.20 a wear, charcoal tailored trousers in 4 looks, and brown leather loafers. Sample data."
        pointerEvents="none"
        className="px-gutter"
        style={{ gap: 12, paddingBottom: invitationHeight }}>
        <View className="flex-row" style={{ gap: 12 }}>
          <ExampleCellView cell={CELLS[0]} />
          <ExampleCellView cell={CELLS[1]} />
        </View>
        <View className="flex-row" style={{ gap: 12 }}>
          <ExampleCellView cell={CELLS[2]} />
          <ExampleCellView cell={CELLS[3]} />
        </View>
      </View>

      {/* The fade the copy sits on — transparent at the top so the first row
          reads as full photography, solid canvas by 82% so the invitation
          below never fights a photo for contrast. Skia, same reasoning as the
          rest of this screen's canvas fades: already in the bundle, and
          expo-linear-gradient would be a dependency for one rectangle. */}
      {size.h > 0 ? (
        <Canvas
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h }}>
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, size.h)}
              colors={[canvasAlpha(0), canvasAlpha(0.1), canvasAlpha(0.8), theme.canvas]}
              positions={[0, 0.3, 0.62, 0.82]}
            />
          </Rect>
        </Canvas>
      ) : null}

      {/* The invitation, pinned to the bottom of the fade. */}
      <View
        onLayout={(e) => setInvitationHeight(e.nativeEvent.layout.height)}
        className="absolute inset-x-0 bottom-0 items-center px-gutter"
        style={{ paddingBottom: 22 }}>
        <View
          className="flex-row items-center rounded-full bg-blush dark:bg-blush-dark"
          style={{ gap: 7, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: theme.blushRule }}>
          <Text
            variant="colophon"
            style={{ fontSize: 10, lineHeight: 13, letterSpacing: 1.2, color: theme.accent }}>
            An example closet
          </Text>
        </View>

        <Text variant="body" className="mt-3.5 text-center" style={{ maxWidth: 300 }}>
          Photograph six pieces and yours looks like this — wears, cost-per-wear and outfits
          counted from the first one.
        </Text>

        {/*
          The shared Button, not a hand-rolled Pressable.

          This was a `Pressable` carrying both a `className` and a FUNCTION
          `style`, and it did not render at all on device — no ground, no
          label, not tappable, just the gap where it should have been. That
          combination is the same NativeWind interop hole the theme documents
          for `Animated.*`: the class list and a computed style cannot both win,
          and what survives is neither. It typechecked, it linted, and it passed
          every test, because none of those run a layout pass.

          `variant="ink"` is the atlas's black fill and deliberately does not
          spend the accent, which this screen has already spent on the pill.
        */}
        <Button
          title="Add your first piece"
          variant="ink"
          onPress={onAddPieces}
          className="mt-[18px] w-full"
        />

        <View className="mt-3 flex-row items-center justify-center" style={{ gap: 8 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row"
            style={{ gap: 4 }}>
            {Array.from({ length: PIECES_ASKED }, (_, i) => (
              <View
                key={i}
                className="rounded-full"
                style={{ width: 6, height: 6, backgroundColor: withAlpha(theme.ink, 0.2) }}
              />
            ))}
          </View>
          {/* `muted`, not the atlas's literal `faint` — free-tier-contract.md
              §4's first standing refusal: faint is ~3.5:1 on canvas and fails
              AA for anything read as body copy, decorative dots aside. */}
          <Text variant="label" style={{ fontSize: 12, lineHeight: 15, color: theme.muted }}>
            {`0 of ${PIECES_ASKED} · about two minutes`}
          </Text>
        </View>
      </View>
    </View>
  );
}
