/**
 * A CPV2 fixture route. Generated shape, one per frame, so that adding a state
 * to the atlas means adding a pose and a file rather than editing a switch.
 *
 * INERT BY CONSTRUCTION. The pose it renders comes from
 * `features/catalogue/dev-fixtures.ts`, where every callback is a no-op, so
 * this route cannot spend a metered catalogue request or write a closet row
 * however hard it is tapped. That is the whole point of the seam: Codex walks
 * all fifteen of these against production data shapes without touching
 * production.
 */

import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { Text } from '@/components/ui/text';
import { CPV2_POSES } from '@/features/catalogue/dev-fixtures';

export default function DevCpv2Screen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="px-gutter pb-3 pt-2">
        <Text variant="eyebrow">CPV2-09 · Not in the catalogue</Text>
      </View>
      <View className="flex-1">
        <CatalogueBody view={CPV2_POSES['09-no-match']} />
      </View>
    </SafeAreaView>
  );
}
