import { useRouter } from 'expo-router';
import { useState } from 'react';

import { MembershipBody, UpgradeBody, type MembershipBodyProps, type UpgradeBodyProps } from '@/components/membership';
import { PLANS } from '@/features/billing/plans';
import {
  RESTORE_FAILED,
  RESTORE_NONE,
  restoreRestored,
} from '@/features/membership/manage-membership-spec';

/**
 * DEV ONLY · REDESIGN 30 — the two membership pages the `dev-mm-*` frames pose.
 *
 * ── WHY THE FIXTURE PASSES READS AND NOT COPY ─────────────────────────────
 *
 * Every sentence, figure and meter on these pages is computed by
 * `manage-membership-spec.ts` from a plan, a term and two counts. The frames
 * below hand over exactly those inputs and nothing else: no tier name, no
 * "of 150", no near-limit sentence, no free-line phrase is written here. That
 * is the whole value of a fixture on a billing surface — a frame built from
 * hand-typed strings keeps looking correct through exactly the edits that
 * break the real page, and "looks correct" and "is correct" are different
 * claims about somebody's money.
 *
 * The counts are picked to sit at the fractions the artifact draws (88/150,
 * 214/450) so a frame can be compared to its PNG side by side. They are
 * inputs, not copy.
 */

const noop = () => {};

/** A confirmed Standard member, both counts landed. The ordinary day. */
export const MM_STANDARD = {
  loading: false,
  unconfirmed: false,
  plan: 'standard',
  copy: PLANS.standard,
  trialing: false,
  trialEndsAt: null,
  currentPeriodEnd: new Date('2026-09-14T12:00:00Z'),
  used: 88,
  stored: 214,
  restoreAvailable: false,
  restoring: false,
  restoreEnding: null,
} satisfies Partial<MembershipBodyProps>;

export type MmOverrides = Partial<MembershipBodyProps>;

export function MmFrame(overrides: MmOverrides = {}) {
  const router = useRouter();

  return (
    <MembershipBody
      onBack={() => router.back()}
      onRetry={noop}
      onUpgrade={noop}
      onCancelBilling={noop}
      onRestore={noop}
      onBackToSettings={noop}
      {...MM_STANDARD}
      {...overrides}
    />
  );
}

/** The three restore endings, computed the way the route computes them. */
export const MM_RESTORED = restoreRestored(PLANS.standard);
export const MM_NONE = RESTORE_NONE;
export const MM_FAILED = RESTORE_FAILED;

// ---------------------------------------------------------------------------
// MB-09
// ---------------------------------------------------------------------------

export type MuOverrides = Partial<UpgradeBodyProps>;

export function MuFrame(overrides: MuOverrides = {}) {
  const router = useRouter();
  // Live, so the frame can actually be operated: the CTA is the one thing on
  // this page that is motion rather than layout, and a still PNG cannot show
  // a control locking. It never reaches a placement — see `onOpen`.
  const [opening, setOpening] = useState(false);

  return (
    <UpgradeBody
      onBack={() => router.back()}
      loading={false}
      plan="standard"
      opening={opening}
      unavailable={false}
      declined={false}
      // A fixture must never summon a real paywall: `present()` is a vendor
      // call with analytics behind it, and a design frame is not a session.
      onOpen={() => setOpening((open) => !open)}
      onDecline={noop}
      {...overrides}
    />
  );
}
