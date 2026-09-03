import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/auth/use-session';
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
 * There is NO server behind this lock any more: `packing-brief` was deleted
 * 2026-09-03 (the memo is computed on the device, `packing-memo.ts`), so a
 * patched client that skipped this hook would get a memo. Accepted — the memo
 * is arithmetic over the user's own closet, and the paid thing is the
 * convenience, not a secret.
 *
 * ── THE BLANK PLAN TAB ───────────────────────────────────────────────────
 *
 * This hook used to present the paywall AUTOMATICALLY, from an effect, the
 * moment Packing became the active segment. That is the founder's "click on
 * plan, it brings up a blank screen", reproduced on the dev client: tapping
 * Packing handed the screen to Superwall, whose paywall is still an unpublished
 * shell. Its WKWebView never commits a frame — the device log shows the page
 * proxy logging `have not received a commit 526.53s after visible content rect
 * update` — so what covers the app is a full-screen grey sheet with no close
 * control, and no way back to Cinch but force-quitting it.
 *
 * A paywall nobody asked for was already the wrong shape (`use-trial-expired`
 * goes to some lengths not to nag). That it can also eat the entire app makes
 * it a boundary the Plan tab cannot own: an automatic presentation is a bet
 * that a vendor's modal will always dismiss itself, and losing that bet costs
 * the whole screen rather than one control.
 *
 * So the paywall is now presented ONLY from `unlock()` — the locked state's
 * button, an explicit tap on "See membership". Entering Packing draws the
 * designed locked plate and nothing else, which is a state this app controls
 * end to end. The offer is not lost: the locked plate says what packing is and
 * carries the action, which converts better than an interstitial anyway.
 */

/**
 * What happened the last time the user asked to see membership.
 *
 * `unavailable` is the honest answer to "the button did nothing" — see
 * `presentationFailed` below for how that is detected without this slice
 * reaching into the billing layer.
 */
export type UnlockState = 'idle' | 'opening' | 'unavailable';

export type PackingAccess = {
  /** True while the entitlement is unknown. Draw a skeleton, never the lock. */
  loading: boolean;
  allowed: boolean;
  /** Offer the paywall. The locked state's action, and nothing else. */
  unlock: () => void;
  unlockState: UnlockState;
};

/**
 * A paywall that reached the user cannot have come and gone this fast.
 *
 * The presentation animation alone is longer than this, and a human dismissing
 * a sheet they actually saw is slower still. So a `present()` that settles
 * inside this window without granting anything did not show anybody anything —
 * an unmatched campaign, a disabled build, or a vendor failure that resolved
 * quietly. All three mean the same thing to the person who tapped the button.
 */
const NOTHING_SHOWN_MS = 1_000;

/**
 * Reduce whatever `gate.present` hands back to one question: did the offer fail
 * to reach the user?
 *
 * DELIBERATELY DEFENSIVE ABOUT A SHAPE THIS SLICE DOES NOT OWN. `present` is
 * typed `Promise<void>` today, so `outcome` is `undefined` and the timing check
 * is what catches a silent no-op. The billing layer is separately being made to
 * fail safe and report a skip or an error, and when it does this reads that
 * signal without another change here — a union of the plausible spellings, none
 * of which can be imported from a module this slice must not edit.
 *
 * Unknown shapes are treated as success on purpose. Guessing "failed" from an
 * unrecognised value would tell a user membership is unavailable at the exact
 * moment a working paywall is on screen.
 */
function presentationFailed(outcome: unknown): boolean {
  if (outcome == null) return false;

  if (typeof outcome === 'string') {
    return outcome === 'error' || outcome === 'skipped' || outcome === 'unavailable';
  }

  if (typeof outcome === 'object') {
    const o = outcome as Record<string, unknown>;
    if (o.presented === false || o.ok === false) return true;
    if (o.error != null && o.error !== false) return true;
    if (typeof o.status === 'string') {
      return o.status === 'error' || o.status === 'skipped' || o.status === 'unavailable';
    }
  }

  return false;
}

/**
 * @param active Whether Packing is the mode actually on screen. Clears the
 *   unlock state on the way out, so someone who left a failed attempt behind
 *   and came back gets a clean plate rather than yesterday's apology.
 */
export function usePackingAccess(active: boolean): PackingAccess {
  const session = useSession();
  const { plan, loading: planLoading } = usePlan();
  const gate = useGate();
  const qc = useQueryClient();

  const [attemptState, setAttemptState] = useState<UnlockState>('idle');

  /**
   * The session is folded in because `usePlan` reports `loading: false` while
   * the user id is still unknown — its query is `enabled: Boolean(userId)`, and
   * a disabled query is pending without loading anything. Read on its own that
   * resolves to `free`, which would flash the lock at a paying subscriber on
   * every cold start. `useSession` always settles (it clears `loading` even
   * when the Keychain read throws), so folding it in bounds this rather than
   * adding a second way to hang.
   */
  const loading = session.loading || planLoading;
  /**
   * PRO, not "any paying plan".
   *
   * This read `plan !== 'free'` until 2026-08-09, which let Standard pack. The
   * atlas prices packing as the thing Pro adds, and the founder moved the
   * product rather than the copy — nothing had shipped, so nobody was sold a
   * Standard subscription with packing in it. `usePlan()` folds the 14-day
   * trial into `pro`, so a trialing account still packs.
   *
   * No server enforces this boundary since 2026-09-03 (see the header) — this
   * line is the lock.
   */
  const allowed = plan === 'pro';

  /** Guards the async `unlock` against setting state on an unmounted tab. */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  /**
   * Derived rather than reset from an effect. `PackingTab` unmounts the moment
   * another segment is chosen, so leaving already discards this state; reading
   * `active` here is the belt to that braces, and costs no render.
   */
  const unlockState: UnlockState = active ? attemptState : 'idle';

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
    setAttemptState('opening');
    const startedAt = Date.now();

    void (async () => {
      try {
        const outcome: unknown = await gate.present(Placement.PackingAccess, onGranted);
        if (!live.current) return;

        const silent = Date.now() - startedAt < NOTHING_SHOWN_MS;
        setAttemptState(presentationFailed(outcome) || silent ? 'unavailable' : 'idle');
      } catch {
        // A gate that throws is the clearest possible "no paywall happened".
        if (live.current) setAttemptState('unavailable');
      }
    })();
  }, [gate, onGranted]);

  return { loading, allowed, unlock, unlockState };
}
