import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { PlateCard } from '@/components/share/plate-card';
import { outfitCostPerWear } from '@/components/today/cost-per-wear';
import { GarmentCell } from '@/components/today/garment-cell';
import { ReactionBar, type ReactionValue } from '@/components/today/reaction-bar';
import { Text } from '@/components/ui/text';
import { formatTemp } from '@/features/context/weather';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/** Order pieces the way a flat-lay reads: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/** Context the colophon prints. Everything optional; missing fields drop out. */
export type PlateColophon = {
  city?: string | null;
  feelsLikeC?: number | null;
};

/** The tiny label the design prints under each garment in the flat-lay. */
const labelFor = (g: Garment) => g.subcategory ?? g.category;

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

/** One garment landing into the flat-lay. */
function Landing({
  index,
  count,
  still,
  withHaptic,
  children,
}: {
  index: number;
  count: number;
  still: boolean;
  withHaptic: boolean;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    const last = index === count - 1;
    progress.value = withDelay(
      120 + index * 60,
      // The final garment landing is the app's one bouncy moment.
      withSpring(1, last ? spring.bouncy : spring.smooth),
    );
    if (last && withHaptic) {
      const t = setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }, 120 + index * 60 + 200);
      return () => clearTimeout(t);
    }
  }, [count, index, progress, still, withHaptic]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
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
 * The grammar, top to bottom: the outfit's didone name with the feels-like it
 * was chosen against as a colophon; the model's reasoning; the flat-lay, each
 * garment flexed by how much of the look it occupies and labelled beneath; then
 * a footer printing the palette in the engine's own colours and the look's cost
 * per wear — the number no competitor computes, so none can print it — and the
 * love / not-for-me / worn actions.
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
}: {
  outfit: StyledOutfit;
  /** Position in today's edit, for the plate number. */
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
            and a lookbook plate carries no share chrome of its own. */}
        <Pressable
          onLongPress={handleShare}
          delayLongPress={350}
          accessibilityHint="Long press to share this plate as an image">
          {/* ── Header: the outfit's name, and what it was dressed for ── */}
          <View className="flex-row items-baseline justify-between gap-3">
            <Text variant="plate" numberOfLines={1} className="flex-1">
              {outfit.name}
            </Text>
            {outfit.source === 'engine' && enhancing ? (
              <View className="flex-row items-center gap-1.5">
                <ActivityIndicator size="small" color={theme.muted} />
                <Text variant="colophon">Styling</Text>
              </View>
            ) : temp ? (
              <Text variant="colophon">Feels {temp}</Text>
            ) : null}
          </View>

          {outfit.reasoning ? (
            <Text variant="callout" className="mt-2 text-muted dark:text-muted-dark">
              {outfit.reasoning}
            </Text>
          ) : null}

          {/* ── The flat-lay. Each garment flexed by how much of the look it
                 occupies, so a coat anchors and a belt does not compete, with
                 the engine's own name for the piece printed beneath. ── */}
          <View
            className="mt-4 flex-row gap-1.5"
            accessibilityLabel={`Outfit: ${a11y}`}>
            {pieces.map((g, i) => (
              <View key={g.id} style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}>
                <Landing index={i} count={pieces.length} still={reduced} withHaptic={index === 0}>
                  <View
                    className="overflow-hidden rounded border border-hairline dark:border-hairline-dark"
                    style={{ height: 132 }}>
                    <GarmentCell garment={g} uri={resolveImage(g.cutoutPath, g.thumbPath)} />
                  </View>
                </Landing>
                <Text
                  variant="caption"
                  numberOfLines={1}
                  className="mt-1.5 text-center">
                  {labelFor(g)}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>

        {outfit.swapNote ? (
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

        {/* ── Footer: the palette in the engine's own colours, and the number
               no competitor tracks — what wearing the look costs per wear. ── */}
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
