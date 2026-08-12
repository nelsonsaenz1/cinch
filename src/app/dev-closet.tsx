import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * Closet fixture — `cinch://dev-closet`.
 *
 * Mirrors the handoff design's closet so the layout can be judged signed-out,
 * with the plate artwork standing in for garment photographs: the masthead
 * (title, live search, the three headline numbers, category filter) fixed above
 * a scrolling two-column grid. Kept visually in step with (tabs)/closet.tsx and
 * components/closet/item-card.tsx — this is the same screen without a wardrobe.
 *
 * Dev-only, like dev-plate and dev-share: __DEV__-gated in the auth gate.
 *
 * It is also the `closet` capture target for the screenshot matrix (audit item
 * 50), which diffs two launches of it byte for byte. Nothing on it reads a
 * clock, a random number or the network: the eight pieces, their wear counts
 * and the three headline figures are literals, the category chips start on
 * `All` every mount, and the search field is not autofocused — an autofocused
 * one would put a blinking caret in the masthead, and a caret is on screen for
 * half of every second it exists.
 *
 * The one thing that is not instant is the grid artwork, which expo-image
 * resolves off the asset server. It is the same five files at the same five
 * URIs on every launch, so it settles to the same pixels; it just has to be
 * given the moment to land before the shutter fires.
 */
const ART = [
  require('@/assets/plates/plate-01-coat.svg'),
  require('@/assets/plates/plate-01-knit.svg'),
  require('@/assets/plates/plate-01-trousers.svg'),
  require('@/assets/plates/plate-01-shoes.svg'),
  require('@/assets/plates/plate-01-scarf.svg'),
];

type Piece = { name: string; art: number; wears: number; cpw: string };
const PIECES: Piece[] = [
  { name: 'Charcoal wool coat', art: 0, wears: 42, cpw: '$4.70' },
  { name: 'Cream fine-knit', art: 1, wears: 27, cpw: '$1.90' },
  { name: 'Camel trousers', art: 2, wears: 33, cpw: '$1.50' },
  { name: 'Leather derbies', art: 3, wears: 22, cpw: '$5.00' },
  { name: 'Wool scarf', art: 4, wears: 11, cpw: '$2.60' },
  { name: 'Raw denim', art: 2, wears: 54, cpw: '$0.90' },
  { name: 'White tee', art: 1, wears: 61, cpw: '$0.40' },
  { name: 'Leather belt', art: 3, wears: 0, cpw: '—' },
];

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];
const GUTTER = 20;

export default function DevClosetScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const uris = useMemo(() => ART.map((m) => Asset.fromModule(m).uri), []);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View style={{ paddingHorizontal: GUTTER }}>
        <View className="flex-row items-baseline justify-between pt-2">
          <Text variant="display" trim accessibilityRole="header">
            Closet
          </Text>
          <Text variant="label" className="text-faint">
            24 pieces
          </Text>
        </View>

        <View className="mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5">
          <SymbolView name="magnifyingglass" size={15} tintColor={theme.faint} resizeMode="scaleAspectFit" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your wardrobe"
            placeholderTextColor={theme.faint}
            style={{ flex: 1, paddingVertical: 11, fontFamily: 'HelveticaNeue', fontSize: 15, color: theme.ink }}
          />
        </View>

        <View className="mt-3.5 flex-row border-y border-hairline">
          <StatCell value="61×" label="Most worn" />
          <StatCell value="1" label="Never worn" accent divided />
          <StatCell value="$2.40" label="Avg / wear" />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingVertical: 12 }}>
          {CATEGORIES.map((c) => {
            const selected = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                // `rounded-md`, matching the shared `Chip` the real closet
                // draws. This fixture exists to judge the closet atlas on a
                // device, and a fixture whose chips are capsules while the
                // screen's are 12px is a fixture that certifies the wrong
                // shape. §1.3 — `full` is circles only.
                className={`rounded-md border px-3.5 py-1.5 active:opacity-70 ${
                  selected
                    ? 'border-ink bg-ink'
                    : 'border-rule bg-transparent'
                }`}>
                <Text
                  variant="label"
                  className={selected ? 'text-canvas' : 'text-muted'}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Rule />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER - 6, paddingTop: 8, paddingBottom: 40 }}>
        <View className="flex-row flex-wrap">
          {PIECES.map((p, i) => (
            <View key={i} style={{ width: '50%' }} className="p-1.5">
              <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray">
                <Image
                  source={{ uri: uris[p.art] }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  style={{ flex: 1 }}
                />
                {p.wears === 0 ? (
                  <View className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-0.5">
                    <Text variant="colophon" className="text-canvas">
                      Never worn
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="mt-2 px-0.5">
                <Text variant="label" numberOfLines={1} className="text-ink">
                  {p.name}
                </Text>
                <View className="mt-1 flex-row items-baseline justify-between">
                  <Text
                    variant="caption"
                    className={p.wears === 0 ? 'text-accent' : 'text-muted'}>
                    {p.wears === 0 ? 'Never worn' : `${p.wears} wears`}
                  </Text>
                  <Text variant="stat" className="text-label text-ink">
                    {p.cpw}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({
  value,
  label,
  accent = false,
  divided = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
  divided?: boolean;
}) {
  return (
    <View
      className={`flex-1 items-center py-2.5 ${
        divided ? 'border-x border-hairline' : ''
      }`}>
      <Text
        variant="stat"
        className={accent ? 'text-accent' : 'text-ink'}>
        {value}
      </Text>
      <Text variant="colophon" className="mt-0.5">
        {label}
      </Text>
    </View>
  );
}
