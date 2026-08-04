import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

// The accent is SPENT, not sprayed: it lives on the primary action and nowhere
// else. Secondary buttons are outlined with the structural rule colour, like
// everything else in the plate grammar; ghost actions are quiet ink.
const container: Record<Variant, string> = {
  primary: 'bg-accent dark:bg-accent-dark',
  secondary: 'bg-transparent border border-rule dark:border-rule-dark',
  ghost: 'bg-transparent',
};

const label: Record<Variant, string> = {
  primary: 'text-canvas dark:text-canvas',
  secondary: 'text-ink dark:text-ink-dark',
  ghost: 'text-muted dark:text-muted-dark',
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
        // rounded-md, not a capsule: pills belong to the glass chrome layer.
        'flex-row items-center justify-center rounded-md px-5 active:opacity-70',
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
