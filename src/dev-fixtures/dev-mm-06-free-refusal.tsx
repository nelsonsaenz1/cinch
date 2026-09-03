import { PLANS } from '@/features/billing/plans';

import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-06 — a confirmed free account.
 *
 * `cinch:///dev-mm-06-free-refusal`. Was the frame
 * `membership-free-deep-link-refusal`, and is not a refusal any more: this is
 * where Settings, the friends shelf and a deep link all land a free account,
 * and it draws what the account has, what each paid tier adds, and one door
 * through the gate. The single sentence it used to carry — "There is no
 * membership on this account to manage" — was a dead end shown to the person
 * the rest of the app was actively selling to.
 */
export default function DevMm06FreeRefusal() {
  return <MmFrame paid={false} plan="free" copy={PLANS.free} currentPeriodEnd={null} />;
}
