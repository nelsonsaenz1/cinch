import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import {
  DELETE_BOARD_CONFIRM,
  DELETE_BOARD_KEEP,
  deleteBoardBody,
  deleteBoardHeading,
} from '@/features/boards/board-lines';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * SV-02 — deleting a board.
 *
 * THE CONFIRMATION LEADS WITH WHAT IS KEPT. "The five plates are kept" is the
 * heading, not a reassurance buried after a warning, because that is the
 * question the reader actually has and the answer is reassuring. It then names
 * where they go — back to All saved, with their names, pieces and wear counts
 * intact — and says no garment is affected.
 *
 * ALL OF THAT IS TRUE, and it is the schema that makes it true rather than a
 * client that remembers: `outfits.board_id` is `references boards (id) ON
 * DELETE SET NULL` (`20260810100000_wear_diary_and_boards.sql:93`), and
 * `useDeleteBoard` is a single `delete` on `boards`.
 *
 * NOTHING HERE SAYS PERMANENT, because for a board it is not — only the
 * grouping is lost. "Keep the board" comes first in reading order and "Delete
 * the board" is the page's single oxblood action.
 *
 * An `Alert` cannot do any of this: iOS orders its buttons, refuses a heading
 * longer than a phrase, and has no oxblood. So this is the house's own overlay,
 * the same shape `BlockConfirmSheet` uses.
 */
export function DeleteBoardSheet({
  visible,
  boardName,
  plateCount,
  pending = false,
  onKeep,
  onDelete,
}: {
  visible: boolean;
  boardName: string;
  /** How many plates are on it. The heading is a sentence about this number. */
  plateCount: number;
  pending?: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={pending ? () => undefined : onKeep}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={pending ? undefined : onKeep}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          style={{ paddingHorizontal: GUTTER, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="rounded-plate bg-canvas p-5">
            <Text variant="title" trim accessibilityRole="header">
              {deleteBoardHeading(plateCount)}
            </Text>
            <Text variant="body" className="mt-3 text-muted">
              {deleteBoardBody(boardName)}
            </Text>
            <View className="mt-5" style={{ gap: 10 }}>
              {/* Keep first, in reading order: the calm outcome is the one the
                  eye should land on, and the destructive one is the one that
                  has to be chosen deliberately. */}
              <Button
                title={DELETE_BOARD_KEEP}
                variant="secondary"
                onPress={onKeep}
                disabled={pending}
              />
              {/* The page's single oxblood action. */}
              <Button
                title={DELETE_BOARD_CONFIRM}
                variant="primary"
                loading={pending}
                onPress={onDelete}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
