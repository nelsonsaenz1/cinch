import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atlas } from '@/components/auth/chrome';
import {
  CodeBoxes,
  RunBusyRow,
  RunHeader,
  RunInlineAction,
  RunPrompt,
  RunStatus,
  RunSubline,
  TroubleCard,
} from '@/components/auth/run-parts';
import {
  BOX_BLEED,
  CODE_CHANGE,
  CODE_CHECKING,
  CODE_HEADLINE,
  CODE_LENGTH,
  CODE_RESENDING,
  CODE_RESEND_ACTION,
  CODE_RESEND_PROMPT,
  CODE_STEP,
  PAD,
  codeColumns,
  cooldownLine,
  resentToLine,
  sentToLine,
  wrongCodeLine,
} from '@/features/auth/auth-run-spec';
import {
  CODE_POSES,
  FIXTURE_EMAIL,
  codeFrame,
  type CodePose,
} from '@/features/auth/auth-run-fixtures';
import { PosePicker, linkedPose } from '@/dev-fixtures/pose-picker';

/**
 * DEV ONLY · AR-02 — redesign 19, step two.
 *
 * Deep-linkable: `cinch:///dev-ar-02-code?pose=expired`.
 *
 * Eight poses against the frames' six, and the two extras are the point. The
 * approved set draws two tries left but never zero, and never the moment a
 * resend is in flight — both are states the shipped machinery can reach, and a
 * state that is reachable and undrawn is where copy goes wrong unwatched.
 */
export default function DevAr02Code() {
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
        <RunHeader step={CODE_STEP} onBack={() => {}} backDisabled={frame.verifying} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={CODE_HEADLINE}>
          <RunSubline>
            {frame.cooldown != null ? resentToLine(FIXTURE_EMAIL) : sentToLine(FIXTURE_EMAIL)}
          </RunSubline>
        </RunPrompt>

        {frame.canChangeEmail ? (
          <View style={{ marginTop: 2 }}>
            <RunInlineAction label={CODE_CHANGE} onPress={() => {}} />
          </View>
        ) : null}

        <View
          style={{
            marginTop: frame.canChangeEmail ? 6 : 24,
            marginHorizontal: -BOX_BLEED,
          }}>
          <CodeBoxes
            digits={digits}
            tone={frame.tone}
            activeIndex={frame.activeIndex}
            columns={codeColumns(false)}
            onPress={() => {}}
          />
        </View>

        <View style={{ marginTop: 16, gap: 12 }}>
          {frame.verifying ? <RunBusyRow label={CODE_CHECKING} /> : null}
          {frame.wrong ? (
            <RunStatus tone="refused">{wrongCodeLine(frame.attemptsLeft)}</RunStatus>
          ) : null}
          {frame.trouble ? <TroubleCard trouble={frame.trouble} onAction={() => {}} /> : null}
          {!frame.verifying && frame.trouble == null ? (
            frame.cooldown != null ? (
              <RunStatus>{cooldownLine(frame.cooldown)}</RunStatus>
            ) : frame.resending ? (
              <RunStatus>{CODE_RESENDING}</RunStatus>
            ) : (
              <RunInlineAction
                prompt={CODE_RESEND_PROMPT}
                label={CODE_RESEND_ACTION}
                onPress={() => {}}
              />
            )
          ) : null}
        </View>

        {chrome ? <PosePicker poses={CODE_POSES} pose={pose} onPick={setPose} /> : null}
      </ScrollView>
    </View>
  );
}
