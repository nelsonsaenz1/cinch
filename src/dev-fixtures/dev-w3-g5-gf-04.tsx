import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { GapLimitFooter } from '@/components/gap-feed/limit-footer';
import {
  ACTIVE_LIMIT,
  BOTTOM_GAP,
  FIXTURE_TALLY,
  SHOE_GAP,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * GF-04 — the active limit reached, and the provider silently absent.
 *
 * ── CORRECTION 20 · NO BYPASS EXISTS ───────────────────────────────────────
 *
 * "Add anyway and store later" is not on this frame, and not disabled on it
 * either: it is gone. `enforce_item_limit()` raises `closet_limit_reached` on
 * `before insert on items` once the unarchived count is at the plan's active
 * ceiling (migration 20260808190100), so the piece cannot be created until a
 * slot is freed — the promise the old action made is one the database refuses
 * before anything can be stored "later". The two recoveries left are the two
 * that exist, and their wording is the Closet's own: "See stored" is
 * `add-clothes.tsx`'s exact string for the same destination, and the sentence
 * about what a stored piece keeps is that screen's sentence verbatim.
 *
 * A TOTAL ceiling is drawn as a separate case, because the database treats it
 * as one: `storage_limit_reached` counts every row the account holds, archived
 * included, and its own hint is "Delete a stored piece, or upgrade" — storing
 * cannot help, so "Choose one to store" is withheld rather than offered and
 * refused. The atlas routes that case to the Closet's C-09; C-09 is not drawn
 * in this wave's Closet atlas and does not exist as a screen, so the honest
 * destination is the stored pieces themselves, where a deletion is possible.
 * Reported as a dependency rather than invented.
 *
 * ── CORRECTION 21 · A CATALOGUE FAILURE IS SILENT ──────────────────────────
 *
 * The second card carries no merchant tray, no outage notice, no apology and
 * no retry, and nothing anywhere on the frame tells the user a provider is
 * down. The gap never depended on the partner, so the computed gap is simply
 * drawn on its own. This is not a branch in the code — `useShopMatch` returns
 * an empty list for every failure mode and the tray renders nothing — so the
 * silence is structural rather than a state somebody remembered to draw.
 * Provider outages belong to the health alerts.
 *
 * NO TIER, NO PRICE, NO PAYWALL anywhere on this frame. Capacity is arithmetic
 * from the current plan; membership is reached from Profile.
 *
 * DETERMINISM: literal counts, no network, no clock, no spinner.
 */
export default function DevW3G5GF04() {
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
          Your active shelf is full, so adding means swapping first.
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-3.5" contentContainerStyle={{ gap: 12 }}>
        <GapCard
          eyebrow="Biggest gap"
          gain={BOTTOM_GAP}
          tally={FIXTURE_TALLY}
          stacked={false}
          footer={
            <GapLimitFooter
              ceiling="active"
              used={ACTIVE_LIMIT}
              limit={ACTIVE_LIMIT}
              onChooseToStore={() => undefined}
              onSeeStored={() => undefined}
            />
          }
        />

        {/* The provider is absent. Nothing says so. */}
        <GapCard eyebrow="Second gap" gain={SHOE_GAP} tally={FIXTURE_TALLY} stacked={false} />

        <View className="pt-3">
          <Text variant="eyebrow">At the total ceiling instead</Text>
        </View>
        <GapCard
          eyebrow="Biggest gap"
          gain={BOTTOM_GAP}
          tally={FIXTURE_TALLY}
          stacked={false}
          footer={
            <GapLimitFooter
              ceiling="total"
              used={450}
              limit={450}
              onSeeStored={() => undefined}
            />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
