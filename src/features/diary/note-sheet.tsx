import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { spring, useTheme } from '@/theme/tokens';

/** The column's own check constraint — `note text check (char_length(note) <= 500)`. */
export const NOTE_LIMIT = 500;

export type NoteSheetProps = {
  visible: boolean;
  /** What is on the row now. Empty string is "no note". */
  initial: string;
  onSave: (next: string) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
};

/**
 * The note editor — the one thing that stays editable after the day has passed.
 *
 * The atlas draws "Your note" as a finished paragraph and never says where it
 * came from. The contract does: the note is written on the morning's confirm
 * and, past the 24-hour correction window, is the ONLY part of an entry that
 * can still be changed. So it has to be reachable from the entry, and this is
 * the smallest surface that does it.
 *
 * Same sheet grammar as `item-edit-sheet.tsx`, including its dismissal rule —
 * a stray tap on the scrim means "I changed nothing", which is a real and safe
 * answer here. `maxLength` mirrors the column's own constraint rather than
 * inventing a shorter one, so the field cannot compose a note the database will
 * refuse.
 */
export function NoteSheet({
  visible,
  initial,
  onSave,
  onCancel,
  busy = false,
  error = null,
}: NoteSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState(initial);

  // Re-seeded on OPEN, adjusted during render rather than in an effect — the
  // repo lint rejects `setState` inside `useEffect`, and an effect here would
  // also paint one frame of the previous entry's note. `visible` is the
  // trigger, never `initial`, which changes identity on every keystroke above.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(initial);
  }

  const y = useSharedValue(visible ? 0 : 1);
  useEffect(() => {
    y.value = withSpring(visible ? 0 : 1, spring.smooth);
  }, [visible, y]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * 40 }],
    opacity: 1 - y.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={busy}
          onPress={onCancel}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(28,26,22,0.28)',
          }}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[sheetStyle, { marginBottom: Math.max(insets.bottom, 10) + 10 }]}
          className="mx-2.5 overflow-hidden rounded-plate bg-canvas">
          <View className="px-5 pt-5">
            <Text variant="title">Your note</Text>
            <Text variant="note" className="mt-2.5">
              What you noticed about wearing this. It stays on the day, and only you ever see it.
            </Text>
          </View>

          <View className="px-5 pt-4">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={NOTE_LIMIT}
              placeholder="Coat too warm indoors…"
              // `muted`, not `faint`. #8A8578 is 3.52:1 on canvas — an AA failure
              // and the constitution's flattest rule — and a placeholder is the
              // one piece of text in a field that has to be readable before
              // anything is typed. `muted` is what every other field in the app
              // uses (search-field, item-edit-sheet, review-card).
              placeholderTextColor={theme.muted}
              accessibilityLabel="Note for this day"
              editable={!busy}
              className="rounded-md border border-rule px-3 py-2.5 font-body text-callout"
              style={{
                minHeight: 108,
                color: theme.ink,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {error ? (
            <Text
              variant="label"
              accessibilityLiveRegion="polite"
              className="px-5 pt-3 text-critical">
              {error}
            </Text>
          ) : null}

          <View className="gap-2.5 px-5 pb-5 pt-4">
            <Button title="Save" loading={busy} onPress={() => onSave(draft)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={onCancel}
              style={{ height: 48 }}
              className="items-center justify-center active:opacity-60">
              <Text variant="callout" className="text-muted">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
