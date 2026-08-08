import { View } from 'react-native';

import { SheetShell } from '@/components/events/date-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type DiscardSheetProps = {
  visible: boolean;
  /** Throw the draft away and leave. */
  onDiscard: () => void;
  /** Close the sheet and put the form back exactly as it was. */
  onKeepEditing: () => void;
};

/**
 * Cancel, with something typed (N-08).
 *
 * **Only shown when a field has been touched.** An untouched form closes on
 * Cancel without asking — "confirming a decision the user has not made yet is
 * friction dressed as care" — so the caller tracks one `touched` boolean, set
 * by a field's first *change* and never by focus, and only opens this when it
 * is true.
 *
 * No grabber. The pickers get one because they are things you dismiss; this is
 * a question, and a handle would invite flicking it away without answering.
 *
 * The destructive button is `accent`, not `critical`. The atlas draws N-08's
 * Discard in oxblood and the atlas wins on exact values — and the reading is
 * defensible on its own terms: nothing has been shared, nothing is being
 * destroyed but a draft, and `critical` is the app's colour for undoing
 * something other people can already see.
 */
export function DiscardSheet({ visible, onDiscard, onKeepEditing }: DiscardSheetProps) {
  const theme = useTheme();

  return (
    <SheetShell
      visible={visible}
      onRequestClose={onKeepEditing}
      accessibilityLabel="Discard this occasion?">
      <Text variant="plate">Discard this occasion?</Text>
      {/* `body` in `muted` via an inline style — the variant carries `text-ink`
          and a `text-muted` class beside it would be two colour utilities on
          one element, resolved by key order rather than by intent. */}
      <Text variant="body" className="mt-2.5" style={{ color: theme.muted }}>
        Nothing has been shared yet — no one has seen it.
      </Text>

      <View className="mt-4 flex-row gap-2">
        <Button
          title="Keep editing"
          variant="secondary"
          className="flex-1"
          onPress={onKeepEditing}
        />
        <Button title="Discard" variant="primary" className="flex-1" onPress={onDiscard} />
      </View>
    </SheetShell>
  );
}
