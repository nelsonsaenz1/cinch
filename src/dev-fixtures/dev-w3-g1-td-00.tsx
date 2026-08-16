/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TD-00, "Paywall dismissed —
 * Today, free closet intact".
 *
 * Where MB-07 lets go: "TD-00 with the free closet whole; nothing is locked by
 * the dismissal." It is a TODAY state and not a paywall surface — there is no
 * sheet, no price, no tier name and no second attempt to persuade anywhere in
 * this frame.
 *
 * THE RENDERING IS GROUP 2's, DELIBERATELY. `docs/ops/wave3-visual-acceptance-
 * matrix.md` resolves the two atlases that both draw this screen — "Landing |
 * TD-00, TD-00/AX | Canonical rendering belongs to Group 2; first-run
 * transition belongs to P1" — so the masthead and the plate here are exactly
 * T-01's, from the same fixtures, rather than a second drawing of the same
 * object. What P1 owns, and what this route exists to photograph, is the band
 * beneath them.
 *
 * THE CAPACITY NOTE IS THE STATE. "The capacity note is a fact in tray, not an
 * upgrade prompt — no price and no tier name one screen after a dismissed
 * paywall." Ten active pieces, the looks above built from them, and the one
 * thing that would change — carrying no action at all, because after a decline
 * there is nothing left to ask.
 *
 * Deterministic by construction: frozen clock, pinned activity dot, `noImages`,
 * and `still` on the plate so the landing is captured on its settled frame —
 * which is also the frame Reduce Motion produces, so one capture serves both.
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
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 72°F"
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
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
      {/* The free ceiling itself, never a literal ten: if the free closet ever
          moves, this frame moves with it. */}
      <CapacityNote activePieces={PLANS.free.items} plan="free" />
    </W3Frame>
  );
}
