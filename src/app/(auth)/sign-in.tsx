import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { sendEmailLink, signInWithApple } from '@/features/auth/actions';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/terms';

type Mode = 'choose' | 'email' | 'sent';

/**
 * One garment swatch of the welcome grid.
 *
 * A vertical Skia gradient rather than a solid: the four tiles stand in for
 * photographed garments, and flat fills read as a colour chart where a soft
 * falloff reads as cloth under light. Skia because it is already in the bundle
 * for the plate — adding expo-linear-gradient for four static rectangles would
 * be a dependency for a two-stop gradient.
 *
 * The gradient needs pixel bounds, so the tile measures itself; the canvas
 * draws nothing until the first layout pass, which on a static screen is
 * invisible.
 */
function SwatchTile({
  top,
  bottom,
  radius,
  children,
}: {
  top: string;
  bottom: string;
  radius: number;
  children?: React.ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={{ flex: 1, borderRadius: radius, overflow: 'hidden' }}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {size.h > 0 ? (
        <Canvas style={{ position: 'absolute', width: size.w, height: size.h }}>
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <LinearGradient start={vec(0, 0)} end={vec(0, size.h)} colors={[top, bottom]} />
          </Rect>
        </Canvas>
      ) : null}
      {children}
    </View>
  );
}

/**
 * The one screen a signed-out user ever sees.
 *
 * Composition per the welcome mock: the top of the page is a 2×2 grid of
 * garment swatches on ink — a styled set presented like a contact sheet, the
 * wordmark printed on the first tile and the set's caption along the bottom —
 * and a canvas sheet rises over its lower edge carrying the promise and the
 * two ways in. The product's whole grammar (a look as a set of plates, cost
 * per wear as a headline fact) is on screen before a single word of pitch.
 *
 * Sign in with Apple leads because it is genuinely the least friction — and
 * because the App Store requires it once any other social login is offered
 * (Guideline 4.8). Email is the second path deliberately: a link to an inbox
 * covers Gmail, Yahoo, Outlook and every work address without binding the
 * product to one company's OAuth.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  /**
   * Every measurement is the mock's own pixel value scaled by one factor. The
   * mock draws the page in a 300-unit-wide frame; `s` converts its units to
   * points so the proportions land as drawn on any width.
   */
  const { width: screenW } = useWindowDimensions();
  const s = screenW / 300;
  const px = (mock: number) => mock * s;

  // The grid's palette. Literal rather than tokenized: these are the mock's
  // four garments — charcoal knit, slate shirt, clay coat, cream trouser — and
  // exist nowhere else in the app. Each pair is a soft top-lit falloff.
  const TILES = [
    { top: '#37342F', bottom: '#282623' }, // charcoal
    { top: '#A9B2C0', bottom: '#5E6874' }, // slate
    { top: '#BB9179', bottom: '#754C3C' }, // clay
    { top: '#F0EADE', bottom: '#A49E90' }, // cream
  ];
  const cream = theme.canvas;
  const warmTan = '#C7A08D'; // the set caption's eyebrow, on ink
  const captionLight = 'rgba(251,250,246,0.82)';

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
    <View className="flex-1 bg-ink">
      {/* The grid half is ink; the global status bar is dark-on-light and
          would vanish over it. */}
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── The set: a 2×2 contact sheet of garment swatches ── */}
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + px(6),
            paddingHorizontal: px(16),
            gap: px(7),
          }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: px(7) }}>
            <SwatchTile top={TILES[0].top} bottom={TILES[0].bottom} radius={px(14)}>
              <RNText
                style={{
                  fontFamily: 'InstrumentSerif_400Regular',
                  fontSize: px(34),
                  color: cream,
                  paddingTop: px(12),
                  paddingLeft: px(15),
                }}>
                Cinch
              </RNText>
            </SwatchTile>
            <SwatchTile top={TILES[1].top} bottom={TILES[1].bottom} radius={px(14)}>
              <RNText
                style={{
                  fontFamily: 'HelveticaNeue-Medium',
                  fontSize: px(9.5),
                  letterSpacing: px(1.7),
                  textTransform: 'uppercase',
                  color: captionLight,
                  textAlign: 'right',
                  paddingTop: px(16),
                  paddingRight: px(15),
                }}>
                Today&apos;s set
              </RNText>
            </SwatchTile>
          </View>

          <View style={{ flex: 1, flexDirection: 'row', gap: px(7) }}>
            <SwatchTile top={TILES[2].top} bottom={TILES[2].bottom} radius={px(14)} />
            <SwatchTile top={TILES[3].top} bottom={TILES[3].bottom} radius={px(14)} />
          </View>

          {/* The set's caption, printed over the grid's lower edge — the same
              two facts every plate in the app carries: the look's name, its
              palette, what it costs to wear. Absolute so the sheet can rise
              over the tiles without pushing the caption off them. */}
          <Animated.View
            entering={FadeIn.delay(150).duration(500)}
            pointerEvents="none"
            style={{ position: 'absolute', left: px(31), bottom: px(34) }}>
            <RNText
              style={{
                fontFamily: 'HelveticaNeue-Medium',
                fontSize: px(10.5),
                letterSpacing: px(1.6),
                textTransform: 'uppercase',
                color: warmTan,
              }}>
              The Quiet Monday
            </RNText>
            <RNText
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: px(13),
                color: captionLight,
                marginTop: px(4),
              }}>
              Charcoal · cream · slate — $1.20 to wear
            </RNText>
          </Animated.View>
        </View>

        {/* ── The sheet: the promise and the two ways in ── */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(600)}
          style={{
            backgroundColor: cream,
            borderTopLeftRadius: px(24),
            borderTopRightRadius: px(24),
            marginTop: -px(22),
            paddingHorizontal: px(31),
            paddingTop: px(28),
            paddingBottom: Math.max(insets.bottom, px(10)) + px(8),
          }}>
          <RNText
            accessibilityRole="header"
            style={{
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: px(29),
              lineHeight: px(34),
              letterSpacing: -0.3,
              color: theme.ink,
            }}>
            Dressed from your{' '}
            <RNText
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: theme.accent }}>
              own closet
            </RNText>
            , every morning.
          </RNText>

          <RNText
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: px(14),
              lineHeight: px(21),
              color: theme.muted,
              marginTop: px(9),
            }}>
            Weather, your plans, and what you actually wear — Cinch reads all three.
          </RNText>

          <View style={{ marginTop: px(19) }}>
            {mode === 'choose' ? (
              <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
                {/* Apple's OWN button, not a look-alike. The mock draws an ink
                    pill reading "Continue with Apple" — exactly the BLACK style
                    of AppleAuthenticationButton, so the design is satisfied
                    without a custom control, which Guideline 4.8 / the Sign in
                    with Apple HIG do not permit. */}
                {appleAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={px(26)}
                    style={{ width: '100%', height: px(50), opacity: busy ? 0.6 : 1 }}
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
                    height: px(50),
                    borderRadius: px(26),
                    borderWidth: 1,
                    borderColor: theme.rule,
                    marginTop: appleAvailable ? px(11) : 0,
                  }}
                  className="w-full items-center justify-center active:opacity-60">
                  <RNText
                    style={{
                      fontFamily: 'HelveticaNeue-Medium',
                      fontSize: px(14.5),
                      color: theme.ink,
                    }}>
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
                      height: px(50),
                      borderWidth: 1,
                      borderColor: theme.rule,
                      color: theme.ink,
                    }}
                  />
                  <Pressable
                    onPress={() => void onSendEmail()}
                    disabled={busy || !email.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send sign-in link"
                    style={{
                      height: px(50),
                      width: px(50),
                      borderRadius: px(26),
                      backgroundColor: email.trim() && !busy ? theme.ink : theme.tray,
                    }}
                    className="items-center justify-center">
                    <SymbolView
                      name="arrow.right"
                      size={18}
                      tintColor={email.trim() && !busy ? theme.canvas : theme.faint}
                      resizeMode="scaleAspectFit"
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setMode('choose')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="mt-1 items-start justify-center active:opacity-60">
                  <Text variant="label" style={{ color: theme.accent }}>
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
                    tintColor={theme.ink}
                    resizeMode="scaleAspectFit"
                  />
                  <Text variant="heading">Check your email</Text>
                </View>
                <Text variant="callout" style={{ color: theme.muted, marginTop: 6 }}>
                  We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this device
                  and you are in.
                </Text>
                <Pressable
                  onPress={() => setMode('email')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="mt-1 items-start justify-center active:opacity-60">
                  <Text variant="label" style={{ color: theme.accent }}>
                    Use a different address
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Required legal furniture — the mock crops below the buttons, but a
              sign-in screen without Terms and Privacy is a 1.1.6 conversation
              with App Review. Kept quiet in faint. */}
          <View className="mt-3 flex-row flex-wrap items-center justify-center">
            <Text variant="caption" style={{ color: theme.faint }}>
              By continuing you agree to our{' '}
            </Text>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
              <Text variant="caption" className="underline" style={{ color: theme.muted }}>
                Terms
              </Text>
            </Pressable>
            <Text variant="caption" style={{ color: theme.faint }}>
              {' '}
              and{' '}
            </Text>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <Text variant="caption" className="underline" style={{ color: theme.muted }}>
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
