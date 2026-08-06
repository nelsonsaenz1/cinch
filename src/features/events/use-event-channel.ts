import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * The realtime seam (build plan §5.2): one channel per focused event screen.
 *
 * Only `event_outfit_votes` and `event_comments` are published — the two
 * tables that change under a member's fingers while an event screen is open,
 * driven by other people. Everything else on these screens moves at
 * pull-to-refresh speed and stays plain react-query.
 *
 * Handlers INVALIDATE the shared §5.4 query keys rather than patching caches
 * from the payload: the refetch re-reads through RLS and the projection views,
 * so a socket payload can never show someone a row the query path wouldn't.
 * (Postgres Changes also runs each subscriber's RLS server-side; this is the
 * belt to that braces.)
 *
 * `useFocusEffect`, not `useEffect`: the subscription exists only while the
 * screen is focused and is torn down on blur, which is what keeps one viewer
 * to one channel on the free tier's connection budget. The keys invalidated
 * here are registered by the event-outfits feature — coupled by string per
 * the build plan, never by import, so the two features compile independently.
 */
export function useEventChannel(eventId: string | null): void {
  const qc = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      if (!eventId) return;

      const channel = supabase
        .channel(`event:${eventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_outfit_votes',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            void qc.invalidateQueries({ queryKey: ['event-posts', eventId] });
            void qc.invalidateQueries({ queryKey: ['my-vote', eventId] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_comments',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            void qc.invalidateQueries({ queryKey: ['event-comments', eventId] });
          },
        )
        .subscribe();

      return () => {
        // removeChannel both unsubscribes and forgets the topic; letting the
        // promise float is fine — nothing downstream depends on the ack.
        void supabase.removeChannel(channel);
      };
    }, [eventId, qc]),
  );
}
