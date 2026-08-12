import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardPage } from '@/components/boards/board-page';
import { DeleteBoardSheet } from '@/components/boards/delete-board-sheet';
import { Text } from '@/components/ui/text';
import {
  resolveFixtureImages,
  SV_NOW,
  SV_WORK,
  SV_WORK_PLATES,
} from '@/features/boards/w3-g5-fixtures';

/**
 * SV-02 — board detail, and deleting a board.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The board line is "5 plates · started in March". Both halves are read, not
 *   guessed: the count is this board's plates, and the month is
 *   `boards.created_at` — a real column since
 *   `20260810100000_wear_diary_and_boards.sql:50`, now carried through
 *   `Board.createdAt`. A DATED board shows its range instead, because dates
 *   make it a trip.
 * · audit 98 — THE DELETE CONFIRMATION LEADS WITH WHAT IS KEPT. "The five
 *   plates are kept" is the heading, not a reassurance buried after a warning.
 *   It names where they go — back to All saved, names, pieces and wear counts
 *   intact — and says no garment is affected.
 * · THAT SENTENCE IS TRUE, and the schema is what makes it true rather than a
 *   client that remembers: `outfits.board_id` is `references boards (id) ON
 *   DELETE SET NULL` (same migration, line 93), and `useDeleteBoard` is one
 *   `delete` on `boards` and touches no other table. Verified before it was
 *   drawn.
 * · "Keep the board" comes FIRST in reading order; "Delete the board" is the
 *   single oxblood action on the page. NOTHING SAYS PERMANENT, because for a
 *   board it is not — only the grouping is lost.
 * · The confirmation is a sheet rather than an `Alert` for those three reasons
 *   exactly: an Alert orders its own buttons, will not carry a consequence as
 *   its heading, and has no accent.
 *
 * DETERMINISM: fixed clock, fixed plates, licensed photographs, no query. The
 * sheet is posed open by local state and its buttons close it — a fixture whose
 * buttons are no-ops is a state nobody can get out of.
 */
export default function DevW3G5SV02() {
  const [confirming, setConfirming] = useState(true);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <BoardPage
        board={SV_WORK}
        plates={SV_WORK_PLATES}
        loading={false}
        error={false}
        imageUrisFor={resolveFixtureImages}
        onBack={() => undefined}
        onEdit={() => undefined}
        onOpenPlate={() => undefined}
        onSendToPacking={null}
        onAddPlate={() => undefined}
        onDelete={() => setConfirming(true)}
        now={SV_NOW}
      />

      <DeleteBoardSheet
        visible={confirming}
        boardName={SV_WORK.name}
        plateCount={SV_WORK_PLATES.length}
        onKeep={() => setConfirming(false)}
        onDelete={() => setConfirming(false)}
      />
    </View>
  );
}
