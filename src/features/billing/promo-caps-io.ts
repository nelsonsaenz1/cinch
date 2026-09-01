/**
 * The IO half of promo-caps.ts — the two functions that touch the network.
 *
 * A SEPARATE FILE for the same reason trial-expired-core.ts is separate from
 * use-trial-expired.ts: the test runner bundles whatever a test imports, and
 * `@/lib/supabase` throws at import time without the Expo env — so the pure
 * evaluation stays importable under bare `node --test`, and everything that
 * needs a client lives here. Same import pattern as use-plan.ts.
 */

import { supabase } from '@/lib/supabase';

import type { PlacementName } from './placements';
import { WEEK_MS, type PromoImpression } from './promo-caps';

/**
 * The typed client does not know `paywall_impressions` yet — the table landed
 * in a parallel migration and `npm run gen:types` has not been re-run against
 * it. The loosening is confined to this one accessor and deletes itself the
 * moment the generated `Database` type catches up (at which point the cast
 * becomes a no-op and can be removed).
 */
const impressionsTable = () =>
  (supabase as unknown as { from: (table: string) => any }).from('paywall_impressions');

/**
 * Record that a general promo VISIBLY presented. Fire-and-forget.
 *
 * Called from `presentPromo()` exactly when `gate.present()` resolved
 * 'granted' or 'declined' — the two outcomes that mean a sheet committed a
 * frame — and never on 'unavailable', which means nothing was ever on screen
 * and must not spend the allowance (see the seam note in present-promo.ts).
 *
 * ERRORS ARE SWALLOWED, deliberately. This runs on paths (the post-Ten beat,
 * the Reveal) that are forbidden to block or throw, and a failed insert costs
 * only accuracy: the caps run on whatever rows the server does hold at the
 * next fetch. The account-level table is what keeps that honest — a reinstall
 * cannot reset the caps, because the ledger never lived on the device.
 */
export function recordImpression(placement: PlacementName): void {
  void (async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await impressionsTable().insert({
      user_id: userId,
      placement,
      shown_at: new Date().toISOString(),
    });
  })().catch(() => {
    /* Offline, RLS mid-deploy, whatever — the ledger is best-effort by
       contract, and the caller is on a path that must not feel this. */
  });
}

/**
 * The last 7 days of the ledger, oldest-first — exactly the window
 * `evaluatePromoCaps` looks at, so callers pass the result straight through.
 *
 * THROWS on a failed read rather than returning `[]`: an empty array is a
 * positive claim ("nothing was shown this week") that a network error has no
 * business making. `presentPromo()` catches the throw and declines to ask —
 * when the history cannot be read, staying quiet is the polite wrong.
 */
export async function fetchRecentImpressions(): Promise<PromoImpression[]> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const { data, error } = await impressionsTable()
    .select('placement, shown_at')
    .gt('shown_at', since)
    .order('shown_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { placement: string; shown_at: string }[]).map((row) => ({
    placement: row.placement,
    shownAtIso: row.shown_at,
  }));
}
