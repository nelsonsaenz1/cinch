import { useRouter } from 'expo-router';
import { useState } from 'react';

import { SettingsBody, type SettingsBodyProps } from '@/components/settings';
import { membershipRowFor, type MembershipRowInput } from '@/features/billing/membership-row';
import { RESTORE_OUTCOMES } from '@/features/profile/settings-copy';
import type { UpdateDiagnostic } from '@/features/updates/diagnostics';

/**
 * DEV ONLY · REDESIGN 29 — the Settings page the nine `dev-se-*` frames pose.
 *
 * ── WHY THE FIXTURE BUILDS INPUTS AND NOT A ROW ───────────────────────────
 *
 * The membership plate below is always the product of `membershipRowFor` run on
 * the same five inputs the screen feeds it. Nothing here hand-writes a tier
 * name, a term, a "Checking…" or a chevron. That is the whole value of the
 * fixture: a frame built from hand-typed strings would keep looking correct
 * through exactly the edits that broke the real plate — and this is a billing
 * surface, where "looks correct" and "is correct" are different claims about
 * somebody's money.
 *
 * The diagnostics facts are hand-written, and that is the one exception with a
 * reason: `updateDiagnostics()` reads `expo-updates` at call time, so on a
 * simulator it answers the simulator's truth and no frame could be compared to
 * another. The values below are the artifact's own, and `diagnosticsSummary`
 * — the part that could actually be wrong — still runs for real.
 */

export const DEV_DIAGNOSTICS: readonly UpdateDiagnostic[] = [
  { label: 'Build', value: '412' },
  { label: 'Update channel', value: 'production' },
  { label: 'Runtime', value: '1.8.0' },
  { label: 'Running update', value: '4c1f2ab' },
  { label: 'Updates', value: 'Enabled' },
];

/** A confirmed Standard member, read cleanly. The page's ordinary day. */
export const PAID_STANDARD: MembershipRowInput = {
  plan: 'standard',
  trialing: false,
  trialEndsAt: null,
  currentPeriodEnd: new Date('2026-09-14T12:00:00Z'),
  loading: false,
  unconfirmed: false,
};

// Pro has no frame of its own, and that is not an omission: it differs from
// Standard by the tier name and the ceiling, both of which come from `PLANS`
// through `membershipRowFor`. A second frame would photograph the same layout
// with two words changed and imply there was a layout question in it.

export const TRIALING: MembershipRowInput = {
  ...PAID_STANDARD,
  trialing: true,
  trialEndsAt: new Date('2026-09-01T12:00:00Z'),
  currentPeriodEnd: null,
};

export const READING: MembershipRowInput = { ...PAID_STANDARD, loading: true };

export const UNCONFIRMED: MembershipRowInput = {
  ...PAID_STANDARD,
  plan: 'free',
  currentPeriodEnd: null,
  unconfirmed: true,
};

export const CONFIRMED_FREE: MembershipRowInput = {
  ...PAID_STANDARD,
  plan: 'free',
  currentPeriodEnd: null,
};

/**
 * Everything a frame does not care about, at the value the ordinary page has.
 *
 * Handlers are inert rather than absent: a fixture that navigated would leave
 * the frame the moment somebody tried a control, and the point of posing a
 * state is to sit in it.
 */
export type SeOverrides = Partial<Omit<SettingsBodyProps, 'membership'>> & {
  membership?: MembershipRowInput;
};

export function SeFrame(overrides: SeOverrides = {}) {
  const router = useRouter();
  const { membership = PAID_STANDARD, ...rest } = overrides;

  // Live, so the diagnostics disclosure and the toggle can actually be operated
  // in the frame — the two behaviours on this page that are motion rather than
  // layout, and the two a still PNG cannot show.
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [whereToBuy, setWhereToBuy] = useState(true);

  const noop = () => {};

  return (
    <SettingsBody
      onBack={() => router.back()}
      membership={membershipRowFor(membership)}
      onMembership={noop}
      onMembershipRetry={noop}
      whereToBuy={whereToBuy}
      whereToBuyWriting={false}
      whereToBuyFailed={false}
      onWhereToBuy={setWhereToBuy}
      onWhereToBuyRetry={noop}
      onPrivacy={noop}
      inviteLink="cinchstyle.com/i/@priyar"
      onInvite={noop}
      onFriends={noop}
      borrowWaiting={2}
      onBorrow={noop}
      blockedCount={1}
      onBlocked={noop}
      notificationsAvailable
      onNotifications={noop}
      restoreAvailable
      restoring={false}
      onRestore={noop}
      restoreNotice={null}
      restoredToast={false}
      onDismissToast={noop}
      onHelp={noop}
      onPolicy={noop}
      onSignOut={noop}
      signOutAsking={false}
      signingOut={false}
      onSignOutKeep={noop}
      onSignOutConfirm={noop}
      onDelete={noop}
      deletePending={false}
      deleteOpen={false}
      deletePieceCount={84}
      deletePaidPlan
      deleteError={null}
      onDeleteConfirm={noop}
      onDeleteClose={noop}
      diagnostics={DEV_DIAGNOSTICS}
      diagnosticsOpen={diagnosticsOpen}
      onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
      version="1.8.0"
      build="412"
      {...rest}
    />
  );
}

/** The two recoverable restore endings, by name, so a frame cannot mistype one. */
export const RESTORE_NOTICES = {
  none: RESTORE_OUTCOMES.none,
  failed: RESTORE_OUTCOMES.failed,
} as const;
