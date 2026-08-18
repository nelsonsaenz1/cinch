import { PLANS } from '@/features/billing/plans';

import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-02 — Pro. Larger ceilings, and NO upgrade row.
 *
 * `cinch:///dev-mm-02-pro`. The frames `membership-pro-default` and
 * `membership-pro-no-upgrade-row`: absence is the design, stated once rather
 * than drawn as a control that could never act. Four-digit counts keep tabular
 * figures, which is the other thing this frame is evidence for.
 */
export default function DevMm02Pro() {
  return (
    <MmFrame
      plan="pro"
      copy={PLANS.pro}
      currentPeriodEnd={new Date('2027-03-02T12:00:00Z')}
      used={412}
      stored={1180}
    />
  );
}
