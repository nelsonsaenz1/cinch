import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { WITHDRAW_SHEET_BODY } from '@/features/privacy/copy';
import { useTheme } from '@/theme/tokens';

/**
 * PD-03 — the withdrawal confirmation, over a scrim.
 *
 * The atlas's rule for this page is "cost before action": what a destructive
 * choice removes is stated above the button that does it, in the present
 * tense, naming the replacement behaviour. So the sheet repeats the
 * consequence rather than asking "Are you sure?", which only proves the reader
 * can tap twice.
 *
 * DISMISSAL IS ALLOWED, unlike `ingest/consent-sheet.tsx`. That sheet makes its
 * scrim inert because a stray tap must never be recorded as an answer to a
 * consent question in either direction. This question is not symmetrical:
 * backing out means "leave consent exactly as it is", which is the safe,
 * complete answer and the state the user is already in. So the scrim and
 * hardware back both cancel.
 *
 * `Withdraw consent` is the filled oxblood pill (`variant="primary"`, the
 * accent) rather than `critical`: atlas 38 draws #6E2B2B, and the app's rule is
 * that a destructive action carries the brand red and never iOS red. Nothing
 * else on this screen spends the accent while the sheet is up.
 */
export function WithdrawConsentSheet({
  visible,
  busy = false,
  onWithdraw,
  onCancel,
}: {
  visible: boolean;
  busy?: boolean;
  onWithdraw: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        // Ignored mid-write: there is nothing left to cancel once the update
        // is on the wire, and a dismissal there would strand the screen.
        if (!busy) onCancel();
      }}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        {/* Hidden from assistive tech — "Keep it on" is the accessible way
            out, the same reasoning `delete-account-card.tsx` gives. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          disabled={busy}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          className="rounded-t-plate bg-canvas px-gutter pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 10 }}>
          {/* The grabber — the sheet's own furniture. */}
          <View className="items-center pb-4">
            <View className="h-[4px] w-9 rounded-full bg-sand" />
          </View>

          <Text variant="title" trim accessibilityRole="header">
            Withdraw AI consent?
          </Text>
          {/* `mt-5` for the atlas's 12pt gap: `trim` has already taken 9pt off
              the title's bottom edge and the two margins sum. */}
          {/* 17px, in `muted`: this is the consequence of a consent decision
              and the group's floor is that no such sentence is set below 15 pt. */}
          <Text variant="body" className="mt-5" style={{ color: theme.muted }}>
            {WITHDRAW_SHEET_BODY}
          </Text>

          <View className="mt-6 gap-2.5">
            <Button
              title="Withdraw consent"
              variant="primary"
              className="h-[52px]"
              loading={busy}
              accessibilityHint="Stops tagging, listing matches and the stylist chat. Your closet is unchanged."
              onPress={onWithdraw}
            />
            <Button
              title="Keep it on"
              variant="secondary"
              className="h-[52px]"
              disabled={busy}
              haptic={false}
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
