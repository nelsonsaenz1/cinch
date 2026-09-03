import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { SettingsBody } from '@/components/settings';
import { signOut } from '@/features/auth/actions';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { membershipRowFor } from '@/features/billing/membership-row';
import { usePlan } from '@/features/billing/use-plan';
import { useCloset } from '@/features/closet/queries';
import { useSetShowWhereToBuy } from '@/features/commerce/mutations';
import { useShowWhereToBuy } from '@/features/commerce/queries';
import { inviteUrlForDisplay } from '@/features/invite/link';
import { useMyProfile } from '@/features/profile/queries';
import { RESTORE_OUTCOMES, type RestoreOutcome } from '@/features/profile/settings-copy';
import { useRestorePurchases } from '@/features/profile/use-restore-purchases';
import { NOTIFICATION_SETTINGS_AVAILABLE } from '@/features/push';
import { useBlockedUsers, useBorrowRequests } from '@/features/social-graph/queries';
import { updateDiagnostics } from '@/features/updates/diagnostics';

// Live on Vercel, now behind the real domain — the project's generated
// preview URL served these for months and still does, but the branded host is
// what belongs in front of a reviewer. This exact URL also goes into App Store
// Connect, and Apple's reviewers must be able to open it without signing in;
// Vercel's deployment protection was on by default and had to be turned off
// for that reason.
const PRIVACY_URL = 'https://cinchstyle.com/privacy';

// SUPPORT_URL is deliberately gone. Atlas 40's first rule: "nothing leaves the
// app — no web view, no external help centre, and the old link is removed in
// the same release this ships." Help is now a native page at /help with the
// eight articles and a composer that writes to hello@mail.cinchstyle.com.

// The manage-subscriptions URL is not here either. Cancellation is not a
// settings row: MB-08 (`/membership`) is the page that owns it, says what
// cancelling costs before you tap, and links to Apple's own subscription list —
// which is where a store subscription genuinely lives.

/** How long the restore toast stays up before it takes itself away. */
const TOAST_MS = 4000;

/**
 * UX-05 / redesign 29 — Settings, pushed from the Profile sheet's overflow.
 *
 * Profile was one screen doing two jobs. The top of it answered "who am I here
 * and what is in my closet"; the bottom answered "how do I administer this
 * account" — membership, preferences, people controls, notifications, help,
 * diagnostics, sign out, deletion. Those are different errands, arrived at from
 * different intentions, and stacking them meant the identity a user came to
 * check sat above eleven cards they did not.
 *
 * A pushed route, deliberately, and not a fifth tab or a route group: settings
 * are a place you go once and leave. It registers in `app/_layout.tsx` with
 * Profile's own `formSheet` options for the same reason `privacy`, `help`,
 * `notifications` and `diary` do — it is reached from inside a sheet, and a
 * plain push would stack a card on top of one.
 *
 * ── WHAT THIS FILE IS NOW ─────────────────────────────────────────────────
 *
 * The reads, the writes and the router. Every line of drawing lives in
 * `components/settings/settings-body.tsx`, so the eight `dev-se-*` fixtures
 * pose the components the app actually mounts rather than a second drawing of
 * them — including the three sheets, which nothing could photograph before.
 * Redesign 28 split `app/activity.tsx` the same way for the same reason.
 *
 * Nothing on the page moved surfaces. `features/profile/settings-copy.ts` holds
 * the Profile/Settings reconciliation and `tests/profile-settings-split.test.ts`
 * enforces it in both directions; `tests/settings-layout.test.ts` holds this
 * page's own inventory.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const plan = usePlan();
  const closet = useCloset();
  const deleteAccount = useDeleteAccount();

  // Only for the invite row — the claimed handle IS the invite link, and an
  // account that has not claimed one yet has nothing to share. Printed the way
  // IV-01 prints it: no scheme, so it reads as an address a person owns.
  const username = useMyProfile().data?.username ?? '';
  const inviteLink = username.length > 0 ? inviteUrlForDisplay(username) : null;

  // The restore ending, held on the page rather than thrown over it. `null` is
  // "nothing has happened yet", which is also what pressing the row again
  // resets it to: a stale failure sitting under a fresh attempt is the notice
  // band's one failure mode.
  const [restoreOutcome, setRestoreOutcome] = useState<RestoreOutcome | null>(null);
  const restore = useRestorePurchases({ onOutcome: setRestoreOutcome });

  // The toast does not time itself out (see toast.tsx — the timer belongs with
  // the thing being timed). Nothing is pending behind this one, so the timer is
  // simply the display, and it lives here.
  useEffect(() => {
    if (restoreOutcome !== 'restored') return;
    const timer = setTimeout(() => setRestoreOutcome(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [restoreOutcome]);

  const tryRestore = () => {
    setRestoreOutcome(null);
    restore.restore();
  };

  // Only for the "waiting" count on the Borrow requests row — the row itself is
  // the screen for everything else. `null` while the read is in flight or has
  // failed: an unknown count is omitted, never printed, and never guessed.
  const borrow = useBorrowRequests();
  const pendingAsks = borrow.data
    ? borrow.data.filter((t) => t.direction === 'incoming' && t.request.status === 'pending').length
    : null;

  // The same rule for "Blocked people 3". A "0" standing in for a pending or
  // failed read would tell somebody their blocks are gone, which is the one
  // thing this row must never say by accident.
  const blockedUsers = useBlockedUsers();
  const blockedCount = blockedUsers.data?.length ?? null;

  // C-03 — "Show where to buy". Default true, per the column's own default. The
  // switch LOCKS while the write is in flight (redesign 29's frames; the row
  // says "Saving…" so the lock reads as a wait rather than a refusal), and a
  // failed write leaves the switch exactly where it was with a notice under it
  // saying so.
  const showWhereToBuy = useShowWhereToBuy();
  const setShowWhereToBuy = useSetShowWhereToBuy();
  const shopPreferenceOn = showWhereToBuy.data ?? true;
  const writeWhereToBuy = (value: boolean) => setShowWhereToBuy.mutate(value);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Only used for the exact count named in the delete-account card. Null when
  // the closet has not loaded (or failed to): the card then names "every piece"
  // rather than claiming "your 0 pieces" to someone whose closet simply could
  // not be read.
  const pieceCount = closet.data?.length ?? null;

  /**
   * Never promise a rollback. Deleting an account spans Storage and Auth,
   * which cannot share a transaction, so a failure part-way through means
   * photographs really are gone while the account really does remain. The
   * server reports exactly how far it got; saying "nothing has been deleted"
   * here would be a comforting lie about irreversible data loss. Pressing
   * Delete everything again resumes — the copy says so, inside the card,
   * where the button that resumes it lives.
   */
  const deleteError = deleteAccount.error
    ? deleteAccount.error instanceof Error
      ? `${deleteAccount.error.message}\n\nAnything already removed is permanently gone. Tap Delete everything again to finish the job.`
      : 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete everything again to finish the job.'
    : null;

  // PR-02 — one row shape, five reads, in `membership-row.ts`. That helper owns
  // the reading and unconfirmed states, which is why a member on a slow network
  // does not briefly read as "not a member", and why no price appears on this
  // row in any of them (a settings row is a layout). Untouched by redesign 29,
  // which changes the plate the row is drawn on and nothing about the reading.
  const membership = membershipRowFor({
    plan: plan.plan,
    trialing: plan.trialing,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEnd: plan.currentPeriodEnd,
    loading: plan.loading,
    unconfirmed: plan.unconfirmed,
  });
  // `usePlan().paid` and not a fourth re-derivation of it. The delete card's
  // subscription clause is about a STORE SUBSCRIPTION that keeps billing, and
  // `!trialing && plan !== 'free'` answered a different question: it dropped
  // the clause for a paying member whose row still carried an old
  // `trial_ends_at`, which is the one account that most needs to read it.
  const paidPlan = plan.paid;

  // "Cinch 1.0.0 (218)" — expo-constants carries the config version in every
  // build. The iOS build number only exists once EAS stamps one in; until then
  // the parenthesis is dropped rather than printing "(undefined)".
  const version = Constants.expoConfig?.version ?? null;
  const build = Constants.expoConfig?.ios?.buildNumber ?? null;
  const updateFacts = updateDiagnostics();

  const restoreNotice =
    restoreOutcome === 'none'
      ? RESTORE_OUTCOMES.none
      : restoreOutcome === 'failed'
        ? RESTORE_OUTCOMES.failed
        : null;

  return (
    <SettingsBody
      onBack={() => router.back()}
      membership={membership}
      // `as Href`: expo-router generates its typed-route union into
      // `.expo/types` from a RUNNING dev server, so it does not know about a
      // route added in a packet that never starts Metro. The cast is not a hole
      // — `/membership` is `src/app/membership.tsx`, and
      // `tests/dev-route-index.test.ts` checks every route path in the app
      // against the filesystem in both directions.
      onMembership={() => router.push('/membership' as Href)}
      onMembershipRetry={() => void plan.refetch()}
      whereToBuy={shopPreferenceOn}
      whereToBuyWriting={setShowWhereToBuy.isPending}
      whereToBuyFailed={setShowWhereToBuy.isError}
      onWhereToBuy={writeWhereToBuy}
      onWhereToBuyRetry={() => writeWhereToBuy(!shopPreferenceOn)}
      onPrivacy={() => router.push('/privacy')}
      onStyleProfile={() => router.push('/style-profile')}
      inviteLink={inviteLink}
      onInvite={() => router.push('/invite')}
      onFriends={() => router.push('/friends')}
      borrowWaiting={pendingAsks}
      onBorrow={() => router.push('/borrow')}
      blockedCount={blockedCount}
      onBlocked={() => router.push('/friends/blocked')}
      notificationsAvailable={NOTIFICATION_SETTINGS_AVAILABLE}
      onNotifications={() => router.push('/notifications')}
      restoreAvailable={restore.available}
      restoring={restore.restoring}
      onRestore={tryRestore}
      restoreNotice={restoreNotice}
      restoredToast={restoreOutcome === 'restored'}
      onDismissToast={() => setRestoreOutcome(null)}
      onHelp={() => router.push('/help')}
      onPolicy={() => void Linking.openURL(PRIVACY_URL)}
      onSignOut={() => setSigningOut(true)}
      signOutAsking={signingOut}
      signingOut={signOutPending}
      onSignOutKeep={() => setSigningOut(false)}
      onSignOutConfirm={() => {
        setSignOutPending(true);
        void signOut();
      }}
      onDelete={() => {
        // A fresh opening should not lead with last time's failure.
        deleteAccount.reset();
        setDeleting(true);
      }}
      deletePending={deleteAccount.isPending}
      deleteOpen={deleting}
      deletePieceCount={pieceCount}
      deletePaidPlan={paidPlan}
      deleteError={deleteError}
      onDeleteConfirm={() => deleteAccount.mutate()}
      onDeleteClose={() => setDeleting(false)}
      diagnostics={updateFacts}
      diagnosticsOpen={diagnosticsOpen}
      onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
      version={version}
      build={build}
    />
  );
}
