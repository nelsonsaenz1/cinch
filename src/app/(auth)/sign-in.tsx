import { Canvas, Group, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  atlas,
  MAX_DISPLAY_SCALE,
  MAX_TEXT_SCALE,
} from '@/components/auth/chrome';
import { signInWithApple } from '@/features/auth/actions';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { useConnectivity } from '@/features/auth/use-connectivity';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET } from '@/theme/tokens';

const COVER_PHOTO = require('../../../assets/garments/cognac-shearling-coat.jpg');

/** The W-03 toast's copy — one sentence, whatever Apple's error was. */
const TOAST_DID_NOT_FINISH = 'Sign-in didn’t finish. Nothing was sent.';

type Toast = { message: string; retry: boolean } | null;

/**
 * The two cover overlays, drawn together in one Skia canvas: the vertical
 * legibility gradient (dark under the wordmark, clear through the coat, dark
 * under the type block) and the bottom radial oxblood glow. Skia because it is
 * already in the bundle; the CSS radial `120% 70% at 50% 100%` is an ellipse,
 * which the circle gradient gets via a scaleX on its group.
 */
function CoverScrim({ width, height }: { width: number; height: number }) {
  if (height <= 0) return null;
  const sx = (1.2 * width) / (0.7 * height) || 1;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', width, height }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[
            'rgba(23,18,14,0.72)',
            'rgba(23,18,14,0.20)',
            'rgba(23,18,14,0.18)',
            'rgba(23,18,14,0.80)',
            'rgba(20,15,11,0.97)',
          ]}
          positions={[0, 0.22, 0.44, 0.74, 1]}
        />
      </Rect>
      <Group transform={[{ translateX: width / 2 }, { scaleX: sx }, { translateX: -width / 2 }]}>
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height)}
            r={0.7 * height}
            colors={['rgba(110,43,43,0.28)', 'rgba(110,43,43,0)']}
            positions={[0, 0.6]}
          />
        </Rect>
      </Group>
    </Canvas>
  );
}

/**
 * W-01, the cover — the only photograph in the flow. Full-bleed shearling
 * coat under the two atlas gradients; wordmark and eyebrow up top; the
 * three-line promise, the cost-per-wear caption, and the two ways in at the
 * bottom. W-03's toast and W-11's offline block are states of this screen,
 * never navigations — a failed sign-in must not cost the user the screen.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const online = useConnectivity();
  const { width: screenW, height: screenH } = useWindowDimensions();
  // The atlas draws its frames 393 wide; one factor carries its measures.
  const s = screenW / 393;
  const px = (v: number) => v * s;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Whether Sign in with Apple can actually run in THIS build. `Platform.OS`
   * is not enough: the capability needs the `com.apple.developer.applesignin`
   * entitlement, which a free personal team cannot sign — so a build made for
   * one ships without it and the tap would throw. Ask the framework instead of
   * assuming, and do not offer the option when it cannot work.
   */
  const builtWithAppleSignIn =
    (Constants.expoConfig?.extra as { appleSignInEnabled?: boolean } | undefined)
      ?.appleSignInEnabled !== false;
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (!builtWithAppleSignIn) return;
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

  const showToast = useCallback((message: string, retry: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, retry });
    AccessibilityInfo.announceForAccessibility(message);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const onApple = useCallback(async () => {
    if (busy) return;
    // After the `busy` guard, so a double-tap on a sheet already opening is one
    // attempt rather than two — the same care `paywall_presented` takes in
    // firing from the presentation and not from the request for one.
    track('auth_started', { method: 'apple' });
    void Haptics.selectionAsync().catch(() => {});
    setBusy(true);
    setToast(null);
    try {
      const result = await signInWithApple();
      if (result.ok) {
        // Land on the handoff (W-14) before the root gate can bounce us to the
        // tabs — the gate exempts (auth)/handoff for exactly this beat.
        router.replace({
          pathname: '/(auth)/handoff',
          params: { isNew: result.isNew ? '1' : '0', name: result.name ?? '' },
        });
        return;
      }
      switch (result.reason) {
        case 'canceled':
          showToast(TOAST_DID_NOT_FINISH, true);
          break;
        case 'unavailable':
          showToast(
            'Sign in with Apple isn’t available on this device. Continue with email instead.',
            false,
          );
          break;
        default:
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          showToast(TOAST_DID_NOT_FINISH, true);
          break;
      }
    } catch (err) {
      // A thrown (not returned) failure is the storage layer escaping — it
      // must surface, never be silent. See describeThrownSignInError.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast(describeThrownSignInError(err), true);
    } finally {
      setBusy(false);
    }
  }, [busy, router, showToast]);

  const onEmail = useCallback(() => {
    // Here rather than on the address screen's Continue. The two methods have
    // to start at the same beat or they cannot be compared: Apple's start is
    // the tap that opens a sheet, and email's equivalent is the tap that enters
    // the flow. Waiting for the address to be submitted would hide everyone who
    // chose email, saw a text field, and left — which is exactly the drop-off
    // this event was added to find.
    track('auth_started', { method: 'email' });
    void Haptics.selectionAsync().catch(() => {});
    router.push('/(auth)/email');
  }, [router]);

  const eyebrowStyle = {
    fontFamily: 'HelveticaNeue-Medium',
    fontSize: px(9),
    letterSpacing: px(9) * 0.2,
    textTransform: 'uppercase' as const,
    color: 'rgba(243,240,233,0.6)',
  };

  return (
    <View style={{ flex: 1, backgroundColor: atlas.coverBase }}>
      <StatusBar style="light" />
      <Image
        source={COVER_PHOTO}
        contentFit="cover"
        transition={0}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityIgnoresInvertColors
      />
      {/* Offline (W-11): the photograph loses its colour. expo-image has no
          grayscale filter, so a neutral overlay approximates the atlas's
          grayscale(.4) saturate(.6). */}
      {!online ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#55504a',
            opacity: 0.38,
          }}
        />
      ) : null}
      <CoverScrim width={screenW} height={screenH} />

      {/* ── Top row: wordmark + tracked eyebrow ── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + px(8),
          left: px(34),
          right: px(34),
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}>
        <RNText
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: px(40),
            lineHeight: px(40),
            letterSpacing: -0.4,
            color: atlas.cream,
          }}>
          Cinch
        </RNText>
        <RNText maxFontSizeMultiplier={MAX_TEXT_SCALE} numberOfLines={2} style={eyebrowStyle}>
          Your closet & your friends’
        </RNText>
      </View>

      {/* ── W-03 toast: top-anchored, dismissed on tap or after 5s ── */}
      {toast ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(200)}
          exiting={reduced ? undefined : FadeOut.duration(160)}
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: px(22),
            right: px(22),
            top: insets.top + px(72),
            zIndex: 10,
          }}>
          <Pressable
            onPress={() => setToast(null)}
            accessibilityRole="alert"
            style={{
              backgroundColor: 'rgba(20,15,11,0.86)',
              borderWidth: 1,
              borderColor: 'rgba(243,240,233,0.16)',
              borderRadius: 16,
              paddingVertical: 15,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              minHeight: MIN_TAP_TARGET,
            }}>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                flex: 1,
                fontFamily: 'HelveticaNeue',
                fontSize: 14,
                lineHeight: 19.5,
                color: atlas.cream,
              }}>
              {toast.message}
            </RNText>
            {toast.retry ? (
              <Pressable
                onPress={() => {
                  setToast(null);
                  void onApple();
                }}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                hitSlop={10}
                style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
                <RNText
                  maxFontSizeMultiplier={MAX_TEXT_SCALE}
                  style={{
                    fontFamily: 'HelveticaNeue-Medium',
                    fontSize: 13,
                    color: atlas.warm,
                  }}>
                  Try again
                </RNText>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}

      {/* ── Bottom block ── */}
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: px(34),
          paddingBottom: Math.max(insets.bottom, px(20)) + px(24),
        }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: px(46),
            lineHeight: px(46) * 1.12,
            letterSpacing: -0.7,
            color: atlas.cream,
          }}>
          Your{' '}
          <RNText style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: atlas.warm }}>
            closet
          </RNText>
          .{'\n'}Your{' '}
          <RNText style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: atlas.warm }}>
            friends
          </RNText>
          .{'\n'}Your{' '}
          <RNText style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: atlas.warm }}>
            stylist
          </RNText>
          .
        </RNText>

        <View
          style={{
            marginTop: px(22),
            paddingTop: px(14),
            borderTopWidth: 1,
            borderTopColor: 'rgba(243,240,233,0.22)',
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: px(16),
          }}>
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            numberOfLines={2}
            style={{ ...eyebrowStyle, flexShrink: 1, lineHeight: px(9) * 1.5 }}>
            Shearling coat · worn 34 times
          </RNText>
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: px(20),
              color: atlas.cream,
            }}>
            $8.20 <RNText style={eyebrowStyle}>/ wear</RNText>
          </RNText>
        </View>

        {online ? (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(220)}
            style={{ marginTop: px(30), gap: px(11) }}>
            {appleAvailable ? (
              <Pressable
                onPress={() => void onApple()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
                style={{
                  minHeight: Math.max(MIN_TAP_TARGET, px(51)),
                  borderRadius: 32,
                  backgroundColor: atlas.cream,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: px(17),
                  paddingHorizontal: px(16),
                  opacity: busy ? 0.6 : 1,
                }}>
                <RNText
                  maxFontSizeMultiplier={MAX_TEXT_SCALE}
                  style={{
                    fontFamily: 'HelveticaNeue-Medium',
                    fontSize: 15,
                    color: atlas.ink,
                  }}>
                  Sign in with Apple
                </RNText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onEmail}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue with email"
              style={{
                minHeight: Math.max(MIN_TAP_TARGET, px(51)),
                borderRadius: 32,
                borderWidth: 1,
                borderColor: 'rgba(243,240,233,0.34)',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: px(17),
                paddingHorizontal: px(16),
                opacity: busy ? 0.6 : 1,
              }}>
              <RNText
                maxFontSizeMultiplier={MAX_TEXT_SCALE}
                style={{
                  fontFamily: 'HelveticaNeue-Medium',
                  fontSize: 15,
                  color: atlas.cream,
                }}>
                Continue with email
              </RNText>
            </Pressable>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                marginTop: px(9),
                textAlign: 'center',
                fontFamily: 'HelveticaNeue',
                fontSize: 12,
                lineHeight: 18,
                color: 'rgba(243,240,233,0.5)',
              }}>
              Plan an outfit for what’s ahead. Borrow the rest.
            </RNText>
          </Animated.View>
        ) : (
          /* ── W-11: both buttons replaced, never merely disabled ── */
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(220)}
            accessibilityLiveRegion="polite"
            style={{ marginTop: px(30) }}>
            <RNText
              maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
              style={{
                fontFamily: 'InstrumentSerif_400Regular',
                fontSize: px(30),
                lineHeight: px(30) * 1.15,
                color: atlas.cream,
              }}>
              You’re offline.
            </RNText>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                marginTop: px(10),
                marginBottom: px(22),
                fontFamily: 'HelveticaNeue',
                fontSize: 14,
                lineHeight: 21.5,
                color: 'rgba(243,240,233,0.62)',
              }}>
              Signing in needs a connection. Nothing else about Cinch does — once you’re in, your
              closet works without one.
            </RNText>
            {/* The poll retries on its own; the chip is for the impatient. */}
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => void Haptics.selectionAsync().catch(() => {})}
                style={{
                  minHeight: MIN_TAP_TARGET,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderWidth: 1,
                  borderColor: 'rgba(243,240,233,0.34)',
                  borderRadius: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <RNText
                  maxFontSizeMultiplier={MAX_TEXT_SCALE}
                  style={{
                    fontFamily: 'HelveticaNeue-Medium',
                    fontSize: 14,
                    color: atlas.cream,
                  }}>
                  Try again
                </RNText>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
