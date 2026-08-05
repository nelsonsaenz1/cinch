import { Asset } from 'expo-asset';
import { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/closet/category-tile';
import { StatTile } from '@/components/closet/stat-tile';
import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';

/**
 * Closet board fixture — `cinch://dev-closet`.
 *
 * The board's geometry is the whole design, and it cannot be judged against an
 * empty account: three squares must divide the measure exactly, two rows must
 * not become three, and the stat tiles must land on the same module. This
 * renders it signed-out with the plate artwork standing in for garment
 * thumbnails, so the collage, the captions and the palette can all be seen
 * without uploading a wardrobe first.
 *
 * Dev-only, like dev-plate and dev-share: __DEV__-gated in the auth gate.
 */

 
const ART = [
  require('@/assets/plates/plate-01-coat.svg'),
  require('@/assets/plates/plate-01-knit.svg'),
  require('@/assets/plates/plate-01-trousers.svg'),
  require('@/assets/plates/plate-01-shoes.svg'),
  require('@/assets/plates/plate-01-scarf.svg'),
];
 

const GUTTER = 20;
const GAP = 10;
const COLUMNS = 3;

const CATEGORIES = [
  { key: 'all', label: 'Everything', count: 24, art: 4 },
  { key: 'top', label: 'Tops', count: 8, art: 2 },
  { key: 'bottom', label: 'Bottoms', count: 5, art: 1 },
  { key: 'outerwear', label: 'Outerwear', count: 4, art: 3 },
  { key: 'footwear', label: 'Shoes', count: 5, art: 4 },
  { key: 'accessory', label: 'Accessories', count: 2, art: 0 },
];

export default function DevClosetScreen() {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');

  const tile = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  // Local bundled assets are not URLs; resolving them gives the tile the same
  // kind of string a signed Storage URL would be.
  const uris = useMemo(() => ART.map((m) => Asset.fromModule(m).uri), []);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 60 }}>
        <View className="pb-4 pt-2">
          <Text variant="display" trim accessibilityRole="header">
            My Closet
          </Text>
          <View style={{ marginTop: 12 }}>
            <Rule />
          </View>
          <Text variant="label" className="mt-2 text-muted dark:text-muted-dark">
            24 pieces
          </Text>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {CATEGORIES.map((c) => (
            <CategoryTile
              key={c.key}
              label={c.label}
              count={c.count}
              selected={category === c.key}
              onPress={() => setCategory(c.key)}
              size={tile}
              previews={uris.slice(0, c.art)}
            />
          ))}
        </View>

        <View style={{ marginTop: 24 }}>
          <Rule />
        </View>
        <Text variant="eyebrow" className="mb-3 mt-3">
          What it is telling you
        </Text>
        <View className="flex-row" style={{ gap: GAP }}>
          <StatTile
            label="Most worn"
            value="41×"
            detail="navy overcoat"
            selected={sort === 'most-worn'}
            onPress={() => setSort('most-worn')}
            size={tile}
          />
          <StatTile
            label="Never worn"
            value="3"
            detail="12% of closet"
            selected={sort === 'never-worn'}
            onPress={() => setSort('never-worn')}
            size={tile}
          />
          <StatTile
            label="Cost / wear"
            value="$3.41"
            detail="average"
            selected={sort === 'cost-per-wear'}
            onPress={() => setSort('cost-per-wear')}
            size={tile}
          />
        </View>

        {/* The accent, so the new CTA colour can be judged against the board. */}
        <Button title="Add clothes" onPress={() => {}} haptic className="mt-8 self-stretch" />
      </ScrollView>
    </SafeAreaView>
  );
}
