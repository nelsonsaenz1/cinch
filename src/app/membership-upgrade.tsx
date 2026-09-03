import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { UpgradeBody } from '@/components/membership';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';

/**
 * MB-09 — Standard → Pro. Only the difference.
 *
 * Redesign 30. The drawing moved to `components/membership/upgrade-body`; this
 * file is the wiring, and the ROUTING is byte-for-byte what shipped: placement
 * `membership_upgrade` → campaign 101571 → paywall 254200, opened through
 * `useGate` and through nothing else. `features/billing/` is untouched.
 *
 * Reached from MB-08's "Move to Pro" row, from Profile's plan door, and by
 * deep link. `upgradeSurface()` decides what that means for the account that
 * arrived: a paying member below Pro sees the delta, a paying Pro member sees
 * the one refusal that is true of them, and a free or trialing account sees
 * the comparison and the same gate — never "This account is already on Pro",
 * which is what the single shipped refusal told both of them.
 */
export default function MembershipUpgradeScreen() {
  const router = useRouter();
  const plan = usePlan();
  const gate = useGate();
  const [unavailable, setUnavailable] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [opening, setOpening] = useState(false);

  const open = useCallback(() => {
    setOpening(true);
    setUnavailable(false);
    setDeclined(false);
    void gate
      .present(Placement.MembershipUpgrade)
      .then((outcome) => {
        // `declined` is a person closing a paywall they read. It needs no
        // apology and gets no second ask — one quiet line confirming that
        // nothing was started, and the page they came back to is still true.
        if (outcome === 'unavailable') setUnavailable(true);
        else if (outcome === 'declined') setDeclined(true);
      })
      .finally(() => setOpening(false));
  }, [gate]);

  return (
    <UpgradeBody
      onBack={() => router.back()}
      loading={plan.loading}
      unconfirmed={plan.unconfirmed}
      plan={plan.plan}
      paid={plan.paid}
      trialing={plan.trialing}
      trialEndsAt={plan.trialEndsAt}
      opening={opening}
      unavailable={unavailable}
      declined={declined}
      onOpen={open}
      onDecline={() => router.back()}
    />
  );
}
