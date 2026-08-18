/**
 * Profile fixture — one accepted frame, posed inert. Redesign 07.
 *
 * 01 · Default — standard plan
 *
 * Rails bleed right; the marks are marks, not a table; the plan door is one row.
 *
 * The pose comes from `features/profile/profile-fixtures.ts`, where every
 * callback is a no-op, so this route cannot open a paywall, a sheet, the
 * friends list or a garment however hard it is tapped. That seam is what lets
 * the accepted frames be walked and photographed against the artifact without a
 * session, a network or a single row in `items`.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileBody } from '@/components/profile/profile-body';
import { Text } from '@/components/ui/text';
import { PROFILE_POSES } from '@/features/profile/profile-fixtures';

export default function DevPf01Default() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ProfileBody view={PROFILE_POSES['01-default']} large={false} />
    </SafeAreaView>
  );
}
