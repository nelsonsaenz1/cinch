import { useEffect } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * Shared chrome for the Welcome & Sign-in flow (WelcomeSignInAtlas W-01…W-14).
 *
 * The atlas draws these screens in their own dialect — paper, one serif, an
 * oxblood accent — and several of its values exist nowhere else in the app, so
 * they live here as the atlas's own constants rather than leaking into the
 * theme. Values that DO match theme tokens (ink, paper/canvas, muted, oxblood/
 * accent, label/faint) are the same hexes; the atlas names are kept so a
 * side-by-side against Canvas.dc.html reads line for line.
 */
export const atlas = {
  ink: '#1C1A16',
  paper: '#FBFAF6',
  cream: '#F3F0E9',
  oxblood: '#6E2B2B',
  warm: '#E2B79C',
  muted: '#6B665C',
  label: '#8a8578',
  coverBase: '#17120E',
  /** The disabled Continue pill's ground. */
  pillDisabled: 'rgba(28,26,22,0.18)',
  /** The disabled pill's label. */
  pillDisabledLabel: 'rgba(251,250,246,0.9)',
  /** Empty code box. */
  boxEmpty: '#F4F1E9',
  boxEmptyBorder: 'rgba(28,26,22,0.14)',
  /** Wrong-code box ground. */
  boxError: '#FCF6F3',
  boxErrorBorder: 'rgba(110,43,43,0.55)',
  /** The W-12 tray callout. */
  callout: '#F4EFE6',
  calloutText: '#4a453c',
} as const;

/**
 * The Dynamic Type ceilings, matching the shared `Text` component exactly.
 * The display-class serif takes the tighter cap, everything else the looser
 * one — same numbers as text.tsx and the screen this flow replaced.
 */
export const MAX_DISPLAY_SCALE = 1.4;
export const MAX_TEXT_SCALE = 1.8;

export const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
export const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/terms';

/**
 * The paper screens' header row: back chevron left, wordmark centred — or the
 * wordmark alone when there is nowhere to go back to (W-13). The chevron is
 * the atlas's own ‹ glyph at 26px inside a 44pt target.
 */
export function AuthHeader({
  onBack,
  backDisabled = false,
}: {
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 26,
        paddingTop: 10,
      }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          disabled={backDisabled}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={{
            minWidth: MIN_TAP_TARGET,
            minHeight: MIN_TAP_TARGET,
            justifyContent: 'center',
          }}>
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: 26,
              lineHeight: 28,
              color: backDisabled ? '#B4AFA3' : atlas.ink,
            }}>
            {'‹'}
          </RNText>
        </Pressable>
      ) : (
        <View style={{ width: MIN_TAP_TARGET }} />
      )}
      <RNText
        maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
        style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22, color: atlas.ink }}>
        Cinch
      </RNText>
      <View style={{ width: MIN_TAP_TARGET }} />
    </View>
  );
}

/**
 * The sending spinner — the atlas's 15px ring, cream on ink. Under Reduce
 * Motion the rotation gives way to an opacity pulse, the same substitution the
 * app's shared Spinner makes (rotation is the vestibular half; a frozen ring
 * says "stuck", not "working").
 */
export function PillSpinner() {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = withRepeat(
        withTiming(0.35, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
      return () => cancelAnimation(pulse);
    }
    rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [reduced, rotation, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        {
          width: 15,
          height: 15,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: 'rgba(243,240,233,0.3)',
          borderTopColor: atlas.cream,
        },
        style,
      ]}
    />
  );
}
