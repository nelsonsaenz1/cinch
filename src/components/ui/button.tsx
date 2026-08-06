import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, useTheme, type ThemeColors } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

/** `rounded-md` in tailwind.config.js — pills belong to the glass chrome layer. */
const RADIUS = 12;

/**
 * The ground — background and border — as inline styles rather than classes.
 *
 * The accent is SPENT, not sprayed: it lives on the primary action and nowhere
 * else. Secondary buttons are outlined with the structural rule colour, like
 * everything else in the plate grammar; ghost actions are quiet ink.
 *
 * It is drawn on an absolutely-positioned `Animated.View` so the press
 * compression carries the whole pill and not just its label. That layer cannot
 * take a `className` — NativeWind's interop is registered for the React Native
 * primitives, not for Reanimated's wrappers, so a class there would silently do
 * nothing — hence the theme lookup, the same reasoning as `labelKey` below.
 */
function ground(variant: Variant, theme: ThemeColors): ViewStyle {
  const base: ViewStyle = { borderRadius: RADIUS };
  if (variant === 'primary') return { ...base, backgroundColor: theme.accent };
  if (variant === 'secondary') return { ...base, borderWidth: 1, borderColor: theme.rule };
  return base;
}

/**
 * Label colour is applied as an inline STYLE, not a className.
 *
 * `<Text variant="body">` already carries `text-ink`, and NativeWind gives no
 * guaranteed precedence between two `text-*` utilities on one element — so a
 * `text-canvas` class here lost, and every primary button rendered ink-on-
 * oxblood: legible enough to survive review, wrong everywhere it shipped. An
 * inline style always wins. `labelKey` names the theme colour per variant.
 */
const labelKey: Record<Variant, 'canvas' | 'ink' | 'muted'> = {
  primary: 'canvas',
  secondary: 'ink',
  ghost: 'muted',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /**
   * Fires a selection tap on press. Defaults ON: a Button is a discrete
   * commitment, and 30 of the app's call sites — every destructive and every
   * commit action among them — simply omitted the prop and shipped silent. The
   * handful of places that must stay quiet pass `haptic={false}`.
   *
   * Note haptics silently no-op in Low Power Mode, when Taptic is disabled, and
   * while a camera session is active — so the visual pressed state below is the
   * real feedback, never the haptic.
   */
  haptic?: boolean;
  className?: string;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  haptic = true,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  className = '',
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const press = usePressFeedback(!isDisabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => {
        if (haptic) {
          void Haptics.selectionAsync().catch(() => {
            /* haptics are best-effort; never block the action */
          });
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      style={{ minHeight: MIN_TAP_TARGET }}
      // Layout, padding and the caller's own classes stay here so `px-0`,
      // `px-6`, `flex-1` and `self-*` keep behaving exactly as they always did.
      // Only the paint moved onto the animated layers below.
      className={[
        'flex-row items-center justify-center rounded-md px-5',
        isDisabled ? 'opacity-40' : '',
        className,
      ].join(' ')}
      {...rest}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, ground(variant, theme), press.style]}
      />
      {/* The label rides the same shared value as the ground, so the pill and
          what is written on it compress as one object rather than sliding
          against each other. */}
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, press.style]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme[labelKey[variant]]} />
        ) : (
          <Text variant="body" className="font-semibold" style={{ color: theme[labelKey[variant]] }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
