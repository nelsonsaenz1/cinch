import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * The two commerce preferences on the signed-in user's own row — C-03's
 * "Show where to buy" and C-05's "Let friends find where your pieces are
 * from". Same shape as `useAiConsent` (features/auth/use-consent.ts): read
 * the raw column, never cache a derived verdict, because there is nothing
 * derived here to cache — the column IS the answer.
 *
 * Deliberately not combined into one query: C-03 is read constantly (every
 * Gap Feed screen, every friend item sheet) while C-05 is read once, on the
 * Privacy page. Bundling them would refetch a privacy setting every time a
 * gap card mounts for no reason either value needs.
 */

const SHOW_WHERE_TO_BUY_KEY = ['commerce', 'show-where-to-buy'];
const SHOPPABLE_KEY = ['commerce', 'shoppable'];

/**
 * The generated `Database` type postdates migration 20260811150000 — the
 * same situation `profile/queries.ts`'s `isHandleFree` documents for
 * `username_available`, and the same fix: one narrow cast of the CLIENT
 * (never a hand-edit of the generated file, which the next `npm run
 * gen:types` would silently revert), shaped to exactly the two calls below.
 * The regen makes this a no-op. Cast the client rather than the query
 * builder mid-chain for the reason `profile/queries.ts` spells out: pulling
 * a method off the object detaches its `this`, and the builder reads it on
 * invocation.
 */
type ProfilesCommerceRead = {
  from(relation: 'profiles'): {
    select(cols: 'show_where_to_buy' | 'shoppable'): {
      eq(
        col: 'user_id',
        value: string,
      ): {
        single(): PromiseLike<{
          data: { show_where_to_buy?: boolean; shoppable?: boolean } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const commerceDb = supabase as unknown as ProfilesCommerceRead;

/** C-03. Defaults to `true` while loading/signed-out — the same default the
 *  column itself carries. The other direction would be the surprising one: a
 *  slow first paint that hid an allowed row, rather than one that shows it a
 *  beat late, is the failure users notice. */
export function useShowWhereToBuy() {
  return useQuery({
    queryKey: SHOW_WHERE_TO_BUY_KEY,
    queryFn: async (): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return true;

      const { data, error } = await commerceDb
        .from('profiles')
        .select('show_where_to_buy')
        .eq('user_id', userId)
        .single();

      if (error) throw new Error(error.message);
      return data?.show_where_to_buy ?? true;
    },
  });
}

/** C-05. Defaults to `false` — the column's own default, and the safe
 *  direction: a loading state must never read as "yes, findable". */
export function useShoppable() {
  return useQuery({
    queryKey: SHOPPABLE_KEY,
    queryFn: async (): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return false;

      const { data, error } = await commerceDb
        .from('profiles')
        .select('shoppable')
        .eq('user_id', userId)
        .single();

      if (error) throw new Error(error.message);
      return data?.shoppable ?? false;
    },
  });
}

export const COMMERCE_QUERY_KEYS = {
  showWhereToBuy: SHOW_WHERE_TO_BUY_KEY,
  shoppable: SHOPPABLE_KEY,
} as const;
