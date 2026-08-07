import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { Item } from '@/schemas/item';
import { spring, useTheme } from '@/theme/tokens';

/**
 * The A-03 header — item detail while the tagger is reading the photograph.
 *
 * Photo card left; right column is a small spinner beside the tracked
 * "Reading the photo" eyebrow, a serif title that fills from whatever tags are
 * already known, and the one-line promise that everything arriving is
 * editable. Below, the chip row: tags that exist render as the ordinary
 * outlined chip, tags still owed render as dashed placeholders — one carrying
 * a dimmed expected label when the row already holds a material to expect
 * (a re-read), one deliberately empty.
 *
 * In reality the tagger answers in a single response, so the grammar is:
 * dashed while in flight, and when the response lands the screen re-renders
 * into the settled layout. The solid chips here carry a `spring.smooth`
 * entrance so a tag that does land mid-flight resolves in place rather than
 * popping, and the placeholder row keeps the block's height so nothing jumps.
 */
export function TaggingHeader({ item, imageUri }: { item: Item; imageUri?: string }) {
  const theme = useTheme();

  // The progressive serif title — kind first, then colour, the order the
  // sentence is spoken: "Sweater, cream…". Built only from what the row
  // actually holds; before anything returns it is a bare ellipsis, which is
  // an honest neutral rather than a claim.
  const kind = item.subcategory ?? (item.category === 'other' ? null : item.category);
  const colour = item.colors[0]?.name ?? null;
  const parts = [kind, colour].filter((p): p is string => Boolean(p));
  const raw = parts.join(', ');
  const title = raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}…` : '…';

  // The chips that have arrived. Same derivation, chip-cased.
  const arrived = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  // The one placeholder a label can honestly be guessed for: a re-read still
  // holds the previous pass's material, and that is what is expected back.
  const expected = item.material
    ? item.material.charAt(0).toUpperCase() + item.material.slice(1)
    : null;

  const photoSource = stableImageSource(imageUri);

  return (
    <View className="mt-2">
      <View className="flex-row items-start gap-4">
        <View className="h-[156px] w-[120px] overflow-hidden rounded-md bg-tray dark:bg-tray-dark">
          {photoSource ? (
            <Image
              source={photoSource}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>

        <View className="flex-1 pt-1">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={theme.accent} />
            <Text variant="eyebrow">Reading the photo</Text>
          </View>
          <Text variant="title" className="mt-3.5" accessibilityLiveRegion="polite">
            {title}
          </Text>
          <Text variant="label" className="mt-2.5">
            Tags fill in as they come back. Every one of them is editable.
          </Text>
        </View>
      </View>

      <View className="mt-6 flex-row flex-wrap items-center gap-2">
        {arrived.map((label) => (
          // The gentle resolve: `spring.smooth`'s own numbers, threaded into
          // the entering builder, so a chip that lands springs into place with
          // the app's default motion rather than a bespoke one.
          <Animated.View
            key={label}
            entering={FadeIn.springify()
              .duration(spring.smooth.duration)
              .dampingRatio(spring.smooth.dampingRatio)}>
            <Chip label={label} />
          </Animated.View>
        ))}
        {expected ? <DashedChip label={expected} /> : null}
        <DashedChip />
      </View>
    </View>
  );
}

/**
 * The not-yet-arrived slot: a dashed hairline ring, dimmed label or a measured
 * emptiness. Deliberately not a `Chip` variant — this is a placeholder, not a
 * control, and it must never grow an onPress.
 */
function DashedChip({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-row items-center justify-center rounded-chip px-3.5"
      style={{
        minHeight: 32,
        minWidth: label ? undefined : 64,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.rule,
      }}>
      {label ? (
        <Text variant="label" style={{ color: theme.byline }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
