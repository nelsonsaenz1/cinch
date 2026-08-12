import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import {
  FIXTURE_NOW,
  noImages,
  THREE_PIECE_OUTFIT,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-03 — a piece with no price
 *
 * The boots were photographed without a price, so cost-per-wear is not
 * computable for this look and THE LINE IS SIMPLY ABSENT — no dash, no "—", no
 * estimate. The palette row still prints, because colour is known. Three
 * pieces compose as two-up plus a full-width piece rather than leaving a blank
 * cell.
 */
export default function DevW3G2T03() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 58°F, 60% rain"
        now={FIXTURE_NOW}
        unseen={false}
        stacked={false}
      />
      <View className="mt-6">
        <Plate
          outfit={THREE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked={false}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
