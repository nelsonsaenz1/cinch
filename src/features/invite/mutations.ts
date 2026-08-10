import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { bareHandle } from './link';

/**
 * Arriving through somebody's link (IV-06).
 *
 * THE TAP WAS THE CONSENT. `apply_invite()` writes both `follows` rows itself,
 * so the friendship is made here rather than requested — "the invite is already
 * accepted" is the atlas's own rule, and IV-06 reports the result rather than
 * asking a second time for something the user already did by opening the link.
 *
 * The function is idempotent and one-way: `invited_by` is written only while
 * null, the follows are `on conflict do nothing`, and it refuses across a block
 * in either direction, so re-opening a link is a no-op and a link is never a
 * way back in for somebody who was blocked.
 */

export type AppliedInvite = {
  inviterId: string;
  /** The inviter's display name, or null when they have not written one. */
  displayName: string | null;
};

/**
 * NO ROWS IS NOT AN ERROR. `apply_invite` returns nothing when the handle is
 * unknown, is the caller's own, or either party has blocked the other — three
 * different situations that are one situation to the person holding the link:
 * there is nobody at the other end. `null` carries that, and IV-06's
 * unavailable branch says so without guessing which of the three it was.
 */
export function useApplyInvite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (handle: string): Promise<AppliedInvite | null> => {
      // Cast the client, not the method: the generated types are regenerated
      // from production and do not know this function until the migration has
      // shipped, and detaching `rpc` from its object throws before the network.
      // Same narrowing as `isHandleFree` in features/profile/queries.ts.
      const client = supabase as unknown as {
        rpc(
          fn: string,
          args: Record<string, unknown>,
        ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };

      const { data, error } = await client.rpc('apply_invite', {
        p_handle: bareHandle(handle),
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
      const inviterId = typeof row?.inviter_id === 'string' ? row.inviter_id : null;
      if (!inviterId) return null;

      const name = row?.display_name;
      return { inviterId, displayName: typeof name === 'string' && name ? name : null };
    },
    onSuccess: (result) => {
      if (!result) return;
      // Both edges were written server-side, so every list that derives from
      // `follows` is now stale — the same set `useFollow` invalidates.
      void qc.invalidateQueries({ queryKey: ['following'] });
      void qc.invalidateQueries({ queryKey: ['followers'] });
      void qc.invalidateQueries({ queryKey: ['friends'] });
      void qc.invalidateQueries({ queryKey: ['friend-requests'] });
      void qc.invalidateQueries({ queryKey: ['sent-requests'] });
    },
    // One attempt. A retry storm on a write that has already succeeded once is
    // harmless (it is idempotent) but buys nothing, and the screen offers a
    // real Retry the user can see.
    retry: false,
  });
}
