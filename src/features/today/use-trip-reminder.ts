import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { tripReminderKey } from '@/features/today/today-spec';

/**
 * Packet T — the trip reminder card gains a way to be acknowledged.
 *
 * Modeled line for line on `use-profile-coaching.ts`, which is the app's
 * card-dismissal idiom (itself following `use-trial-expired.ts` and
 * `use-alias-reconcile.ts`): AsyncStorage, because a dismissal is a property
 * of an INSTALL rather than an account, and because it must resolve without a
 * network round trip.
 *
 * The one difference is the key, and it is the point: `tripReminderKey(id)` is
 * PER TRIP. "Got it" about Tokyo is not an opinion about every future trip —
 * a dismissed trip never returns, and a different later trip still surfaces,
 * because its id derives a key nothing has ever written.
 *
 * ── WHY IT STARTS HIDDEN ──────────────────────────────────────────────────
 *
 * `show` is false until the read for THIS trip resolves, and resets to false
 * the moment the trip changes, for the coaching hook's reason: a card that
 * flashes in and vanishes is a card shown to somebody who already dismissed
 * it, where a card that arrives one frame late costs nothing. A FAILED read
 * is treated as dismissed for the same asymmetry — the trip's own screens
 * still exist, so skipping a reminder is the smaller harm.
 */
export function useTripReminder(tripId: string | null) {
  // The trip id rides in the state so a change of trip resets `show` DURING
  // the render — the same render-time reset the masthead's rung ladder uses —
  // rather than via a synchronous setState in the effect body, which the
  // hooks lint rightly refuses as a cascading render.
  const [read, setRead] = useState<{ tripId: string | null; show: boolean }>({
    tripId,
    show: false,
  });
  if (read.tripId !== tripId) setRead({ tripId, show: false });

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    AsyncStorage.getItem(tripReminderKey(tripId))
      .then((seen) => {
        // Guarded twice: `alive` for unmount, and the id check for the trip
        // having changed while the read was in flight — a stale read must not
        // resurface a card about a different trip.
        if (alive && !seen) {
          setRead((prev) => (prev.tripId === tripId ? { tripId, show: true } : prev));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tripId]);

  /**
   * Hide first, persist after — the coaching hook's contract verbatim. A
   * dismissal that failed to save must still dismiss; the worst case of a
   * lost write is the card appearing once more on a later launch.
   */
  const dismiss = () => {
    setRead((prev) => ({ ...prev, show: false }));
    if (tripId) void AsyncStorage.setItem(tripReminderKey(tripId), '1').catch(() => {});
  };

  return { show: read.show && read.tripId === tripId, dismiss };
}
