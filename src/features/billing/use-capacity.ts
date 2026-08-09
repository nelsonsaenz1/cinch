import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';
import { supabase } from '@/lib/supabase';

import { PLANS } from './plans';
import { usePlan } from './use-plan';

export interface Capacity {
  /** Active garments — the ones Cinch styles. Stored pieces are not counted. */
  readonly used: number;
  /** The plan's active ceiling. */
  readonly limit: number;
  /** How many more may be added before the trigger refuses. Never negative. */
  readonly remaining: number;
  /** True when the next insert will be rejected for want of an active slot. */
  readonly full: boolean;
  /** Every row the account holds, stored pieces included. */
  readonly stored: number;
  /** The plan's total ceiling. */
  readonly storedLimit: number;
  /**
   * True when the account is at its TOTAL ceiling — the state where storing a
   * piece does not help, because the stored piece is the problem. The Wall must
   * not offer "make room" here; the only remedies are deleting or upgrading.
   */
  readonly storageFull: boolean;
  readonly loading: boolean;
}

/**
 * How much room is left in the closet.
 *
 * TWO counts, because the database enforces two ceilings (migration
 * 20260808190100) and they have different remedies.
 *
 * `used` is the ACTIVE closet — unarchived rows, what Cinch styles from and
 * what the grid shows. Storing a piece lowers it, which is what makes The
 * Wall's "make room" exit real rather than decorative.
 *
 * `stored` is every row the account holds. It exists so that "archive
 * everything" cannot become unlimited free storage, and it is the ceiling where
 * storing another piece does not help — the distinction the sheet has to draw,
 * because telling someone to make room when making room will not work is the
 * dead end this pair of counts was introduced to remove.
 *
 * Both mirror the trigger exactly. A client that promises room the server
 * refuses fails *after* the user has photographed and cut out the garment,
 * which is the expensive place to be wrong.
 *
 * One round trip: PostgREST cannot do two conditional counts in a single
 * `head` request, so the archived rows are counted separately and the active
 * figure is the difference.
 *
 * This is a display and pre-flight helper, never a control. The database is the
 * authority; a client that decides it has room is a client an attacker patches.
 */
export function useCapacity(): Capacity {
  const session = useSession();
  const { plan, loading: planLoading } = usePlan();
  const limit = PLANS[plan].items;
  const storedLimit = PLANS[plan].storedItems;

  const { data, isPending } = useQuery({
    queryKey: ['closet-count', session.userId],
    enabled: Boolean(session.userId),
    // Invalidated by upload-queue.ts (invalidateAfterItemSettled) when an item
    // lands; this staleTime is the fallback for an item added on another device.
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [total, archived] = await Promise.all([
        supabase
          .from('items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.userId!),
        supabase
          .from('items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.userId!)
          .eq('is_archived', true),
      ]);
      if (total.error) throw total.error;
      if (archived.error) throw archived.error;
      const stored = total.count ?? 0;
      return { stored, active: stored - (archived.count ?? 0) };
    },
  });

  const used = data?.active ?? 0;
  const stored = data?.stored ?? 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    // Unknown capacity is NOT treated as full. A failed count would otherwise
    // paywall someone who has plenty of room, and the server refuses correctly
    // either way — the cost of being wrong in this direction is one honest
    // error message, versus a false paywall in the other.
    full: data !== undefined && used >= limit,
    stored,
    storedLimit,
    storageFull: data !== undefined && stored >= storedLimit,
    loading: isPending || planLoading,
  };
}
