import { Pressable, View } from 'react-native';

import { SheetShell } from '@/components/events/date-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The three confirmations — Event Detail State Atlas E-09: cancel the
 * occasion, leave it, remove a guest. One shell, three sets of copy, because
 * the shape of the question never changes: "each says what is lost, in one
 * sentence, and each keep-option is named for the thing being kept rather
 * than 'Cancel' — a Cancel button inside a Cancel-this-occasion prompt is a
 * coin flip."
 *
 * No grabber: this is a question, not a picker, and a handle would invite
 * flicking it away without answering — same reasoning as `DiscardSheet`.
 *
 * The destructive control is hand-built rather than `<Button variant="…">`:
 * none of `Button`'s four variants fills with `critical`, and the atlas draws
 * every one of these three at `critical` (#8A2E28), never the accent — this
 * is "undoing something other people can already see" (Discard Sheet's own
 * comment on why ITS destructive stays accent, by contrast).
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  keepLabel,
  destructiveLabel,
  onKeep,
  destructiveBusy = false,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  /** Named for the thing being kept — never "Cancel". */
  keepLabel: string;
  destructiveLabel: string;
  onKeep: () => void;
  destructiveBusy?: boolean;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <SheetShell visible={visible} onRequestClose={onKeep} accessibilityLabel={title}>
      <Text variant="plate">{title}</Text>
      <Text variant="body" className="mt-2.5" style={{ color: theme.muted }}>
        {body}
      </Text>

      <View className="mt-4 flex-row gap-2">
        <Button title={keepLabel} variant="secondary" className="flex-1" onPress={onKeep} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={destructiveLabel}
          accessibilityState={{ disabled: destructiveBusy, busy: destructiveBusy }}
          disabled={destructiveBusy}
          onPress={onConfirm}
          style={{
            minHeight: MIN_TAP_TARGET,
            backgroundColor: theme.critical,
            opacity: destructiveBusy ? 0.6 : 1,
          }}
          className="flex-1 flex-row items-center justify-center rounded-md active:opacity-80">
          <Text variant="body" style={{ color: theme.canvas }}>
            {destructiveLabel}
          </Text>
        </Pressable>
      </View>
    </SheetShell>
  );
}
