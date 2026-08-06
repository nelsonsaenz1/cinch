import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';

/**
 * Packing is membership-only, and the app is the one deciding.
 *
 * EVERY OTHER PAYWALL IN CINCH IS A SECOND OPINION. `claim_ai_quota` or a
 * database trigger has already refused the action, and Superwall only chooses
 * what to show at that moment — which is why `placements.ts` says a typo there
 * costs a paywall, not a boundary. Packing has no server refusal to sit behind,
 * because opening a questionnaire is not a row anybody inserts. So this hook is
 * the boundary itself, and it has to fail CLOSED:
 *
 *   - An unmatched placement proceeds silently, and there is no `packing_access`
 *     campaign in the dashboard yet.
 *   - `PAYWALLS_ENABLED` is false in every keyless build, where `gate.present`
 *     resolves without doing anything at all.
 *
 * Either of those, used as the gate, is an open door. So `allowed` is read from
 * the entitlement — never from whether a paywall appeared — and the placement is
 * only ever the way *out* of the locked state.
 *
 * `usePlan()` folds the 14-day trial into `pro`, so a trialing account has
 * packing and a lapsed one does not, with no extra rule written here.
 *
 * The server backs this up on its own: `packing-brief` claims the `stylist_chat`
 * allowance, which free is excluded from, so a patched client that skipped this
 * hook would still get a 402 instead of a brief.
 */

export type PackingAccess = {
  /** True while the entitlement is unknown. Draw a skeleton, never the lock. */
  loading: boolean;
  allowed: boolean;
  /** Offer the paywall. The locked state's action, and nothing else. */
  unlock: () => void;
};

/**
 * @param active Whether Packing is the mode actually on screen. The automatic
 *   presentation must belong to *entering packing*, not to the Plan tab
 *   existing — a paywall that opens because someone tapped Week is the nagging
 *   `use-trial-expired` goes to such lengths to avoid.
 */
export function usePackingAccess(active: boolean): PackingAccess {
  const { plan, loading } = usePlan();
  const gate = useGate();
  const qc = useQueryClient();

  const allowed = plan !== 'free';

  /**
   * A purchase makes the *server's* answer stale, not this hook's. The
   * subscription row is what `usePlan` reads and what the Edge Functions
   * re-derive from, so re-reading it is the whole of "let them in" — there is
   * no local flag to flip, which is exactly why there is no way to spoof one.
   */
  const onGranted = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['subscription'] });
  }, [qc]);

  const unlock = useCallback(() => {
    void gate.present(Placement.PackingAccess, onGranted);
  }, [gate, onGranted]);

  /**
   * Once per visit to Packing, not once per render and not once per launch.
   *
   * Cleared when the tab is left, so coming back after subscribing elsewhere
   * asks again — and, more to the point, so a free user who taps Week and then
   * Packing again gets the offer a second time without being re-interrupted
   * while they are reading the locked state.
   */
  const presented = useRef(false);

  useEffect(() => {
    if (!active) {
      presented.current = false;
      return;
    }
    if (loading || allowed || presented.current) return;
    presented.current = true;
    void gate.present(Placement.PackingAccess, onGranted);
  }, [active, loading, allowed, gate, onGranted]);

  return { loading, allowed, unlock };
}
