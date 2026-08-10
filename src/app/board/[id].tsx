import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardEditSheet } from '@/components/boards/board-edit-sheet';
import { BoardPage } from '@/components/boards/board-page';
import { KeepSheet } from '@/components/boards/keep-sheet';
import { EmptyState, ScreenHeader } from '@/components/ui';
import { distinctPieces, isDatedBoard, plateTitle, platesOnBoard } from '@/features/boards/board-lines';
import {
  useCreateBoard,
  useDeleteBoard,
  useDeletePlate,
  useKeepPlate,
  useUpdateBoard,
} from '@/features/boards/mutations';
import { PACKING_HREF, offerBoardToPacking } from '@/features/boards/packing-handoff';
import type { KeptPlate } from '@/features/boards/types';
import { useLookbook } from '@/features/boards/use-lookbook';

/**
 * KP-03 — one board open.
 *
 * The board's plates come out of the same lookbook query the chip row was
 * drawn from rather than a fetch of their own, so the count on the chip and
 * the count in the summary line are the same number by construction.
 *
 * Two sheets rise over this page and neither is new: `BoardEditSheet` is what
 * the atlas's `Edit` opens, and `KeepSheet` is the same sheet a plate was
 * saved from — reused rather than re-drawn, because moving a plate off this
 * board and moving it onto one are the same tap seen from two ends.
 */
export default function BoardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookbook = useLookbook();

  const keepPlate = useKeepPlate();
  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();
  const deletePlate = useDeletePlate();

  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState<{ plate: KeptPlate; boardId: string | null } | null>(null);

  const board = id ? lookbook.boardById(id) : null;
  const plates = board ? platesOnBoard(lookbook.plates, board.id) : [];

  const back = () => (router.canGoBack() ? router.back() : router.replace('/saved'));

  // A board that is not in a loaded, un-failed set is a board that is gone —
  // deleted on another device, or a stale deep link. Only claimed once both
  // queries have actually answered, so a cold start never accuses the app of
  // losing something it has simply not read yet.
  if (!board && !lookbook.loading && !lookbook.error) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScreenHeader align="leading" title="Board" onBack={back} />
        {/* An absence, not a failure: both queries answered and this board
            was not among them. `EmptyState` is the one that may make a claim
            about the data; `ErrorState` is for when the read itself failed. */}
        <EmptyState
          symbol="tray"
          title="That board is gone"
          body="It was deleted, here or on another device. The plates that were on it are still saved — they went back to All."
          actionTitle="Back to Saved"
          onAction={back}
        />
      </SafeAreaView>
    );
  }

  const confirmRemovePlate = (plate: KeptPlate) => {
    const name = plateTitle(plate) ?? 'this look';
    Alert.alert(
      'Remove from Saved',
      `${name} comes out of your collection. The pieces stay in your closet, and anything you wore from it stays in your diary.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deletePlate.mutate(plate.id, { onSuccess: () => setMoving(null) }),
        },
      ],
    );
  };

  const confirmDeleteBoard = () => {
    if (!board) return;
    Alert.alert(
      `Delete ${board.name}?`,
      'The plates on it stay saved — they return to All. Nothing in your closet is touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteBoard.mutate(board.id, {
              onSuccess: () => {
                setEditing(false);
                back();
              },
            }),
        },
      ],
    );
  };

  return (
    <>
      <BoardPage
        // `board` is only null here while the queries are still in flight or
        // have failed, and both of those states are drawn by the page itself —
        // so it is given a placeholder name rather than an early return that
        // would flash a second, different loading screen.
        board={board ?? { id: id ?? '', name: 'Board', startsOn: null, endsOn: null }}
        plates={plates}
        loading={lookbook.loading}
        error={lookbook.error}
        retrying={lookbook.retrying}
        onRetry={lookbook.refetch}
        imageUrisFor={lookbook.imageUrisFor}
        onBack={back}
        onEdit={() => setEditing(true)}
        onOpenPlate={(plate) => setMoving({ plate, boardId: plate.boardId })}
        /*
         * "Dates make it a trip." The action exists only when both dates do,
         * and what it hands over is the board's dates and its distinct pieces
         * — never a packing list. The questionnaire is what produces the
         * brief, and Packing's own Pro gate is what decides who gets one.
         */
        onSendToPacking={
          board && isDatedBoard(board)
            ? () => {
                offerBoardToPacking({
                  boardId: board.id,
                  boardName: board.name,
                  startsOn: board.startsOn,
                  endsOn: board.endsOn,
                  itemIds: distinctPieces(plates),
                });
                router.push(PACKING_HREF);
              }
            : null
        }
        // Saved is where the plates are, and the sheet there is what moves one
        // onto this board — the same one tap, from the other end.
        onAddPlate={() => router.push('/saved')}
      />

      <BoardEditSheet
        visible={editing && board !== null}
        board={board}
        onSave={(write) => {
          if (!board) return;
          updateBoard.mutate({ id: board.id, ...write }, { onSuccess: () => setEditing(false) });
        }}
        busy={updateBoard.isPending}
        onDelete={confirmDeleteBoard}
        deleting={deleteBoard.isPending}
        onDismiss={() => setEditing(false)}
      />

      <KeepSheet
        visible={moving !== null}
        mode="move"
        boards={lookbook.sheetBoards}
        selectedBoardId={moving?.boardId ?? null}
        onSelectBoard={(boardId) => setMoving((open) => (open ? { ...open, boardId } : open))}
        onCreateBoard={(name) =>
          createBoard.mutate(
            { name },
            { onSuccess: (newId) => setMoving((open) => (open ? { ...open, boardId: newId } : open)) },
          )
        }
        creating={createBoard.isPending}
        onCommit={() => {
          if (!moving) return;
          keepPlate.mutate(
            { target: { kind: 'outfit', outfitId: moving.plate.id }, boardId: moving.boardId },
            { onSuccess: () => setMoving(null) },
          );
        }}
        busy={keepPlate.isPending}
        onDismiss={() => setMoving(null)}
        onRemove={() => moving && confirmRemovePlate(moving.plate)}
        removing={deletePlate.isPending}
      />
    </>
  );
}
