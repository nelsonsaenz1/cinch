import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountPage } from '@/components/privacy/delete-account-page';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-04 — deletion, the three horizons.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Immediate, not scheduled" — correction 16. The first section is "While you
 *   wait", and the thirty-day backup window is gone along with the claim it
 *   made. Deletion runs on this screen; that immediacy is what satisfies
 *   Guideline 5.1.1(v), and `delete-account/index.ts` names the thirty-day
 *   version as a thing that does not.
 * · "What is left afterwards" names the residue exactly: moderation reports,
 *   and AI cost rows with the account reference cut out of them. A smaller and
 *   stranger residue than a backup window, which is why it is stated.
 * · "Export offered before deleting" — the export is a peer, offered first and
 *   unfilled.
 * · "Oxblood spent here" — on "Delete everything", once. Leaving is a real
 *   44pt exit rather than a cancel hidden in the nav bar.
 *
 * WHAT IS STOPPED, AND WHY
 *
 * PV-04's third section ends "Comments you left in other people's events stay,
 * shown without your name." Every social table cascades from `auth.users`, so
 * those comments are erased rather than anonymised — the second section says
 * so. Printing the drawn sentence would promise a survival that does not
 * happen. Its true half — there is no restore, export first — is in the panel
 * above the buttons.
 *
 * PV-04 also heads the sheet with "148 pieces, 612 wears, 41 plans and 6
 * boards". Three of those four are not available to this screen and no single
 * query returns them; printing the one that is would turn a four-part inventory
 * into a partial one. Omitted with the reason rather than estimated.
 *
 * DETERMINISM: no data at all — the page is copy and three controls.
 */
export default function DevW3G4Pv04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <DeleteAccountPage onBack={() => {}} onExportFirst={() => {}} onDelete={() => {}} />
  );
}
