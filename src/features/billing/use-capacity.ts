import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';
import { supabase } from '@/lib/supabase';

import { PLANS } from './plans';
import { usePlan } from './use-plan';

export interface Capacity {
  /** Garments counted the way the database counts them. */
  readonly used: number;
  /** The plan's ceiling. */
  readonly limit: number;
  /** How many more may be added before the trigger refuses. Never negative. */
  readonly remaining: number;
  /** True when the next insert will be rejected. */
  readonly full: boolean;
  readonly loading: boolean;
}

/**
 * How much room is left in the closet.
 *
 * THE COUNT IS NOT `useCloset().length`, and the difference is the whole point.
 *
 * `useCloset` filters to `is_archived = false`, because that is what the grid
 * shows. The `items_enforce_limit` trigger counts every row the user owns,
 * archived included — deliberately, since archived garments still occupy
 * storage and come back when unarchived, and excluding them would make
 * "archive everything" a way to hold an unlimited closet on the free tier.
 *
 * Counting the visible ones here would therefore promise room that the server
 * refuses: the user is shown "12 of 30" and the insert fails anyway. Worse, it
 * fails *after* they have photographed and cut out the garment. This query
 * mirrors the trigger's `select count(*) from items where user_id = $1` exactly.
 *
 * `head: true` means PostgREST returns the count in a header and no rows at
 * all, so this stays cheap enough to run before every capture.
 *
 * This is a display and pre-flight helper, never a control. The database is the
 * authority; a client that decides it has room is a client an attacker patches.
 */
export function useCapacity(): Capacity {
  const session = useSession();
  const { plan, loading: planLoading } = usePlan();
  const limit = PLANS[plan].items;

  const { data, isPending } = useQuery({
    queryKey: ['closet-count', session.userId],
    enabled: Boolean(session.userId),
    // Invalidated by upload-queue.ts (invalidateAfterItemSettled) when an item
    // lands; this staleTime is the fallback for an item added on another device.
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const used = data ?? 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    // Unknown capacity is NOT treated as full. A failed count would otherwise
    // paywall someone who has plenty of room, and the server refuses correctly
    // either way — the cost of being wrong in this direction is one honest
    // error message, versus a false paywall in the other.
    full: data !== undefined && used >= limit,
    loading: isPending || planLoading,
  };
}
