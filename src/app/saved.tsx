import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { KeepSheet } from '@/components/boards/keep-sheet';
import { SavedPage } from '@/components/boards/saved-page';
import { plateTitle } from '@/features/boards/board-lines';
import { useCreateBoard, useDeletePlate, useKeepPlate } from '@/features/boards/mutations';
import type { KeptPlate } from '@/features/boards/types';
import { useLookbook } from '@/features/boards/use-lookbook';
import { useBoundedLoad } from '@/lib/use-bounded-load';

/**
 * Saved — KP-01, KP-02 and KP-05.
 *
 * The lookbook of kept plates: a collection at rest, browsed separately from
 * the daily feed. Everything drawn here comes from `SavedPage`, which
 * `dev-saved.tsx` drives with fixtures, so the states verified on a simulator
 * are the states that ship.
 *
 * TAPPING A PLATE RAISES THE KEEP SHEET, in its move mode. That is not an
 * invention: it is the only per-plate interaction atlas 35 defines — "a plate
 * sits on one board at a time; moving it is one tap in the same sheet that
 * saved it" — and it is where the other stated rule, "deleting a plate is
 * confirmed once, and never cascades to the pieces", has somewhere to live.
 */
export default function SavedScreen() {
  const router = useRouter();
  const lookbook = useLookbook();

  const keepPlate = useKeepPlate();
  const createBoard = useCreateBoard();
  const deletePlate = useDeletePlate();

  /**
   * The sheet's whole state in one value: which plate is open and where it is
   * being sent. Held together because they change together — opening a plate
   * seeds the selection from the board it is already on, and two pieces of
   * state would need an effect to keep that true, which is the bug lint
   * refuses `setState` in `useEffect` to prevent.
   */
  const [moving, setMoving] = useState<{ plate: KeptPlate; boardId: string | null } | null>(null);

  /**
   * UX #30 — Saved's grid of placeholders is bounded now.
   *
   * The finding: "Saved Looks and Wear Diary can remain in skeleton states long
   * enough to look like an unfinished page." Two queries behind one `loading`
   * flag and no clock on either. The bound gives the wait an end, a retry and
   * the page's own way back.
   */
  const load = useBoundedLoad({
    loading: lookbook.loading,
    error: lookbook.error,
    retrying: lookbook.retrying,
    onRetry: lookbook.refetch,
  });

  const close = () => setMoving(null);

  const confirmRemove = (plate: KeptPlate) => {
    const name = plateTitle(plate) ?? 'this look';
    Alert.alert(
      'Remove from Saved',
      `${name} comes out of your collection. The pieces stay in your closet, and anything you wore from it stays in your diary.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deletePlate.mutate(plate.id, { onSuccess: close }),
        },
      ],
    );
  };

  return (
    <>
      <SavedPage
        loading={load.state === 'skeleton'}
        error={load.state === 'error'}
        timedOut={load.timedOut}
        retrying={load.retrying}
        onRetry={load.retry}
        plates={lookbook.plates}
        boards={lookbook.boards}
        imageUrisFor={lookbook.imageUrisFor}
        onOpenBoard={(boardId) => router.push(`/board/${boardId}`)}
        onOpenPlate={(plate) => setMoving({ plate, boardId: plate.boardId })}
        // "The way in is to plan a look, so that is the button." Plan is where
        // a look gets put on a day; Today proposes one, it does not schedule it.
        onPlanALook={() => router.push('/(tabs)/plan')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
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
            // Created and chosen in one move: nobody names a board in this
            // sheet in order to then not use it.
            { onSuccess: (id) => setMoving((open) => (open ? { ...open, boardId: id } : open)) },
          )
        }
        creating={createBoard.isPending}
        onCommit={() => {
          if (!moving) return;
          keepPlate.mutate(
            { target: { kind: 'outfit', outfitId: moving.plate.id }, boardId: moving.boardId },
            { onSuccess: close },
          );
        }}
        busy={keepPlate.isPending}
        onDismiss={close}
        onRemove={() => moving && confirmRemove(moving.plate)}
        removing={deletePlate.isPending}
      />
    </>
  );
}
