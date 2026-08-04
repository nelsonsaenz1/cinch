import * as AppleAuthentication from 'expo-apple-authentication';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentRail } from '@/components/auth/garment-rail';
import { Text } from '@/components/ui/text';
import { sendEmailLink, signInWithApple } from '@/features/auth/actions';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/support';

/** Entrance rhythm. The rail lands first, then the words, then the choices. */
const BEAT = { rail: 0, wordmark: 420, tagline: 540, actions: 680 };

type Mode = 'choose' | 'email' | 'sent';

/**
 * The one screen a signed-out user ever sees.
 *
 * Sign in with Apple leads because it is genuinely the least friction — no
 * password, no inbox round trip — and because the App Store requires it once
 * any other social login is offered (Guideline 4.8).
 *
 * Email is the second path deliberately, rather than a third-party button. A
 * link to an inbox works for Gmail, Yahoo, Outlook and every work address
 * without binding the product to one company's OAuth or adding another
 * processor to the privacy policy.
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
        {/* Uneven spacers, not justify-center. Mathematically centred content
            always reads slightly low; the optical centre sits a little above. */}
        <View style={{ flex: 0.7 }} />

        <View className="px-8">
          <Animated.View entering={FadeIn.delay(BEAT.rail).duration(500)} className="mb-8">
            <GarmentRail />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(BEAT.wordmark).duration(650)}>
            <Text variant="wordmark" accessibilityRole="header" className="text-center">
              Cinch
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(BEAT.tagline).duration(650)}>
            <Text
              variant="body"
              className="mx-auto mt-4 text-center text-muted dark:text-muted-dark"
              // Measure chosen so the two lines come out near-even (26 and 24
              // characters). "that works with" was cut: it added length without
              // adding meaning, and it forced a lopsided 37/24 break.
              style={{ maxWidth: 272 }}>
              A personal stylist for the clothes you already own.
            </Text>
          </Animated.View>
        </View>

        <View style={{ flex: 0.5 }} />

        <Animated.View
          entering={FadeInDown.delay(BEAT.actions).duration(700)}
          className="px-8 pb-6">
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
                  cornerRadius={999}
                  style={{ height: 54, width: '100%' }}
                  onPress={onApple}
                />
              ) : null}

              <Pressable
                onPress={() => {
                  setMode('email');
                  setTimeout(() => emailRef.current?.focus(), 260);
                }}
                accessibilityRole="button"
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-3 items-center justify-center active:opacity-60">
                <Text variant="body" className="font-medium text-ink dark:text-ink-dark">
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
                  // `emailAddress` is the setting that scopes AutoFill to email:
                  // it offers addresses from the user's contact card and nothing
                  // else. Two things summon the generic Passwords / Credit Cards /
                  // Addresses key instead, and neither is present here — using
                  // `username` (which is *defined* as "this is a login field"),
                  // or mounting a `secureTextEntry` sibling on the same screen,
                  // which makes iOS classify the whole screen as a login form.
                  // If a password field is ever added, put it on its own route.
                  //
                  // `autoComplete` is Android-only in React Native's iOS path
                  // (it is passed as undefined), so it cannot conflict here; it
                  // is kept for when Android ships.
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  accessibilityLabel="Email address"
                  style={{ height: 54 }}
                  className="flex-1 rounded-chip border border-hairline px-5 font-body text-body text-ink dark:border-hairline-dark dark:text-ink-dark"
                />
                <Pressable
                  onPress={() => void onSendEmail()}
                  disabled={busy || !email.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send sign-in link"
                  style={{ height: 54, width: 54 }}
                  className={`items-center justify-center rounded-full ${
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
                className="mt-2 items-center justify-center active:opacity-60">
                <Text variant="label">Back</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} className="items-center">
              <SymbolView
                name="envelope"
                size={24}
                tintColor={theme.accent}
                resizeMode="scaleAspectFit"
              />
              <Text variant="heading" className="mt-3 text-center">
                Check your email
              </Text>
              <Text
                variant="body"
                className="mt-1.5 text-center text-muted dark:text-muted-dark"
                style={{ maxWidth: 300 }}>
                We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this
                device and you are in.
              </Text>
              <Pressable
                onPress={() => setMode('email')}
                accessibilityRole="button"
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-3 items-center justify-center active:opacity-60">
                <Text variant="label">Use a different address</Text>
              </Pressable>
            </Animated.View>
          )}

          <View className="mt-6 flex-row flex-wrap items-center justify-center">
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
