/**
 * CPV2-02 fixture — the shipping `ListeningScreen`, with numbers for a recorder.
 *
 * INERT BY CONSTRUCTION, and that is the point of the whole refactor. No
 * `useCatalogueVoice`, no `useRecorder`, no microphone permission and no
 * upload: opening this route cannot start recording anybody, which is what
 * makes a listening state reviewable at all. Before the split, the only way to
 * look at this frame was to speak into a simulator and take a screenshot at the
 * right moment.
 *
 * `amplitude` is omitted, so the meter draws the static profile — which is also
 * exactly what Reduce Motion draws (§6), so this fixture doubles as that state.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { ListeningScreen } from '@/components/catalogue/listening-screen';
import { CATALOGUE_MAX_RECORDING_MS } from '@/features/catalogue/use-catalogue-voice';

export default function DevCpv2ListeningScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ListeningScreen
        // The atlas's own clock: "Listening · 0:04 of 0:30".
        elapsedMs={4_000}
        maxMs={CATALOGUE_MAX_RECORDING_MS}
        onDone={() => {}}
        onCancel={() => {}}
        onTypeInstead={() => {}}
      />
    </SafeAreaView>
  );
}
