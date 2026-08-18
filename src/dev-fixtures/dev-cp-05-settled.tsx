/**
 * CP-05 fixture — redesign 22, frames 09 and 16: the settled batch.
 *
 * Nothing is in flight, so the rows become a three-up grid of what landed, the
 * headline becomes a spelled count, and the only forward door is review with
 * "Photograph more" quiet beneath it.
 *
 * The invite line is drawn here because this fixture poses the account it is
 * conditioned on. THE CONDITION ITSELF LIVES IN `capture.tsx` and is the
 * shipped one character for character — a settled batch with pieces in it, no
 * listing offer on screen, and a closet at or past the free tier's own figure.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CloseDisc,
  InviteLine,
  PageActions,
  PageMasthead,
  SettledGrid,
} from '@/components/ingest/capture-parts';
import { CP_SETTLED } from '@/features/ingest/capture-fixtures';
import { PHOTOGRAPH_MORE, SETTLED_SUB, reviewCta, settledTitle } from '@/features/ingest/capture-spec';

export default function DevCp05SettledScreen() {
  const filed = CP_SETTLED.length;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-canvas">
      <View className="flex-row justify-start px-gutter pb-1 pt-2">
        <CloseDisc tone="canvas" glyph="chevron.left" label="Back" onPress={() => {}} />
      </View>
      <PageMasthead title={settledTitle(filed)} sub={SETTLED_SUB} />
      <SettledGrid uris={CP_SETTLED.map((j) => j.localUri)} />
      <View className="pt-4">
        <InviteLine onPress={() => {}} />
      </View>
      <View className="flex-1" />
      <PageActions
        primary={reviewCta(filed)}
        onPrimary={() => {}}
        quiet={PHOTOGRAPH_MORE}
        onQuiet={() => {}}
      />
    </SafeAreaView>
  );
}
