/**
 * Invite fixture — one accepted frame, posed inert. Redesign 10.
 *
 * 05 · Link failed — arrivals still fine
 *
 * The pose comes from `features/invite/invite-10-fixtures.ts`, where every
 * callback is a no-op — so this route cannot raise a share sheet, write the
 * pasteboard, open a profile or reach the network however hard it is tapped.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { InvitePage } from '@/components/invite/invite-page';
import { Text } from '@/components/ui/text';
import { INVITE_10_POSES } from '@/features/invite/invite-10-fixtures';

export default function DevIv05LinkFailed() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return <InvitePage {...INVITE_10_POSES['05-link-failed']} />;
}
