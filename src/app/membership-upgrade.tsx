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
 * Reached from MB-08's "Move to Pro" row, which renders only once the
 * subscription read has confirmed a paid plan below Pro. A free account has no
 * upgrade — it has a first purchase, which is the paywall's own job at
 * `reveal_complete` and the limit placements — and a Pro member has nothing
 * above them. Both reach this route only as a typed deep link, and both are
 * refused with a way back.
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
      plan={plan.plan}
      opening={opening}
      unavailable={unavailable}
      declined={declined}
      onOpen={open}
      onDecline={() => router.back()}
    />
  );
}
