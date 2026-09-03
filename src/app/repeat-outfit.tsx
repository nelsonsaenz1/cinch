import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentCell, stackLayout, STACK_ASPECT } from '@/components/today/garment-cell';
import { platedCostPerWear } from '@/components/today/cost-per-wear';
import { LAYOUT_ORDER, labelFor } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, tallyOf } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useWearOutfit } from '@/features/styling/mutations';
import { useWardrobe } from '@/features/styling/queries';
import {
  describeDate,
  exhaustionProgress,
  joinDates,
  wearsOfCore,
  weekdayName,
} from '@/features/styling/repeat';
import { useWornOutfits } from '@/features/styling/use-worn-outfits';
import type { FeatureVector, OutfitCandidate } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const ZERO_FEATURES: FeatureVector = {
  palette: 0,
  formality: 0,
  weather: 0,
  occasion: 0,
  proportion: 0,
  pattern: 0,
  season: 0,
  freshness: 0,
  affinity: 0,
};

/**
 * P-05 — opened from the notification.
 *
 * The tap lands HERE, on the outfit the notification named, not on the Today
 * feed and not on a paywall. There is no plan mentioned anywhere on this
 * screen — the user came for the outfit.
 *
 * Reached today only by hand (`cinch://repeat-outfit?itemIds=...`) or from
 * `dev-repeat.tsx`'s fixture: P-04's lock-screen notification is a design, not
 * a shipping surface (no `expo-notifications` in this app), so nothing in the
 * product can deep-link here yet. The route exists so the day push ships, the
 * destination is already built and already honest — it just names the day the
 * closet had the whole thing (`itemIds`, and optionally the AI's own `name`
 * for the look) rather than trying to reconstruct a look from a bare id.
 */
export default function RepeatOutfitScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { itemIds: itemIdsParam, name: nameParam } = useLocalSearchParams<{
    itemIds?: string;
    name?: string;
  }>();

  const wardrobe = useWardrobe();
  const wornOutfits = useWornOutfits();
  const wear = useWearOutfit();

  const requestedIds = useMemo(
    () => (itemIdsParam ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    [itemIdsParam],
  );

  // Memoised (not just `?? []`) so a fresh empty-array identity on every
  // render doesn't invalidate every `useMemo` that depends on it below.
  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  const records = useMemo(() => wornOutfits.data ?? [], [wornOutfits.data]);

  const pieces = useMemo(
    () =>
      items
        .filter((g) => requestedIds.includes(g.id))
        .sort((a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot)),
    [items, requestedIds],
  );

  // Real dates only — the same core-matching `wearsOfCore` uses everywhere
  // else in The Repeat, so this screen cannot claim a wear the calendar never
  // recorded even if the notification's own copy implied one.
  const previousWears = useMemo(
    () => wearsOfCore(records, items, requestedIds),
    [records, items, requestedIds],
  );

  const exhaustion = useMemo(() => exhaustionProgress(items, records), [items, records]);
  const totalCores = useMemo(() => countOutfits(tallyOf(items)), [items]);
  // STRICT, and the cell disappears when it is null — see the note over `Stat`.
  const cpw = useMemo(() => platedCostPerWear(pieces), [pieces]);

  const { resolve } = useSignedUrls(
    pieces.flatMap((g) => [g.cutoutPath, g.thumbPath]),
  );

  const now = new Date();
  const layout = pieces.length > 0 ? stackLayout(pieces, 340, 'tile') : [];
  const a11y = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');

  const title = nameParam || pieces.slice(0, 2).map(labelFor).join(' and ') || 'Today’s repeat';

  // The band is BUILT, not laid out — the same shape `components/item/
  // item-stats.tsx` settled on for IT-02, and for the same two sentences: the
  // constitution's "printed when known or omitted — never estimated, never a
  // dash", and IT-02's "Cost cell removed, not blanked".
  //
  // This screen printed `'—'` here, which is the exact thing that refuses. It
  // also computed the figure with `outfitCostPerWear`, which sums only the
  // pieces that HAVE a price and returns that: on a look where one garment is
  // unpriced or unworn, the dash never appeared and a confident, too-small
  // number did — a wrong figure is a worse failure than an absent one, because
  // nothing on screen admits to it. `platedCostPerWear` returns null unless
  // every piece can be priced, and null removes the column outright.
  //
  // Each cell is `flex-1`, so two cells fill the row exactly as three did and
  // nothing needs to know how many there are. A missing figure costs its
  // column, not the band's geometry.
  const stats: { key: string; label: string; value: string }[] = [
    { key: 'worn', label: 'Worn', value: `${previousWears.length}×` },
    {
      key: 'exhaustion',
      label: `Of ${exhaustion.total} worn`,
      value: `${exhaustion.wornCount}`,
    },
  ];
  if (cpw != null) {
    stats.push({ key: 'cpw', label: '$/wear', value: `$${cpw.toFixed(2)}` });
  }

  const body =
    previousWears.length > 0
      ? `Worn ${joinDates(previousWears.map((d) => describeDate(d, now)))}. It still fits today better than the other ${Math.max(totalCores - 1, 0)}.`
      : null;

  const handleWearAgain = () => {
    if (!pieces.length) return;
    const candidate: OutfitCandidate = {
      items: pieces,
      score: 0,
      features: ZERO_FEATURES,
      notes: {},
      harmonies: [],
    };
    wear.mutate({
      candidate,
      context: null,
      name: title,
      reasoning: 'Worn again from a repeat notification.',
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow">{`${weekdayName(now)} · the repeat you tapped`}</Text>
        <View style={{ marginTop: 6 }}>
          <Text variant="display" trim accessibilityRole="header">
            {title}
          </Text>
        </View>
        {body ? (
          <Text variant="body" className="mt-2 text-muted">
            {body}
          </Text>
        ) : null}
      </View>

      {pieces.length > 0 ? (
        <View className="mx-gutter mt-4 rounded-plate border border-rule bg-surface p-3.5">
          <View
            style={{ width: '100%', aspectRatio: 1 / STACK_ASPECT }}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Outfit: ${a11y}`}>
            {layout.map((piece) => (
              <View
                key={piece.garment.id}
                style={{
                  position: 'absolute',
                  left: piece.x,
                  top: piece.y,
                  width: piece.size,
                  height: piece.size,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: theme.tray,
                  borderWidth: 1,
                  borderColor: theme.rule,
                }}>
                <GarmentCell garment={piece.garment} uri={resolve(piece.garment.cutoutPath, piece.garment.thumbPath)} />
              </View>
            ))}
          </View>

          <Text variant="caption" numberOfLines={2} className="mt-2.5">
            {pieces.map(labelFor).join(' · ')}
          </Text>

          <View className="mt-3.5 flex-row gap-2">
            {stats.map((s) => (
              <Stat key={s.key} label={s.label} value={s.value} />
            ))}
          </View>

          <View className="mt-4 flex-row gap-2.5">
            <View style={{ flex: 1 }}>
              <Button title="I’ll wear it again" onPress={handleWearAgain} loading={wear.isPending} />
            </View>
            <Button title="Show another" variant="secondary" onPress={() => router.replace('/')} />
          </View>
        </View>
      ) : wardrobe.isLoading ? (
        <View className="mx-gutter mt-6">
          <Text variant="label">Loading your closet…</Text>
          {/* A way out while the read is in flight — this screen is reached
              by a notification tap, so there is no stack beneath it to swipe
              back to. */}
          <View className="mt-4">
            <Button title="Back to Today" variant="secondary" onPress={() => router.replace('/')} />
          </View>
        </View>
      ) : (
        <View className="mx-gutter mt-6">
          <Text variant="body" className="text-muted">
            This outfit isn&rsquo;t in your closet any more.
          </Text>
          <View className="mt-4">
            <Button title="Back to Today" variant="secondary" onPress={() => router.replace('/')} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View className="flex-1 rounded-md p-3" style={{ borderWidth: 1, borderColor: theme.rule }}>
      <Text variant="colophon">{label}</Text>
      <Text variant="title" trim style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
