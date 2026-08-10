import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * Reading a walkthrough back.
 *
 * The load-bearing one is `useResumableSession`. A procession is twenty-odd
 * cards and runs for minutes; iOS will kill a backgrounded app in the middle of
 * it, and somebody who loses forty spoken garments to a phone call does not
 * speak them again. Everything here exists so that never costs more than a
 * scroll position.
 *
 * These went through an untyped client while the tables existed only on a
 * verification branch. The migrations reached production on 2026-08-10 and
 * `npm run gen:types` picked them up, so the rows below are the generated ones
 * and the cast is gone.
 */

export type IntakeSessionRow = Database['public']['Tables']['intake_sessions']['Row'];
export type IntakeDraftRow = Database['public']['Tables']['intake_drafts']['Row'];

/** The statuses a walkthrough can be picked back up from. Mirrors the partial
 *  index `intake_sessions_resumable_idx` — committed and abandoned are history,
 *  never resumed. */
const RESUMABLE = ['recording', 'transcribing', 'parsing', 'reviewing'];

export const intakeKeys = {
  resumable: ['intake', 'resumable'] as const,
  drafts: (sessionId: string) => ['intake', 'drafts', sessionId] as const,
};

/**
 * The walkthrough waiting to be finished, if there is one.
 *
 * Returns the most recent resumable session and nothing else. There is
 * deliberately no list: two half-finished walkthroughs is not a state the
 * product has an opinion about, and offering a choice between them would be
 * asking somebody to remember which recording was which.
 *
 * RLS scopes this to the caller, so there is no user filter here — a query that
 * needed one would mean the policy was not doing its job.
 */
export function useResumableSession() {
  return useQuery({
    queryKey: intakeKeys.resumable,
    queryFn: async (): Promise<IntakeSessionRow | null> => {
      const { data, error } = await supabase
        .from('intake_sessions')
        .select('*')
        .in('status', RESUMABLE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    // A resume prompt that appears three seconds after launch is worse than no
    // resume prompt — the reader has already started doing something else. This
    // is asked once per mount and not refetched behind them.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * One walkthrough's drafts, in spoken order.
 *
 * `ordinal` and not `created_at`: the procession's position is an index into
 * this list, and a list that could reorder itself would move the card under
 * somebody's thumb. The unique constraint on (session_id, ordinal) is what
 * makes the order total.
 */
export function useDrafts(sessionId: string | null) {
  return useQuery({
    queryKey: intakeKeys.drafts(sessionId ?? 'none'),
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<IntakeDraftRow[]> => {
      const { data, error } = await supabase
        .from('intake_drafts')
        .select('*')
        .eq('session_id', sessionId!)
        .order('ordinal', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    // The drafts are the procession's whole working set and it edits them
    // locally as it goes. Refetching mid-walk would overwrite an unsaved
    // correction with the row it was correcting.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Where a resumed procession should reopen.
 *
 * Clamped rather than trusted. `cursor` is written as the user walks and a
 * crash can leave it ahead of the drafts that actually exist — pointing the
 * procession past the end would open it on nothing, which reads as "your
 * walkthrough is gone". A cursor equal to the count is the legitimate
 * "finished, awaiting commit" position and is preserved.
 */
export function resumeCursor(cursor: number, draftCount: number): number {
  if (draftCount <= 0) return 0;
  return Math.min(Math.max(cursor, 0), draftCount);
}
