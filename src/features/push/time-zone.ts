import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Tell the server which day the reader is living in.
 *
 * The morning edit fires at *their* 7:30, and the event reminder at *their*
 * evening. The server has neither: `profiles` carries `home_city` and `units`,
 * and a city name is not a schedule. So the client writes the zone.
 *
 * AN IANA NAME, NEVER AN OFFSET. An offset in minutes is wrong twice a year,
 * and it is most wrong for the dormant account that most needs its schedule to
 * keep working without anyone opening the app. A name lets Postgres own the
 * DST rules, which it already does correctly and we would not.
 *
 * Until this column is filled, `push_senders`'s morning-edit and event-reminder
 * claims match nobody — deliberately. A Californian's 07:30 read as UTC is
 * 23:30 the night before, which is not an early notification, it is the wrong
 * one. Null sends nothing, and that is the safe direction to be wrong in.
 *
 * FIRE AND FORGET, and not gated on push. It is written on every launch with a
 * session, whether or not the binary has the notifications module and whether
 * or not any channel is switched on: the value is a fact about the account, it
 * is one small write against a row that is already being read, and requiring
 * push to exist first would mean the very first notification after a store
 * build had no schedule to fire on. A failed write costs one launch's worth of
 * staleness and is never surfaced — there is nothing the reader could do about
 * it, and the zone will be right again the next time the app opens.
 */
export function useReportTimeZone(): void {
  useEffect(() => {
    const write = (userId: string) => {
      let zone: string | undefined;
      try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // Hermes without full ICU would land here. No zone is better than a
        // guessed one: the senders already treat null as "do not schedule".
        return;
      }
      if (!zone) return;

      void supabase
        .from('profiles')
        .update({ time_zone: zone })
        .eq('user_id', userId)
        .then(() => {
          /* best effort, by design — see the docblock */
        });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // `INITIAL_SESSION` covers the ordinary cold launch of a signed-in app,
      // which is the case that matters: somebody who flies to Lisbon and opens
      // Cinch there should get tomorrow's edit on Lisbon time.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user.id) write(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
