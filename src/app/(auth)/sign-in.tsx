import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { sendEmailLink, signInWithApple } from '@/features/auth/actions';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/terms';

type Mode = 'choose' | 'email' | 'sent';

/**
 * The one screen a signed-out user ever sees — the whole promise on a single
 * dark page. Rather than describe the product, it shows a sample outfit: an
 * eyebrow up top, a serif headline pushed to the bottom of the page, a strip of
 * four garment swatches standing in for a styled look, and the two ways in.
 *
 * The screen is ink (#1C1A16) end to end, so text colour comes from inline
 * `style` using theme values — a `text-*` className cannot reliably beat a Text
 * variant's own colour, and light-on-dark is the whole point here.
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

  /**
   * Whether Sign in with Apple can actually run in THIS build.
   *
   * `Platform.OS === 'ios'` is not enough. The capability needs the
   * `com.apple.developer.applesignin` entitlement, which a free Apple personal
   * team is not allowed to sign — so a device build made for a personal team
   * (see scripts/free-signing.sh) ships without it, and tapping the button
   * would throw. Ask the framework instead of assuming, and simply do not
   * offer the option when it cannot work.
   */
  const builtWithAppleSignIn =
    (Constants.expoConfig?.extra as { appleSignInEnabled?: boolean } | undefined)
      ?.appleSignInEnabled !== false;

  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (!builtWithAppleSignIn) return; // free-team build: the capability is absent
    let cancelled = false;
    void AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAppleAvailable(ok);
      })
      .catch(() => {
        if (!cancelled) setAppleAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [builtWithAppleSignIn]);

  // Dark-page palette. `canvas`/`ink`/`faint` come from the design tokens; the
  // warm tans have no token because they only ever appear on this one dark
  // screen, so they are literal here (and match the handoff's welcome frame).
  const cream = theme.canvas; // light text + the Apple button fill
  const warmTan = '#B7A99A'; // eyebrow + the outfit caption line
  const warmItalic = '#D8B7A6'; // the emphasis words "already own."
  const subhead = '#C9C2B6'; // the paragraph under the headline
  const hairlineOnInk = 'rgba(251,250,246,0.4)'; // outline button + field border

  /**
   * Every measurement on this screen is the handoff's own pixel value scaled by
   * one factor.
   *
   * The mock draws the welcome page inside a 300px-wide phone frame — it is a
   * scaled picture of a ~400pt device, not a 300pt layout. Treating its pixels
   * as points (which this screen used to do) rendered the whole page about a
   * third too small: the eyebrow read as a footnote and the headline stopped
   * carrying the page. `s` converts mock px to points so the proportions land
   * as drawn, on any width.
   */
  const { width: screenW } = useWindowDimensions();
  const s = screenW / 300;
  const px = (mock: number) => mock * s;

  // The tracked caption under the swatch strip — mock 10px/600 at .14em.
  const caption = {
    fontFamily: 'HelveticaNeue-Medium' as const,
    fontSize: px(10),
    letterSpacing: px(1.4),
    textTransform: 'uppercase' as const,
    color: '#B7A99A',
  };

  const headSize = px(44);
  // The mock sets 1.02 leading. Instrument Serif declares a 1.30 line box, and
  // `leading()` would clamp up to it — which is right for a single trimmed line
  // but here would push the three lines a third further apart than the design.
  // 1.10 clears the real ink (cap 0.72 + descent 0.31) with room to spare, so
  // nothing clips, while keeping the headline as tight as the mock reads.
  const headLineHeight = Math.round(headSize * 1.1);

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
    <SafeAreaView className="flex-1 bg-ink">
      {/* This is the one dark screen in a light-only app; the global status bar
          is dark-on-light and would vanish here. */}
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          className="flex-1"
          style={{ paddingHorizontal: px(26), paddingTop: px(14), paddingBottom: px(10) }}>
          {/* ── Eyebrow, pinned to the top of the page ── */}
          <Animated.View entering={FadeIn.duration(500)}>
            <RNText
              style={{
                fontFamily: 'HelveticaNeue-Medium',
                fontSize: px(11),
                letterSpacing: px(3.3),
                textTransform: 'uppercase',
                color: warmTan,
              }}>
              Cinch
            </RNText>
          </Animated.View>

          {/* The eyebrow sits at the top; everything else falls to the bottom. */}
          <View className="flex-1" />

          {/* ── The promise: headline, paragraph, a sample look ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(600)}>
            <RNText
              accessibilityRole="header"
              style={{
                fontFamily: 'InstrumentSerif_400Regular',
                fontSize: headSize,
                lineHeight: headLineHeight,
                letterSpacing: -0.4,
                color: cream,
              }}>
              A stylist for{'\n'}the clothes you{'\n'}
              <RNText
                style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: warmItalic }}>
                already own.
              </RNText>
            </RNText>

            <RNText
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: px(14),
                lineHeight: px(21),
                color: subhead,
                marginTop: px(16),
                maxWidth: px(230),
              }}>
              One photo of your wardrobe. Every morning, outfits built from your real garments —
              nothing to buy, ever.
            </RNText>

            {/* Sample outfit strip — four garment swatches standing in for a
                styled look, in place of any illustration. */}
            <View style={{ flexDirection: 'row', gap: px(8), marginTop: px(22), marginBottom: px(10) }}>
              {['#3A3A38', '#E3DBCB', '#8A94A0', '#4A3B31'].map((tone, i) => (
                <View
                  key={i}
                  style={{ flex: 1, height: px(96), borderRadius: px(4), backgroundColor: tone }}
                />
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: px(24),
              }}>
              {/* The mock's two captions are together wider than its column, so
                  it wraps them. Let the left one shrink for the same reason —
                  without this they collide into "MONDAY$1.20". */}
              <RNText style={[caption, { flexShrink: 1, marginRight: px(8) }]}>
                Today · The Quiet Monday
              </RNText>
              <RNText style={[caption, { flexShrink: 0 }]}>$1.20 to wear</RNText>
            </View>
          </Animated.View>

          {/* ── The two ways in, plus the closing promise ── */}
          <Animated.View entering={FadeInDown.delay(260).duration(650)}>
            {mode === 'choose' ? (
              <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
                {/* Apple's OWN button, not a look-alike. The design draws a
                    cream pill with the logo and "Continue with Apple", which is
                    exactly AppleAuthenticationButton's WHITE style — so the zip
                    is satisfied without shipping a custom control, which
                    Guideline 4.8 / the Sign in with Apple HIG do not permit. */}
                {appleAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={px(30)}
                    style={{ width: '100%', height: px(47), opacity: busy ? 0.6 : 1 }}
                    onPress={() => {
                      if (!busy) void onApple();
                    }}
                  />
                ) : null}

                <Pressable
                  onPress={() => {
                    setMode('email');
                    setTimeout(() => emailRef.current?.focus(), 260);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with email"
                  style={{
                    height: px(47),
                    borderRadius: px(30),
                    borderWidth: 1,
                    borderColor: hairlineOnInk,
                    marginTop: appleAvailable ? px(10) : 0,
                  }}
                  className="w-full items-center justify-center active:opacity-60">
                  <RNText
                    style={{ fontFamily: 'HelveticaNeue-Medium', fontSize: px(14), color: cream }}>
                    Continue with email
                  </RNText>
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
                    placeholderTextColor={theme.faint}
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
                    className="flex-1 rounded-full px-4 font-body text-callout"
                    style={{
                      height: 52,
                      borderWidth: 1,
                      borderColor: hairlineOnInk,
                      color: cream,
                    }}
                  />
                  <Pressable
                    onPress={() => void onSendEmail()}
                    disabled={busy || !email.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send sign-in link"
                    style={{
                      height: 52,
                      width: 52,
                      borderRadius: 30,
                      backgroundColor:
                        email.trim() && !busy ? cream : 'rgba(251,250,246,0.14)',
                    }}
                    className="items-center justify-center">
                    <SymbolView
                      name="arrow.right"
                      size={18}
                      tintColor={email.trim() && !busy ? theme.ink : theme.faint}
                      resizeMode="scaleAspectFit"
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setMode('choose')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="mt-2 items-start justify-center active:opacity-60">
                  <Text variant="label" style={{ color: warmTan }}>
                    Back
                  </Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(300)}>
                <View className="flex-row items-center gap-2">
                  <SymbolView
                    name="envelope"
                    size={20}
                    tintColor={theme.canvas}
                    resizeMode="scaleAspectFit"
                  />
                  <Text variant="heading" style={{ color: cream }}>
                    Check your email
                  </Text>
                </View>
                <Text variant="callout" style={{ color: subhead, marginTop: 6, maxWidth: 320 }}>
                  We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this device and
                  you are in.
                </Text>
                <Pressable
                  onPress={() => setMode('email')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="mt-2 items-start justify-center active:opacity-60">
                  <Text variant="label" style={{ color: warmTan }}>
                    Use a different address
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* The closing promise, then the terms — both kept legible on ink. */}
            <RNText
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: px(12),
                lineHeight: px(16.8),
                color: theme.faint,
                textAlign: 'center',
                marginTop: px(16),
              }}>
              We never show you a garment you don&apos;t have.
            </RNText>

            <View className="mt-2 flex-row flex-wrap items-center justify-center">
              <Text variant="caption" style={{ color: theme.faint }}>
                By continuing you agree to our{' '}
              </Text>
              <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
                <Text variant="caption" className="underline" style={{ color: cream }}>
                  Terms
                </Text>
              </Pressable>
              <Text variant="caption" style={{ color: theme.faint }}>
                {' '}
                and{' '}
              </Text>
              <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
                <Text variant="caption" className="underline" style={{ color: cream }}>
                  Privacy Policy
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
