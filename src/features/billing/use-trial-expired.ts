import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { Placement } from './placements';
import { presentPromo } from './present-promo';
import { evaluateTrialExpired } from './trial-expired-core';
import { useCapacity } from './use-capacity';
import { useGate } from './use-gate';
import { usePlan } from './use-plan';

/**
 * The `trial_expired` placement — the one not tied to an action.
 *
 * Fires on app open when the 14-day trial has lapsed and the account never
 * subscribed. Unlike the other three placements there is no attempted action to
 * retry on grant: the user was interrupted, not refused, so `onGranted` is
 * simply nothing and the app continues.
 *
 * ONCE PER LAPSE, NOT ONCE PER LAUNCH. Without the stored marker this would
 * fire on every cold start for as long as the user stays free — which turns
 * "your trial ended" from information into a toll gate, and is exactly the
 * nagging the design brief forbids. The marker is keyed on the trial's end
 * timestamp rather than a boolean so that a future re-trial (win-back, say)
 * fires exactly once again without any migration.
 *
 * Superwall's campaign filters still decide whether anything is SHOWN — this
 * only registers the placement. Registering once and letting the dashboard
 * decide frequency would also work, but then a mis-configured campaign nags on
 * every launch; this keeps the guarantee in the app.
 */
export function useTrialExpiredPlacement(): void {
  const { plan, trialing, trialEndsAt, loading } = usePlan();
  const gate = useGate();
  // The active count the closet itself reads (`closet-count`), unread as null
  // — never presented over an empty closet (A75; see the core).
  const capacity = useCapacity();
  const garments = capacity.loading ? null : capacity.used;

  // A primitive, because `trialEndsAt` is a fresh Date object every render of
  // usePlan — putting the Date itself in the deps re-runs the effect (and its
  // storage read) on every render, and two overlapping reads can both see the
  // marker unwritten and present twice.
  const marker = trialEndsAt?.toISOString() ?? null;

  useEffect(() => {
    let cancelled = false;

    // The whole decision — the lapse guard, the read-check-write ordering
    // (write BEFORE present, so a crash mid-paywall cannot re-interrupt), and
    // the once-per-lapse guarantee — lives in `evaluateTrialExpired`, where
    // the node suite exercises every branch. This effect only supplies the
    // real storage, the real gate, and the unmount flag.
    void evaluateTrialExpired(
      { loading, trialing, plan, marker, garments },
      {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        // Through the promo path, not the bare gate: `trial_expired` is a
        // general promotional ask, so it spends the frequency allowance and
        // is itself refused when the account was already asked today. The
        // once-per-lapse marker above still applies first — a capped ask
        // consumes the marker, deliberately: the lapse was noticed, and
        // repeating it tomorrow because a different promo showed today is
        // the nagging this hook exists to prevent.
        present: () => void presentPromo(gate, Placement.TrialExpired, { plan, trialing }),
        cancelled: () => cancelled,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [loading, trialing, plan, marker, garments, gate]);
}
