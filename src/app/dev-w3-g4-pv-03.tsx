import { SafeAreaView } from 'react-native-safe-area-context';

import { ExportPage } from '@/components/privacy/export-page';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-03 — export, offered.
 *
 * PV-03 is drawn as a comparison document with all four states stacked so their
 * wording can be read against each other. The app shows one at a time, so the
 * four are four routes: this one, `-pv-03-ready` and `-pv-03-failed`. The
 * Building state has no route — see the note at the foot of this comment.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · correction 15 — the export is not one bundle with the photographs inside
 *   it. The five files are named in the first sentence, and `photos.html` is
 *   named as itself rather than described as "photos", because that is the
 *   filename in the email the reader is holding.
 * · The manifest is the page: one row per real file, at 16px regular.
 * · "One request a day" is the rpc's own rule, stated before the button rather
 *   than discovered as a refusal after it.
 *
 * WHY THERE IS NO BUILDING FRAME
 *
 * That state's card carries an `ActivityIndicator` — the platform's own
 * indeterminate control, chosen because there is no `progress` column and a bar
 * would be a percentage nothing can compute. It spins, so its bytes can never
 * reproduce, and a screenshot of it is not evidence. The wording is verifiable
 * in `export-page.tsx` and in this lane's tests instead.
 *
 * DETERMINISM: no exports in the list, a literal email, no clock reached, no
 * spinner mounted.
 */
export default function DevW3G4Pv03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ExportPage
      loading={false}
      error={false}
      onRetry={() => {}}
      exports={[]}
      email="sophie@mail.com"
      requesting={false}
      requestError={null}
      onRequest={() => {}}
      onBack={() => {}}
    />
  );
}
