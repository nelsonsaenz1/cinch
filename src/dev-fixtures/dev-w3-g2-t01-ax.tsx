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
 * DEV ONLY · Wave 3 atlas state T-01/AX — the normal day at the largest type
 *
 * The greeting is dropped — "a name the user already knows is the first thing
 * worth spending to keep the outfit above the fold" — and the context label
 * breaks over two lines rather than truncating. The three actions stack at
 * 60 pt in the same order, the wear action still filled. Nothing is capped and
 * nothing is ellipsised.
 *
 * Capture this route at the largest Dynamic Type setting; `stacked` is passed
 * explicitly so the composition is the AX one whatever the simulator is set
 * to, and the capture is a picture of the arrangement rather than of the
 * device's settings.
 */
export default function DevW3G2T01Ax() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 72°F, mild"
        now={FIXTURE_NOW}
        unseen={false}
        stacked
      />
      <View className="mt-6">
        <Plate
          outfit={FIVE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
