import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  describeDate,
  describeSpan,
  joinDates,
  ordinalWord,
  repeatRegisterFor,
  weekdayName,
} from '@/features/styling/repeat';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * The Repeat's first two registers — P-01 and P-02 of the atlas — living
 * inside the plate, beside the outfit it is about.
 *
 * `previousWears` is real marked history for this exact core (see
 * `wearsOfCore` in `@/features/styling/repeat`), oldest first, and it alone
 * decides the register:
 *
 *   0 previous wears — not a repeat. Renders nothing.
 *   1 previous wear  — P-01: one line, not a banner, not a warning colour.
 *                       Defends the suggestion rather than apologising for it.
 *   2+ previous wears — P-02: a panel naming every real date, the cause
 *                       stated before the door — "see plans" — is offered,
 *                       "show me another" sitting right beside it.
 *
 * There is no third escalation. Three or more previous wears still renders
 * the same P-02 panel with all the real dates in it — "escalate once" means
 * the REGISTER stops changing, not that the count stops being named.
 */
export function RepeatMark({
  previousWears,
  pieceCount,
  totalCores,
  now = new Date(),
  onSeePlans,
  onShowAnother,
}: {
  /** Real past wears of this exact core, oldest first. Empty = not a repeat. */
  previousWears: Date[];
  /** The closet's own piece count, for "N pieces make M outfits". */
  pieceCount: number;
  /** `countOutfits` for this wardrobe — never a constant. */
  totalCores: number;
  now?: Date;
  onSeePlans: () => void;
  onShowAnother: () => void;
}) {
  const theme = useTheme();
  const register = repeatRegisterFor(previousWears);

  if (register.kind === 'none') return null;

  if (register.kind === 'first') {
    return (
      <View
        className="mt-3.5"
        style={{
          borderLeftWidth: 2,
          borderLeftColor: theme.accent,
          paddingLeft: 12,
          paddingVertical: 2,
        }}>
        <Text variant="body">You wore this on {weekdayName(register.lastWorn)}.</Text>
        <Text variant="callout" className="mt-1 text-muted dark:text-muted-dark">
          Still the best fit your closet makes for today.
        </Text>
      </View>
    );
  }

  // register.kind === 'firm'
  const dateParts = [...register.previousWears.map((d) => describeDate(d, now)), 'today'];
  const first = register.previousWears[0]!;

  return (
    <View className="mt-3.5 rounded-md p-3.5" style={{ backgroundColor: theme.blush }}>
      <Text variant="body">
        {capitalize(ordinalWord(register.occurrence))} time {describeSpan(first, now)} —{' '}
        {joinDates(dateParts)}.
      </Text>
      <Text variant="callout" className="mt-1.5 text-muted dark:text-muted-dark">
        {pieceCount} pieces make {totalCores} outfits, and this one keeps winning. A larger
        closet is what ends the repetition.
      </Text>
      <View className="mt-3 flex-row items-center gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See plans"
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET - 12, justifyContent: 'center' }}
          className="active:opacity-60"
          onPress={onSeePlans}>
          <Text variant="label" className="font-medium" style={{ color: theme.accent }}>
            See plans
          </Text>
        </Pressable>
        <Text variant="label" style={{ color: theme.muted }}>
          ·
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show me another outfit"
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET - 12, justifyContent: 'center' }}
          className="active:opacity-60"
          onPress={onShowAnother}>
          <Text variant="label" className="font-medium">
            Show me another
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
