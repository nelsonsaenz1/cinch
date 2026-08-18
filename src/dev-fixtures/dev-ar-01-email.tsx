import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atlas, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import {
  RunButton,
  RunField,
  RunFieldError,
  RunHeader,
  RunPrompt,
  RunSubline,
  TroubleCard,
} from '@/components/auth/run-parts';
import {
  EMAIL_CTA,
  EMAIL_CTA_SENDING,
  EMAIL_FIELD_LABEL,
  EMAIL_HEADLINE,
  EMAIL_INVALID,
  EMAIL_PLACEHOLDER,
  EMAIL_STEP,
  EMAIL_SUBLINE,
  LEGAL_PREFIX,
  LEGAL_SIZE,
  PAD,
  showsOwnCta,
} from '@/features/auth/auth-run-spec';
import { EMAIL_POSES, emailFrame, type EmailPose } from '@/features/auth/auth-run-fixtures';
import { PosePicker, linkedPose } from '@/dev-fixtures/pose-picker';

/**
 * DEV ONLY · AR-01 — redesign 19, step one in all seven drawn states.
 *
 * Deep-linkable: `cinch:///dev-ar-01-email?pose=rate-limited`. Not a
 * convenience — `simctl` opens URLs and cannot tap, so a state that only a
 * finger can reach has no reproducible evidence. `?chrome=off` drops the
 * picker, which is how the frame is photographed at the accessibility sizes
 * where the picker alone fills the viewport.
 *
 * It draws the SHIPPING parts with posed state, never copies of them, so a
 * fixture that looks right is evidence about the screen.
 */
export default function DevAr01Email() {
  const params = useLocalSearchParams<{ pose?: string; chrome?: string }>();
  const chrome = params.chrome !== 'off';
  const linked = linkedPose(EMAIL_POSES, params.pose, 'empty');

  // The URL is the source of truth; a tap is an override the URL clears.
  const [pose, setPose] = useState<EmailPose>(linked);
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

  const frame = emailFrame(pose);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper }}>
      <SafeAreaView edges={['top']}>
        <RunHeader step={EMAIL_STEP} onBack={() => {}} backDisabled={frame.sending} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={EMAIL_HEADLINE}>
          <RunSubline>{EMAIL_SUBLINE}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 26 }}>
          <RunField
            tone={frame.tone}
            value={frame.value}
            editable={false}
            placeholder={EMAIL_PLACEHOLDER}
            accessibilityLabel={EMAIL_FIELD_LABEL}
          />
        </View>

        {frame.invalid ? <RunFieldError>{EMAIL_INVALID}</RunFieldError> : null}

        {frame.trouble ? (
          <View style={{ marginTop: 16 }}>
            <TroubleCard trouble={frame.trouble} onAction={() => {}} />
          </View>
        ) : null}

        {showsOwnCta(frame.trouble) ? (
          <View style={{ marginTop: 16 }}>
            <RunButton
              label={frame.sending ? EMAIL_CTA_SENDING : EMAIL_CTA}
              onPress={() => {}}
              disabled={!frame.armed}
              busy={frame.sending}
            />
          </View>
        ) : null}

        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 14,
            fontFamily: 'HelveticaNeue',
            fontSize: LEGAL_SIZE,
            lineHeight: 20,
            color: atlas.muted,
          }}>
          {LEGAL_PREFIX}
          <RNText style={{ color: atlas.oxblood, textDecorationLine: 'underline' }}>Terms</RNText>
          {' and '}
          <RNText style={{ color: atlas.oxblood, textDecorationLine: 'underline' }}>
            Privacy Policy
          </RNText>
          .
        </RNText>

        {chrome ? <PosePicker poses={EMAIL_POSES} pose={pose} onPick={setPose} /> : null}
      </ScrollView>
    </View>
  );
}
