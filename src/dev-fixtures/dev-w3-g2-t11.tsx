import { Masthead } from '@/app/(tabs)/index';
import { ClosetFloor } from '@/components/today/closet-floor';
import {
  FIXTURE_NOW,
  noImages,
  PARTIAL_CLOSET,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-11 — a partial closet, under the engine floor
 *
 * What is missing comes from `missingForFirstOutfit`, the same routine the
 * Reveal's zero state uses, so the two screens can never disagree about what a
 * first outfit needs. The sentence names the two KINDS of garment, which is
 * actionable, rather than the engine's internal floor, which is not. The
 * pieces already photographed are shown at full size: this is a closet that is
 * working, not a warning.
 */
export default function DevW3G2T11() {
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
      <ClosetFloor
        items={PARTIAL_CLOSET}
        remaining={2}
        resolveImage={noImages}
        onStart={() => {}}
        onDescribe={() => {}}
      />
    </W3Frame>
  );
}
