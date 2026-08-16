import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The atlas's button, at the atlas's sizes: 44/10 filled for the hero way
 * forward, 40/10 and 36/9 and 34/9 outlined for the quieter commitments. Not
 * the shared `Button`, whose 12pt radius and 17px label are fixed inside its
 * animated ground — this page's controls are drawn smaller than the app's
 * default hand. Press feedback, haptics and the 44pt floor (via hitSlop when
 * the drawn height is under it) match `Button` exactly.
 *
 * Lifted out of `explore.tsx` by UX-04: the people search it used to host is
 * now its own sheet, and both surfaces draw this control. Still feature-local,
 * not a `components/ui` primitive — the shared press/motion primitive is the
 * integration owner's and this file must not become a second one.
 */

/** The outline edge — 22% ink, stronger than `rule`, for buttons inside ruled cards. */
const OUTLINE_EDGE = 'rgba(28,26,22,0.22)';

export type LatelyButtonProps = {
  title: string;
  onPress: () => void;
  /** The ink fill — hero CTAs only. Everything quieter is the outline. */
  filled?: boolean;
  height?: number;
  radius?: number;
  fontSize?: number;
  paddingX?: number;
  disabled?: boolean;
};

export function LatelyButton({
  title,
  onPress,
  filled = false,
  height = 34,
  // `md`, per reference board A: every labelled control is 12. Was 9.
  radius = 12,
  fontSize = 13,
  paddingX = 14,
  disabled = false,
}: LatelyButtonProps) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={height < MIN_TAP_TARGET ? (MIN_TAP_TARGET - height) / 2 : undefined}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          /* haptics are best-effort; never block the action */
        });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      className={disabled ? 'opacity-40' : ''}>
      <Animated.View
        style={[
          press.style,
          {
            height,
            borderRadius: radius,
            paddingHorizontal: paddingX,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          filled ? { backgroundColor: theme.ink } : { borderWidth: 1, borderColor: OUTLINE_EDGE },
        ]}>
        {/* Filled and outlined differed by weight once. TY-01 removes weight
            from the product, so the fill and the label colour carry it alone. */}
        <Text
          variant={filled ? 'body' : 'label'}
          style={{
            fontSize,
            lineHeight: Math.round(fontSize * 1.3),
            color: filled ? theme.canvas : theme.ink,
          }}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
