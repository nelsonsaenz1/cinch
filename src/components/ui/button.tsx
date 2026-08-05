import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

// The accent is SPENT, not sprayed: it lives on the primary action and nowhere
// else. Secondary buttons are outlined with the structural rule colour, like
// everything else in the plate grammar; ghost actions are quiet ink.
const container: Record<Variant, string> = {
  primary: 'bg-accent dark:bg-accent-dark',
  secondary: 'bg-transparent border border-rule dark:border-rule-dark',
  ghost: 'bg-transparent',
};

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
   * Fires a selection tap on press. Note haptics silently no-op in Low Power
   * Mode, when Taptic is disabled, and while a camera session is active — so
   * the visual pressed state below is the real feedback, never the haptic.
   */
  haptic?: boolean;
  className?: string;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  haptic = false,
  disabled,
  onPress,
  className = '',
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

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
      style={{ minHeight: MIN_TAP_TARGET }}
      // NativeWind types `className` as a string, so the `({ pressed }) => ...`
      // callback form that plain RN Pressable accepts does not apply here.
      // The `active:` variant is NativeWind's equivalent and maps to pressed.
      className={[
        // rounded-md, not a capsule: pills belong to the glass chrome layer.
        'flex-row items-center justify-center rounded-md px-5 active:opacity-70',
        container[variant],
        isDisabled ? 'opacity-40' : '',
        className,
      ].join(' ')}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={theme[labelKey[variant]]} />
      ) : (
        <View className="flex-row items-center gap-2">
          <Text variant="body" className="font-semibold" style={{ color: theme[labelKey[variant]] }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
