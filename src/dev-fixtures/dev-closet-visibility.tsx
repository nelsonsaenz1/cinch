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
 */
export default function DevClosetVisibility() {
  const [visibility, setVisibility] = useState<ClosetVisibility>(ALL_VISIBLE);

  return (
    <ClosetVisibilityPage
      visibility={visibility}
      onChange={(flag: VisibilityFlag, visible: boolean) =>
        setVisibility((prev) => ({ ...prev, [flag]: visible }))
      }
      onBack={() => {}}
    />
  );
}
