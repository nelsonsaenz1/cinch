import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { noRoomCopy } from '@/features/onboarding/ten-copy';
import {
  PLATE_ACTION_HEIGHT,
  PLATE_BODY_SIZE,
  PLATE_HEADLINE_SIZE,
  PLATE_PAD,
  PLATE_RADIUS,
  type TenMeasure,
} from '@/features/onboarding/ten-spec';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The account is at its TOTAL ceiling and a replacement was refused — drawn.
 *
 * REDESIGN 21 RESTYLED IT AND CHANGED NOTHING ELSE. The brief lists this plate
 * under "shipped, restyled to match", and that is exactly what happened: the
 * copy is `noRoomCopy` untouched, both doors go to the same two places they
 * always did (`onOpenStorage` → Storage, `onSeePlans` → `AddGarmentOverLimit`),
 * and the spoken announcement the route raises is the same paragraph. What
 * moved is the ink — a blush ground with a dashed clay hairline, the frames'
 * own no-room plate, in place of a white surface with a solid rule.
 *
 * WHAT IT REPLACED, two waves ago and still worth stating: `Alert.alert`,
 * carrying a 44-word paragraph that named an upgrade and offered no way to
 * reach one, in the one surface Cinch does not draw.
 *
 * IT SPENDS ITS OWN OXBLOOD NOW, and that is the one substantive change from
 * the shipped plate. The old rule was "the screen's single accent belongs to the
 * guided walk's own action"; DIRECTIVE §1 repealed the one-oxblood-per-screen
 * law outright, and the approved frame draws this plate's first door filled.
 * `See plans` stays the quieter of the two — the reader came here to change a
 * photograph, not to buy anything — so the order is unchanged and only the
 * weight of the first door moved.
 *
 * The plate is drawn UNDER the tray, never instead of it, for the same reason
 * the camera refusal keeps the masthead: nothing that was photographed has
 * moved, and the screen must go on saying so.
 */
export function TenNoRoomNotice({
  slotId,
  measure,
  onOpenStorage,
  onSeePlans,
}: {
  slotId: number;
  measure: TenMeasure;
  onOpenStorage: () => void;
  /** `AddGarmentOverLimit` — the placement that names the price, so this never does. */
  onSeePlans: () => void;
}) {
  const theme = useTheme();
  const copy = noRoomCopy(slotId);
  const storage = usePressFeedback();
  const plans = usePressFeedback();

  return (
    <View
      accessibilityRole="summary"
      style={{
        borderRadius: PLATE_RADIUS,
        padding: PLATE_PAD,
        backgroundColor: theme.blush,
        borderWidth: 1,
        // Dashed, matching the empty wells above it: this plate is drawn where a
        // well would have gone and it is saying that no well is available.
        borderStyle: 'dashed',
        borderColor: theme.blushRule,
      }}>
      <Text variant="eyebrow">{copy.eyebrow}</Text>
      <View style={{ marginTop: 8 }}>
        <Text
          variant="title"
          trim
          style={{
            fontSize: PLATE_HEADLINE_SIZE,
            lineHeight: leading('instrument', PLATE_HEADLINE_SIZE, 1.1),
          }}>
          {copy.headline}
        </Text>
      </View>
      <Text
        variant="body"
        style={{
          marginTop: 10,
          fontSize: PLATE_BODY_SIZE,
          lineHeight: leading('helvetica', PLATE_BODY_SIZE, 1.45),
        }}>
        {copy.note}
      </Text>
      {/* Two doors on one row, and the row STACKS at accessibility sizes rather
          than truncating: "Open Storage" is wider than half the plate there, and
          a remedy the reader cannot read is not a remedy. */}
      <View
        style={{
          marginTop: 16,
          flexDirection: measure.large ? 'column' : 'row',
          alignItems: measure.large ? 'stretch' : 'center',
          gap: 10,
        }}>
        <Pressable
          onPress={onOpenStorage}
          onPressIn={storage.onPressIn}
          onPressOut={storage.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={copy.storage}
          style={{ height: PLATE_ACTION_HEIGHT, minWidth: MIN_TAP_TARGET }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 22,
                borderRadius: PLATE_ACTION_HEIGHT / 2,
                backgroundColor: theme.accent,
              },
              storage.style,
            ]}>
            <Text
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: 16,
                lineHeight: leading('helvetica', 16, 1.2),
                color: theme.canvas,
              }}>
              {copy.storage}
            </Text>
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={onSeePlans}
          onPressIn={plans.onPressIn}
          onPressOut={plans.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={copy.plans}
          style={{ height: PLATE_ACTION_HEIGHT, minWidth: MIN_TAP_TARGET }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 22,
                borderRadius: PLATE_ACTION_HEIGHT / 2,
                backgroundColor: theme.surface,
              },
              plans.style,
            ]}>
            <Text
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: 16,
                lineHeight: leading('helvetica', 16, 1.2),
                color: theme.accent,
              }}>
              {copy.plans}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
