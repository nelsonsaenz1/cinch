import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * An oxblood outline with an oxblood label — PD-02's "Withdraw consent" and
 * PD-06's "Delete my account".
 *
 * The one control the shared `Button` cannot express: `variant="secondary"`
 * draws its ring in the structural `rule` colour and sets the label in ink,
 * and both live inside `ground()` / `labelKey` where no prop reaches them.
 * `variant="critical"` is the wrong answer too — that is the deeper brick
 * #8A2E28, and atlas 38 asks for the brand red #6E2B2B on both of these.
 *
 * Deliberately a near-twin of the one inside `components/item/delete-sheet.tsx`
 * rather than an import of it: that one is module-private to a file another
 * unit owns. Flagged in the handover — the two should become one, and this is
 * the second time the app has hand-built this control.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** `rounded-md` — the radius `ui/button.tsx` draws its own pill at. */
const RADIUS = 12;

/** The atlas sets these two controls at 50–52pt, above the 44pt floor. */
const HEIGHT = 52;

export function OutlinedAccentButton({
  title,
  hint,
  loading = false,
  disabled = false,
  onPress,
}: {
  title: string;
  hint?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const press = usePressFeedback(!isDisabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          /* haptics are best-effort; never block the action */
        });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ height: HEIGHT, minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center justify-center rounded-md px-5 ${
        isDisabled ? 'opacity-40' : ''
      }`}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: RADIUS, borderWidth: 1, borderColor: withAlpha(theme.accent, 0.5) },
          press.style,
        ]}
      />
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, press.style]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          // Inline colour, never a second `text-*` class: `variant="body"`
          // already carries `text-ink` and NativeWind resolves two colour
          // utilities on one element by key order, not by intent.
          <Text variant="body" className="font-semibold" style={{ color: theme.accent }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
