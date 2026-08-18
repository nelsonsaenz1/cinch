import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atlas, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import { RunDots } from '@/components/auth/run-parts';
import {
  HEADLINE_SIZE,
  PAD,
  SUBLINE_SIZE,
  handoffHeadline,
  handoffSubline,
} from '@/features/auth/auth-run-spec';
import { HANDOFF_POSES, handoffFrame, type HandoffPose } from '@/features/auth/auth-run-fixtures';
import { PosePicker, linkedPose } from '@/dev-fixtures/pose-picker';
import { leading } from '@/theme/font-metrics';

const HEADLINE_LEADING = leading('instrument', HEADLINE_SIZE, 1.12);

/**
 * DEV ONLY · AR-04 — redesign 19, the arrival.
 *
 * Deep-linkable: `cinch:///dev-ar-04-handoff?pose=returning`.
 *
 * The real screen holds this frame for a beat and then replaces itself, which
 * is exactly long enough to be impossible to photograph. Here it simply stays.
 * The third pose — a returning greeting with no name — is the fallback the
 * screen takes when the session read fails, and it exists here because it is
 * the one arrival state no frame was drawn for.
 */
export default function DevAr04Handoff() {
  const params = useLocalSearchParams<{ pose?: string; chrome?: string }>();
  const chrome = params.chrome !== 'off';
  const linked = linkedPose(HANDOFF_POSES, params.pose, 'new');

  const [pose, setPose] = useState<HandoffPose>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPose(linked);
  }

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <RNText>Not available.</RNText>
      </SafeAreaView>
    );
  }

  const { isNew, name } = handoffFrame(pose);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: atlas.oxblood,
        paddingHorizontal: PAD,
        justifyContent: 'center',
      }}>
      <RNText
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
        style={{
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: HEADLINE_SIZE,
          lineHeight: HEADLINE_LEADING,
          color: atlas.cream,
        }}>
        {handoffHeadline(isNew, name)}
      </RNText>
      <RNText
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          marginTop: 12,
          fontFamily: 'HelveticaNeue',
          fontSize: SUBLINE_SIZE,
          lineHeight: 24,
          color: 'rgba(243,240,233,0.72)',
        }}>
        {handoffSubline(isNew)}
      </RNText>
      <View style={{ marginTop: 22 }}>
        <RunDots onFill />
      </View>

      {chrome ? <PosePicker poses={HANDOFF_POSES} pose={pose} onPick={setPose} /> : null}
    </View>
  );
}
