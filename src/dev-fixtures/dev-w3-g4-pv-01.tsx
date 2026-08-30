import { SafeAreaView } from 'react-native-safe-area-context';

import { PrivacyIndexPage } from '@/components/privacy/privacy-index-page';
import { CONSENT_DETAIL_GRANTED } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-01 — the index, collapsed.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 75 — every category is named in the collapsed state, with a Medium
 *   title and a regular gist under it, so the first viewport is a readable
 *   summary of the whole disclosure rather than the first third of one
 *   paragraph of it.
 * · "Row 44 pt, chevron affordance" — every row is a 44pt target and says which
 *   way it opens: down for the ones that expand in place, right for the three
 *   that open a page.
 * · "No oxblood on the index" — deletion is the last row, in the same weight as
 *   the rest. It is a section, not a red button; the accent is spent inside the
 *   page it opens.
 * · The AI row prints live state — the consent date and what it covers — so the
 *   most consequential setting on the page is legible without opening anything.
 * · Rules rather than cards, so nine rows read as one list.
 *
 * WHERE THE DRAWN GISTS ARE NOT USED
 *
 * PV-01 draws "Weather by city, calendar titles never stored" and "Email,
 * membership, devices". Neither is true of this app — the forecast comes from a
 * rounded coordinate, the calendar TITLE is sent with the outfit request, and
 * there is no device list. `features/privacy/copy.ts` carries the honest
 * versions and the citations.
 *
 * NOT DRAWN BY THE ATLAS, AND KEPT: "Let friends find where your pieces are
 * from" (commerce-directive C-05) is a live consent control that ships.
 *
 * DETERMINISM: one frozen consent line, no clock, no query, no image, no
 * spinner. `deferredLinksAvailable` is false — the shipping default, since the
 * attribution module is not in the binary.
 */
export default function DevW3G4Pv01() {
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
      pinterestDetail="Not connected"
      deferredLinksAvailable={false}
      shoppable={false}
      onToggleShoppable={() => {}}
      onBack={() => {}}
      onOpenPinterest={() => {}}
      onOpenConsent={() => {}}
      onOpenVisibility={() => {}}
      onOpenExport={() => {}}
      onOpenDelete={() => {}}
    />
  );
}
