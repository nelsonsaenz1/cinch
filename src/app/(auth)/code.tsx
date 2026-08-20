import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas } from '@/components/auth/chrome';
import {
  CodeBoxes,
  RunBusyRow,
  RunHeader,
  RunInlineAction,
  RunPrompt,
  RunStatus,
  RunSubline,
  RunButton,
  TroubleCard,
  type BoxTone,
} from '@/components/auth/run-parts';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import {
  sendEmailCode,
  sendPhoneCode,
  verifyEmailCode,
  verifyPhoneCode,
} from '@/features/auth/actions';
import {
  AX_STACK_SCALE,
  BOX_BLEED,
  CODE_CHANGE,
  CODE_CHANGE_PHONE,
  CODE_CHECKING,
  CODE_HEADLINE,
  CODE_LENGTH,
  CODE_RESENDING,
  CODE_RESEND_ACTION,
  CODE_RESEND_PROMPT,
  CODE_STEP,
  MAX_ATTEMPTS,
  PAD,
  RESEND_COOLDOWN_S,
  codeColumns,
  cooldownLine,
  expiredTrouble,
  resendFailedTrouble,
  resentToLine,
  sentToLine,
  thrownTrouble,
  wrongCodeLine,
  type Trouble,
} from '@/features/auth/auth-run-spec';
import { formatPhoneForDisplay } from '@/features/auth/phone';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { haptics } from '@/lib/haptics';

/**
 * Redesign 19, step two — the six digits.
 *
 * ── WHAT MOVED, AND WHAT DID NOT ────────────────────────────────────────────
 *
 * Moved: the boxes are bigger and rounder and match the field on the screen
 * before them; the three error sentences that all shared one grey line are now
 * a refusal line (a wrong code, which is about what you typed) and a trouble
 * card (an expired code or a failed resend, which is not); the resend link is a
 * real 44pt control instead of a text span apologising for its line height.
 *
 * Did NOT move: ONE hidden `TextInput` still drives the boxes, which is what
 * makes iOS one-time-code autofill and the number pad land in a single field —
 * the brief names this keyboard handling as already correct. The sixth digit
 * still submits on its own, so this screen still has no Continue button. Three
 * attempts per code, a 60-second resend cooldown, a fresh send invalidating the
 * previous code server-side, and `actions.ts`'s wrong-versus-expired reading
 * are all untouched.
 */
export default function CodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const { email = '', phone = '' } = useLocalSearchParams<{ email?: string; phone?: string }>();

  // One screen serves both channels — the six boxes, the attempts, the shake
  // and the cooldown are channel-blind, and only three sentences differ. The
  // phone param wins when both are somehow present, because it can only have
  // been set by the phone screen's push. `destination` is what the sublines
  // say back; the E.164 the server needs stays in `phone` untouched.
  const viaPhone = phone.length > 0;
  const destination = viaPhone ? formatPhoneForDisplay(phone) : email;
  const sendCode = useCallback(
    () => (viaPhone ? sendPhoneCode(phone) : sendEmailCode(email)),
    [viaPhone, phone, email],
  );
  const verifyCode = useCallback(
    (code: string) => (viaPhone ? verifyPhoneCode(phone, code) : verifyEmailCode(email, code)),
    [viaPhone, phone, email],
  );

  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  /** The wrong digits stay on screen so you can see what you typed. */
  const [errorValue, setErrorValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [resending, setResending] = useState(false);

  const large = fontScale >= AX_STACK_SCALE;
  const exhausted = attemptsLeft <= 0;
  const errored = wrong || trouble != null;
  const shown = wrong ? errorValue : value;

  // The one shake: 8px horizontal, once, skipped under Reduce Motion. Driven by
  // a tick so the shared-value write lives in an effect, as the repo's
  // precedent (and the react-hooks immutability rule) wants.
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
        const result = await verifyCode(code);
        if (result.ok) {
          haptics.success();
          if (result.isNew) {
            // New account, no name in the metadata yet — step three first.
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
          setTrouble(expiredTrouble());
        } else {
          const left = attemptsLeft - 1;
          setAttemptsLeft(left);
          setWrong(true);
          setShakeTick((t) => t + 1);
          AccessibilityInfo.announceForAccessibility(wrongCodeLine(left));
        }
        haptics.failure();
      } catch (err) {
        // Thrown, not returned — must surface, never be silent.
        setErrorValue(code);
        setValue('');
        setTrouble(thrownTrouble(describeThrownSignInError(err)));
        haptics.failure();
      } finally {
        setVerifying(false);
      }
    },
    [attemptsLeft, verifyCode, router],
  );

  const onChange = useCallback(
    (raw: string) => {
      if (verifying || exhausted) return;
      const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
      // The keystroke after a miss clears the whole field — the hidden input was
      // already emptied, so whatever arrives simply starts fresh.
      if (wrong) setWrong(false);
      if (trouble) setTrouble(null);
      setValue(digits);
      if (digits.length === CODE_LENGTH) void verify(digits);
    },
    [wrong, trouble, exhausted, verifying, verify],
  );

  const resend = useCallback(async () => {
    if (resending || cooldown != null) return;
    haptics.selection();
    setResending(true);
    try {
      // A fresh signInWithOtp invalidates the previous code server-side.
      const result = await sendCode();
      if (result.ok) {
        setValue('');
        setErrorValue('');
        setWrong(false);
        setTrouble(null);
        setAttemptsLeft(MAX_ATTEMPTS);
        setCooldown(RESEND_COOLDOWN_S);
        inputRef.current?.focus();
      } else {
        haptics.failure();
        setTrouble(resendFailedTrouble());
      }
    } catch (err) {
      haptics.failure();
      setTrouble(thrownTrouble(describeThrownSignInError(err)));
    } finally {
      setResending(false);
    }
  }, [cooldown, sendCode, resending]);

  const boxTone: BoxTone = wrong ? 'refused' : verifying ? 'busy' : 'active';
  const activeIndex = !errored && !exhausted && !verifying ? value.length : -1;
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => shown[i]);

  /** Nothing typed, nothing wrong — the only moment "Change email" is useful. */
  const canChangeEmail = value.length === 0 && !errored && !verifying && cooldown == null;

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <RunHeader step={CODE_STEP} onBack={() => router.back()} backDisabled={verifying} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={CODE_HEADLINE}>
          <RunSubline>
            {cooldown != null ? resentToLine(destination) : sentToLine(destination)}
          </RunSubline>
        </RunPrompt>

        {canChangeEmail ? (
          <View style={{ marginTop: 2 }}>
            <RunInlineAction
              label={viaPhone ? CODE_CHANGE_PHONE : CODE_CHANGE}
              onPress={() => router.back()}
            />
          </View>
        ) : null}

        {/* The row overhangs the text column by 4pt a side. See `BOX_BLEED`. */}
        <Animated.View
          style={[
            { marginTop: canChangeEmail ? 6 : 24, marginHorizontal: -BOX_BLEED },
            shakeStyle,
          ]}>
          <CodeBoxes
            digits={digits}
            tone={boxTone}
            activeIndex={activeIndex}
            columns={codeColumns(large)}
            onPress={() => inputRef.current?.focus()}
          />
        </Animated.View>

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
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1, left: PAD, top: 0 }}
        />

        <View style={{ marginTop: 16, gap: 12 }}>
          {verifying ? <RunBusyRow label={CODE_CHECKING} /> : null}

          {wrong ? <RunStatus tone="refused">{wrongCodeLine(attemptsLeft)}</RunStatus> : null}

          {trouble ? (
            <TroubleCard
              trouble={trouble}
              large={large}
              busy={resending}
              onAction={() => void resend()}
            />
          ) : null}

          {/* The resend offer. Suppressed while a card is up, because that card
              already carries the send — two ways to ask for the same code on
              one screen is the "one CTA" rule broken by accretion. */}
          {!verifying && trouble == null ? (
            cooldown != null ? (
              <RunStatus>{cooldownLine(cooldown)}</RunStatus>
            ) : resending ? (
              <RunStatus>{CODE_RESENDING}</RunStatus>
            ) : large ? (
              // At the accessibility sizes the prompt and the action stop
              // fitting on one line, so the action becomes the screen's button
              // rather than wrapping into an unscannable shape.
              <View style={{ gap: 10 }}>
                <RunStatus>{CODE_RESEND_PROMPT}</RunStatus>
                <RunButton label={CODE_RESEND_ACTION} onPress={() => void resend()} large />
              </View>
            ) : (
              <RunInlineAction
                prompt={CODE_RESEND_PROMPT}
                label={CODE_RESEND_ACTION}
                onPress={() => void resend()}
              />
            )
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
