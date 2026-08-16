import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import { OccasionInterrupt } from '@/components/today/occasion-interrupt';
import {
  FIXTURE_NOW,
  FIXTURE_OCCASION,
  FOUR_PIECE_OUTFIT,
  noImages,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-02 — the occasion interrupt
 *
 * The interrupt takes the tray, sits above the look it competes with, and
 * offers exactly one action — and it takes the frame's single oxblood, so the
 * plate's wear action falls back to ink (`accent={false}`). Because the
 * interrupt costs about 96 pt, the plate composes at four pieces on one row.
 */
export default function DevW3G2T02() {
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
      <OccasionInterrupt occasion={FIXTURE_OCCASION} now={FIXTURE_NOW} onDress={() => {}} />
      <View className="mt-6">
        <Plate
          outfit={FOUR_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked={false}
          accent={false}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
