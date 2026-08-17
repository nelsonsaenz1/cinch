import { useState } from 'react';

import { ClosetVisibilityPage } from '@/components/privacy/closet-visibility-page';
import {
  ALL_VISIBLE,
  type ClosetVisibility,
  type VisibilityFlag,
} from '@/features/privacy/visibility-flags';

/**
 * `cinch://dev-closet-visibility` — the four visibility switches, live.
 *
 * The real screen is behind sign-in, so this is how the control is looked at:
 * the same `ClosetVisibilityPage` the route renders, driven by local state
 * instead of the profile row. Nothing here is a copy of the page — a fixture
 * that redrew the screen would stop being evidence about it.
 *
 * What it is for: the state that only appears in combination. Turn the closet
 * off and the three stat switches must go inert with their labels at full
 * strength, because `friend_closet_meta` already nulls all three behind
 * `closet_hidden` and a live switch there would change nothing while claiming
 * otherwise. That is the frame worth checking at AX-XXXL.
 *
 * DS-07 rides the same fixture rather than a new one. It starts OFF, which is
 * its real default and the state a reviewer must see first — nothing on this
 * screen may suggest sharing is already on — and it is live, so the on
 * position and its longer state line are one tap away at any text size.
 */
export default function DevClosetVisibility() {
  const [visibility, setVisibility] = useState<ClosetVisibility>(ALL_VISIBLE);
  const [wornSharing, setWornSharing] = useState(false);

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
