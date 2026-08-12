import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import {
  BOTTOM_GAP,
  FIXTURE_TALLY,
  SHOE_GAP,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * GF-01 — computed gaps only, buying suggestions off.
 *
 * THE ACCEPTANCE CASE FOR A CARD WITH NO MERCHANT ROW. Nothing about this
 * frame looks like a card with a row missing: the tray footer is absent, not
 * empty, and the card ends on its own evidence.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Audit 85 — no bare delta. The old `+7` in 26pt oxblood is gone; the
 *   sentence names the unit ("outfit cores"), defines it in passing and prints
 *   both endpoints (14 → 21). Every figure comes from `countOutfits()` by way
 *   of `gainFrom`, so the card's arithmetic IS the app's arithmetic — see
 *   `w3-g5-fixture-data.ts` for why the atlas's own 4-tops illustration cannot
 *   be evaluated and this closet can.
 * · Audit 84 — the masthead is one serif line and one sentence, and the first
 *   card's headline follows immediately. The measured offset is in
 *   `app/gap-feed.tsx`'s header, along with why 112pt is not reachable on a
 *   pushed route and what §14 actually asks a reviewer to check.
 * · The second card carries no imagery, because its evidence is arithmetic
 *   rather than three garments.
 *
 * WHAT IS NOT DRAWN, AND WHY
 *
 * The atlas's two corrections — "I already own one" and "Not my style" — are
 * ABSENT, and the reason is more specific than "no backend".
 *
 * `wardrobe_gaps` exists (migration 20260803210000) and carries a `dismissed`
 * boolean with owner RLS on all four verbs. But the Gap Feed does not use that
 * table and never has: `useGapFeed` computes its ranking on the device from the
 * wardrobe tally (`rankGaps`), and nothing in `src/` reads or writes
 * `wardrobe_gaps` — the only mentions are in the generated `database.types.ts`.
 * A gap on this screen therefore has no persistent identity to dismiss. Wiring
 * these two controls would mean either writing gap rows from the client, which
 * is a new backend path this packet forbids inventing, or a local-only flag
 * that `rankGaps` would recompute away on the next render. And "I already own
 * one" has nothing to record against at all: `dismissed` is one boolean, while
 * these are two distinct signals.
 *
 * So they would be two controls that cannot complete — the standing "never a
 * dead control" refusal. Reported as a conflict rather than implemented.
 *
 * The atlas's second card ("Something for rain") is absent for the same
 * reason: `rankGaps` ranks the four counted kinds and nothing else — there is
 * no weather-derived or wear-derived gap kind in the product — so the second
 * card here is the real runner-up.
 *
 * DETERMINISM: no network, no clock, no `ActivityIndicator`, no shimmer.
 */
export default function DevW3G5GF01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-6 pt-2.5">
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 32 }}>
          What your closet is missing
        </Text>
        <Text variant="note" className="mt-1.5" style={{ fontSize: 15, lineHeight: 22 }}>
          {/* "and what you actually wear" is not drawn: no wear record enters
              the ranking. See app/gap-feed.tsx. */}
          Two gaps, computed from what you own.
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-3.5" contentContainerStyle={{ gap: 12 }}>
        <GapCard
          eyebrow="Biggest gap"
          gain={BOTTOM_GAP}
          tally={FIXTURE_TALLY}
          pairings={WAITING_TOPS}
          gloss
          stacked={false}
        />
        <GapCard eyebrow="Second gap" gain={SHOE_GAP} tally={FIXTURE_TALLY} stacked={false} />
      </ScrollView>
    </SafeAreaView>
  );
}
