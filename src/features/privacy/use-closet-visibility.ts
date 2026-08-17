import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DAILY_SOCIAL_EVENTS,
  closetVisibilityChangedProps,
} from '@/features/daily-social/analytics';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';

import {
  ALL_VISIBLE,
  visibilityFromRow,
  visibilityPatch,
  type ClosetVisibility,
  type VisibilityFlag,
} from './visibility-flags';

/**
 * The four owner-held visibility flags, read and written.
 *
 * THE COLUMNS SHIPPED IN 20260808110000 AND THE CONTROL NEVER DID. That
 * migration says so itself — "the toggle UI lands in a later Profile session;
 * until then no row ever flips these" — and until this file existed, no row
 * ever did. The read path has been honouring flags nobody could set for two
 * weeks: `friend_items` filters on `not p.closet_hidden`, and
 * `friend_closet_meta` nulls each stat behind `case when p.closet_hidden or
 * p.stat_*_hidden`. So there is nothing to enforce here and nothing to
 * backfill. A flag flips and the next read is already correct.
 *
 * ── STORED HIDDEN, SHOWN VISIBLE ──────────────────────────────────────────
 *
 * The columns are `*_hidden`: true means hidden. The switches read the other
 * way round — on means "friends can see this" — because a switch labelled with
 * a thing and turned on should show the thing, and a control whose ON means
 * OFF is how somebody hides a closet they meant to show. The inversion happens
 * exactly twice, here at the boundary, and `tests/closet-visibility.test.ts`
 * pins both directions rather than trusting the reader to hold it in their head.
 *
 * ── WHAT IS NOT CHANGED ───────────────────────────────────────────────────
 *
 * No default moves. Today every flag is `false`, which means a mutual friend
 * can see the closet and its stats, and that stays true for everyone who never
 * opens this screen. Flipping the defaults would retroactively hide content
 * from friends who can see it now, which is a change to announce rather than
 * infer. The public boundary is untouched and separate: `profiles.visibility`
 * defaults to `'private'` and is not one of these four.
 */
export type { ClosetVisibility, VisibilityFlag } from './visibility-flags';

export const CLOSET_VISIBILITY_KEY = ['closet-visibility'] as const;

export function useClosetVisibility() {
  return useQuery({
    queryKey: CLOSET_VISIBILITY_KEY,
    queryFn: async ({ signal }): Promise<ClosetVisibility> => {
      const userId = await getUserId();
      if (!userId) return ALL_VISIBLE;

      const { data, error } = await supabase
        .from('profiles')
        .select('closet_hidden, stat_pieces_hidden, stat_wears_hidden, stat_cost_per_wear_hidden')
        .eq('user_id', userId)
        .abortSignal(signal)
        .maybeSingle();

      if (error) throw error;

      // A profile row that does not exist yet is not hidden — `visibilityFromRow`
      // defaults on the HIDDEN side, so absence reads as today's default.
      return visibilityFromRow(data);
    },
  });
}

export function useSetClosetVisibility() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ flag, visible }: { flag: VisibilityFlag; visible: boolean }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      // `update`, not `upsert`. An upsert would write a profile row for an
      // account that has none, and a privacy switch is not the thing that
      // should bring a profile into existence — the row is created by
      // onboarding, and writing one here would give the account a username-less
      // profile as a side effect of hiding a stat.
      const { error } = await supabase
        .from('profiles')
        .update({ ...visibilityPatch(flag, visible), updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
    },

    // The switch moves under the finger and is put back if the write fails.
    // A privacy control that lags reads as one that did not take.
    onMutate: async ({ flag, visible }) => {
      await qc.cancelQueries({ queryKey: CLOSET_VISIBILITY_KEY });
      const previous = qc.getQueryData<ClosetVisibility>(CLOSET_VISIBILITY_KEY);
      if (previous) qc.setQueryData(CLOSET_VISIBILITY_KEY, { ...previous, [flag]: visible });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(CLOSET_VISIBILITY_KEY, context.previous);
    },
    // Which of the four moved, and which way. These columns shipped without a
    // control and then without any measurement either, so "do owners actually
    // use this" has never been answerable — and the money one in particular is
    // the flag most worth knowing about. Fired on the WRITE, not on the tap:
    // an optimistic switch that rolled back did not change anything.
    onSuccess: (_data, { flag, visible }) => {
      track(
        DAILY_SOCIAL_EVENTS.closetVisibilityChanged,
        closetVisibilityChangedProps(flag, visible),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CLOSET_VISIBILITY_KEY });
      // Anything drawn from a friend-facing projection of this account is now
      // a different answer. These are the caller's own caches, not a friend's
      // — their device re-reads the views and gets the new truth on its own.
      void qc.invalidateQueries({ queryKey: ['friend-closet'] });
      void qc.invalidateQueries({ queryKey: ['friend-closet-meta'] });
      void qc.invalidateQueries({ queryKey: ['social-profile'] });
    },
  });
}
