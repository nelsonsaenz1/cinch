import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C02_MATCHES } from '@/components/closet/w3-g3-fixture-data';
import { Chip } from '@/components/ui/chip';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { searchSummary } from '@/features/closet/search-summary';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * C-02 — search open, query and chip composing.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Opening search replaces the title block rather than pushing it down, so the
 *   grid does not jump — the field occupies the masthead's own 44 pt row."
 * · "Chip counts are recomputed over the matched set, which is why All reads 7
 *   here and 148 in C-01" — the counts below are the frame's, and the shipping
 *   screen derives the same numbers from `categoryCounts(items, q)`.
 * · "the held chip and the typed query compose rather than override, and the
 *   sentence above the grid states the composition in words" — the sentence is
 *   `searchSummary`, the same derivation the screen calls.
 * · Cancel is MUTED, not the accent: the frame draws it in its secondary colour,
 *   and this screen's oxblood is not spent on the way out of a mode.
 *
 * DETERMINISM: the query is a literal, the counts are literals, the field is NOT
 * autofocused (a keyboard rising mid-capture is a different frame every time),
 * and nothing here reads a clock, a random source or a network.
 */
export default function DevW3G3C02() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // The frame's own numbers. All 7 over the matched set, Tops 4 held.
  const counts: { label: string; count: number; held: boolean }[] = [
    { label: 'All', count: 7, held: false },
    { label: 'Tops', count: 4, held: true },
    { label: 'Outerwear', count: 2, held: false },
    { label: 'Bottoms', count: 1, held: false },
  ];

  const summary = searchSummary({ count: 4, category: 'Tops', query: 'wool' });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center gap-2.5 px-gutter pt-2">
        <View className="flex-1">
          <SearchField
            value="wool"
            onChangeText={() => {}}
            className="min-h-[44px]"
            placeholder="Search your wardrobe"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel search"
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
          <Text variant="body" style={{ fontSize: 16, color: theme.muted }}>
            Cancel
          </Text>
        </Pressable>
      </View>

      {/* The rail, at the screen's own geometry: 8pt gaps, a 44pt row, and a
          20pt inset at BOTH ends so the partial chip reads as a rail that
          continues rather than as a clip. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: GUTTER,
          paddingVertical: 6,
          minHeight: 44,
          alignItems: 'center',
        }}>
        {counts.map((c) => (
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
        <ClosetGrid items={C02_MATCHES} resolveImage={resolve} />
      </View>
    </SafeAreaView>
  );
}
