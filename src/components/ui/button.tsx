import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

const container: Record<Variant, string> = {
  primary: 'bg-accent dark:bg-accent-dark',
  secondary: 'bg-tray dark:bg-tray-dark border border-hairline dark:border-hairline-dark',
  ghost: 'bg-transparent',
};

const label: Record<Variant, string> = {
  primary: 'text-canvas dark:text-canvas',
  secondary: 'text-ink dark:text-ink-dark',
  ghost: 'text-accent dark:text-accent-dark',
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
        'flex-row items-center justify-center rounded-chip px-5 active:opacity-70',
        container[variant],
        isDisabled ? 'opacity-40' : '',
        className,
      ].join(' ')}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          <Text variant="body" className={`font-semibold ${label[variant]}`}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
