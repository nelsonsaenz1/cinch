import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-03 — the server's 14-day access trial.
 *
 * `cinch:///dev-mm-03-trialing`. The frame `membership-trialing-server-date`.
 * The colophon reads TRIAL THROUGH and the date is the one the SERVER wrote to
 * `subscriptions.trial_ends_at` — never a countdown this client computed, and
 * never an App Store introductory offer, which does not exist for any of the
 * four products.
 */
export default function DevMm03Trialing() {
  return (
    <MmFrame trialing trialEndsAt={new Date('2026-09-01T12:00:00Z')} currentPeriodEnd={null} />
  );
}
