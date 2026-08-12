import { Masthead } from '@/app/(tabs)/index';
import { ClosetFloor } from '@/components/today/closet-floor';
import { FIXTURE_NOW, noImages, W3Frame } from '@/components/today/w3-g2-fixtures';

/**
 * DEV ONLY · Wave 3 atlas state T-10 — the empty closet
 *
 * No count is printed — "0 pieces" is not a sentence anybody should read —
 * and no commerce is offered: a closet with nothing in it has no computable
 * gap. Both intake doors are on the page, in the same order and weights the
 * hallway gives them. The number asked for is `PLANS.free.items`, never a
 * literal.
 */
export default function DevW3G2T10() {
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
        items={[]}
        remaining={8}
        resolveImage={noImages}
        onStart={() => {}}
        onDescribe={() => {}}
      />
    </W3Frame>
  );
}
