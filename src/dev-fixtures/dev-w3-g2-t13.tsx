import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import {
  FIVE_PIECE_OUTFIT,
  FIXTURE_NOW,
  noImages,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-13 — reaction pending, on its own row
 *
 * The reaction takes effect immediately and the row shows it three ways at
 * once — ink fill, a tick, and the verb changing from "Love it" to "Loved" —
 * so the state does not depend on colour. The saving line sits under the row
 * rather than in a toast, and the row does not resize while the write is in
 * flight.
 */
export default function DevW3G2T13() {
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
        <Plate
          outfit={FIVE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked={false}
          reacted={{ liked: true, status: 'pending' }}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
