import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  CAMERA_UNAVAILABLE_BODY,
  CAMERA_UNAVAILABLE_DESCRIBE,
  CAMERA_UNAVAILABLE_HELP,
  CAMERA_UNAVAILABLE_LIBRARY,
  CAMERA_UNAVAILABLE_TITLE,
} from '@/features/ingest/camera-copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * CP-04 — the camera door, on a binary that has no camera in it.
 *
 * "Named cause, two forward paths." The cause is one sentence, the two doors
 * that still work are BUTTONS rather than advice, and the help route sits last
 * as text because it leaves the app and is not what to do first.
 *
 * WHAT IS DELIBERATELY ABSENT: an Open Settings link. This is not a permission,
 * so there is no switch to send anybody to — that belongs to AC-02, which this
 * state is kept separate from precisely because the recovery differs. Also no
 * retry: nothing about tapping again changes which modules a binary carries.
 */
export function CameraUnavailable({
  onLibrary,
  onDescribe,
  onHelp,
}: {
  onLibrary: () => void;
  onDescribe: () => void;
  onHelp: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="px-gutter" accessibilityLabel={CAMERA_UNAVAILABLE_TITLE}>
      <Text variant="title" trim>
        {CAMERA_UNAVAILABLE_TITLE}
      </Text>
      {/* Cause, then what still works, then what is unaffected. No version
          number and no module name: neither would help, and both would read as
          a crash report handed to somebody who did nothing wrong. */}
      <Text variant="body" className="mt-4 text-muted">
        {CAMERA_UNAVAILABLE_BODY}
      </Text>

      {/* Peers. Both file into the same queue the camera would have fed, so
          neither is a consolation. */}
      <View className="mt-7 gap-2.5">
        <Button title={CAMERA_UNAVAILABLE_LIBRARY} onPress={onLibrary} />
        <Button title={CAMERA_UNAVAILABLE_DESCRIBE} variant="secondary" onPress={onDescribe} />
      </View>

      <Text
        accessibilityRole="button"
        accessibilityLabel={CAMERA_UNAVAILABLE_HELP}
        variant="note"
        onPress={onHelp}
        style={{ color: theme.accent, minHeight: MIN_TAP_TARGET }}
        className="mt-5 pt-3">
        {CAMERA_UNAVAILABLE_HELP}
      </Text>
    </View>
  );
}
