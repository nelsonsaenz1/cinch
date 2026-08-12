import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import { SlowNotice } from '@/components/today/plate-skeleton';
import {
  FIVE_PIECE_OUTFIT,
  FIXTURE_NOW,
  noImages,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-08 — slow — the notice is additive
 *
 * The garments resolved before the reasoning did, so they are shown as they
 * arrived rather than held behind the sentence. The notice appears UNDER the
 * same layout instead of replacing it, at six seconds
 * (`SLOW_NOTICE_MS`), and its escape hatch renders the plate with no rationale
 * and no apology.
 */
export default function DevW3G2T08() {
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
      <SlowNotice onShowAnyway={() => {}} />
      <View className="mt-6">
        <Plate
          outfit={FIVE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked={false}
          hideRationale
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
