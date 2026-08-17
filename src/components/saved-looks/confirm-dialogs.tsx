import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  DELETE_COLLECTION,
  REMOVE,
  deleteCollectionBody,
  deleteCollectionTitle,
  removeAccessibilityLabel,
  removeBody,
} from '@/features/saved-looks/copy';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * THE TWO CONFIRMATIONS — OS-07's removal and OS-05c's collection delete.
 *
 * ══ WHY THESE ARE NOT `Alert.alert` ════════════════════════════════════════
 *
 * The argument is `DeleteBoardSheet`'s and `components/circles/confirm-dialogs`'
 * before it, and it is followed rather than re-decided:
 * `feedbackSurface({ destructive: true })` answers `'alert'`, and that answer is
 * about the SURFACE CLASS — a blocking, focus-stealing stop — not about the iOS
 * widget. iOS orders its own buttons, refuses a heading longer than a phrase,
 * has no oxblood, and cannot put the calm outcome first. Both of the bodies
 * below lead with what happens at a length an `Alert` will not carry.
 *
 * The scrim and the Android back gesture both dismiss to the SAFE choice. A
 * destructive dialog whose incidental dismissals landed on the destructive
 * branch would be a trap, and both of these appear one tap from a swipe.
 *
 * ══ EACH ONE NAMES WHAT IS **NOT** LOST ════════════════════════════════════
 *
 * Which is the unusual part here, and the whole reason the copy is as long as it
 * is. Both of these acts are frightening for the same reason: the reader is
 * about to delete something that points at somebody else's look, or at a shelf
 * with other people's looks on it.
 *
 * · Remove: "The original in Maya's Daily isn't affected." True by construction
 *   — `saved_looks` has no cascade to anything, its `source_id` is deliberately
 *   not even a foreign key, and deleting a row of it touches exactly one row.
 * · Delete collection: "The N looks inside stay in Saved." That sentence IS
 *   `saved_looks.collection_id`'s `on delete set null`, asserted in
 *   21_saved_looks.sql at 23 rather than promised here.
 *
 * ══ MOTION AND HAPTICS ═════════════════════════════════════════════════════
 *
 * `useReducedMotion()` drops the fade entirely — the dialog still arrives, in
 * full, with everything it says, which is the standard §9 sets. §8 asks for
 * `notificationAsync(Warning)` when the sheet opens and a medium impact on the
 * confirm; in this app's vocabulary those are `haptics.warning()` and
 * `haptics.destructiveConfirm()`, fired by the SCREEN that opens and confirms.
 * `lib/haptics` exports intents rather than strengths on purpose and has no
 * Medium, so the confirm is the app's one Heavy — a deliberate, recorded
 * deviation of one step, and the alternative was adding a strength to a module
 * whose entire argument is that call sites must not choose strengths.
 */

function ConfirmDialog({
  visible,
  heading,
  body,
  confirmTitle,
  confirmAccessibilityLabel,
  safeTitle,
  onSafe,
  onConfirm,
  pending,
}: {
  visible: boolean;
  heading: string;
  body: string;
  confirmTitle: string;
  confirmAccessibilityLabel: string;
  safeTitle: string;
  onSafe: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // While the act is in flight nothing may dismiss the dialog — a scrim tap
  // that closed it mid-delete would leave the reader with no idea whether it
  // happened.
  const dismiss = pending ? undefined : onSafe;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={dismiss ?? (() => undefined)}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={safeTitle}
        />
        <View
          accessibilityViewIsModal
          style={{ paddingHorizontal: GUTTER, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          {/* The card scrolls rather than caps. At AX-XXXL a two-sentence
              consequence is taller than the viewport, and the one thing a
              destructive confirmation must never do is hide half of what it is
              warning about. */}
          <View className="rounded-plate bg-canvas">
            <ScrollView bounces={false} contentContainerStyle={{ padding: 20 }} accessibilityViewIsModal>
              <Text variant="title" trim accessibilityRole="header">
                {heading}
              </Text>
              <Text variant="body" className="mt-3 text-muted">
                {body}
              </Text>
              <View className="mt-5" style={{ gap: 10 }}>
                {/* The safe outcome first, in reading order. */}
                <Button
                  title={safeTitle}
                  variant="secondary"
                  onPress={onSafe}
                  disabled={pending}
                  accessibilityLabel={safeTitle}
                />
                <Button
                  title={confirmTitle}
                  variant="primary"
                  loading={pending}
                  onPress={onConfirm}
                  accessibilityLabel={confirmAccessibilityLabel}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * OS-07 · removing one saved look.
 *
 * The frame's action sheet also offers "Move to a collection instead", which is
 * a THIRD outcome rather than a second safe one, so it is not drawn here: a
 * confirm dialog with two safe branches makes neither of them the obvious way
 * out, and the move needs a picker this dialog has no room for. The detail
 * screen offers "Move to…" as a peer of Remove, one tap earlier, which is where
 * somebody who wanted to move rather than delete actually is.
 */
export function RemoveSaveDialog({
  visible,
  title,
  sourceLabel,
  pending = false,
  onCancel,
  onRemove,
}: {
  visible: boolean;
  /** The look's snapshot title, for the destructive control's spoken label. */
  title: string | null;
  /** "Maya's Daily look" — named in the body, so the fear is answered by name. */
  sourceLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      heading={REMOVE.title}
      body={removeBody(sourceLabel)}
      confirmTitle={REMOVE.confirm}
      confirmAccessibilityLabel={removeAccessibilityLabel(title)}
      safeTitle={REMOVE.cancel}
      onSafe={onCancel}
      onConfirm={onRemove}
      pending={pending}
    />
  );
}

/** OS-05c · deleting a collection, and the looks inside it staying where they are. */
export function DeleteCollectionDialog({
  visible,
  name,
  memberCount,
  pending = false,
  onKeep,
  onDelete,
}: {
  visible: boolean;
  name: string;
  /** Counted from the saves already loaded, so it matches the grid behind it. */
  memberCount: number;
  pending?: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      heading={deleteCollectionTitle(name)}
      body={deleteCollectionBody(memberCount)}
      confirmTitle={DELETE_COLLECTION.confirm}
      confirmAccessibilityLabel={`${DELETE_COLLECTION.confirm} ${name.trim()}`}
      safeTitle={DELETE_COLLECTION.keep}
      onSafe={onKeep}
      onConfirm={onDelete}
      pending={pending}
    />
  );
}
