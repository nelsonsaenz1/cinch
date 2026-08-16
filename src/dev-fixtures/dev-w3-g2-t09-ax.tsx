import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import { OFFLINE_ACTIONS_REASON, OfflineNotice } from '@/components/today/offline-notice';
import {
  FIVE_PIECE_OUTFIT,
  FIXTURE_NOW,
  noImages,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-09/AX — offline at the largest type
 *
 * The unavailable controls are REMOVED rather than stacked as inert 60 pt
 * bars — three dead controls at this size would push everything else off the
 * screen — and the sentence that explained the disabling now explains the
 * absence. That is a change in composition, which the accessibility contract
 * allows, not a cap on the type scale, which it does not.
 */
export default function DevW3G2T09Ax() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather={null}
        now={FIXTURE_NOW}
        unseen={false}
        stacked
      />
      <OfflineNotice onRetry={() => {}} />
      <View className="mt-5">
        <Plate
          outfit={FIVE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked
          offline
          dated="Closet as of Wed 5 Aug"
          actionsUnavailable={OFFLINE_ACTIONS_REASON}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </W3Frame>
  );
}
