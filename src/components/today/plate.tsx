import {
  Canvas,
  Group,
  Image as SkiaImage,
  Shadow,
  useImage,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { PlateCard } from '@/components/share/plate-card';
import { outfitCostPerWear } from '@/components/today/cost-per-wear';
import {
  GarmentCell,
  STACK_ASPECT,
  platePathOf,
  stackLayout,
  stackRegime,
  type StackedPiece,
} from '@/components/today/garment-cell';
import { ReactionBar, type ReactionValue } from '@/components/today/reaction-bar';
import { Text } from '@/components/ui/text';
import { formatTemp } from '@/features/context/weather';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/** Order pieces the way a look is read aloud: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/** Context the colophon prints. Everything optional; missing fields drop out. */
export type PlateColophon = {
  city?: string | null;
  feelsLikeC?: number | null;
};

/** The tiny label the design prints under the stack for each garment. */
const labelFor = (g: Garment) => g.subcategory ?? g.category;

/** Concentric with the tile's own corner: soft enough to be a photograph, not a chip. */
const TILE_RADIUS = 10;

/**
 * The warm contact shadow, one definition for both regimes.
 *
 * On a plate it is derived from the cutout's ALPHA by Skia, so a coat casts a
 * coat-shaped shadow and the piece sits on the paper instead of floating. On a
 * tile iOS derives it from the rounded rect. Same offset and softness either
 * way, so switching regimes does not change the light.
 */
const CONTACT = { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' } as const;

/** The stagger, in ms — piece n lands 60ms after piece n-1. */
const landingDelay = (index: number) => 120 + index * 60;

/**
 * The look's palette, as the swatch dots the footer prints — the real garment
 * colours the engine actually scored, deduplicated and limited to the pieces
 * that carry the outfit (a belt does not claim a colour slot from the coat).
 */
function paletteDots(pieces: Garment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of pieces) {
    if (g.visualWeight < 0.1) continue;
    const c = g.colors[0];
    if (!c) continue;
    const hex = oklchToHex(c.oklch);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 5) break;
  }
  return out;
}

/** One garment landing into the stack. */
function Landing({
  index,
  count,
  still,
  style,
  children,
}: {
  index: number;
  count: number;
  still: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    const last = index === count - 1;
    progress.value = withDelay(
      landingDelay(index),
      // The final garment landing is the app's one bouncy moment.
      withSpring(1, last ? spring.bouncy : spring.smooth),
    );
  }, [count, index, progress, still]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * One plated garment inside the stack's canvas.
 *
 * The entrance is driven by shared values read straight by Skia, so the landing
 * runs on the UI thread exactly as the tile regime's Reanimated wrapper does —
 * no bridge hop per frame, and the two regimes are the same motion.
 */
function PlateLayer({
  piece,
  uri,
  index,
  count,
  still,
}: {
  piece: StackedPiece;
  uri?: string;
  index: number;
  count: number;
  still: boolean;
}) {
  const image = useImage(uri);
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    const last = index === count - 1;
    progress.value = withDelay(
      landingDelay(index),
      withSpring(1, last ? spring.bouncy : spring.smooth),
    );
  }, [count, index, progress, still]);

  const opacity = useDerivedValue(() => Math.min(progress.value * 1.6, 1));
  const transform = useDerivedValue(() => [
    { translateY: (1 - progress.value) * 18 },
    { scale: 0.96 + progress.value * 0.04 },
  ]);
  const origin = { x: piece.x + piece.size / 2, y: piece.y + piece.size / 2 };

  return (
    <Group opacity={opacity} transform={transform} origin={origin}>
      {/* `contain` on a square image in a square box is a no-op scale — which
          is the point: the pipeline already normalized these against each
          other, and fit must not second-guess it. */}
      <SkiaImage
        image={image}
        x={piece.x}
        y={piece.y}
        width={piece.size}
        height={piece.size}
        fit="contain">
        <Shadow dx={CONTACT.dx} dy={CONTACT.dy} blur={CONTACT.blur} color={CONTACT.color} />
      </SkiaImage>
    </Group>
  );
}

/**
 * The stack — the outfit as a dressed figure rather than a row of parts.
 *
 * The box's height comes from `aspectRatio`, so the card reserves its space on
 * the first pass and nothing jumps when the width is measured; the measurement
 * only decides where inside that box each garment goes.
 */
function GarmentStack({
  pieces,
  resolveImage,
  still,
  withHaptic,
  label,
}: {
  pieces: Garment[];
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  still: boolean;
  /** Only the day's first card earns the landing haptic. */
  withHaptic: boolean;
  label: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const regime = useMemo(() => stackRegime(pieces, resolveImage), [pieces, resolveImage]);
  const layout = useMemo(
    () => (width > 0 ? stackLayout(pieces, width, regime) : []),
    [pieces, regime, width],
  );

  useEffect(() => {
    if (still || !withHaptic || pieces.length === 0) return;
    // Fired for the LAST piece to land, mid-spring — the moment the look reads
    // as assembled. Lives here rather than in the layer so the plate regime,
    // where every layer is a Skia node and not a React Native view, still gets it.
    const t = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    }, landingDelay(pieces.length - 1) + 200);
    return () => clearTimeout(t);
  }, [pieces.length, still, withHaptic]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: 1 / STACK_ASPECT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      {regime === 'plate' ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {layout.map((piece, i) => (
            <PlateLayer
              key={piece.garment.id}
              piece={piece}
              uri={resolveImage(platePathOf(piece.garment))}
              index={i}
              count={layout.length}
              still={still}
            />
          ))}
        </Canvas>
      ) : (
        layout.map((piece, i) => (
          <Landing
            key={piece.garment.id}
            index={i}
            count={layout.length}
            still={still}
            style={{
              position: 'absolute',
              left: piece.x,
              top: piece.y,
              width: piece.size,
              height: piece.size,
              // Shadow and clip cannot share a view on iOS — a rounded rect that
              // clips its children also clips its own shadow away — so the
              // shadow is out here and the corner is on the layer below.
              shadowColor: '#1C1A16',
              shadowOpacity: 0.16,
              shadowRadius: CONTACT.blur,
              shadowOffset: { width: CONTACT.dx, height: CONTACT.dy },
            }}>
            <View
              className="h-full w-full overflow-hidden border border-hairline dark:border-hairline-dark"
              style={{ borderRadius: TILE_RADIUS, backgroundColor: theme.tray }}>
              <GarmentCell
                garment={piece.garment}
                uri={resolveImage(piece.garment.cutoutPath, piece.garment.thumbPath)}
              />
            </View>
          </Landing>
        ))
      )}
    </View>
  );
}

/**
 * The "I wore this" action. Not a `Button`: the design's worn state is an ink
 * FILL, and the shared button has no ink variant — so this is a small inline
 * pill in the same grammar as the reaction pills beside it. Light label colour
 * is set inline (a `text-*` class does not reliably win over the variant's).
 */
function WearButton({
  worn,
  wearing,
  onPress,
}: {
  worn: boolean;
  wearing: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={worn ? 'Worn today' : 'Mark as worn today'}
      accessibilityState={{ selected: worn, disabled: wearing, busy: wearing }}
      disabled={wearing}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{ minHeight: MIN_TAP_TARGET - 4 }}
      className={[
        'flex-none items-center justify-center rounded-md px-4 active:opacity-70',
        worn ? 'bg-ink' : 'border border-rule',
        wearing ? 'opacity-40' : '',
      ].join(' ')}>
      {wearing ? (
        <ActivityIndicator size="small" color={theme.muted} />
      ) : (
        <Text
          variant="label"
          className="font-medium"
          style={{ color: worn ? theme.canvas : theme.ink }}
          numberOfLines={1}>
          {worn ? 'Worn today' : 'I wore this'}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * A plate from the day's edit — the app's signature component, set as the
 * design's white outfit card.
 *
 * The card, top to bottom: the outfit's serif name with the feels-like it
 * was chosen against as a colophon; the model's reasoning; the stack, the look
 * composed body-ordered with the pieces named beneath it in one credit line;
 * then a footer printing the palette in the engine's own colours and the
 * look's cost per wear — a number Whering and Indyx print too now, so it isn't
 * what makes this footer Cinch's; the friends who voted this look into
 * existence, from a closet they can see is real, are — and the love / not-for-me
 * / worn actions.
 */
export function Plate({
  outfit,
  index,
  occasion,
  colophon,
  resolveImage,
  onWear,
  onReact,
  reacted,
  wearing,
  worn,
  enhancing,
  offline = false,
}: {
  outfit: StyledOutfit;
  /** Position in the day's set — only the first card gets the landing haptic. */
  index: number;
  /** What the look is for — the user's note or the day's first event. */
  occasion?: string | null;
  colophon: PlateColophon;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onWear: () => void;
  onReact: (value: ReactionValue) => void;
  reacted?: ReactionValue | null;
  wearing?: boolean;
  worn?: boolean;
  /** The model is still working. Distinct from having given up on it. */
  enhancing?: boolean;
  /**
   * The offline cut of the card: name, stack, and a footer saying the look
   * came off disk, with its cost per wear. Everything the network paid for —
   * the model's reasoning, the feels-like it was scored against — and every
   * action that needs the network — love, not-for-me, worn — is dropped rather
   * than shown dead. Default false: every online caller is unchanged.
   */
  offline?: boolean;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  // The share flow: long-press mounts the 360×640 card off-screen, the card
  // reports ready, view-shot captures it, the system sheet opens. The card
  // unmounts when the sheet closes — it never stays resident.
  const [shareMounted, setShareMounted] = useState(false);
  const shareView = useRef<View>(null);

  const handleShare = useCallback(() => {
    if (shareMounted) return;
    // Rigid is the "snap" of the haptics vocabulary — the shutter.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    setShareMounted(true);
  }, [shareMounted]);

  const handleCardReady = useCallback(() => {
    void sharePlate(shareView)
      .catch((err) => {
        // The user felt the shutter haptic; going silent after it reads as a
        // dead button. The error notification haptic is the honest answer —
        // there is no toast layer to say more.
        console.warn('[share] capture failed', err);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      })
      .finally(() => setShareMounted(false));
  }, []);

  const pieces = useMemo(
    () =>
      [...outfit.candidate.items].sort(
        (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
      ),
    [outfit.candidate.items],
  );

  const a11y = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');

  const dots = useMemo(() => paletteDots(pieces), [pieces]);
  const cpw = useMemo(() => outfitCostPerWear(pieces), [pieces]);
  // The feels-like the look was chosen against, printed top-right like a
  // colophon. Dropped entirely when weather is unavailable rather than faked.
  const temp = colophon.feelsLikeC != null ? formatTemp(colophon.feelsLikeC, 'F') : null;

  return (
    <View className="mb-section px-gutter">
      <View className="rounded-plate border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
        {/* Long-press the visual → the 1080×1920 artifact. The share target is
            the card's editorial half only; the action pills below stay tappable
            and the card carries no share chrome of its own. */}
        <Pressable
          onLongPress={handleShare}
          delayLongPress={350}
          accessibilityHint="Long press to share this plate as an image">
          {/* ── Header: the outfit's name, and what it was dressed for ── */}
          <View className="flex-row items-baseline justify-between gap-3">
            <Text variant="plate" numberOfLines={1} className="flex-1">
              {outfit.name}
            </Text>
            {offline ? null : outfit.source === 'engine' && enhancing ? (
              <View className="flex-row items-center gap-1.5">
                <ActivityIndicator size="small" color={theme.muted} />
                <Text variant="colophon">Styling</Text>
              </View>
            ) : temp ? (
              <Text variant="colophon">Feels {temp}</Text>
            ) : null}
          </View>

          {!offline && outfit.reasoning ? (
            <Text variant="callout" className="mt-2 text-muted dark:text-muted-dark">
              {outfit.reasoning}
            </Text>
          ) : null}

          {/* ── The stack: the look composed body-ordered, the same geometry the
                 share poster prints. ── */}
          <View className="mt-4">
            <GarmentStack
              pieces={pieces}
              resolveImage={resolveImage}
              still={reduced}
              withHaptic={index === 0}
              label={`Outfit: ${a11y}`}
            />
          </View>

          {/* ── The credit line. The row of per-cell captions the flat-lay used
                 to carry has nowhere to sit under overlapping pieces, so the
                 engine's own name for each garment is set once, in order, the
                 way a lookbook credits a shot. ── */}
          <Text variant="caption" numberOfLines={2} className="mt-3">
            {pieces.map(labelFor).join('  ·  ')}
          </Text>
        </Pressable>

        {!offline && outfit.swapNote ? (
          <View className="mt-3 flex-row gap-2 rounded-md border border-hairline p-3 dark:border-hairline-dark">
            <SymbolView
              name="arrow.triangle.2.circlepath"
              size={14}
              tintColor={theme.muted}
              resizeMode="scaleAspectFit"
            />
            <Text variant="label" className="flex-1 text-ink dark:text-ink-dark">
              {outfit.swapNote}
            </Text>
          </View>
        ) : null}

        {offline ? (
          /* ── Offline footer: where the look came from, and what it costs to
                wear. No palette row — the swatches are a styling argument, and
                offline the card is a record, not an argument. ── */
          <View className="mt-4 flex-row items-center justify-between border-t border-rule pt-3 dark:border-rule-dark">
            <Text variant="callout" className="text-muted dark:text-muted-dark">
              Saved for offline
            </Text>
            {cpw != null ? (
              <Text variant="stat" accessibilityLabel={`$${cpw.toFixed(2)} per wear`}>
                ${cpw.toFixed(2)}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            {/* ── Footer: the palette in the engine's own colours, and what
                   wearing the look costs per wear. Other closet apps track
                   that number too now — what they don't have is a look their
                   friends actually voted on, from a closet those friends can
                   see is real. ── */}
            <View className="mt-4 flex-row items-center justify-between border-t border-rule pt-3 dark:border-rule-dark">
              <View className="flex-1 flex-row items-center gap-2">
                <Text variant="eyebrow">Palette</Text>
                <View className="flex-row items-center gap-1.5">
                  {dots.map((hex, i) => (
                    <View
                      key={`${hex}-${i}`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: hex,
                        borderWidth: 1,
                        borderColor: theme.rule,
                      }}
                    />
                  ))}
                </View>
              </View>
              {cpw != null ? (
                <View className="flex-row items-baseline gap-1">
                  <Text variant="stat">${cpw.toFixed(2)}</Text>
                  <Text variant="colophon">/ wear</Text>
                </View>
              ) : null}
            </View>

            {/* ── The three actions, as the design sets them: love, pass, worn. ── */}
            <View className="mt-3.5 flex-row items-start gap-2">
              <ReactionBar onReact={onReact} reacted={reacted} disabled={wearing} />
              <WearButton worn={Boolean(worn)} wearing={Boolean(wearing)} onPress={onWear} />
            </View>
          </>
        )}
      </View>

      {shareMounted ? (
        // Mounted far off-screen, never visible. `collapsable={false}` keeps
        // the view in the native hierarchy so view-shot has a layer to render.
        <View
          ref={shareView}
          collapsable={false}
          style={{ position: 'absolute', left: -9999, top: 0, width: CARD_W, height: CARD_H }}>
          <PlateCard
            outfit={outfit}
            occasion={occasion}
            colophon={colophon}
            resolveImage={resolveImage}
            onReady={handleCardReady}
          />
        </View>
      ) : null}
    </View>
  );
}
