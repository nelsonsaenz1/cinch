import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { MembershipBody } from '@/components/membership';
import {
  RESTORE_FAILED,
  RESTORE_NONE,
  restoreRestored,
  type RestoreEnding,
} from '@/features/membership/manage-membership-spec';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { useRestorePurchases } from '@/features/profile/use-restore-purchases';

/**
 * Apple's own manage-subscriptions page. There is no StoreKit module installed
 * to present the native sheet in-app; this URL opens the App Store's
 * subscription list, which is where cancellation genuinely lives anyway.
 * `profile.tsx` and `features/help/articles.ts` each hold the same literal —
 * see the note on the one in `articles.ts` for why it is not imported.
 */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * MB-08 — membership. Reached from Settings' membership plate, from the
 * friends shelf's "See plans", and by deep link.
 *
 * ── IT IS NO LONGER A PAID-ONLY PAGE ──────────────────────────────────────
 *
 * It never truly was: Settings hid the row for a confirmed free account, but
 * `/friends` pushed here and a deep link always could, and what those readers
 * met was "There is no membership on this account to manage" and a way back —
 * a dead end for the exact person Today and Closet were selling to. The page
 * now draws whichever of five states `membershipSurface()` returns, and the
 * free and trialing ones carry the comparison and one door.
 *
 * That door is `useGate` and the `membership_upgrade` placement — the same
 * gate every other purchase in the app opens, never a second way to summon a
 * paywall. A paying Standard member's "Move to Pro" row still routes to MB-09
 * instead, because that page is a delta and this one is not.
 *
 * Redesign 30. The drawing moved to `components/membership/membership-body`
 * so the `dev-mm-*` fixtures can pose every state against the components the
 * app actually mounts; this file is the wiring, which is all it ever should
 * have been. `features/billing/` is untouched by the redesign — the plan read,
 * the capacity counts, the traced claims in `manage-membership.ts` and the
 * upgrade routing are exactly what they were.
 *
 * The restore endings are drawn IN PLACE rather than raised as alerts, which is
 * the option `use-restore-purchases.ts` has offered since UX-08: pass
 * `onOutcome` and the hook reports instead of interrupting. Redesign 30's
 * frames draw all three endings on this page, so this is the surface that
 * takes the option.
 */
export default function MembershipScreen() {
  const router = useRouter();
  const plan = usePlan();
  const capacity = useCapacity();
  const gate = useGate();

  const [ending, setEnding] = useState<RestoreEnding | null>(null);
  const [opening, setOpening] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [declined, setDeclined] = useState(false);

  // `plan.copy` is read at report time rather than captured, so a restore that
  // moved the tier names the tier that came BACK and not the one this screen
  // was mounted with.
  const onOutcome = useCallback(
    (outcome: 'restored' | 'none' | 'failed') => {
      setEnding(
        outcome === 'restored'
          ? restoreRestored(plan.copy)
          : outcome === 'none'
            ? RESTORE_NONE
            : RESTORE_FAILED,
      );
    },
    [plan.copy],
  );

  const restore = useRestorePurchases({ onOutcome });

  /**
   * The first-purchase door. Identical shape to MB-09's, deliberately: both
   * resolve on every path, and both draw the two endings that are not a
   * purchase, so neither is ever a button that appears to do nothing.
   */
  const seePlans = useCallback(() => {
    setOpening(true);
    setUnavailable(false);
    setDeclined(false);
    void gate
      .present(Placement.MembershipUpgrade)
      .then((outcome) => {
        if (outcome === 'unavailable') setUnavailable(true);
        else if (outcome === 'declined') setDeclined(true);
      })
      .finally(() => setOpening(false));
  }, [gate]);

  return (
    <MembershipBody
      onBack={() => router.back()}
      loading={plan.loading}
      unconfirmed={plan.unconfirmed}
      onRetry={plan.refetch}
      plan={plan.plan}
      copy={plan.copy}
      trialing={plan.trialing}
      paid={plan.paid}
      ownedPlan={plan.ownedPlan}
      trialEndsAt={plan.trialEndsAt}
      currentPeriodEnd={plan.currentPeriodEnd}
      // `useCapacity` returns 0 while its count is in flight, which is a claim
      // about somebody's closet rather than an absence of one. `loading` is
      // what distinguishes them, and a pending count draws a skeleton.
      used={capacity.loading ? null : capacity.used}
      stored={capacity.loading ? null : capacity.stored}
      onUpgrade={() => router.push('/membership-upgrade')}
      onSeePlans={seePlans}
      opening={opening}
      unavailable={unavailable}
      declined={declined}
      onCancelBilling={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
      restoreAvailable={restore.available}
      restoring={restore.restoring}
      onRestore={() => {
        // The previous ending is cleared on a retry: a "couldn't be reached"
        // notice still on screen while the next attempt is in flight is the
        // page contradicting itself.
        setEnding(null);
        restore.restore();
      }}
      restoreEnding={ending}
      onBackToSettings={() => router.back()}
    />
  );
}
