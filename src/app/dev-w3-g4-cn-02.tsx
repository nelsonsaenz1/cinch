import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentPage } from '@/components/privacy/ai-consent-page';
import { REVOKED_AT } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state CN-02 — kept on this phone, the declined path.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Declining is drawn as a CONFIGURATION, not a consequence: the longer list
 *   comes first and names the whole product, the shorter one names what
 *   genuinely needs the model.
 * · correction 01 — cutting a garment out of its background is in the works
 *   list. It is Apple Vision on the device and never depended on consent.
 * · "Nothing has been sent" is stated even though it is an absence, because it
 *   is a fact worth stating: the counts are zero and the ledger says so rather
 *   than showing an empty space.
 * · "No oxblood — nothing is being sold": the way back on is the ink-filled
 *   "Give AI consent", which opens the full disclosure rather than a toggle.
 *   Nothing on this frame spends the accent.
 *
 * WHERE THE DRAWN LISTS ARE WRONG ABOUT THIS APP
 *
 * CN-02 puts packing in the works list; `packing-brief` refuses without consent
 * exactly as the tagger does. CN-02 omits the stylist chat from the lost list;
 * it stops. Both corrected in `features/privacy/copy.ts`, with citations.
 *
 * DETERMINISM: frozen ISO date, zero counts, no photographs, no spinner —
 * `sentPhotos` is empty so the ledger and its loading branch never mount.
 */
export default function DevW3G4Cn02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <AiConsentPage
      granted={false}
      ready
      grantedAt={null}
      revokedAt={REVOKED_AT}
      version={null}
      taggedCount={0}
      listingCount={0}
      untaggedCount={0}
      backfillPhase="idle"
      onOpenBackfill={() => {}}
      sentListOpen={false}
      onToggleSentList={() => {}}
      sentPhotos={[]}
      sentDetails={undefined}
      sentDetailsLoading={false}
      resolveThumb={() => undefined}
      onBack={() => {}}
      onWithdraw={() => {}}
      onGive={() => {}}
    />
  );
}
