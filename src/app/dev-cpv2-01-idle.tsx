/**
 * CPV2-01 fixture — the shipping `SearchHeader`, empty.
 *
 * The 56 pt square microphone beside the field is the thing to check: it is a
 * PEER of the text field inside the same labelled group, not a route on the
 * intake chooser and not a mode switch. Tapping it in the live screen takes the
 * frame to CPV2-02 in place.
 *
 * Inert: every callback is a no-op.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { SearchHeader } from '@/components/catalogue/search-header';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CPV2_POSES } from '@/features/catalogue/dev-fixtures';

export default function DevCpv2IdleScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader title="Find a product photo" onBack={() => {}} />
      <SearchHeader
        text=""
        onChangeText={() => {}}
        canSearch={false}
        onSubmit={() => {}}
        onSpeak={() => {}}
      />
      <View className="flex-1">
        <CatalogueBody view={CPV2_POSES['01-idle']} />
      </View>
    </SafeAreaView>
  );
}
