/**
 * Invite fixture — one accepted frame, posed inert. Redesign 10.
 *
 * 12 · Share unavailable — copy promoted
 *
 * The pose comes from `features/invite/invite-10-fixtures.ts`, where every
 * callback is a no-op — so this route cannot raise a share sheet, write the
 * pasteboard, open a profile or reach the network however hard it is tapped.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { InvitePage } from '@/components/invite/invite-page';
import { Text } from '@/components/ui/text';
import { INVITE_10_POSES } from '@/features/invite/invite-10-fixtures';

export default function DevIv12ShareUnavailable() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return <InvitePage {...INVITE_10_POSES['12-share-unavailable']} />;
}
