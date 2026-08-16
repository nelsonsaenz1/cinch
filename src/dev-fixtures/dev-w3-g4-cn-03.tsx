import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentPage } from '@/components/privacy/ai-consent-page';
import {
  CONSENT_VERSION,
  GRANTED_AT,
  LISTING_SENDS,
  SENT_DETAILS,
  SENT_PHOTOS,
  UNTAGGED_COUNT,
  resolveThumb,
} from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state CN-03 — withdrawal, with the sent log.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "On since 3 March" — the state sentence comes off the consent record, and
 *   the record's own version and date are printed at the foot of the decision.
 * · The record is re-read, not re-summarised, at 17px. Every fact is the
 *   wording the user agreed to.
 * · "Counts, never a graph" — the ledger is counts and a list of pieces. No
 *   chart, no timeline, no percentage.
 * · "Withdrawal is one action": one unfilled oxblood control, consequential and
 *   reversible, never dressed as a warning. It opens a confirmation.
 *
 * WHERE THIS FRAME STOPS SHORT OF THE DRAWING, AND WHY
 *
 * CN-03 draws the log as four ruled rows of per-day counts under one lifetime
 * total — "148 photographs since 3 March". This repository cannot produce that
 * number. `use-ai-privacy.ts` is explicit: `tag-item` records an `item_id` and
 * `garment-search` records none, so one door is itemisable and the other is
 * only countable; the `garment_search` workload also covers searches that send
 * no photograph at all, making its row count an upper bound rather than a
 * count. "Adding the two together would replace an undercount with an
 * overcount and print it as a single confident figure." So the two are printed
 * as two, each worded for exactly what it is, and the day-by-day grouping is
 * not drawn — a per-day count would need a per-send ledger, and the query
 * deliberately collapses to one row per piece so a re-tag is not counted twice.
 *
 * CN-03 also draws a toggle. A toggle can be flipped back on, and
 * `use-consent.ts:116-119` forbids re-granting without the full disclosure.
 *
 * DETERMINISM: every date is a frozen ISO literal, every count a literal, the
 * ledger is open with its details already resolved so no spinner mounts, and
 * the photographs are local assets.
 */
export default function DevW3G4Cn03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <AiConsentPage
      granted
      ready
      grantedAt={GRANTED_AT}
      revokedAt={null}
      version={CONSENT_VERSION}
      taggedCount={SENT_PHOTOS.length}
      listingCount={LISTING_SENDS}
      untaggedCount={UNTAGGED_COUNT}
      backfillPhase="idle"
      onOpenBackfill={() => {}}
      sentListOpen
      onToggleSentList={() => {}}
      sentPhotos={SENT_PHOTOS}
      sentDetails={SENT_DETAILS}
      sentDetailsLoading={false}
      resolveThumb={resolveThumb}
      onBack={() => {}}
      onWithdraw={() => {}}
      onGive={() => {}}
    />
  );
}
