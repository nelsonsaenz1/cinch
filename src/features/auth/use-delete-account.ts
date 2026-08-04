import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Permanent account deletion — App Store Guideline 5.1.1(v).
 *
 * The destructive work happens in the `delete-account` Edge Function, which
 * needs admin privileges to remove the auth user. The client's job is to ask
 * clearly, then clear every trace of the old session locally so the app cannot
 * come back up holding a cache belonging to an account that no longer exists.
 */
export function useDeleteAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { ok: boolean; objectsRemoved: number };
    },

    onSuccess: async () => {
      // The user row is gone, so the refresh token is already void — signOut
      // here is about clearing local storage, and it must not be allowed to
      // fail loudly and strand the user inside a dead session.
      await supabase.auth.signOut().catch(() => undefined);

      // Remove rather than invalidate. Invalidating would refetch against a
      // deleted account; removing guarantees no stale closet survives into the
      // next sign-in on this device.
      qc.removeQueries();
    },
  });
}
