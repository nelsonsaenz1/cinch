import { Pressable, View } from 'react-native';

import { SheetShell } from '@/components/events/date-sheet';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * IF-05's "Cancel with picks made" — shown when Cancel (or the backdrop, or
 * hardware back) fires while at least one checkbox is picked and nothing has
 * been sent yet. "Nothing sends until Done", so leaving the sheet only ever
 * loses a draft, never an invitation already on its way — the same shape of
 * question `DiscardSheet` asks about a half-written occasion.
 *
 * Buttons at `rounded-md`, not the atlas's drawn `border-radius:22` pill —
 * `tailwind.config.js`'s radius scale reserves `full` for circles and glass
 * chrome, never a labelled capsule; the house rule outranks the atlas's
 * literal pixel value here, the same call `event/[id]/index.tsx`'s
 * `StatePill` already made.
 */
export function LeaveWithoutInvitingSheet({
  visible,
  pickedCount,
  onKeepChoosing,
  onDiscard,
}: {
  visible: boolean;
  pickedCount: number;
  onKeepChoosing: () => void;
  onDiscard: () => void;
}) {
  const theme = useTheme();

  return (
    <SheetShell
      visible={visible}
      onRequestClose={onKeepChoosing}
      accessibilityLabel="Leave without inviting?">
      <Text variant="plate">Leave without inviting?</Text>
      <Text variant="body" className="mt-2.5" style={{ color: theme.muted }}>
        {pickedCount === 1
          ? 'One person is checked and hasn’t been invited yet.'
          : `${pickedCount} people are checked and haven’t been invited yet.`}
      </Text>

      <View className="mt-4 gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep choosing"
          onPress={onKeepChoosing}
          style={{ minHeight: MIN_TAP_TARGET, backgroundColor: theme.ink }}
          className="flex-row items-center justify-center rounded-md active:opacity-80">
          <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
            Keep choosing
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard"
          onPress={onDiscard}
          style={{ minHeight: MIN_TAP_TARGET, borderColor: theme.rule, borderWidth: 1 }}
          className="flex-row items-center justify-center rounded-md active:opacity-60">
          <Text variant="body" className="font-semibold" style={{ color: theme.accent }}>
            Discard
          </Text>
        </Pressable>
      </View>
    </SheetShell>
  );
}
