import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { getUserId } from '@/lib/supabase';

import { ACTIVITY_EVENTS, activityActionProps } from './analytics';
import { activityDb } from './client';
import { ACTIVITY_EVENTS_KEY, ACTIVITY_UNSEEN_KEY, activityEventKey } from './queries';
import type { ActivityEvent } from './types';

/**
 * The Activity Center's writes, and there are only four.
 *
 * Accepting and declining an invitation are NOT here. They are
 * `useAcceptInvitation` and `useDeclineInvitation` in
 * `features/circles/mutations.ts`, called directly by AC-02's inline row and
 * AC-03's buttons. Reimplementing them would mean a second module writing
 * `circle_members.state`, with its own optimistic painting, its own rollback and
 * its own analytics event — two code paths for one act, guaranteed to disagree
 * about something eventually. The Activity Center is a place invitations are
 * SURFACED, not a second place they are answered, and the row it draws goes
 * inert on its own: `fan_out_circle_transition` sets `revoked_at` on the
 * invitee's own notice as part of the same transaction that moves the
 * membership.
 *
 * ── WHY EVERY ONE OF THESE PAINTS OPTIMISTICALLY ──────────────────────────
 *
 * Because all four are about the reader's own inbox and none of them can be
 * refused for a reason the reader could have anticipated. A dismissal that
 * waited for a round trip would leave a row sitting under a finger that has
 * already moved on, and the undo toast — which is the whole safety net — is
 * five seconds long. So the row leaves immediately and comes back if the write
 * failed, which is the same shape `features/circles/mutations.ts` uses for every
 * membership change.
 */

/** What a rollback needs. */
type Snapshot = { events: ActivityEvent[] | undefined };

function snapshot(qc: QueryClient): Snapshot {
  return { events: qc.getQueryData<ActivityEvent[]>(ACTIVITY_EVENTS_KEY) };
}

function restore(qc: QueryClient, context: Snapshot | undefined): void {
  if (context?.events) qc.setQueryData(ACTIVITY_EVENTS_KEY, context.events);
}

/**
 * Opening the screen IS being read.
 *
 * ── THE INVALIDATION THAT IS DELIBERATELY MISSING ─────────────────────────
 *
 * This stamps `seen_at` on the server and invalidates the DOT, and it does not
 * invalidate the list. That is the whole design of the `New` section: if the
 * list refetched here, every row would come back with a `seen_at` and the
 * heading the reader is looking at would dissolve under them mid-scroll —
 * which is the behaviour that makes an inbox feel like it is moving on its own.
 * The rows stay `New` for the visit that found them, and are `Earlier` on the
 * next one, which is what `sectionOf` means by "New is unseen, not recent".
 *
 * ── AND THE ONE THAT IS NOT A READ RECEIPT ────────────────────────────────
 *
 * `seen_at` is readable under one policy — the recipient's own — and there is no
 * view, function or join anywhere that lets the ACTOR of an event learn it.
 * `reaction.privacy` says so to the reader in as many words: "No one can see
 * whether you've opened this." Nothing in this mutation sends anything to
 * anybody.
 */
export function useMarkActivitySeen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;

      // `is('seen_at', null)` rather than a blanket update: re-stamping rows
      // that were already seen would rewrite the timestamp on every open for no
      // benefit, and `updated_at` bookkeeping on an inbox is a write amplified
      // by however often somebody checks it.
      const { error } = await activityDb()
        .from('activity_events')
        .update({ seen_at: new Date().toISOString() })
        .is('seen_at', null);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_UNSEEN_KEY });
    },
  });
}

/**
 * Remove one row — AC-02's Edit-mode Remove, and AC-05's Dismiss.
 *
 * A SOFT DELETE, and the softness is the undo. `dismissed_at` takes the row out
 * of every read immediately (the SELECT policy filters on it) while leaving it
 * writable by its recipient (the UPDATE policy does not), which is exactly the
 * asymmetry a five-second Undo needs. `purge_activity_events` turns it into a
 * hard delete a minute later.
 *
 * Nothing is told to anybody. Dismissing an invitation notice does not decline
 * the invitation — `circle_members` is untouched — and `DISMISS_SCOPE` says so
 * on the screen where the confusion would happen.
 */
export function useDismissActivityEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; eventType?: ActivityEvent['type'] }) => {
      const { error } = await activityDb()
        .from('activity_events')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },

    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ACTIVITY_EVENTS_KEY });
      const context = snapshot(qc);
      if (context.events) {
        qc.setQueryData(
          ACTIVITY_EVENTS_KEY,
          context.events.filter((event) => event.id !== id),
        );
      }
      return context;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: (_data, { eventType }) => {
      track(
        ACTIVITY_EVENTS.action,
        activityActionProps({ action: 'dismiss', surface: 'activity', eventType }),
      );
    },
    onSettled: (_data, _error, { id }) => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_UNSEEN_KEY });
      void qc.invalidateQueries({ queryKey: activityEventKey(id) });
    },
  });
}

/**
 * Take a dismissal back.
 *
 * The window is a minute on the server (`purge_activity_events`) against five
 * seconds on screen, and the gap is deliberate: an app backgrounded mid-toast
 * comes back to a row that is still there to restore. Past the minute the row is
 * gone for good and this resolves without restoring anything, which is the
 * honest outcome — there is no error to show for a row that has already been
 * purged, and an alert saying so would be the app apologising for a promise it
 * kept.
 */
export function useUndoDismissActivityEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await activityDb()
        .from('activity_events')
        .update({ dismissed_at: null })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      track(ACTIVITY_EVENTS.action, activityActionProps({ action: 'undo', surface: 'activity' }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_EVENTS_KEY });
      void qc.invalidateQueries({ queryKey: ACTIVITY_UNSEEN_KEY });
    },
  });
}

/**
 * AC-10 · Clear All. The one irreversible act on this surface.
 *
 * A HARD DELETE, and it has to be. A soft one would be undoable, `clear.body`
 * promises it is not, and a promise the schema does not make is a promise the
 * screen cannot keep. The DELETE policy scopes it to the caller's own rows, so
 * "every item from your Activity" is exactly what the statement can reach and
 * exactly what it reaches.
 *
 * THE `recipient_id` FILTER IS NOT THE BOUNDARY, and should not be read as one.
 * The boundary is the DELETE policy; this predicate is here because PostgREST
 * needs a filter to accept a delete at all, and `recipient_id = me` is the one
 * filter that is provably a no-op against the policy rather than a second,
 * quieter rule that could drift from it. `21_activity_center.sql` assertion 22
 * is what checks the real thing: a stranger's delete reaches none of your rows
 * even when it names them explicitly.
 *
 * PENDING INVITATIONS SURVIVE IT. Nothing here touches `circle_members`, so an
 * invitation whose notice was cleared is still waiting in the group and still
 * answerable there. `clear.body` states it because it is the single most likely
 * misunderstanding of this button.
 */
export function useClearAllActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await activityDb().from('activity_events').delete().eq('recipient_id', userId);
      if (error) throw new Error(error.message);
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ACTIVITY_EVENTS_KEY });
      const context = snapshot(qc);
      qc.setQueryData(ACTIVITY_EVENTS_KEY, []);
      return context;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(
        ACTIVITY_EVENTS.action,
        activityActionProps({ action: 'clear_all', surface: 'activity' }),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_EVENTS_KEY });
      void qc.invalidateQueries({ queryKey: ACTIVITY_UNSEEN_KEY });
    },
  });
}
