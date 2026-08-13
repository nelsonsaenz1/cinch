import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text as RNText, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  atlas,
  AuthHeader,
  MAX_DISPLAY_SCALE,
  MAX_TEXT_SCALE,
  PillSpinner,
  PRIVACY_URL,
  TERMS_URL,
} from '@/components/auth/chrome';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { sendEmailCode } from '@/features/auth/actions';
import { isValidEmail, normalizeEmail } from '@/features/auth/email';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/** W-12's two sentences — the only copy the tray callout ever shows, plus a
 * thrown storage failure, which must surface rather than be silent. */
const SEND_FAILED_COPY =
  'We couldn’t send the code just now. This is on us, not you — try again in a moment.';
const RATE_LIMITED_COPY = 'Too many codes requested. Try again in five minutes.';

const SEND_TIMEOUT_MS = 8000;

const LABEL_STYLE = {
  fontFamily: 'HelveticaNeue',
  fontSize: 9,
  letterSpacing: 9 * 0.2,
  textTransform: 'uppercase' as const,
} as const;

function LegalLink({ label, url }: { label: string; url: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <RNText
      accessibilityRole="link"
      suppressHighlighting
      onPress={() => void Linking.openURL(url)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ color: pressed ? '#8a3a35' : atlas.oxblood }}>
      {label}
    </RNText>
  );
}

/**
 * W-04…07 and W-12: the address, on paper. One field, one button, and a label
 * line that becomes the error line rather than adding a row — nothing below
 * ever moves. Validation runs on blur or submit only, never per keystroke.
 */
export default function EmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'failed'>('idle');
  const [failCopy, setFailCopy] = useState(SEND_FAILED_COPY);
  const fieldRef = useRef<TextInput>(null);

  const armed = isValidEmail(email);
  const sending = status === 'sending';

  // The Continue pill fills to ink over 180ms the moment the address first
  // parses (W-05). Under Reduce Motion the fill is instant.
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(armed ? 1 : 0, { duration: reduced ? 0 : 180 });
  }, [armed, reduced, fill]);
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [atlas.pillDisabled, atlas.ink]),
  }));

  const validateNow = useCallback(() => {
    setInvalid(email.trim().length > 0 && !isValidEmail(email));
  }, [email]);

  const onSubmit = useCallback(async () => {
    if (sending) return;
    if (!isValidEmail(email)) {
      setInvalid(true);
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    setInvalid(false);
    setStatus('sending');
    try {
      // An open request past 8s falls into W-12 — the button must never sit
      // on "Sending" forever.
      const result = await Promise.race([
        sendEmailCode(email),
        new Promise<{ ok: false; reason: 'failed' }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: 'failed' }), SEND_TIMEOUT_MS),
        ),
      ]);
      if (result.ok) {
        setStatus('idle');
        router.push({ pathname: '/(auth)/code', params: { email: normalizeEmail(email) } });
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFailCopy(result.reason === 'rate-limited' ? RATE_LIMITED_COPY : SEND_FAILED_COPY);
      setStatus('failed');
    } catch (err) {
      // Thrown, not returned — the storage layer escaping. Surface it.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFailCopy(describeThrownSignInError(err));
      setStatus('failed');
    }
  }, [email, sending, router]);

  const labelInvalid = invalid && !sending;

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <AuthHeader onBack={() => router.back()} backDisabled={sending} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 34, paddingTop: 40, paddingBottom: 40 }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 36,
            lineHeight: 40,
            color: atlas.ink,
          }}>
          What’s your email?
        </RNText>
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 12,
            fontFamily: 'HelveticaNeue',
            fontSize: 15,
            lineHeight: 23,
            color: atlas.muted,
          }}>
          We’ll send a six-digit code. No password to remember, ever.
        </RNText>

        <TextInput
          ref={fieldRef}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            // Only CLEARING here — flagging waits for blur or submit.
            if (invalid) setInvalid(false);
          }}
          onBlur={validateNow}
          onSubmitEditing={() => void onSubmit()}
          editable={!sending}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          placeholder="you@example.com"
          placeholderTextColor="#B4AFA3"
          selectionColor={atlas.oxblood}
          accessibilityLabel="Email address"
          style={{
            marginTop: 36,
            paddingBottom: 10,
            paddingTop: 0,
            minHeight: MIN_TAP_TARGET,
            borderBottomWidth: 1.5,
            borderBottomColor: labelInvalid
              ? atlas.oxblood
              : sending
                ? 'rgba(28,26,22,0.3)'
                : atlas.ink,
            fontFamily: 'HelveticaNeue',
            fontSize: 20,
            color: sending ? atlas.label : atlas.ink,
          }}
        />
        {/* The label line IS the error line — it swaps, nothing below moves. */}
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          style={{
            marginTop: 12,
            ...LABEL_STYLE,
            color: labelInvalid ? atlas.oxblood : atlas.label,
          }}>
          {labelInvalid ? 'That address is missing something' : 'Email address'}
        </RNText>

        {status === 'failed' ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              marginTop: 22,
              backgroundColor: atlas.callout,
              borderLeftWidth: 2,
              borderLeftColor: atlas.oxblood,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: 13,
                lineHeight: 20,
                color: atlas.calloutText,
              }}>
              {failCopy}
            </RNText>
          </View>
        ) : null}

        <Pressable
          onPress={() => void onSubmit()}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel={status === 'failed' ? 'Try again' : 'Continue'}
          accessibilityState={{ disabled: sending, busy: sending }}
          style={{ marginTop: status === 'failed' ? 18 : 30 }}>
          <Animated.View
            style={[
              {
                minHeight: Math.max(MIN_TAP_TARGET, 51),
                // 12, not 32. §1.3 of the Refacing: a labelled control is `md`,
                // full stop — `full` and everything approaching it belongs to
                // circles. At 51pt tall a 32 radius is a capsule in all but
                // name, and this page's dialect (§3.1) covers its voice and
                // spacing, not its shape.
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                paddingVertical: 17,
                paddingHorizontal: 16,
              },
              pillStyle,
              sending ? { backgroundColor: atlas.ink } : null,
            ]}>
            {sending ? <PillSpinner /> : null}
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: 15,
                color: armed || sending ? atlas.cream : atlas.pillDisabledLabel,
              }}>
              {sending ? 'Sending' : status === 'failed' ? 'Try again' : 'Continue'}
            </RNText>
          </Animated.View>
        </Pressable>

        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 18,
            fontFamily: 'HelveticaNeue',
            fontSize: 12,
            lineHeight: 19,
            color: atlas.label,
          }}>
          By continuing you agree to the <LegalLink label="Terms" url={TERMS_URL} /> and{' '}
          <LegalLink label="Privacy Policy" url={PRIVACY_URL} />.
        </RNText>
      </KeyboardAwareScrollView>
    </View>
  );
}
