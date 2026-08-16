import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C03_ACCESSORIES } from '@/components/closet/w3-g3-fixture-data';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { searchSummary } from '@/features/closet/search-summary';
import { GUTTER } from '@/theme/tokens';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * C-03 — the filter rail scrolled to its end. AUDIT 61'S PROOF FRAME.
 *
 * "The same rail at its opposite end, drawn so a reviewer can confirm audit 61
 * without a device: the last chip is whole, it clears the frame edge by 20 pt,
 * and the partial chip is now at the left where the row continues backwards.
 * Nothing about the row's appearance changes between ends — there is no fade, no
 * arrow and no gradient mask, because a rail that is padded honestly does not
 * need one."
 *
 * WHAT THE FRAME IS EVIDENCE FOR, AND HOW THIS ROUTE PRODUCES IT
 *
 * The 20pt trailing inset is `contentContainerStyle.paddingHorizontal: GUTTER`,
 * and GUTTER is 20. A horizontal ScrollView applies content padding at BOTH ends
 * of its scrollable content, so the one value gives C-01's lead inset and this
 * frame's trailing inset — there is no second measure to keep in step.
 *
 * The route scrolls the rail to its end on mount, without animation, so the
 * captured viewport is the settled far end rather than a frame mid-travel.
 * `scrollToEnd({ animated: false })` is the whole of the determinism argument
 * here: an animated scroll would be captured at whatever point it had reached.
 */
export default function DevW3G3C03() {
  const rail = useRef<ScrollView>(null);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // The far end of the rail, in the frame's order. The three that fit are the
  // last three; the ones before them are what the partial at the left edge is
  // the tail of.
  const chips: { label: string; count: number; held: boolean }[] = [
    { label: 'Tops', count: 41, held: false },
    { label: 'Bottoms', count: 26, held: false },
    { label: 'Outerwear', count: 12, held: false },
    { label: 'Dresses', count: 12, held: false },
    { label: 'Shoes', count: 19, held: false },
    { label: 'Accessories', count: 8, held: true },
  ];

  const summary = searchSummary({ count: 8, category: 'Accessories', query: '' });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow" accessibilityRole="header">
          Your closet
        </Text>
        <Text variant="note" className="mt-1">
          148 pieces · 41 worn this year
        </Text>
      </View>

      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        // NO fade, NO arrow, NO gradient mask, and no `contentInset` trick.
        // Every one of them exists to apologise for a rail that ends flush.
        onContentSizeChange={() => rail.current?.scrollToEnd({ animated: false })}
        style={{ flexGrow: 0, marginTop: 8 }}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: GUTTER,
          paddingVertical: 6,
          minHeight: 44,
          alignItems: 'center',
        }}>
        {chips.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            count={c.count}
            selected={c.held}
            selectedGround="ink"
            onPress={() => {}}
          />
        ))}
      </ScrollView>

      {summary ? (
        <View className="px-gutter pb-1 pt-1">
          <Text variant="note">{summary}</Text>
        </View>
      ) : null}

      <View className="flex-1">
        <ClosetGrid items={C03_ACCESSORIES} resolveImage={resolve} />
      </View>
    </SafeAreaView>
  );
}
