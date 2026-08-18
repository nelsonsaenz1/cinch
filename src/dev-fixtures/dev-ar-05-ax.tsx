import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atlas } from '@/components/auth/chrome';
import {
  CodeBoxes,
  RunButton,
  RunHeader,
  RunPrompt,
  RunStatus,
  RunSubline,
} from '@/components/auth/run-parts';
import {
  BOX_BLEED,
  CODE_HEADLINE,
  CODE_LENGTH,
  CODE_RESEND_ACTION,
  CODE_RESEND_PROMPT,
  CODE_STEP,
  PAD,
  codeColumns,
  sentToLine,
} from '@/features/auth/auth-run-spec';
import { CODE_POSES, FIXTURE_EMAIL, codeFrame, type CodePose } from '@/features/auth/auth-run-fixtures';
import { PosePicker, linkedPose } from '@/dev-fixtures/pose-picker';

/**
 * DEV ONLY · AR-05 — redesign 19 at the largest accessibility text size.
 *
 * Deep-linkable: `cinch:///dev-ar-05-ax?pose=wrong&chrome=off`.
 *
 * The composition change, forced rather than waited for. The wrap and the
 * promoted resend button are what the shipping screen does above
 * `AX_STACK_SCALE`; here they are drawn unconditionally, because the iOS text
 * slider cannot be set from a deep link and a frame nobody can reach on demand
 * is a frame nobody checks.
 *
 * Set the device slider to AX-XXXL as well to see the real thing: this fixture
 * pins the LAYOUT decision, and the type only grows for real when the system
 * says so.
 */
export default function DevAr05Ax() {
  const params = useLocalSearchParams<{ pose?: string; chrome?: string }>();
  const chrome = params.chrome !== 'off';
  const linked = linkedPose(CODE_POSES, params.pose, 'empty');

  const [pose, setPose] = useState<CodePose>(linked);
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

  const frame = codeFrame(pose);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => frame.value[i]);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper }}>
      <SafeAreaView edges={['top']}>
        <RunHeader step={CODE_STEP} onBack={() => {}} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={CODE_HEADLINE}>
          <RunSubline>{sentToLine(FIXTURE_EMAIL)}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 24, marginHorizontal: -BOX_BLEED }}>
          <CodeBoxes
            digits={digits}
            tone={frame.tone}
            activeIndex={frame.activeIndex}
            // The whole point of this fixture: three columns, not six.
            columns={codeColumns(true)}
            onPress={() => {}}
          />
        </View>

        <View style={{ marginTop: 16, gap: 10 }}>
          <RunStatus>{CODE_RESEND_PROMPT}</RunStatus>
          <RunButton label={CODE_RESEND_ACTION} onPress={() => {}} large />
        </View>

        {chrome ? <PosePicker poses={CODE_POSES} pose={pose} onPick={setPose} /> : null}
      </ScrollView>
    </View>
  );
}
