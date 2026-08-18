import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atlas } from '@/components/auth/chrome';
import {
  RunButton,
  RunField,
  RunHeader,
  RunPrompt,
  RunSubline,
  TroubleCard,
} from '@/components/auth/run-parts';
import {
  NAME_CTA,
  NAME_CTA_SAVING,
  NAME_FIELD_LABEL,
  NAME_HEADLINE,
  NAME_PLACEHOLDER,
  NAME_STEP,
  NAME_SUBLINE,
  PAD,
  showsOwnCta,
} from '@/features/auth/auth-run-spec';
import { NAME_POSES, nameFrame, type NamePose } from '@/features/auth/auth-run-fixtures';
import { PosePicker, linkedPose } from '@/dev-fixtures/pose-picker';

/**
 * DEV ONLY · AR-03 — redesign 19, step three.
 *
 * Deep-linkable: `cinch:///dev-ar-03-name?pose=failed`.
 *
 * The header here draws the progress bar with no back well, which is the frame
 * and also the truth: the account exists by the time this screen is reached and
 * there is nothing behind it to return to.
 */
export default function DevAr03Name() {
  const params = useLocalSearchParams<{ pose?: string; chrome?: string }>();
  const chrome = params.chrome !== 'off';
  const linked = linkedPose(NAME_POSES, params.pose, 'empty');

  const [pose, setPose] = useState<NamePose>(linked);
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

  const frame = nameFrame(pose);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper }}>
      <SafeAreaView edges={['top']}>
        <RunHeader step={NAME_STEP} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={NAME_HEADLINE}>
          <RunSubline>{NAME_SUBLINE}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 26 }}>
          <RunField
            tone={frame.tone}
            value={frame.value}
            editable={false}
            placeholder={NAME_PLACEHOLDER}
            accessibilityLabel={NAME_FIELD_LABEL}
          />
        </View>

        {frame.trouble ? (
          <View style={{ marginTop: 16 }}>
            <TroubleCard trouble={frame.trouble} onAction={() => {}} />
          </View>
        ) : null}

        {showsOwnCta(frame.trouble) ? (
          <View style={{ marginTop: 16 }}>
            <RunButton
              label={frame.saving ? NAME_CTA_SAVING : NAME_CTA}
              onPress={() => {}}
              disabled={!frame.armed}
              busy={frame.saving}
            />
          </View>
        ) : null}

        {chrome ? <PosePicker poses={NAME_POSES} pose={pose} onPick={setPose} /> : null}
      </ScrollView>
    </View>
  );
}
