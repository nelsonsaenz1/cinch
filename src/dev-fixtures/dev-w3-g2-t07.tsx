import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { PlateSkeleton } from '@/components/today/plate-skeleton';
import { FIXTURE_NOW, W3Frame } from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-07 — loading — the skeleton mirrors the plate
 *
 * The masthead is real, because date, place and weather are known before the
 * look is. Every skeleton block is the height and radius of the element it
 * stands in for, laid out by the same `plateGrid()` the real plate uses, so
 * nothing reflows when the look arrives. No spinner and no percentage; `still`
 * freezes the pulse, which is also exactly what Reduce Motion does.
 */
export default function DevW3G2T07() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 72°F, mild"
        now={FIXTURE_NOW}
        unseen={false}
        stacked={false}
      />
      <View className="mt-6">
        <PlateSkeleton pieces={5} still />
      </View>
    </W3Frame>
  );
}
