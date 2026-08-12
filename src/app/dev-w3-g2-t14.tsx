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
 * DEV ONLY · Wave 3 atlas state T-14 — worn, saved — and what it changed
 *
 * The action row is REPLACED rather than disabled, because after the decision
 * there is no decision left to offer. The consequence is named as a number of
 * counts — derived from the pieces in the look, which is exactly what
 * `wear_outfit_tx` increments — and the 24-hour edit window is stated at the
 * moment it starts. No oxblood: nothing is left to do.
 */
export default function DevW3G2T14() {
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
          worn
          wornBand={{ onUndo: () => {}, onAddNote: () => {} }}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
