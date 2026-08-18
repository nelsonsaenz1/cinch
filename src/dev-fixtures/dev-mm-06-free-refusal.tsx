import { PLANS } from '@/features/billing/plans';

import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-06 — a confirmed free account, reached by a typed deep link.
 *
 * `cinch:///dev-mm-06-free-refusal`. The frame
 * `membership-free-deep-link-refusal`. The app never routes here from Settings
 * for a free account, so this state exists only for a URL somebody typed. One
 * truthful sentence and a way back — NO upsell is placed on a refusal.
 */
export default function DevMm06FreeRefusal() {
  return <MmFrame plan="free" copy={PLANS.free} currentPeriodEnd={null} />;
}
