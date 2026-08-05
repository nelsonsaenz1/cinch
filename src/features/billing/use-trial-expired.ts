import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { Placement } from './placements';
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
const FIRED_KEY = 'cinch.trialExpiredFiredFor';

export function useTrialExpiredPlacement(): void {
  const { plan, trialing, trialEndsAt, loading } = usePlan();
  const gate = useGate();

  // A primitive, because `trialEndsAt` is a fresh Date object every render of
  // usePlan — putting the Date itself in the deps re-runs the effect (and its
  // storage read) on every render, and two overlapping reads can both see the
  // marker unwritten and present twice.
  const marker = trialEndsAt?.toISOString() ?? null;

  useEffect(() => {
    // A past `trialEndsAt` with `trialing` false is the lapse signal. A user
    // with no trial timestamp at all never lapsed (they predate trials or
    // already subscribed) and is never interrupted.
    if (loading || trialing || plan !== 'free' || !marker) return;
    let cancelled = false;

    void AsyncStorage.getItem(FIRED_KEY).then((fired) => {
      if (cancelled || fired === marker) return;
      // Write BEFORE presenting. If the write happened after, a crash or kill
      // mid-paywall would re-interrupt on next launch — the failure mode this
      // hook exists to prevent. The cost of the other ordering (a write that
      // succeeds but a present that never happens) is one missed interruption,
      // which is the better wrong.
      void AsyncStorage.setItem(FIRED_KEY, marker).then(() => {
        if (!cancelled) void gate.present(Placement.TrialExpired);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loading, trialing, plan, marker, gate]);
}
