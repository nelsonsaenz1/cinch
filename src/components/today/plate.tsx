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
import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import type { Garment } from '@/lib/styling';
import { spring, useTheme } from '@/theme/tokens';

/** Order pieces the way a flat-lay reads: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/** Context the colophon prints. Everything optional; missing fields drop out. */
export type PlateColophon = {
  city?: string | null;
  feelsLikeC?: number | null;
};

/**
 * Two colophon rows: circumstances on the first, the look's own facts on the
 * second. One line truncates on any real outfit — a date, a city, four colour
 * names and a price do not fit 353 points at 10px.
 */
function colophonLines(items: Garment[], extra: PlateColophon): [string, string | null] {
  const where: string[] = [];
  const now = new Date();
  where.push(
    `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} ${now.getFullYear()}`,
  );
  if (extra.city) where.push(extra.city);
  if (extra.feelsLikeC != null) where.push(`Feels ${Math.round(extra.feelsLikeC)}°`);

  const what: string[] = [];
  // The palette, in the engine's own colour vocabulary — substantial pieces
  // only, so a belt does not claim a colour slot from the coat.
  const names = [
    ...new Set(
      items
        .filter((g) => g.visualWeight >= 0.1)
        .map((g) => g.colors[0]?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ].slice(0, 4);
  if (names.length > 1) what.push(names.join(' / '));

  const cpw = outfitCostPerWear(items);
  if (cpw != null) what.push(`$${cpw.toFixed(2)} / wear`);

  return [where.join(' · '), what.length ? what.join(' · ') : null];
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
 * A numbered plate from the day's edit — the app's signature component.
 *
 * The grammar, top to bottom: tracked eyebrow, the flat-lay on its tray, the
 * outfit's didone title, a structural rule, and a colophon printing the exact
 * data the engine reasoned about — date, city, feels-like, the palette in the
 * engine's own colour names, and what wearing the look costs per wear. The
 * colophon line is the product: no competitor computes it, so none can print it.
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

  const [legendWhere, legendWhat] = useMemo(
    () => colophonLines(pieces, colophon),
    [pieces, colophon],
  );

  return (
    <View className="mb-section px-gutter">
      {/* Long-press the plate → the 1080×1920 artifact. No share chrome on the
          page itself; a lookbook plate doesn't carry buttons. */}
      <Pressable
        onLongPress={handleShare}
        delayLongPress={350}
        accessibilityHint="Long press to share this plate as an image">
      {/* ── Eyebrow ── */}
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text variant="eyebrow">
          {`Plate 0${index + 1}`}
          {occasion ? ` — ${occasion}` : ''}
        </Text>
        {outfit.source === 'engine' ? (
          enhancing ? (
            <View className="flex-row items-center gap-1.5">
              <ActivityIndicator size="small" color={theme.muted} />
              <Text variant="colophon">Styling</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1">
              <SymbolView
                name="bolt.slash"
                size={10}
                tintColor={theme.muted}
                resizeMode="scaleAspectFit"
              />
              <Text variant="colophon">Offline</Text>
            </View>
          )
        ) : null}
      </View>

      {/* ── The flat-lay. Each garment flexed by how much of the look it
             occupies, so a coat anchors and a belt does not compete. ── */}
      <View
        className="flex-row gap-1.5 overflow-hidden rounded-plate bg-tray p-3 dark:bg-tray-dark"
        accessibilityLabel={`Outfit: ${a11y}`}
        style={{ height: 236 }}>
        {pieces.map((g, i) => (
          <View key={g.id} style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}>
            <Landing index={i} count={pieces.length} still={reduced} withHaptic={index === 0}>
              <GarmentCell garment={g} uri={resolveImage(g.cutoutPath, g.thumbPath)} />
            </Landing>
          </View>
        ))}
      </View>
      </Pressable>

      {/* ── Title, rule, colophon ── */}
      <View style={{ marginTop: 16 }}>
        <Text variant="plate" trim numberOfLines={1}>
          {outfit.name}
        </Text>
      </View>
      <View style={{ marginTop: 12 }}>
        <Rule />
      </View>
      <Text variant="colophon" style={{ marginTop: 8 }} numberOfLines={1}>
        {legendWhere}
      </Text>
      {legendWhat ? (
        <Text variant="colophon" style={{ marginTop: 3 }} numberOfLines={1}>
          {legendWhat}
        </Text>
      ) : null}

      <Text variant="callout" className="mt-2 text-muted dark:text-muted-dark">
        {outfit.reasoning}
      </Text>

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

      <View className="mt-3 flex-row items-center justify-between">
        <ReactionBar onReact={onReact} reacted={reacted} disabled={wearing} />
        <Button
          title={worn ? 'Worn today' : 'Wear it'}
          variant={worn ? 'ghost' : 'secondary'}
          onPress={onWear}
          loading={wearing}
          haptic
        />
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
