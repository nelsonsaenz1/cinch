import { useRouter } from 'expo-router';

import { ClosetVisibilityPage } from '@/components/privacy/closet-visibility-page';
import { useSetWornSharing, useWornSharing } from '@/features/daily-social/use-worn-sharing';
import {
  useClosetVisibility,
  useSetClosetVisibility,
  type VisibilityFlag,
} from '@/features/privacy/use-closet-visibility';

/**
 * `/privacy/visibility` — the control for `profiles.closet_hidden` and the
 * three stat flags beside it.
 *
 * The columns and their enforcement shipped in 20260808110000; the migration
 * said the toggle would land "in a later Profile session" and it never did.
 * Until this route existed the read path was honouring flags no user could
 * reach, which is the wrong half of a privacy feature to ship first.
 *
 * No loading gate. The query answers all-visible until the row arrives, which
 * is today's default for every account, so the switches open in the position
 * they are overwhelmingly likely to hold and settle rather than flicker. A
 * spinner in front of four switches would be a worse lie than a half-second of
 * optimism, because it would suggest the settings are unknown when the default
 * is known exactly.
 *
 * DS-07 rides the same argument in the other direction: `worn_outfits_shared_
 * since` is null for every account that has never touched it, so the sharing
 * switch opens OFF while its read is in flight, which is both the overwhelming
 * likelihood and the safe half of the guess.
 */
export default function ClosetVisibilityRoute() {
  const router = useRouter();
  const { data: visibility } = useClosetVisibility();
  const setVisibility = useSetClosetVisibility();
  const { data: wornSharing } = useWornSharing();
  const setWornSharing = useSetWornSharing();

  const onChange = (flag: VisibilityFlag, visible: boolean) => {
    setVisibility.mutate({ flag, visible });
  };

  return (
    <ClosetVisibilityPage
      visibility={
        visibility ?? {
          closetVisible: true,
          piecesVisible: true,
          wearsVisible: true,
          costPerWearVisible: true,
        }
      }
      wornSharing={wornSharing ?? false}
      onChange={onChange}
      onWornSharingChange={(shared) => setWornSharing.mutate({ shared })}
      onBack={() => router.back()}
    />
  );
}
