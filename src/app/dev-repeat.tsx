import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_REPEAT_OUTFIT, FIXTURE_REPEAT_WARDROBE } from '@/components/dev/fixtures';
import { GarmentCell, stackLayout, STACK_ASPECT } from '@/components/today/garment-cell';
import { LAYOUT_ORDER, labelFor, Plate } from '@/components/today/plate';
import { RepeatExhausted } from '@/components/today/repeat-exhausted';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, rankGaps, tallyOf } from '@/features/closet/outfit-count';
import {
  describeDate,
  exhaustionProgress,
  joinDates,
  possibleCores,
  weekdayName,
  type WornRecord,
} from '@/features/styling/repeat';
import { useTheme } from '@/theme/tokens';

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);

const TOTAL_CORES = countOutfits(tallyOf(FIXTURE_REPEAT_WARDROBE)); // 14, by the same arithmetic as the atlas
const LINEN_AND_CHARCOAL_IDS = ['r1', 'r4', 'r7', 'r10'];

// ── P-01 — first repeat, informational ──────────────────────────────────────
const P01_NOW = noon(2026, 8, 7); // Friday 7 Aug
const P01_PREVIOUS = [noon(2026, 8, 4)]; // Tuesday 4 Aug

// ── P-02 — third wear, firmer, with the count ───────────────────────────────
const P02_NOW = noon(2026, 8, 12); // Wednesday 12 Aug
const P02_PREVIOUS = [noon(2026, 8, 4), noon(2026, 8, 7)]; // Tue 4th, Fri 7th

// ── P-03 — exhausted, all fourteen worn ─────────────────────────────────────
const P03_NOW = noon(2026, 8, 24);
const P03_SINCE = noon(2026, 8, 3); // 21 days before P03_NOW — "day 22", matching the atlas's own span
const P03_RECORDS: WornRecord[] = possibleCores(FIXTURE_REPEAT_WARDROBE).map((ids, i, all) => ({
  // Spread evenly between SINCE and NOW so every core has a distinct, real date.
  date: new Date(
    P03_SINCE.getTime() + ((P03_NOW.getTime() - P03_SINCE.getTime()) * i) / Math.max(1, all.length - 1),
  ),
  itemIds: ids,
}));

// ── P-05 — opened from the notification ─────────────────────────────────────
const P05_NOW = noon(2026, 8, 10); // Monday 10 Aug
const P05_PREVIOUS = [noon(2026, 8, 4), noon(2026, 8, 7)];

/**
 * DEV ONLY — The Repeat's four built states at `cinch://dev-repeat`.
 *
 * P-01 and P-02 are rendered through the real, shared `<Plate>` — the
 * component Today actually mounts — with fixture `repeat` data, so this is
 * pixel-identical to what a real repeat looks like on the shipped screen. P-03
 * is `<RepeatExhausted>` as Today would place it, above the day's plates.
 * P-05 is composed by hand from the same primitives the real
 * `repeat-outfit.tsx` route uses (`GarmentCell` + `stackLayout`), because that
 * route reads a signed-in wardrobe and a signed-out dev preview has none.
 *
 * P-04 (the lock-screen notification) is deliberately absent — it is a
 * design, not a shipping surface: this app has no `expo-notifications`, no
 * APNs key, no permission prompt, no privacy-manifest entry.
 */
export default function DevRepeatScreen() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const exhaustion = exhaustionProgress(FIXTURE_REPEAT_WARDROBE, P03_RECORDS);
  const gap = rankGaps(tallyOf(FIXTURE_REPEAT_WARDROBE))[0] ?? null;

  const p05Pieces = FIXTURE_REPEAT_WARDROBE.filter((g) => LINEN_AND_CHARCOAL_IDS.includes(g.id)).sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );
  const p05Layout = stackLayout(p05Pieces, 340, 'tile');

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="pb-16">
        <StateLabel>P-01 · first repeat — informational</StateLabel>
        <Plate
          outfit={FIXTURE_REPEAT_OUTFIT}
          index={0}
          occasion={null}
          colophon={{ city: 'Denver', feelsLikeC: 14 }}
          resolveImage={() => undefined}
          onWear={() => {}}
          onReact={() => {}}
          repeat={{
            previousWears: P01_PREVIOUS,
            pieceCount: FIXTURE_REPEAT_WARDROBE.length,
            totalCores: TOTAL_CORES,
            now: P01_NOW,
            onSeePlans: () => {},
            onShowAnother: () => {},
          }}
        />

        <StateLabel className="mt-8">P-02 · third wear — firmer, with the count</StateLabel>
        <Plate
          outfit={FIXTURE_REPEAT_OUTFIT}
          index={0}
          occasion={null}
          colophon={{ city: 'Denver', feelsLikeC: 16 }}
          resolveImage={() => undefined}
          onWear={() => {}}
          onReact={() => {}}
          repeat={{
            previousWears: P02_PREVIOUS,
            pieceCount: FIXTURE_REPEAT_WARDROBE.length,
            totalCores: TOTAL_CORES,
            now: P02_NOW,
            onSeePlans: () => {},
            onShowAnother: () => {},
          }}
        />

        <StateLabel className="mt-8">P-03 · exhausted — all fourteen worn</StateLabel>
        <RepeatExhausted
          total={exhaustion.total}
          since={exhaustion.since}
          now={P03_NOW}
          gap={gap}
          currentCountOfKind={gap ? tallyOf(FIXTURE_REPEAT_WARDROBE)[gap.kind] : 0}
          topOutfitName="the linen and charcoal"
          topOutfitWearCount={3}
          onSeePlans={() => {}}
          onSwapInstead={() => {}}
        />

        <StateLabel className="mt-8">P-04 · the lock-screen notification — not built</StateLabel>
        <View className="mx-gutter rounded-plate border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
          <Text variant="body" className="text-muted dark:text-muted-dark">
            A design, not a shipping surface: this app has no expo-notifications, no APNs key, no
            permission prompt, no privacy-manifest entry. See the atlas and
            docs/design/free-tier-contract.md.
          </Text>
        </View>

        <StateLabel className="mt-8">P-05 · opened from the notification</StateLabel>
        <View className="px-gutter pt-2">
          <Text variant="eyebrow">{`${weekdayName(P05_NOW)} · the repeat you tapped`}</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="display" trim>
              Linen and charcoal
            </Text>
          </View>
          <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
            {`Worn ${joinDates(P05_PREVIOUS.map((d) => describeDate(d, P05_NOW)))}. It still fits today better than the other ${TOTAL_CORES - 1}.`}
          </Text>
        </View>

        <View className="mx-gutter mt-4 rounded-plate border border-rule bg-surface p-3.5 dark:border-rule-dark dark:bg-surface-dark">
          <View style={{ width: '100%', aspectRatio: 1 / STACK_ASPECT }}>
            {p05Layout.map((piece) => (
              <View
                key={piece.garment.id}
                style={{
                  position: 'absolute',
                  left: piece.x,
                  top: piece.y,
                  width: piece.size,
                  height: piece.size,
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: theme.tray,
                  borderWidth: 1,
                  borderColor: theme.rule,
                }}>
                <GarmentCell garment={piece.garment} />
              </View>
            ))}
          </View>
          <Text variant="caption" className="mt-2.5">
            {p05Pieces.map(labelFor).join(' · ')}
          </Text>

          <View className="mt-3.5 flex-row gap-2">
            <DevStat label="Worn" value={`${P05_PREVIOUS.length}×`} />
            <DevStat label={`Of ${TOTAL_CORES} worn`} value="14" />
            <DevStat label="$/wear" value="$4.10" />
          </View>

          <View className="mt-4 flex-row gap-2.5">
            <View style={{ flex: 1 }}>
              <Button title="I'll wear it again" onPress={() => {}} />
            </View>
            <Button title="Show another" variant="secondary" onPress={() => {}} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DevStat({ label, value }: { label: string; value: string }) {
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

/** A small caption marking each stacked state — dev chrome, not app UI. */
function StateLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <View className={`px-gutter ${className}`} style={{ paddingTop: 8, paddingBottom: 4 }}>
      <Text variant="colophon" className="text-accent dark:text-accent-dark">
        {children}
      </Text>
    </View>
  );
}
