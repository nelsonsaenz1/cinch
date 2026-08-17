import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  DELETE_GROUP,
  deleteGroupBody,
  deleteGroupHeading,
  LEAVE_GROUP,
  leaveGroupHeading,
  REMOVE_MEMBER,
  removeMemberConfirm,
  removeMemberHeading,
} from '@/features/circles/copy';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * THE THREE CONFIRMATIONS — PC-08, plus the removal PC-07 leads to.
 *
 * ══ WHY THESE ARE NOT `Alert.alert` ════════════════════════════════════════
 *
 * `feedbackSurface({ destructive: true })` answers `'alert'`, and that answer is
 * about the SURFACE CLASS — a blocking, focus-stealing stop, rather than a
 * toast or a band — not about the iOS widget. `DeleteBoardSheet` already made
 * this exact argument and this file follows it rather than re-deciding: iOS
 * orders its own buttons, refuses a heading longer than a phrase, has no
 * oxblood, and cannot put the calm outcome first. All three of these
 * confirmations lead with WHAT IS LOST at a length an `Alert` will not carry.
 *
 * So it is the house's own overlay — `accessibilityViewIsModal`, a scrim that
 * dismisses to the SAFE choice, and `onRequestClose` (the Android back gesture)
 * wired to the same safe choice. A destructive dialog whose incidental
 * dismissals landed on the destructive branch would be a trap.
 *
 * ══ EVERY ONE OF THEM NAMES WHAT IS LOST ═══════════════════════════════════
 *
 * · Delete: everyone loses access, the waiting invitations are canceled, and it
 *   cannot be undone. All three are true of the schema — `circle_members` is
 *   `on delete cascade`, so the members and every unanswered invitation go with
 *   the row.
 * · Leave: you lose access, and the roster records that you LEFT rather than
 *   that you were removed. That distinction is the whole reason
 *   `circle_member_state` has five values where the events enum has four, and
 *   it is the question somebody leaving a small group actually has.
 * · Remove: their access ends immediately, and they are told they were removed
 *   and not who removed them. There is no remover field on `circle_members` for
 *   a future screen to leak, so the promise is structural.
 *
 * None of them says "permanent" where the schema does not: a removed or left
 * member can be invited again — the transition trigger permits
 * `removed|left|declined → invited` — and only the delete is irreversible.
 *
 * ══ REDUCE MOTION ══════════════════════════════════════════════════════════
 *
 * `useReducedMotion()` is the house pattern and it is honoured here by dropping
 * the fade entirely. The dialog still arrives, in full, with everything it says
 * — the animation was never the carrier of any information, which is the
 * standard the accessibility contract sets.
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
  // that closed the sheet mid-delete would leave the reader with no idea
  // whether it happened.
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
          {/* The card scrolls rather than caps. At AX-XXXL a three-sentence
              consequence is taller than the viewport, and the one thing a
              destructive confirmation must never do is hide half of what it is
              warning about. `bounces={false}` so it does not read as scrollable
              when it is not. */}
          <View className="rounded-plate bg-canvas">
            <ScrollView
              bounces={false}
              contentContainerStyle={{ padding: 20 }}
              accessibilityViewIsModal>
              <Text variant="title" trim accessibilityRole="header">
                {heading}
              </Text>
              <Text variant="body" className="mt-3 text-muted">
                {body}
              </Text>
              <View className="mt-5" style={{ gap: 10 }}>
                {/* The safe outcome first, in reading order: the calm one is
                    where the eye should land, and the destructive one has to be
                    chosen deliberately. */}
                <Button
                  title={safeTitle}
                  variant="secondary"
                  onPress={onSafe}
                  disabled={pending}
                  accessibilityLabel={safeTitle}
                />
                {/* The page's single oxblood action. */}
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

/** PC-08 · the owner's only exit, and the one act here that cannot be undone. */
export function DeleteGroupDialog({
  visible,
  groupName,
  memberCount,
  pending = false,
  onKeep,
  onDelete,
}: {
  visible: boolean;
  groupName: string;
  /** `joined` members, the owner included. The body rebuilds around it. */
  memberCount: number;
  pending?: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      heading={deleteGroupHeading(groupName)}
      body={deleteGroupBody(memberCount)}
      confirmTitle={DELETE_GROUP.confirm}
      confirmAccessibilityLabel={`${DELETE_GROUP.confirm} ${groupName}`}
      safeTitle={DELETE_GROUP.keep}
      onSafe={onKeep}
      onConfirm={onDelete}
      pending={pending}
    />
  );
}

/**
 * PC-08 · leaving, which is a different act from being removed.
 *
 * Never rendered for the owner: the transition trigger refuses `owner → left`,
 * and `MANAGE.ownerCannotLeave` is what the manage page says instead.
 */
export function LeaveGroupDialog({
  visible,
  groupName,
  pending = false,
  onStay,
  onLeave,
}: {
  visible: boolean;
  groupName: string;
  pending?: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      heading={leaveGroupHeading(groupName)}
      body={LEAVE_GROUP.body}
      confirmTitle={LEAVE_GROUP.confirm}
      confirmAccessibilityLabel={`${LEAVE_GROUP.confirm} ${groupName}`}
      safeTitle={LEAVE_GROUP.stay}
      onSafe={onStay}
      onConfirm={onLeave}
      pending={pending}
    />
  );
}

/** PC-07 · ejecting somebody, with what they will and will not be told. */
export function RemoveMemberDialog({
  visible,
  memberName,
  pending = false,
  onKeep,
  onRemove,
}: {
  visible: boolean;
  memberName: string;
  pending?: boolean;
  onKeep: () => void;
  onRemove: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      heading={removeMemberHeading(memberName)}
      body={REMOVE_MEMBER.body}
      confirmTitle={removeMemberConfirm(memberName)}
      confirmAccessibilityLabel={removeMemberConfirm(memberName)}
      safeTitle={REMOVE_MEMBER.keep}
      onSafe={onKeep}
      onConfirm={onRemove}
      pending={pending}
    />
  );
}
