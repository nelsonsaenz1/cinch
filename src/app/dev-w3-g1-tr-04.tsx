/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TR-04, "Skipped — where Skip
 * lands".
 *
 * The frame the tour hands to when the reader skips it, and the state the atlas
 * drew precisely because the destination had never been in one: "Skip lands on
 * Today's empty state, not on a dead end — and both intake doors are still
 * reachable from it, in the same order and the same weights they had on the
 * choice screen. No count is printed here: zero is quiet."
 *
 * ALL THREE OF THOSE ARE BEHAVIOUR, NOT DRAWING, AND ALL THREE ALREADY HOLD.
 * `exitDestination('tabs', …)` in `features/onboarding/tour-state.ts` returns
 * `/(tabs)`, and Today's `!canGenerate(items)` branch renders `ClosetFloor`,
 * whose empty cut is this frame word for word — "Start your closet" filled,
 * "Describe it out loud instead" outlined beneath it, and no "0 pieces"
 * anywhere. This route photographs that branch in isolation.
 *
 * WHY THE MASTHEAD CARRIES NO NAME AND NO TEMPERATURE. The frame prints "Thu 7
 * Aug · Denver" and "Good morning" — no name, because an account that has just
 * skipped the tour usually has none to greet (`useFirstName` returns null
 * rather than guessing one out of an email address), and no temperature,
 * because a known-unknown is omitted rather than estimated. Both are the
 * masthead's own defaults, passed explicitly so the capture is a picture of the
 * arrangement rather than of whatever the simulator happened to know.
 *
 * Deterministic by construction: `FIXTURE_NOW` for the date line, `unseen`
 * pinned so the activity dot cannot depend on a round trip landing before the
 * shutter, `noImages` so no cell fetches a byte, and an empty closet, which has
 * no motion in it at all.
 */

import { Masthead } from '@/app/(tabs)/index';
import { ClosetFloor } from '@/components/today/closet-floor';
import { FIXTURE_NOW, noImages, W3Frame } from '@/components/today/w3-g2-fixtures';
import { MIN_CLOSET_FOR_OUTFITS } from '@/features/styling/thresholds';

export default function Fixture() {
  return (
    <W3Frame>
      <Masthead city="Denver" name={null} weather={null} now={FIXTURE_NOW} unseen={false} stacked={false} />
      <ClosetFloor
        items={[]}
        remaining={MIN_CLOSET_FOR_OUTFITS}
        resolveImage={noImages}
        onStart={() => {}}
        onDescribe={() => {}}
      />
    </W3Frame>
  );
}
