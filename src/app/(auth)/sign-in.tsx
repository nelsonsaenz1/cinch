import * as AppleAuthentication from 'expo-apple-authentication';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlateHero } from '@/components/brand/plate-hero';
import { Text } from '@/components/ui/text';
import { sendEmailLink, signInWithApple } from '@/features/auth/actions';
import { MIN_TAP_TARGET, fadeEasing, useTheme } from '@/theme/tokens';

const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/terms';

/**
 * Entrance rhythm: the masthead sets itself like a page of print — wordmark,
 * rule, eyebrow, tagline — then the plate assembles, then the choices arrive.
 */
const BEAT = { wordmark: 0, rule: 160, eyebrow: 260, tagline: 340, plate: 160, actions: 900 };

type Mode = 'choose' | 'email' | 'sent';

/** A 1px rule that draws itself left to right, like a pen stroke. */
function DrawnRule({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: Easing.bezier(...fadeEasing) }),
    );
  }, [delay, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View className="w-full overflow-hidden">
      <Animated.View
        className="bg-rule dark:bg-rule-dark"
        style={[{ height: 1, transformOrigin: 'left' }, style]}
      />
    </View>
  );
}

/**
 * The one screen a signed-out user ever sees, set as the cover of a lookbook:
 * everything hard-left at the gutter, structure drawn with real rules, and the
 * plate teaching the product's visual grammar before any UI copy does.
 *
 * Sign in with Apple leads because it is genuinely the least friction — and
 * because the App Store requires it once any other social login is offered
 * (Guideline 4.8). Email is the second path deliberately: a link to an inbox
 * covers Gmail, Yahoo, Outlook and every work address without binding the
 * product to one company's OAuth.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);

  const onApple = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const result = await signInWithApple();
    setBusy(false);
    if (result.ok) return; // Root layout redirects as soon as the session lands.

    switch (result.reason) {
      case 'canceled':
        break; // The user chose to back out. Do not shame them for it.
      case 'unavailable':
        Alert.alert(
          'Sign in with Apple is unavailable',
          'This device does not support it. You can continue with your email instead.',
        );
        setMode('email');
        break;
      case 'failed':
        Alert.alert('Could not sign you in', result.message ?? 'Please try again in a moment.');
        break;
    }
  }, [busy]);

  const onSendEmail = useCallback(async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    const result = await sendEmailLink(email);
    setBusy(false);

    if (result.ok) setMode('sent');
    else Alert.alert('Could not send the link', result.message ?? 'Please try again.');
  }, [busy, email]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Masthead. Hard-left at the gutter; never centred. ── */}
        <View className="px-gutter" style={{ paddingTop: 24 }}>
          <Animated.View entering={FadeInDown.delay(BEAT.wordmark).duration(600)}>
            <Text variant="wordmark" trim accessibilityRole="header">
              Cinch
            </Text>
          </Animated.View>

          <View style={{ marginTop: 14 }}>
            <DrawnRule delay={BEAT.rule} />
          </View>

          <Animated.View entering={FadeIn.delay(BEAT.eyebrow).duration(500)}>
            <Text variant="eyebrow" style={{ marginTop: 10 }}>
              Nº 01 — The Morning Edit
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(BEAT.tagline).duration(600)}>
            <Text
              variant="body"
              className="text-muted dark:text-muted-dark"
              // Measure tuned for a near-even two-line break:
              // "A personal stylist for the" / "clothes you already own."
              style={{ marginTop: 12, maxWidth: 230 }}>
              A personal stylist for the clothes you already own.
            </Text>
          </Animated.View>
        </View>

        {/* ── Plate 01, optically centred in the space the masthead and the
               choices leave over — not pinned under the tagline, which strands
               a court of dead canvas above the buttons. ── */}
        <View className="flex-1 justify-center">
          <Animated.View
            entering={FadeIn.delay(BEAT.plate).duration(400)}
            className="px-gutter"
            style={{ paddingBottom: 16 }}>
            <PlateHero />
          </Animated.View>
        </View>

        {/* ── Choices ── */}
        <Animated.View
          entering={FadeInDown.delay(BEAT.actions).duration(650)}
          className="px-gutter pb-6">
          {mode === 'choose' ? (
            <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
              {Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={
                    theme.scheme === 'dark'
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  // 12, not a capsule: pills belong to the glass chrome layer.
                  // Content-layer controls are rectangles, like the plates.
                  cornerRadius={12}
                  style={{ height: 52, width: '100%' }}
                  onPress={onApple}
                />
              ) : null}

              <Pressable
                onPress={() => {
                  setMode('email');
                  setTimeout(() => emailRef.current?.focus(), 260);
                }}
                accessibilityRole="button"
                style={{ height: 52 }}
                className="mt-3 items-center justify-center rounded-md border border-rule active:opacity-60 dark:border-rule-dark">
                <Text variant="callout" className="font-medium">
                  Continue with email
                </Text>
              </Pressable>
            </Animated.View>
          ) : mode === 'email' ? (
            <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)}>
              <View className="flex-row items-center gap-2">
                <TextInput
                  ref={emailRef}
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => void onSendEmail()}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  // `emailAddress` scopes iOS AutoFill to email addresses from
                  // the user's own contact card — nothing else. The generic
                  // Passwords / Credit Cards / Addresses key is summoned by
                  // textContentType="username" (defined as "login field") or by
                  // a secureTextEntry sibling on the same screen; neither exists
                  // here, and if a password field is ever added it goes on its
                  // own route. `autoComplete` is inert on iOS when
                  // textContentType is set (RN passes it to Android only) and is
                  // kept for the Android build.
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  accessibilityLabel="Email address"
                  style={{ height: 52 }}
                  className="flex-1 rounded-md border border-rule px-4 font-body text-callout text-ink dark:border-rule-dark dark:text-ink-dark"
                />
                <Pressable
                  onPress={() => void onSendEmail()}
                  disabled={busy || !email.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send sign-in link"
                  style={{ height: 52, width: 52 }}
                  className={`items-center justify-center rounded-md ${
                    email.trim() && !busy ? 'bg-ink dark:bg-ink-dark' : 'bg-tray dark:bg-tray-dark'
                  }`}>
                  <SymbolView
                    name="arrow.right"
                    size={18}
                    tintColor={email.trim() && !busy ? theme.canvas : theme.muted}
                    resizeMode="scaleAspectFit"
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={() => setMode('choose')}
                accessibilityRole="button"
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-2 items-start justify-center active:opacity-60">
                <Text variant="label">Back</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)}>
              <View className="flex-row items-center gap-2">
                <SymbolView
                  name="envelope"
                  size={20}
                  tintColor={theme.ink}
                  resizeMode="scaleAspectFit"
                />
                <Text variant="heading">Check your email</Text>
              </View>
              <Text
                variant="callout"
                className="mt-1.5 text-muted dark:text-muted-dark"
                style={{ maxWidth: 320 }}>
                We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this
                device and you are in.
              </Text>
              <Pressable
                onPress={() => setMode('email')}
                accessibilityRole="button"
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-2 items-start justify-center active:opacity-60">
                <Text variant="label">Use a different address</Text>
              </Pressable>
            </Animated.View>
          )}

          <View className="mt-5 flex-row flex-wrap items-center">
            <Text variant="caption">By continuing you agree to our </Text>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
              <Text variant="caption" className="underline">
                Terms
              </Text>
            </Pressable>
            <Text variant="caption"> and </Text>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <Text variant="caption" className="underline">
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
