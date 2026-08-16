import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InsightCard } from '@/components/closet/insight-card';
import { ItemCard } from '@/components/closet/item-card';
import { RailCard } from '@/components/closet/rail-card';
import { ItemStats } from '@/components/item/item-stats';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';

import type { Item } from '@/schemas/item';

/**
 * The five figure-bearing `numberOfLines={1}` sites, under worst-case values.
 *
 * Audit items 38–43 and 55. The Dynamic Type walk found that the signed-in
 * simulator account has an empty closet, so every data-bearing surface renders
 * its empty state and the places where truncation actually bites were never
 * exercised. Seeding production to fix that is not an option.
 *
 * So this is the fixture instead: the REAL components — not copies — fed the
 * longest honest values each can receive, on one screen, deterministic and
 * `__DEV__`-only. Reachable at `/dev-truncation`.
 *
 * WHY THESE FIVE AND NOT THE OTHER 71
 *
 * 76 of the app's 96 `numberOfLines={1}` sites render dynamic content. Almost
 * all are NAMES in list rows — a garment, a handle, an event title — where an
 * ellipsis is correct: the full value is one tap away and VoiceOver reads the
 * whole string regardless of the prop. These five are different because they
 * truncate a FIGURE, and a truncated number does not look truncated. "$1,2…"
 * is a plausible price. "12…" is a plausible wear count. Nothing on screen
 * tells the reader they are looking at half a number.
 *
 * The values below are chosen to be the widest a real user could produce, not
 * absurd: a four-figure coat, a four-digit wear count on a daily-worn basic,
 * and the longest garment name the tagger writes.
 */

/**
 * The name is DERIVED, not stored — `pieceName()` joins the first colour to
 * the subcategory. So the longest honest name comes from the longest honest
 * pair the tagger can write, not from a `name` field (there isn't one).
 */
const LONG_COLOUR = 'charcoal herringbone';
const LONG_SUBCATEGORY = 'double-breasted wool overcoat';

const base: Omit<Item, 'id' | 'wearCount' | 'purchasePrice'> = {
  userId: 'dev-truncation',
  imagePath: null,
  cutoutPath: null,
  platePath: null,
  thumbPath: null,
  listingPath: null,
  status: 'verified',
  category: 'outerwear',
  subcategory: LONG_SUBCATEGORY,
  colors: [{ name: LONG_COLOUR, hex: '#3A3A3C' }],
  pattern: null,
  material: null,
  brand: null,
  formalityScore: null,
  warmthScore: null,
  waterResistant: false,
  fit: null,
  patternScale: null,
  seasons: [],
  occasions: [],
  description: null,
  purchaseDate: null,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: true,
  createdAt: '2023-10-01T00:00:00.000Z',
} as unknown as Omit<Item, 'id' | 'wearCount' | 'purchasePrice'>;

const item = (over: Partial<Item> & { id: string }): Item =>
  ({ ...base, wearCount: 0, purchasePrice: null, ...over }) as Item;

/** A four-figure coat worn four figures of times. Both are reachable. */
const EXTREME = item({ id: 'x1', wearCount: 1284, purchasePrice: 1295 });
/** Never worn, so the card prints the full price instead of a rate. */
const NEVER_WORN = item({ id: 'x2', wearCount: 0, purchasePrice: 1295 });
/** The ordinary case, for comparison in the same screenshot. */
const ORDINARY = item({
  id: 'x3',
  subcategory: 'crew',
  colors: [{ name: 'navy', hex: '#1F2A44' }],
  wearCount: 12,
  purchasePrice: 89,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text variant="eyebrow">{title}</Text>
      <Rule className="mb-3 mt-1.5" />
      {children}
    </View>
  );
}

export default function DevTruncationScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="px-gutter">
          <Text variant="title" trim>
            Truncation
          </Text>
          <Text variant="note" className="mt-2">
            The five sites that truncate a figure rather than a name. Set the
            simulator to the largest Dynamic Type before reading this.
          </Text>

          <Section title="ItemCard · name, wears, price, cost per wear">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <ItemCard item={EXTREME} />
              </View>
              <View className="flex-1">
                <ItemCard item={NEVER_WORN} />
              </View>
            </View>
            <View className="mt-3 flex-row gap-3">
              <View className="flex-1">
                <ItemCard item={ORDINARY} />
              </View>
              <View className="flex-1" />
            </View>
          </Section>

          <Section title="InsightCard · the worn line">
            <InsightCard worn={1284} total={1500} unworn={216} />
          </Section>
        </View>

        <Section title="ItemStats · the three-figure band">
          <ItemStats wears={1284} costPerWear="$1,295.00" sinceLast="1284d" />
          <View className="mt-3">
            <ItemStats wears={0} costPerWear="$1,295.00" sinceLast="Never" neverWorn />
          </View>
        </Section>

        <View className="px-gutter">
          <Section title="RailCard · cost per wear">
            <View className="flex-row gap-3">
              <RailCard item={EXTREME} variant="mostWorn" />
              <RailCard item={ORDINARY} variant="latest" />
            </View>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
