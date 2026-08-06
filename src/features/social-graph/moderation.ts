import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';

import type { ReportSubject } from '@/features/social/db-rows';
import { getUserId } from '@/lib/supabase';

import { socialDb } from './types';

/**
 * The moderation seam (build-plan §5.3) — report, block, unblock. Other
 * agents' screens import these hooks against the signatures below, so the
 * shapes here are a contract, not a style choice.
 *
 * Both actions are deliberately thin: a report is one insert into
 * `content_reports` (triage is the operator's job; a comment auto-hides at
 * three distinct reporters via trigger), and a block is one insert into
 * `user_blocks` whose server trigger severs both follow edges. The client
 * never tears down the graph itself — it just asks, then refetches.
 *
 * Every reportable surface goes through `useReportContent` with a different
 * `subject`: 'profile' from a friend's closet, 'comment' from an event thread,
 * 'outfit_post' from a look on an event board. The enum has carried all five
 * subjects since 20260807100000, so a new surface needs no migration — only a
 * caller.
 */

/**
 * The one report-reason vocabulary, shared by every reporting surface.
 *
 * `content_reports.reason` is free text — the database enforces nothing — so
 * this list is the only thing keeping the operator's triage queue groupable.
 * It had been copied into three screens and had already drifted ('Other'
 * existed only on the profile screen), which is exactly how a triage queue
 * ends up with five spellings of the same complaint. Screens import it; none
 * declares its own.
 *
 * 'Other' stays: a reporter whose reason doesn't fit the taxonomy must still
 * be able to file — a report we can't categorise beats an abuse we never
 * hear about. It sorts last so the specific reasons get first refusal.
 */
export const REPORT_REASONS = [
  'Harassment',
  'Inappropriate content',
  'Spam',
  'Impersonation',
  'Other',
] as const;

export interface ReportInput {
  subject: ReportSubject;
  /** Id in the subject's table. */
  subjectId: string;
  /** Author, when known (denormalised for triage). */
  subjectUserId?: string;
  /** <= 100 chars. */
  reason: string;
  /** <= 2000 chars. */
  details?: string;
}

/** Flag a piece of content for the moderation queue. Silent to its author. */
export function useReportContent(): UseMutationResult<void, Error, ReportInput> {
  const qc = useQueryClient();

  return useMutation<void, Error, ReportInput>({
    mutationFn: async (input) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await socialDb.from('content_reports').insert({
        reporter_id: me,
        subject: input.subject,
        subject_id: input.subjectId,
        subject_user: input.subjectUserId ?? null,
        reason: input.reason.slice(0, 100),
        details: input.details?.trim() ? input.details.trim().slice(0, 2000) : null,
      });

      if (error) {
        if ((error as PostgrestError).code === '54000') {
          throw new Error('That was a lot of reports at once — try again in a little while.');
        }
        throw error;
      }
    },
    onSuccess: (_data, input) => {
      // The third distinct report on a comment auto-hides it server-side, so a
      // comment thread on screen may have just changed under this reporter.
      if (input.subject === 'comment') {
        void qc.invalidateQueries({ queryKey: ['event-comments'] });
      }
    },
  });
}

/**
 * Block. Account-level and absolute: the server trigger deletes both follow
 * edges, and every social read path screens the pair out from then on. The
 * blocked woman sees nothing and is told nothing — the invalidations below are
 * only the blocker's own screens catching up with what is already true.
 */
export function useBlockUser(): UseMutationResult<void, Error, { userId: string }> {
  const qc = useQueryClient();

  return useMutation<void, Error, { userId: string }>({
    mutationFn: async ({ userId }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await socialDb
        .from('user_blocks')
        .insert({ blocker_id: me, blocked_id: userId });

      // Blocking someone twice is the same wish granted already.
      if (error && (error as PostgrestError).code !== '23505') throw error;
    },
    onSuccess: () => {
      // Everything that could have been showing her. The event keys belong to
      // other features (§5.4 convention) — invalidating a key is not an import.
      for (const key of [
        'following',
        'followers',
        'friends',
        'friend-requests',
        'friend-closet',
        'profile-search',
        'borrow-requests',
        'blocked-users',
        'event-comments',
        'event-posts',
        'event-members',
        // A block retracts the picks between the pair server-side
        // (20260807120000): one pick per event, and leaving it on a look she
        // can no longer see would spend it forever.
        'my-vote',
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/**
 * Unblock — removes the block row, nothing more. The severed follow edges do
 * NOT come back; both women start from zero, by design.
 */
export function useUnblockUser(): UseMutationResult<void, Error, { userId: string }> {
  const qc = useQueryClient();

  return useMutation<void, Error, { userId: string }>({
    mutationFn: async ({ userId }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await socialDb
        .from('user_blocks')
        .delete()
        .eq('blocker_id', me)
        .eq('blocked_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocked-users'] });
      void qc.invalidateQueries({ queryKey: ['profile-search'] });
    },
  });
}
