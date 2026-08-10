import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import type { Board, KeptPlate } from './types';

/**
 * Reading the lookbook.
 *
 * KP-01 is one screen but three questions, and they are deliberately three
 * queries rather than one clever join:
 *
 *   1. the kept plates and their pieces (`outfits` where `saved_at` is set);
 *   2. how many wears each of those plates has produced;
 *   3. the boards themselves, so a board with nothing on it still gets a chip.
 *
 * The second cannot be folded into the first. "worn 6×" is
 * `count(*) from outfits where origin_outfit_id = <plate> and worn_at is not
 * null` — a self-referencing aggregate on the same table the first query is
 * already filtering the other way. PostgREST will express it, but as an
 * embedded aggregate whose shape the generated types do not carry, which means
 * a cast over the one number on this screen that must never be wrong. A second
 * select of a single indexed column (`outfits_origin_idx`) is cheaper to read
 * and impossible to misinterpret.
 *
 * The third cannot be derived from the first either: a board with no plates on
 * it has no row in the plates query, and it still has to appear as a chip —
 * otherwise making a board and then leaving the sheet makes the board vanish.
 */

export const savedPlatesKey = ['saved-plates'] as const;
export const boardsKey = ['boards'] as const;

/** One garment's paths as the join returns them, best render first. */
type ItemPaths = {
  plate_path: string | null;
  cutout_path: string | null;
  thumb_path: string | null;
};

type PlateRow = {
  id: string;
  name: string | null;
  occasion: string | null;
  saved_at: string;
  board_id: string | null;
  outfit_items: { item_id: string; position: number | null; items: ItemPaths | null }[] | null;
};

/**
 * The same preference order `useSignedUrls().resolve` applies, applied once
 * here so the tile receives four paths and no decisions.
 */
const bestPath = (item: ItemPaths | null): string | null =>
  item?.plate_path ?? item?.cutout_path ?? item?.thumb_path ?? null;

/**
 * Exported for the shape's sake: everything that turns a wire row into a
 * `KeptPlate` lives in one function, so the dev fixtures and the real screen
 * are demonstrably reading the same anatomy.
 */
export function toKeptPlate(row: PlateRow, wornCount: number): KeptPlate {
  // `position` is what the look was built in; a null sorts last rather than
  // reordering the rest, since a missing position is a defect in one row and
  // not a licence to rearrange the look.
  const pieces = [...(row.outfit_items ?? [])].sort(
    (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
  );

  // Four cells, always — a three-piece look leaves the fourth empty rather
  // than stretching the other three (KP's "The plate at rest").
  const imagePaths: (string | null)[] = [0, 1, 2, 3].map((i) =>
    pieces[i] ? bestPath(pieces[i]!.items) : null,
  );

  return {
    id: row.id,
    name: row.name,
    occasion: row.occasion,
    savedAt: row.saved_at,
    boardId: row.board_id,
    wornCount,
    itemIds: pieces.map((p) => p.item_id),
    imagePaths,
  };
}

/**
 * Every kept plate, newest first, with its honest wear count.
 *
 * Newest-first is `outfits_user_saved_idx`'s own order, and it is the right
 * one for a lookbook: the thing you kept a minute ago is the thing you are
 * looking for.
 */
export function useSavedPlates() {
  return useQuery({
    queryKey: savedPlatesKey,
    staleTime: 30_000,
    queryFn: async (): Promise<KeptPlate[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('outfits')
        .select(
          'id, name, occasion, saved_at, board_id, outfit_items(item_id, position, items(plate_path, cutout_path, thumb_path))',
        )
        .eq('user_id', userId)
        .not('saved_at', 'is', null)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as PlateRow[];
      if (rows.length === 0) return [];

      // The lineage read. One row per wear that came out of one of these
      // plates; anything else in `outfits` is irrelevant to this screen.
      const { data: wears, error: wearsError } = await supabase
        .from('outfits')
        .select('origin_outfit_id')
        .eq('user_id', userId)
        .not('worn_at', 'is', null)
        .in(
          'origin_outfit_id',
          rows.map((r) => r.id),
        );

      // A failed count is NOT zero. Nothing here falls back to "never worn" on
      // an error — the whole query fails and the screen draws its error state,
      // because "never worn" is a claim about the user's own history and the
      // one thing this page must not get wrong.
      if (wearsError) throw wearsError;

      const counts = new Map<string, number>();
      for (const wear of wears ?? []) {
        const origin = wear.origin_outfit_id;
        if (!origin) continue;
        counts.set(origin, (counts.get(origin) ?? 0) + 1);
      }

      return rows.map((row) => toKeptPlate(row, counts.get(row.id) ?? 0));
    },
  });
}

/**
 * The boards, in the order their chips are drawn.
 *
 * By name rather than by creation date, matching `boards_user_name_idx`: the
 * chip row is a place to find something, and a list that reshuffles every time
 * a board is used is a list nobody learns.
 */
export function useBoards() {
  return useQuery({
    queryKey: boardsKey,
    staleTime: 30_000,
    queryFn: async (): Promise<Board[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('boards')
        .select('id, name, starts_on, ends_on')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      }));
    },
  });
}
