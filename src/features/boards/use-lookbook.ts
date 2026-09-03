import { useMemo } from 'react';

import { useSignedUrls } from '@/features/closet/use-image-urls';

import { plateCountsByBoard } from './board-lines';
import { useBoards, useSavedPlates } from './queries';
import type { Board, KeptPlate } from './types';

/**
 * The whole lookbook, read once.
 *
 * Saved and a board are two views of the same two queries — the plates and the
 * boards — and both need the same third thing on top: signed URLs, because the
 * garments bucket is private and a stored path handed to an `<Image>` renders
 * nothing, silently. Signing is batched into one request for every tile on the
 * page; a call per image would mean forty round trips on a screen whose whole
 * job is to appear at once.
 *
 * Board detail deliberately reads the same query rather than a `board_id`
 * filter of its own. A board's plates are a subset of the kept set, the set is
 * already in the cache by the time anybody taps a chip, and one query means
 * the count on the chip and the count on the page can never disagree.
 *
 * Returns data, never a component (the standing refusal).
 */
export function useLookbook() {
  const plates = useSavedPlates();
  const boards = useBoards();

  const all = useMemo(() => plates.data ?? [], [plates.data]);
  const allBoards = useMemo(() => boards.data ?? [], [boards.data]);

  const { resolve } = useSignedUrls(all.flatMap((plate) => plate.imagePaths));

  const namesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const board of allBoards) map.set(board.id, board.name);
    return map;
  }, [allBoards]);

  const counts = useMemo(() => plateCountsByBoard(all), [all]);

  return {
    plates: all,
    boards: allBoards,

    /**
     * Loading is only true while there is genuinely nothing to draw. A
     * refetch behind an already-drawn grid must not replace it with
     * skeletons — the page would blink every time a plate is kept.
     */
    loading: plates.isLoading || boards.isLoading,
    fetching: plates.isFetching || boards.isFetching,
    /**
     * Either query failing is a failure of the page. Half a lookbook — plates
     * with no board names, or chips with no plates — is a screen that states
     * things that are not true.
     */
    error: plates.isError || boards.isError,
    retrying: plates.isRefetching || boards.isRefetching,
    refetch: () => {
      void plates.refetch();
      void boards.refetch();
    },

    /** A board's name for the meta line, or null for a plate that sits in All. */
    boardNameFor: (boardId: string | null): string | null =>
      boardId ? (namesById.get(boardId) ?? null) : null,

    /** The four signed cells of a plate, in the order the look was built. */
    imageUrisFor: (plate: KeptPlate): (string | undefined)[] =>
      plate.imagePaths.map((path) => resolve(path)),

    /** One board, or null while the set is still arriving or the id is stale. */
    boardById: (id: string): Board | null => allBoards.find((b) => b.id === id) ?? null,

    /** How many plates sit on a board — the Keep sheet's "6 plates". */
    plateCountFor: (boardId: string): number => counts[boardId] ?? 0,

    /** The board list the Keep sheet draws, counts included. */
    sheetBoards: allBoards.map((board) => ({
      id: board.id,
      name: board.name,
      plateCount: counts[board.id] ?? 0,
    })),
  };
}
