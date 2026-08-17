import { useState } from 'react';

import { ClosetVisibilityPage } from '@/components/privacy/closet-visibility-page';
import {
  ALL_VISIBLE,
  type ClosetVisibility,
  type VisibilityFlag,
} from '@/features/privacy/visibility-flags';

/**
 * `cinch://dev-closet-visibility-hidden` — the closet switched off.
 *
 * The state worth its own frame. `friend_closet_meta` nulls all three stats
 * behind `closet_hidden`, so with the closet off those switches cannot change
 * anything — they are drawn `overridden`, remembering their positions, with the
 * labels at full strength and one sentence saying why. A control that stayed
 * live here would be claiming an effect it does not have.
 *
 * Drawn as its own fixture rather than by tapping the sibling, so the state is
 * reachable in one deep link and cannot be missed at review.
 *
 * DS-07 is inert here too, and for the matching reason: `friend_worn_outfits`
 * carries `not p.closet_hidden`, so with the closet off no look crosses however
 * that switch is set. It is drawn ON so the frame shows an overridden switch
 * that still remembers its position rather than one that merely looks off.
 */
export default function DevClosetVisibilityHidden() {
  const [visibility, setVisibility] = useState<ClosetVisibility>({
    ...ALL_VISIBLE,
    closetVisible: false,
  });
  const [wornSharing, setWornSharing] = useState(true);

  return (
    <ClosetVisibilityPage
      visibility={visibility}
      wornSharing={wornSharing}
      onChange={(flag: VisibilityFlag, visible: boolean) =>
        setVisibility((prev) => ({ ...prev, [flag]: visible }))
      }
      onWornSharingChange={setWornSharing}
      onBack={() => {}}
    />
  );
}
