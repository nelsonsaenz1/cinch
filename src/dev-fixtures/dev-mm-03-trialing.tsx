import { PLANS } from '@/features/billing/plans';

import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-03 — the server's 14-day access trial.
 *
 * `cinch:///dev-mm-03-trialing`. The frame `membership-trialing-server-date`.
 * The colophon reads TRIAL THROUGH and the date is the one the SERVER wrote to
 * `subscriptions.trial_ends_at` — never a countdown this client computed, and
 * never an App Store introductory offer, which does not exist for any of the
 * four products.
 *
 * `paid={false}` and `plan="pro"` together are the real shape of this account:
 * a free row with a live `trial_ends_at`, which `usePlan()` folds up to `pro`
 * for every ceiling in the app while owning nothing. That combination used to
 * draw the manage page — cancel row and all — for somebody with no
 * subscription to cancel.
 */
export default function DevMm03Trialing() {
  return (
    <MmFrame
      paid={false}
      plan="pro"
      copy={PLANS.pro}
      trialing
      trialEndsAt={new Date('2026-09-01T12:00:00Z')}
      currentPeriodEnd={null}
    />
  );
}
