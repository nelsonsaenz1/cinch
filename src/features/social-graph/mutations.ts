import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';

import { getUserId, supabase } from '@/lib/supabase';

import { socialDb } from './types';

/**
 * Writes for the social graph. All of them are plain inserts/updates — RLS and
 * the database triggers are the authority (a borrow insert against a
 * non-borrowable item is refused server-side no matter what the UI showed).
 * What this file adds is the translation of the stable errcodes those triggers
 * raise into sentences a person can act on.
 */

/** Does this look like a PostgrestError? Narrow enough for the code switch. */
function pgCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as PostgrestError).code);
  }
  return null;
}

/** The abuse-control trigger family raises `54000`; every surface says the same calm thing. */
const RATE_LIMITED = 'That was a lot at once — take a breath and try again in a little while.';

// ---------------------------------------------------------------------------
// Follows. "Add a friend" is one edge; the friendship is both edges existing.
// ---------------------------------------------------------------------------

/** Follow someone — sending a friend request, or accepting one by following back. */
export function useFollow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: me, followee_id: userId });

      if (error) {
        // Already following: the edge this tap wanted already exists, so the
        // action succeeded before it was taken. A duplicate is not a failure.
        if (pgCode(error) === '23505') return;
        if (pgCode(error) === '54000') throw new Error(RATE_LIMITED);
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['following'] });
      void qc.invalidateQueries({ queryKey: ['friends'] });
      void qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
}

/**
 * Unfollow — which is also "unfriend": removing one edge dissolves the mutual
 * pair, and the other woman's follow silently degrades to public-only
 * visibility. No notification fires anywhere; silence is always ambiguous.
 */
export function useUnfollow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', me)
        .eq('followee_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['following'] });
      void qc.invalidateQueries({ queryKey: ['friends'] });
      void qc.invalidateQueries({ queryKey: ['friend-requests'] });
      // Her closet may no longer be readable; the view will say so on refetch.
      void qc.invalidateQueries({ queryKey: ['friend-closet'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Borrowing.
// ---------------------------------------------------------------------------

/**
 * Ask to borrow a friend's garment. `ownerId` is advisory — the trigger
 * re-derives the true owner from the item and overwrites whatever is sent —
 * but the column is NOT NULL so a value must ride along. `eventId` is for
 * event-scoped entry points (EVENTS/OUTFITS screens); this feature's own
 * surfaces pass null.
 */
export function useRequestBorrow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      ownerId,
      eventId = null,
      message,
    }: {
      itemId: string;
      ownerId: string;
      eventId?: string | null;
      message?: string;
    }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await socialDb.from('borrow_requests').insert({
        item_id: itemId,
        owner_id: ownerId,
        requester_id: me,
        event_id: eventId,
        message: message?.trim() || null,
      });

      if (error) {
        // The trigger's refusals: not borrowable / not reachable / blocked all
        // arrive as 42501 on purpose, so the requester cannot distinguish "she
        // marked it not-for-lending" from "she blocked you".
        if (pgCode(error) === '42501') {
          throw new Error('This piece isn’t available to borrow right now.');
        }
        if (pgCode(error) === '22023') throw new Error('That one is already yours.');
        if (pgCode(error) === '54000') throw new Error(RATE_LIMITED);
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['borrow-requests'] });
    },
  });
}

/**
 * The owner's side of the lifecycle: lend it, decline it, or close an open
 * loan as returned. The transition trigger pins which statuses each side may
 * reach; the canned one-tap responses in the UI are what keep a decline
 * graceful — no reason is ever asked for or sent.
 */
export function useAnswerBorrow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      answer,
    }: {
      id: string;
      answer: 'approved' | 'declined' | 'returned';
    }) => {
      const { error } = await socialDb
        .from('borrow_requests')
        .update({ status: answer })
        .eq('id', id);

      if (error) {
        if (pgCode(error) === '22023') {
          throw new Error('This request has already moved on — pull to refresh.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['borrow-requests'] });
    },
  });
}

/** The requester withdrawing a still-pending ask. Silent, like every retreat here. */
export function useCancelBorrow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await socialDb
        .from('borrow_requests')
        .update({ status: 'canceled' })
        .eq('id', id);

      if (error) {
        if (pgCode(error) === '22023') {
          throw new Error('This request has already been answered — pull to refresh.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['borrow-requests'] });
    },
  });
}

/**
 * The owner flipping "Not for lending" on one of her own garments. An ordinary
 * owner UPDATE on `items` under the existing RLS — no new policy exists for
 * this, which is the point: the flag is hers alone. The item stays visible in
 * friends' closet views either way; only the borrow affordance comes and goes.
 */
export function useSetBorrowable() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, borrowable }: { id: string; borrowable: boolean }) => {
      const { error } = await socialDb.from('items').update({ borrowable }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['item-borrowable', id] });
    },
  });
}
