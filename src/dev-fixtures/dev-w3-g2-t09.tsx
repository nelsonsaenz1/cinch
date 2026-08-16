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
 * DEV ONLY · Wave 3 atlas state T-09 — offline — a usable plate, honestly labelled
 *
 * The context label DROPS the temperature entirely rather than showing a
 * stale one. The plate carries the date of the closet it was built from, so
 * what may be stale is verifiable on the object. The three actions are drawn
 * as tray fills with secondary-ink labels — inert by ground, never by
 * faintness — and the sentence beneath names why.
 *
 * Deviation, recorded here because the frame shows it: the atlas draws the
 * wear action LIVE, on the promise that it is "saved here and sent when you
 * are back". This app has no such queue, so the control is unavailable with a
 * reason rather than a promise it cannot keep.
 */
export default function DevW3G2T09() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather={null}
        now={FIXTURE_NOW}
        unseen={false}
        stacked={false}
      />
      <OfflineNotice onRetry={() => {}} />
      <View className="mt-5">
        <Plate
          outfit={FIVE_PIECE_OUTFIT}
          index={1}
          colophon={{ city: 'Denver' }}
          resolveImage={noImages}
          still
          stacked={false}
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
