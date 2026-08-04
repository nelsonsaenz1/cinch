import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, View } from 'react-native';

import { ReactionBar, type ReactionValue } from '@/components/today/reaction-bar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/** Order pieces the way a flat-lay reads: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

export function OutfitCard({
  outfit,
  resolveImage,
  onWear,
  onReact,
  reacted,
  wearing,
  worn,
  enhancing,
}: {
  outfit: StyledOutfit;
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

  const pieces = [...outfit.candidate.items].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  const a11y = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');

  return (
    <View className="mb-8 px-gutter">
      {/* Flat-lay. Each garment is flexed by how much of the look it occupies,
          so a coat reads as the anchor and a belt does not compete with it. */}
      <View
        className="flex-row gap-1.5 overflow-hidden rounded-card bg-tray p-3 dark:bg-tray-dark"
        accessibilityLabel={`Outfit: ${a11y}`}
        style={{ height: 190 }}>
        {pieces.map((g) => {
          const uri = resolveImage(g.cutoutPath, g.thumbPath);
          return (
            <View
              key={g.id}
              style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}
              className="items-center justify-center">
              {uri ? (
                <Image
                  source={uri}
                  contentFit="contain"
                  transition={200}
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                // No cutout yet — background removal needs a native module that
                // cannot run in the Simulator at all, so this path is the norm
                // rather than the exception right now.
                //
                // Rendering the garment's real colour turns that from a row of
                // grey boxes into something that actually reads as an outfit,
                // and it is honest: the colour is the same value the palette
                // rules scored. Text flips to light on dark swatches using the
                // OKLCH lightness, which is exactly what a perceptual space is
                // for — the sRGB luma equivalent misjudges saturated blues.
                <View
                  className="h-full w-full items-center justify-center rounded-lg px-1"
                  style={{
                    backgroundColor: g.colors[0]
                      ? oklchToHex(g.colors[0].oklch)
                      : theme.tray,
                  }}>
                  <Text
                    variant="caption"
                    numberOfLines={2}
                    className="text-center"
                    style={{
                      color:
                        (g.colors[0]?.oklch.L ?? 1) < 0.55 ? '#FFFFFFCC' : '#141310AA',
                    }}>
                    {g.subcategory ?? g.category}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <Text variant="heading" className="flex-1" numberOfLines={1}>
          {outfit.name}
        </Text>
        {outfit.source === 'engine' ? (
          // Two very different situations, and conflating them would be a lie
          // in one direction or the other: the model is still writing, versus
          // the model could not be reached. The outfit itself is equally real
          // either way — only the words are the local scorer's.
          enhancing ? (
            <View className="flex-row items-center gap-1.5">
              <ActivityIndicator size="small" color={theme.muted} />
              <Text variant="caption">Styling…</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1 rounded-chip border border-hairline px-2 py-0.5 dark:border-hairline-dark">
              <SymbolView
                name="bolt.slash"
                size={10}
                tintColor={theme.muted}
                resizeMode="scaleAspectFit"
              />
              <Text variant="caption">Styling offline</Text>
            </View>
          )
        ) : null}
      </View>

      <Text variant="body" className="mt-1 text-muted dark:text-muted-dark">
        {outfit.reasoning}
      </Text>

      {outfit.swapNote ? (
        <View className="mt-3 flex-row gap-2 rounded-card border border-hairline p-3 dark:border-hairline-dark">
          <SymbolView
            name="arrow.triangle.2.circlepath"
            size={14}
            tintColor={theme.accent}
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
    </View>
  );
}
