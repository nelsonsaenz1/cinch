import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  CLEAR_BODY,
  CLEAR_CANCEL,
  CLEAR_CONFIRM,
  CLEAR_TITLE,
} from '@/features/activity-center/copy';
import { haptics } from '@/lib/haptics';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * AC-10 · Clear All, and the one irreversible act on this surface.
 *
 * ══ WHY THIS IS NOT `Alert.alert` ══════════════════════════════════════════
 *
 * `feedbackSurface({ destructive: true })` answers `'alert'`, and that answer is
 * about the SURFACE CLASS — a blocking, focus-stealing stop rather than a toast
 * or a band — not about the iOS widget. `DeleteBoardSheet` made this argument
 * first and `components/circles/confirm-dialogs.tsx` follows it; this file
 * follows both rather than re-deciding. iOS orders its own buttons, refuses a
 * heading longer than a phrase, has no oxblood, and cannot put the calm choice
 * first. `clear.body` is three sentences and the middle one is load-bearing.
 *
 * So it is the house's own overlay — `accessibilityViewIsModal`, a scrim that
 * dismisses to the SAFE choice, and `onRequestClose` (the Android back gesture)
 * wired to the same safe choice. A destructive dialog whose incidental
 * dismissals landed on the destructive branch would be a trap.
 *
 * ══ THE MIDDLE SENTENCE ════════════════════════════════════════════════════
 *
 * "Pending invitations stay in your circles." It is the single most likely
 * misunderstanding of this button, and it is structurally true rather than
 * reassuring: `useClearAllActivity` deletes from `activity_events` and touches
 * `circle_members` nowhere, so an invitation whose NOTICE was cleared is still
 * waiting in the group and still answerable there. Clearing the notice is not
 * declining the invite.
 *
 * ══ HAPTICS ═══════════════════════════════════════════════════════════════
 *
 * §10 asks for `notificationWarning` on present and `impactMedium` on confirm.
 * They map onto the house policy — `haptics.warning()` and
 * `haptics.destructiveConfirm()` — rather than onto raw `expo-haptics` calls,
 * which `tests/haptic-policy.test.ts` refuses to let a product file make. The
 * confirm's weight is `Heavy` there rather than `Medium`, and that is the
 * policy's deliberate single exception for an irreversible act; matching the
 * design record's letter would mean giving this dialog a lighter tick than
 * deleting one garment, which is the wrong relative weight.
 */
export function ClearAllDialog({
  visible,
  pending = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // While the purge is in flight nothing may dismiss the dialog — a scrim tap
  // that closed it mid-delete would leave the reader with no idea whether it
  // happened, and this is the one act here they cannot check by undoing.
  const dismiss = pending ? undefined : onCancel;

  return (
    <Modal
      visible={visible}
      transparent
      // §10's "sheet spring in" becomes an opacity-only cross-fade under Reduce
      // Motion, and `'none'` under it entirely: the dialog still arrives in
      // full, with everything it says. The animation was never the carrier of
      // any information, which is the standard the accessibility contract sets.
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={dismiss ?? (() => undefined)}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={CLEAR_CANCEL}
        />
        <View
          accessibilityViewIsModal
          style={{ paddingHorizontal: GUTTER, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="rounded-plate bg-canvas">
            {/* The card scrolls rather than caps. At AX-XXXL a three-sentence
                consequence is taller than the viewport, and the one thing a
                destructive confirmation must never do is hide half of what it
                is warning about. `bounces={false}` so it does not read as
                scrollable when it is not. */}
            <ScrollView bounces={false} contentContainerStyle={{ padding: 20 }} accessibilityViewIsModal>
              <Text variant="title" trim accessibilityRole="header">
                {CLEAR_TITLE}
              </Text>
              <Text variant="body" className="mt-3 text-muted">
                {CLEAR_BODY}
              </Text>
              <View className="mt-5" style={{ gap: 10 }}>
                {/* The safe outcome first, in reading order: the calm one is
                    where the eye should land, and the destructive one has to be
                    chosen deliberately. */}
                <Button
                  title={CLEAR_CANCEL}
                  variant="secondary"
                  onPress={onCancel}
                  disabled={pending}
                  accessibilityLabel={CLEAR_CANCEL}
                />
                {/* The page's single oxblood action, spent here and nowhere
                    else in the Activity Center. */}
                <Button
                  title={CLEAR_CONFIRM}
                  variant="primary"
                  loading={pending}
                  onPress={() => {
                    haptics.destructiveConfirm();
                    onConfirm();
                  }}
                  accessibilityLabel={CLEAR_CONFIRM}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}
