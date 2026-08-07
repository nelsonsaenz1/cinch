import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas, AuthHeader, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import { sendEmailCode, verifyEmailCode } from '@/features/auth/actions';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { MIN_TAP_TARGET } from '@/theme/tokens';

const CODE_LENGTH = 6;
/** Three tries per code, counted down out loud rather than hidden (W-09). */
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_S = 60;

type ErrorKind = 'wrong' | 'expired' | 'send-failed' | 'thrown';

const WORDS: Record<number, string> = { 2: 'Two attempts left', 1: 'One attempt left' };

function formatCooldown(s: number): string {
  return `0:${String(s).padStart(2, '0')}`;
}

/**
 * W-08/09/10: six boxes driven by one hidden TextInput, so iOS one-time-code
 * autofill and the number pad both land in a single field. The sixth digit
 * submits on its own — there is no Continue button here.
 */
export default function CodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  /** The wrong digits stay on screen so you can see what you typed. */
  const [errorValue, setErrorValue] = useState('');
  const [error, setError] = useState<{ kind: ErrorKind; message?: string } | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [resending, setResending] = useState(false);

  const exhausted = attemptsLeft <= 0;
  const shown = error ? errorValue : value;

  // The one shake: 8px horizontal, once, skipped under Reduce Motion. Driven
  // by a tick so the shared-value write lives in an effect, where the
  // react-hooks immutability rule (and the repo's precedent) wants it.
  const [shakeTick, setShakeTick] = useState(0);
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (shakeTick === 0 || reduced) return;
    shakeX.value = withSequence(
      withTiming(-8, { duration: 55 }),
      withTiming(8, { duration: 90 }),
      withTiming(-5, { duration: 80 }),
      withTiming(0, { duration: 60 }),
    );
  }, [shakeTick, reduced, shakeX]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  useEffect(() => {
    if (cooldown == null || cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => (c != null && c > 1 ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = useCallback(
    async (code: string) => {
      setVerifying(true);
      try {
        const result = await verifyEmailCode(email, code);
        if (result.ok) {
          void Haptics.selectionAsync().catch(() => {});
          if (result.isNew) {
            // New account, no name in the metadata yet — W-13 before handoff.
            router.replace('/(auth)/name');
          } else {
            router.replace({
              pathname: '/(auth)/handoff',
              params: { isNew: '0', name: result.name ?? '' },
            });
          }
          return;
        }
        setErrorValue(code);
        setValue('');
        if (result.reason === 'expired-code') {
          setError({ kind: 'expired' });
        } else {
          const left = attemptsLeft - 1;
          setAttemptsLeft(left);
          setError({ kind: 'wrong' });
          setShakeTick((t) => t + 1);
          AccessibilityInfo.announceForAccessibility(
            left > 0
              ? `That code doesn’t match. ${WORDS[left] ?? `${left} attempts left`}.`
              : 'That code doesn’t match. Send another to try again.',
          );
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } catch (err) {
        // Thrown, not returned — must surface, never be silent.
        setErrorValue(code);
        setValue('');
        setError({ kind: 'thrown', message: describeThrownSignInError(err) });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } finally {
        setVerifying(false);
      }
    },
    [attemptsLeft, email, router],
  );

  const onChange = useCallback(
    (raw: string) => {
      if (verifying || exhausted) return;
      const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
      // The keystroke after a miss clears the whole field (W-09) — the hidden
      // input was already emptied, so whatever arrives simply starts fresh.
      if (error) setError(null);
      setValue(digits);
      if (digits.length === CODE_LENGTH) void verify(digits);
    },
    [error, exhausted, verifying, verify],
  );

  const resend = useCallback(async () => {
    if (resending || cooldown != null) return;
    void Haptics.selectionAsync().catch(() => {});
    setResending(true);
    try {
      // A fresh signInWithOtp invalidates the previous code server-side.
      const result = await sendEmailCode(email);
      if (result.ok) {
        setValue('');
        setErrorValue('');
        setError(null);
        setAttemptsLeft(MAX_ATTEMPTS);
        setCooldown(RESEND_COOLDOWN_S);
        inputRef.current?.focus();
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError({
          kind: 'send-failed',
          message:
            result.reason === 'rate-limited'
              ? 'Too many codes requested. Try again in five minutes.'
              : 'We couldn’t send the code just now. This is on us, not you — try again in a moment.',
        });
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError({ kind: 'thrown', message: describeThrownSignInError(err) });
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending]);

  const activeIndex = !error && !exhausted && !verifying ? value.length : -1;

  const link = (label: string) => (
    <RNText
      accessibilityRole="link"
      suppressHighlighting
      onPress={() => void resend()}
      style={{ color: atlas.oxblood }}>
      {label}
    </RNText>
  );

  // The line under the boxes: resend link, countdown, or the error sentence.
  let statusLine: ReactNode;
  if (cooldown != null) {
    statusLine = (
      <RNText style={{ color: atlas.label }}>
        A new code is on its way. You can ask again in {formatCooldown(cooldown)}.
      </RNText>
    );
  } else if (resending) {
    statusLine = <RNText style={{ color: atlas.label }}>Sending a new code…</RNText>;
  } else if (error?.kind === 'wrong' || (exhausted && error)) {
    statusLine =
      attemptsLeft > 0 ? (
        <RNText style={{ color: atlas.oxblood }}>
          That code doesn’t match. {WORDS[attemptsLeft] ?? `${attemptsLeft} attempts left`}, or{' '}
          {link('send another')}.
        </RNText>
      ) : (
        <RNText style={{ color: atlas.oxblood }}>
          That code doesn’t match. {link('Send another')} to try again.
        </RNText>
      );
  } else if (error?.kind === 'expired') {
    statusLine = (
      <RNText style={{ color: atlas.oxblood }}>
        That code has expired. {link('Send another')}.
      </RNText>
    );
  } else if (error?.kind === 'send-failed' || error?.kind === 'thrown') {
    statusLine = <RNText style={{ color: atlas.oxblood }}>{error.message}</RNText>;
  } else {
    statusLine = (
      <RNText style={{ color: atlas.label }}>Didn’t arrive? {link('Send another')}</RNText>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <AuthHeader onBack={() => router.back()} backDisabled={verifying} />
      <View style={{ paddingHorizontal: 34, paddingTop: 40 }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 36,
            lineHeight: 40,
            color: atlas.ink,
          }}>
          Check your mail.
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
          Six digits, sent to <RNText style={{ color: atlas.ink }}>{email}</RNText>.{' '}
          <RNText
            accessibilityRole="link"
            suppressHighlighting
            onPress={() => router.back()}
            style={{ color: atlas.oxblood }}>
            Change
          </RNText>
        </RNText>

        <Pressable
          accessible={false}
          onPress={() => inputRef.current?.focus()}
          style={{ marginTop: 34 }}>
          <Animated.View style={[{ flexDirection: 'row', gap: 9 }, shakeStyle]}>
            {Array.from({ length: CODE_LENGTH }, (_, i) => {
              const digit = shown[i];
              const isError = error != null && digit != null;
              const isActive = i === activeIndex;
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`Digit ${i + 1} of ${CODE_LENGTH}${digit ? `, ${digit}` : ', empty'}`}
                  style={{
                    flex: 1,
                    height: 62,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isError ? atlas.boxError : digit || isActive ? '#FFFFFF' : atlas.boxEmpty,
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isError
                      ? atlas.boxErrorBorder
                      : isActive
                        ? atlas.ink
                        : digit
                          ? 'rgba(28,26,22,0.2)'
                          : atlas.boxEmptyBorder,
                  }}>
                  {digit ? (
                    <RNText
                      maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
                      style={{
                        fontFamily: 'InstrumentSerif_400Regular',
                        fontSize: 28,
                        color: isError ? atlas.oxblood : atlas.ink,
                      }}>
                      {digit}
                    </RNText>
                  ) : isActive ? (
                    <View style={{ width: 2, height: 26, backgroundColor: atlas.oxblood }} />
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </Pressable>

        {/* One hidden field drives the boxes, so oneTimeCode autofill works. */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          editable={!verifying && !exhausted}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          caretHidden
          accessibilityLabel="Six-digit code"
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1, left: 34, top: 0 }}
        />

        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          accessibilityLiveRegion="polite"
          style={{
            marginTop: 18,
            fontFamily: 'HelveticaNeue',
            fontSize: 14,
            lineHeight: 21,
            // The resend link's touch target is a text span; give the line
            // room so the 44pt floor is met by the row itself.
            minHeight: MIN_TAP_TARGET - 21,
          }}>
          {statusLine}
        </RNText>
      </View>
    </View>
  );
}
