/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TD-00 / AX, "Today's three
 * reactions at largest type".
 *
 * The frame audit 59 was raised against, answered at the size that produced it:
 * "Three reactions stack at full width rather than shrinking to fit a row; the
 * wear action stays first and stays filled, so the dominant action survives the
 * reflow. The rationale paragraph and the garment list scroll out of the first
 * viewport rather than truncating — the outfit name and one action remain
 * visible without scrolling."
 *
 * The greeting is dropped and the context label breaks over two lines, which is
 * the masthead's own AX composition (`contextLines`), not a second layout: a
 * name the reader already knows is the first thing worth spending to keep the
 * outfit above the fold.
 *
 * The capacity note needs no AX cut of its own — it is two wrapping paragraphs
 * in a tray band with no horizontal row to break, so larger type is answered
 * with height, which is what the group's Dynamic Type rule asks for.
 *
 * Capture this route at the largest Dynamic Type setting. `stacked` is passed
 * explicitly on both the masthead and the plate so the composition is the AX
 * one whatever the simulator is set to.
 */

import { View } from 'react-native';

import { Masthead } from '@/app/(tabs)/index';
import { CapacityNote } from '@/components/today/capacity-note';
import { Plate } from '@/components/today/plate';
import {
  FIVE_PIECE_OUTFIT,
  FIXTURE_NOW,
  noImages,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';
import { PLANS } from '@/features/billing/plans';

export default function Fixture() {
  return (
    <W3Frame>
      <Masthead city="Denver" name="Maya" weather="Feels 72°F" now={FIXTURE_NOW} unseen={false} stacked />
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
      <CapacityNote activePieces={PLANS.free.items} plan="free" />
    </W3Frame>
  );
}
