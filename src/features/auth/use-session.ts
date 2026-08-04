import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type SessionState =
  | { loading: true; userId: null }
  | { loading: false; userId: string | null };

/**
 * Reactive session state.
 *
 * `onAuthStateChange` fires on every event the auth client emits, including
 * silent token refreshes — so this hook re-renders as the user signs in, out,
 * or their session gets refreshed in the background.
 *
 * On sign-in / sign-out we invalidate every cached query: the closet, review
 * queue, and profile all become the new user's data, and TanStack Query would
 * otherwise serve the previous user's cache for a beat.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true, userId: null });
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    // Prime the state from whatever is already persisted in AsyncStorage,
    // so the initial render doesn't flash the sign-in screen for a user who
    // was already signed in on a previous launch.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState({ loading: false, userId: data.session?.user.id ?? null });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ loading: false, userId: session?.user.id ?? null });

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Clear rather than invalidate: cached rows from the previous user
        // would still be shown momentarily while the refetch runs, and RLS
        // means they wouldn't even come back on a re-query anyway.
        qc.clear();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return state;
}
