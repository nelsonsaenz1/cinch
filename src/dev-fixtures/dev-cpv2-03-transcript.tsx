/**
 * CPV2-03 fixture — the shipping `SearchHeader` with a transcript in it.
 *
 * Two things to look at, and both are about honesty rather than layout.
 *
 * The "Heard:" line quotes the FIELD, not the transcript, so editing the words
 * updates it and the screen can never show two different queries at once.
 *
 * The action reads "Search again" and nothing is in flight beneath it. That is
 * the ruled deviation from the atlas, which draws the search as already
 * running: dictation mishears brand names more than anything else, and a
 * metered request against a hard monthly cutoff should not be spent before
 * somebody has looked at what was heard.
 *
 * Inert: every callback is a no-op, so this route cannot search or record.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { SearchHeader } from '@/components/catalogue/search-header';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CPV2_POSES } from '@/features/catalogue/dev-fixtures';

export default function DevCpv2TranscriptScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader title="Find a product photo" onBack={() => {}} />
      <SearchHeader
        text="James Perse men’s T-shirt"
        onChangeText={() => {}}
        canSearch
        onSubmit={() => {}}
        onSpeak={() => {}}
        transcribed
      />
      <View className="flex-1">
        {/* The skeleton at result geometry, as CPV2-03 draws it — shown here as
            the state that follows the tap, not as one already running. */}
        <CatalogueBody view={CPV2_POSES['03-transcript']} transcribed />
      </View>
    </SafeAreaView>
  );
}
