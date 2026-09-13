/**
 * The `returning_free` wiring — Today mounts this, and Today never feels it.
 *
 * The schedule is returning-free-core.ts (pure, tested); the qualification and
 * caps are present-promo.ts (free-only, not-trialing, one general ask per day,
 * three per week); this file is only the plumbing between an app open and
 * those two: read the account's clock, read the ledger, ask the core, and go
 * through `presentPromo` if it says now.
 *
 * MUST NEVER INTERFERE WITH TODAY'S RENDER. Everything runs from an effect,
 * deferred behind `InteractionManager.runAfterInteractions` so the first
 * frames of the home tab are never sharing the thread with a Supabase read —
 * and the hook returns nothing, so no render can depend on it.
 *
 * WHERE THE INPUTS COME FROM, because none of them is a new query:
 *
 *   - the account's age is `user.created_at` off the session already persisted
 *     in storage (`supabase.auth.getSession()` — the same zero-request read
 *     Today's `useFirstName` makes for the greeting);
 *   - the outfit count is handed in by Today, which already computes it from
 *     the wardrobe it is rendering (`countOutfits(tallyOf(items))`);
 *   - whether the Reveal has been DELIVERED — `useRevealDelivered()`, the
 *     `reveal_seen_at` read Today already makes for its own Reveal door.
 *     Ledger A78 (2026-09-13): `faaec810` returned at +127 h with five
 *     garments that had never been dressed and was asked for money two
 *     seconds after the app opened. An outfit COUNT is arithmetic — the
 *     engine could make one — and a stamp is delivery — the person was shown
 *     one. A return offer is about the second thing;
 *   - the prior asks come from `fetchRecentImpressions()`, the same 7-day
 *     ledger read the caps use. Seven days is enough for the day-7 spacing
 *     rule — a day-3 impression is at most ~4 days old by then — see the note
 *     on `evaluateReturningFree`.
 */

import { useEffect } from 'react';
import { InteractionManager } from 'react-native';

import { supabase } from '@/lib/supabase';

import { Placement } from './placements';
import { presentPromo } from './present-promo';
import { fetchRecentImpressions } from './promo-caps-io';
import { evaluateReturningFree } from './returning-free-core';
import { useGate } from './use-gate';
import { usePlan } from './use-plan';

/**
 * The once-per-app-open latch — upsell-bubble.ts's claimed-latch precedent,
 * for the same reason: module state clears on a cold start and on nothing
 * else, which is the definition of "this app open" with no key to migrate.
 *
 * CLAIMED BEFORE THE EVALUATION, not before the sheet, and that is deliberate.
 * The evaluation itself reads the impression ledger over the network, and the
 * effect below re-runs whenever the outfit count or plan state moves — a
 * wardrobe still classifying can move it several times in a minute. One claim
 * per open caps all of that at a single ledger read; the cost is that a
 * not-due answer also spends the open, which is nothing, because the windows
 * are days wide and tomorrow's open asks again.
 */
let claimed = false;

/** True for the first caller after an app open, false for every one after. */
function claimReturningFree(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

/** Tests only — there is no cold start in a test process. */
export function resetReturningFree(): void {
  claimed = false;
}

/**
 * Offer the day-3 / day-7 return ask, if this is the moment for it.
 *
 * `outfitCount` is Today's own computed count, unmodified — zero while the
 * wardrobe loads simply defers the evaluation (nothing is claimed until the
 * account qualifies), and the effect re-runs when the real count lands.
 *
 * `revealDelivered` is `useRevealDelivered()` — false until a settled read
 * says `reveal_seen_at` is stamped. Gated BEFORE the latch, like the other
 * cheap gates, so a never-dressed closet never spends its app open here and
 * the ask arrives the first open after the Reveal is delivered, on schedule.
 */
export function useReturningFree(outfitCount: number, revealDelivered: boolean): void {
  const gate = useGate();
  const { plan, trialing, loading, unconfirmed } = usePlan();

  useEffect(() => {
    // The cheap gates, before anything is claimed or fetched. `presentPromo`
    // re-checks plan and trial state anyway; checking here as well keeps an
    // unqualified account from ever spending the latch or touching the ledger.
    if (loading || unconfirmed || plan !== 'free' || trialing) return;
    if (outfitCount < 1) return;
    if (!revealDelivered) return;
    if (claimed) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        if (cancelled || !claimReturningFree()) return;
        try {
          // The persisted session — no request. An account with no readable
          // creation date has no age to schedule from, and the quiet answer
          // is the right one for an ask the app initiates.
          const { data } = await supabase.auth.getSession();
          const createdAt = data.session?.user.created_at;
          if (!createdAt) return;

          const prior = (await fetchRecentImpressions()).filter(
            (row) => row.placement === Placement.ReturningFree,
          );

          const verdict = evaluateReturningFree(
            new Date().toISOString(),
            createdAt,
            outfitCount,
            prior,
          );
          if (!verdict.due || cancelled) return;

          // No contextOpts: `returning_free` has no context line in
          // context-lines.ts, and inventing one here would be a second author
          // for the sheet's copy. Qualification, the frequency caps and the
          // paywall_eligible/dismissed events are all presentPromo's.
          await presentPromo(gate, Placement.ReturningFree, { plan, trialing });
        } catch {
          // `fetchRecentImpressions` throws on an unreadable ledger, and this
          // whole hook is an ask the app initiates: on any failure, silence.
          // The latch stays spent — retrying a network error on the home tab
          // is how a quiet feature becomes a chatty one.
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [gate, plan, trialing, loading, unconfirmed, outfitCount, revealDelivered]);
}
