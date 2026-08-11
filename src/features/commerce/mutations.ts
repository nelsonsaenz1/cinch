import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import { COMMERCE_QUERY_KEYS } from './queries';

/**
 * Same narrow-cast situation as `queries.ts` — the generated `Database` type
 * postdates migration 20260811150000. See that file's header for the full
 * reasoning; this is its write-side mirror.
 */
type ProfilesCommerceWrite = {
  from(relation: 'profiles'): {
    update(values: { show_where_to_buy?: boolean; shoppable?: boolean }): {
      eq(col: 'user_id', value: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

const commerceDb = supabase as unknown as ProfilesCommerceWrite;

/** C-03's write half — Profile → Settings' "Show where to buy" switch. */
export function useSetShowWhereToBuy() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (value: boolean) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await commerceDb
        .from('profiles')
        .update({ show_where_to_buy: value })
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COMMERCE_QUERY_KEYS.showWhereToBuy });
    },
  });
}

/**
 * C-05's write half — Profile → Privacy's "Let friends find where your
 * pieces are from" switch. Invalidating `friend-closet` for every friend
 * viewing this account is a query this device cannot know about — nothing to
 * invalidate here beyond this device's own read of the flag; a friend's
 * client picks up the change on its own next fetch of `friend_items`, same as
 * any other owner-held toggle in this codebase (closet_hidden included).
 */
export function useSetShoppable() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (value: boolean) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await commerceDb
        .from('profiles')
        .update({ shoppable: value })
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COMMERCE_QUERY_KEYS.shoppable });
    },
  });
}
