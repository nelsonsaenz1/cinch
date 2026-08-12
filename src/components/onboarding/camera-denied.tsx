import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CAMERA_DENIED, cameraDeniedKeepLine } from '@/features/onboarding/ten-copy';

/**
 * T-05 — the camera is switched off for Cinch.
 *
 * A DENIED PERMISSION IS A FORK, NOT A WALL. The loudest action is the one that
 * needs no permission at all: the library picker runs out of process, which is
 * why `app.config.ts` suppresses `NSPhotoLibraryUsageDescription`, so it can be
 * offered to somebody who has just refused a prompt without asking them for
 * anything. Settings is offered second because it leaves the app, and the voice
 * door third because it is a different flow entirely.
 *
 * THE COUNT STAYS IN THE MASTHEAD. This is rendered under The Ten's own
 * masthead rather than replacing the screen, so the work already done is
 * visible from the failure — and the closing sentence names what is kept, which
 * is the same "nothing is silently lost" rule the decline sheet relies on.
 */
export function CameraDenied({
  filled,
  onLibrary,
  onSettings,
  onVoice,
}: {
  /** How many of the ten are already photographed. Zero prints nothing. */
  filled: number;
  onLibrary: () => void;
  onSettings: () => void;
  onVoice: () => void;
}) {
  const keepLine = cameraDeniedKeepLine(filled);

  return (
    <View accessibilityRole="alert">
      <View style={{ marginBottom: 10 }}>
        <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 30 }}>
          {CAMERA_DENIED.headline}
        </Text>
      </View>
      <Text variant="note" style={{ fontSize: 16, lineHeight: 25 }}>
        {CAMERA_DENIED.body}
      </Text>
      <View style={{ marginTop: 20, gap: 10 }}>
        <Button title={CAMERA_DENIED.library} onPress={onLibrary} className="self-stretch" />
        <Button
          title={CAMERA_DENIED.settings}
          variant="secondary"
          onPress={onSettings}
          className="self-stretch"
        />
        <Button
          title={CAMERA_DENIED.voice}
          variant="ghost"
          onPress={onVoice}
          className="self-stretch"
        />
      </View>
      {keepLine ? (
        <Text variant="note" style={{ fontSize: 14, marginTop: 16 }}>
          {keepLine}
        </Text>
      ) : null}
    </View>
  );
}
