import { SafeAreaView } from 'react-native-safe-area-context';

import { PrivacyIndexPage } from '@/components/privacy/privacy-index-page';
import { CONSENT_DETAIL_GRANTED } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-02 — shopping partners expanded.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 76 — the full detail stays in the app, at 17px, and the section
 *   separates the four parties involved rather than running them together:
 *   the listing service, the cache, the shop's own image server, the merchant.
 * · "Body stays 17 pt when open" — the expanded prose is `body`, the same size
 *   as the collapsed row's title. Nothing shrinks to fit.
 * · "Cache described, not denied" — correction 03. The page used to say nothing
 *   about the catalogue cache at all. It now states what actually remains: the
 *   sentence is discarded, and a scrambled key plus at most twelve ordinary
 *   garment words in no order can persist. Both halves are read off
 *   `supabase/functions/_shared/catalog.ts` — `cacheKey()` is a SHA-256, and
 *   `MAX_RETAINED_TERMS` is 12.
 * · correction 14 — "Paid link" is named as a property of merchants with a paid
 *   arrangement, not of every row, in the same words the Gap Feed uses.
 * · Expansion in place: the neighbours keep their position and collapse to
 *   their titles.
 *
 * `initialOpen` is the fixture's only concession — PV-02 is PV-01 with one row
 * open, and a frame that had to be tapped into position would be a picture of
 * the tap.
 *
 * DETERMINISM: identical to PV-01 plus one literal row title.
 */
export default function DevW3G4Pv02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <PrivacyIndexPage
      consentDetail={CONSENT_DETAIL_GRANTED}
      deferredLinksAvailable={false}
      shoppable={false}
      onToggleShoppable={() => {}}
      initialOpen="Shopping partners"
      onBack={() => {}}
      onOpenConsent={() => {}}
      onOpenVisibility={() => {}}
      onOpenExport={() => {}}
      onOpenDelete={() => {}}
    />
  );
}
