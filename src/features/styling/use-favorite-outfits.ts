import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

export type FavoriteOutfit = {
  id: string;
  name: string;
  favoritedAt: string;
  itemIds: string[];
  imagePaths: (string | null)[];
};

type FavoriteRow = {
  id: string;
  name: string | null;
  favorited_at: string | null;
  outfit_items: {
    item_id: string;
    position: number;
    items: { plate_path: string | null; cutout_path: string | null; thumb_path: string | null } | null;
  }[] | null;
};

/** Owner-only favorites. The public outfit view never exposes this marker. */
export function useFavoriteOutfits() {
  return useQuery({
    queryKey: ['favorite-outfits'],
    queryFn: async (): Promise<FavoriteOutfit[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('outfits')
        .select(
          'id, name, favorited_at, outfit_items(item_id, position, items(plate_path, cutout_path, thumb_path))',
        )
        .eq('user_id', userId)
        .not('favorited_at', 'is', null)
        .order('favorited_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      return ((data ?? []) as unknown as FavoriteRow[])
        .filter((row): row is FavoriteRow & { favorited_at: string } => row.favorited_at !== null)
        .map((row) => {
          const pieces = [...(row.outfit_items ?? [])].sort((a, b) => a.position - b.position);
          return {
            id: row.id,
            name: row.name?.trim() || 'Favorite outfit',
            favoritedAt: row.favorited_at,
            itemIds: pieces.map((piece) => piece.item_id),
            imagePaths: pieces.map(
              (piece) =>
                piece.items?.plate_path ?? piece.items?.cutout_path ?? piece.items?.thumb_path ?? null,
            ),
          };
        });
    },
    staleTime: 5 * 60_000,
  });
}

export function useUnfavoriteOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (outfitId: string) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');
      const { error } = await supabase
        .from('outfits')
        .update({ favorited_at: null })
        .eq('id', outfitId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorite-outfits'] });
    },
  });
}
