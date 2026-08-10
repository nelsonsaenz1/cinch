import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEFAULT_NOTIFICATION_PREFS,
  prefsFromRow,
  rowFromPrefs,
  type NotificationPrefs,
} from '@/features/push/channels';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * Reading and writing `notification_prefs`.
 *
 * **A user may have no row.** Nothing writes one at sign-up, because the atlas's
 * defaults are already the senders' behaviour and a row full of default values
 * is a row that says nothing. So absence reads as the defaults, and the first
 * change writes the whole set — not just the field that moved. A partial insert
 * would silently reset the others to the column defaults, which is the one
 * thing this screen promises never to do.
 */

export const notificationPrefsKey = ['notification-prefs'] as const;

export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationPrefsKey,
    queryFn: async (): Promise<NotificationPrefs> => {
      const userId = await getUserId();
      if (!userId) return DEFAULT_NOTIFICATION_PREFS;

      const { data, error } = await supabase
        .from('notification_prefs')
        .select(
          'morning_edit, morning_edit_at, friend_activity, borrow_requests, event_reminders, votes_comments',
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return prefsFromRow(data);
    },
  });
}

/**
 * Writes the complete set, and moves the switch before the network does.
 *
 * The optimistic write is not decoration: a switch that waits on a round trip
 * before moving reads as broken, and the value being written is the user's own
 * — there is nothing to reconcile against. A failure rolls the cache back to
 * exactly what was there, so the screen never claims a setting that is not
 * saved.
 */
export function useSetNotificationPrefs() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (next: NotificationPrefs) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('notification_prefs')
        .upsert({ user_id: userId, ...rowFromPrefs(next) }, { onConflict: 'user_id' });

      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: notificationPrefsKey });
      const previous = qc.getQueryData<NotificationPrefs>(notificationPrefsKey);
      qc.setQueryData(notificationPrefsKey, next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) qc.setQueryData(notificationPrefsKey, context.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationPrefsKey });
    },
  });
}
