/**
 * CPV2-V02 — the matcher entered from the walkthrough, prefilled.
 *
 * Two things are being checked here and neither is the search itself.
 *
 * That the words arriving from the review card are the ones searched — the
 * VERBATIM utterance, not the parse's summary of it — and that the walkthrough
 * says out loud what it is holding while the user is away from it. §3's held
 * sentence is the promise that the procession cursor and the confirmed work
 * survive whatever happens in here, and it is the only reason it is safe to
 * push a whole flow out of the middle of a seven-card review.
 *
 * The colour parsed from that card rides along and arrives pre-selected on
 * CPV2-05 — see `useCatalogueFlow.openFamily`.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { Text } from '@/components/ui/text';
import { HELD_WALKTHROUGH, TYPED_PRIVACY } from '@/features/catalogue/copy';
import { CPV2_POSES } from '@/features/catalogue/dev-fixtures';

export default function DevCpv2V02Screen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="gap-2 px-gutter pb-3 pt-2">
        <Text variant="eyebrow">CPV2-V02 · Matcher from the walkthrough</Text>
        <Text variant="body">the grey james perse tee I wear all the time</Text>
        <Text variant="noteSmall">{HELD_WALKTHROUGH}</Text>
        <Text variant="noteSmall">{TYPED_PRIVACY}</Text>
      </View>
      <View className="flex-1">
        <CatalogueBody view={CPV2_POSES['04-families']} />
      </View>
    </SafeAreaView>
  );
}
