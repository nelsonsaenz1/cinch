import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { Card } from '@/components/ui/card';
import { NoticeBand } from '@/components/ui/notice-band';
import { Rule } from '@/components/ui/rule';
import { BackButton } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ToggleRow, ValueRow } from '@/components/ui/settled-row';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/toast';
import { signOut } from '@/features/auth/actions';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { membershipRowFor } from '@/features/billing/membership-row';
import { usePlan } from '@/features/billing/use-plan';
import { useCloset } from '@/features/closet/queries';
import { SHOW_WHERE_TO_BUY_DETAIL, SHOW_WHERE_TO_BUY_LABEL } from '@/features/commerce/copy';
import { useSetShowWhereToBuy } from '@/features/commerce/mutations';
import { useShowWhereToBuy } from '@/features/commerce/queries';
import { DeleteAccountCard } from '@/features/profile/delete-account-card';
import {
  DAILY_STYLING_FACT,
  DAILY_STYLING_LABEL,
  RESTORE_OUTCOMES,
  SETTINGS_TITLE,
  SIGN_OUT_CONFIRM,
  type RestoreOutcome,
} from '@/features/profile/settings-copy';
import { useRestorePurchases } from '@/features/profile/use-restore-purchases';
import { NOTIFICATION_SETTINGS_AVAILABLE } from '@/features/push';
import { useBlockedUsers, useBorrowRequests } from '@/features/social-graph/queries';
import { updateDiagnostics } from '@/features/updates/diagnostics';
import { MIN_TAP_TARGET } from '@/theme/tokens';

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
 * UX-05 — Settings, pushed from the Profile sheet's gear.
 *
 * Profile was one screen doing two jobs. The top of it answered "who am I here
 * and what is in my closet"; the bottom answered "how do I administer this
 * account" — membership, preferences, people controls, notifications, help,
 * diagnostics, sign out, deletion. Those are different errands, arrived at from
 * different intentions, and stacking them meant the identity a user came to
 * check sat above eleven cards they did not.
 *
 * A pushed route, deliberately, and not a fifth tab or a route group: settings
 * are a place you go once and leave, and the accepted plan says so in as many
 * words. It registers in `app/_layout.tsx` with Profile's own `formSheet`
 * options for the same reason `privacy`, `help`, `notifications` and `diary`
 * do — it is reached from inside a sheet, and a plain push would stack a card
 * on top of one.
 *
 * ── What changed on the way across ─────────────────────────────────────────
 *
 * One row lost a control. "Daily outfit styling" carried a `<Switch>` that was
 * `disabled` and hard-wired to `value` — it could not be operated and never
 * could have been, because the beam search it named has no off switch. It is
 * now the fact it was always standing in for, written out. See
 * `settings-copy.ts`.
 *
 * Two endings changed container. Sign out asks in a `ConfirmSheet` rather than
 * an `Alert` (UX-08: blocking is for the irreversible, and this is the one
 * thing on the page that undoes itself), and Restore purchases reports into the
 * shared toast or an inline notice band rather than three alerts. Delete
 * account is untouched: it is genuinely irreversible, and its typed-DELETE card
 * is already the strongest confirmation in the app.
 *
 * Nothing else moved but its coordinates. `features/profile/settings-copy.ts`
 * holds the reconciliation and `tests/profile-settings-split.test.ts` enforces
 * it in both directions.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const plan = usePlan();
  const closet = useCloset();
  const deleteAccount = useDeleteAccount();

  // UX-08 — the restore ending, held on the page rather than thrown over it.
  // `null` is "nothing has happened yet", which is also what pressing the row
  // again resets it to: a stale failure sitting under a fresh attempt is the
  // notice band's one failure mode.
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

  // Only for the "waiting" count on the Borrow requests row — the row itself
  // is the screen for everything else. No tab badges anywhere.
  const borrow = useBorrowRequests();
  const pendingAsks = (borrow.data ?? []).filter(
    (t) => t.direction === 'incoming' && t.request.status === 'pending',
  ).length;

  // PR-01's "Blocked people 3". `null` until the list has genuinely been read
  // — a "0" standing in for a pending or failed read would tell somebody their
  // blocks are gone, which is the one thing this row must never say by accident.
  const blockedUsers = useBlockedUsers();
  const blockedCount = blockedUsers.data?.length ?? null;

  // C-03 — "Show where to buy". Default true, per the column's own default;
  // the switch stays enabled while the write is in flight rather than
  // disabling itself, because a toggle that locks the instant you touch it
  // reads as broken on the exact gesture it exists to make feel immediate.
  const showWhereToBuy = useShowWhereToBuy();
  const setShowWhereToBuy = useSetShowWhereToBuy();
  const shopPreferenceOn = showWhereToBuy.data ?? true;

  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // PR-02 — one row shape, four reads, in `membership-row.ts`. That helper owns
  // the reading and unconfirmed states, which is why a member on a slow network
  // does not briefly read as "not a member", and why no price appears on this
  // row in any of them (correction 31: a settings row is a layout).
  const membership = membershipRowFor({
    plan: plan.plan,
    trialing: plan.trialing,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEnd: plan.currentPeriodEnd,
    loading: plan.loading,
    unconfirmed: plan.unconfirmed,
  });
  const paidPlan = !plan.trialing && plan.plan !== 'free';

  // "Cinch 1.0.0 (218)" — expo-constants carries the config version in every
  // build. The iOS build number only exists once EAS stamps one in; until
  // then the parenthesis is dropped rather than printing "(undefined)".
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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* `pt-5` clears the sheet grabber, the clearance profile.tsx, privacy.tsx
          and help.tsx all use. The chevron returns to Profile, which stays
          mounted underneath — this is a push inside the sheet, not a second
          sheet over it. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => router.back()} label="Back to Profile" />
      </View>

      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter">
          {/* The serif title below the chevron rather than beside it — help.tsx's
              arrangement, and for its reason: printing the word twice in two
              sizes is how a header stops meaning anything. */}
          <Text variant="title" trim accessibilityRole="header" className="pt-4">
            {SETTINGS_TITLE}
          </Text>

          {/* PR-02 — one row, four reads. A confirmed member gets a chevron into
              MB-08 (`/membership`), with no upsell in the row even on Standard.
              A failed read gets a Retry and nothing else. A free account gets no
              row at all — the frozen contract describes no Free membership
              object for one to be about. */}
          {!membership.visible ? null : (
            <>
              <SectionHeader title="Membership" className="mb-2.5 mt-6" />
              <Card padding="none">
                {membership.chevron ? (
                  <SettingsRow
                    label={membership.label}
                    sublabel={membership.value || undefined}
                    // `as Href`: expo-router generates its typed-route union
                    // into `.expo/types` from a RUNNING dev server, so it does
                    // not know about a route added in a packet that never
                    // starts Metro. The cast is not a hole — `/membership` is
                    // `src/app/membership.tsx`, and `tests/dev-route-index.
                    // test.ts` already checks every route path in the app
                    // against the filesystem in both directions.
                    onPress={() => router.push('/membership' as Href)}
                  />
                ) : (
                  <View
                    className="flex-row items-center justify-between gap-3 px-4 py-3.5"
                    style={{ minHeight: MIN_TAP_TARGET }}>
                    <View className="flex-1">
                      <Text variant="body">{membership.label}</Text>
                      {membership.value ? (
                        <Text variant="note" className="mt-1">
                          {membership.value}
                        </Text>
                      ) : null}
                    </View>
                    {membership.retry ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry reading your membership"
                        onPress={() => void plan.refetch()}
                        hitSlop={8}
                        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                        className="flex-none active:opacity-60">
                        <Text variant="label" className="text-ink">
                          Retry
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </Card>
            </>
          )}

          <SectionHeader title="Styling" className="mb-2.5 mt-6" />
          <Card padding="none">
            {/* The row that used to hold a switch nobody could move. It is a
                statement now, and `accessibilityRole="text"` is the whole
                difference: VoiceOver used to announce a switch, which invited
                a double-tap that could never do anything. See settings-copy.ts.

                Not `ValueRow` — its value shares the label's line, and this one
                is a sentence. The settled row's own rule sends a value that
                cannot share the line underneath, which is what this is. */}
            <View
              accessibilityRole="text"
              accessibilityLabel={`${DAILY_STYLING_LABEL}. ${DAILY_STYLING_FACT}`}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="px-4 py-3">
              <Text variant="body">{DAILY_STYLING_LABEL}</Text>
              <Text variant="note" className="mt-1">
                {DAILY_STYLING_FACT}
              </Text>
            </View>
            <Rule tone="hairline" />
            {/* C-03 — the one switch that turns every merchant row and product
                sheet off app-wide (commerce-directive.md §6 refusal 6). It
                writes `profiles.show_where_to_buy` and the Gap Feed /
                friend-piece "Find it" row both read it, client- and
                server-side (gap-shop-match checks it again).

                PR-01 prints the state as a WORD, not only as a track colour:
                "On — merchants under a gap". A preference carried by colour
                alone is one channel, and the wrong one. */}
            <ToggleRow
              label={SHOW_WHERE_TO_BUY_LABEL}
              state={`${shopPreferenceOn ? 'On' : 'Off'} — ${SHOW_WHERE_TO_BUY_DETAIL}`}
              value={shopPreferenceOn}
              onValueChange={(value) => setShowWhereToBuy.mutate(value)}
            />
            <Rule tone="hairline" />
            {/* The doorway to Privacy & data (atlas 38), which owns three things
                that used to be scattered: AI consent and its record, the data
                export, and the deletion explanation.

                No On/Off detail. "AI tagging — Off" was a true summary of a page
                about one switch; "Privacy & data — Off" would summarise nothing,
                and a detail slot that reports one of three subjects is a slot
                that misleads about the other two. The page itself states each. */}
            <SettingsRow label="Privacy & data" onPress={() => router.push('/privacy')} />
          </Card>

          {/* Still "People", not "People & notifications". The Notifications row
              below is real, but it is real only on a binary that has the push
              module — see the comment on it — and a section kicker that changes
              with the build is worse than one that simply says less. */}
          <SectionHeader title="People" className="mb-2.5 mt-6" />
          <Card>
            <SettingsRow label="Friends" onPress={() => router.push('/friends')} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Borrow requests"
              detail={pendingAsks > 0 ? `${pendingAsks} waiting` : undefined}
              onPress={() => router.push('/borrow')}
            />
            <Rule tone="hairline" />
            <SettingsRow
              label="Blocked people"
              detail={blockedCount === null ? undefined : String(blockedCount)}
              onPress={() => router.push('/friends/blocked')}
            />
            {/* Notifications, on the builds that can send them.
                `NOTIFICATION_SETTINGS_AVAILABLE` is a plain boolean resolved
                once at module scope — a binary either carries the push module
                or it does not, and that cannot change mid-session.

                This is the whole reason wave 5 could ship over the air onto a
                binary that has no push: on that binary the flag is false, this
                row is absent, no token is registered, and no permission is
                ever asked for. Nothing dead ships. The same bundle grows the
                row the moment it runs on a build that was cut with the module.
                See docs/design/diary-boards-activity-contract.md §6.2.

                Restore purchases, one card down, is the same pattern for the
                same reason — a row whose destination cannot work is a dead end
                wearing a chevron. */}
            {NOTIFICATION_SETTINGS_AVAILABLE ? (
              <>
                <Rule tone="hairline" />
                <SettingsRow label="Notifications" onPress={() => router.push('/notifications')} />
              </>
            ) : null}
          </Card>

          {/* The utility card — no kicker, per the atlas: these rows serve the
              app rather than any one topic. */}
          <Card className="mt-6">
            {restore.available ? (
              <>
                <SettingsRow
                  label="Restore purchases"
                  onPress={tryRestore}
                  loading={restore.restoring}
                />
                <Rule tone="hairline" />
              </>
            ) : null}
            {/* Help is native now and leads the pair, because it is the one
                people actually want. The policy stays below it and stays
                external: atlas 38 says every claim is written in the app's own
                words, and "the linked policy is the long form, never the only
                form" — so it is a second door to more detail, not the first
                door to any detail. */}
            <SettingsRow label="Help" onPress={() => router.push('/help')} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Privacy Policy"
              external
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            />
          </Card>

          {/* UX-08 — the two recoverable restore endings, inline and under the
              row that caused them, with the retry named rather than implied.
              The band announces itself politely (notice-band.tsx), so VoiceOver
              gets the ending the alert used to force on everybody. */}
          {restoreNotice ? (
            <NoticeBand
              className="mt-3"
              cause={restoreNotice.cause}
              title={restoreNotice.title}
              body={restoreNotice.body}
              actions={[
                { label: restoreNotice.action, onPress: tryRestore, loading: restore.restoring },
              ]}
            />
          ) : null}

          {/* The way out, in both weights. Delete account is the only
              critical-coloured thing in the app; its confirmation is the
              in-sheet card below, which enumerates exactly what disappears
              and takes a typed DELETE — see delete-account-card.tsx for why
              that replaced the two-Alert chain. Sign out's question is a sheet
              for the opposite reason: it is the one thing here that undoes
              itself. */}
          <Card className="mt-6">
            <SettingsRow label="Sign out" onPress={() => setSigningOut(true)} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Delete account"
              tone="accent"
              onPress={() => {
                // A fresh opening should not lead with last time's failure.
                deleteAccount.reset();
                setDeleting(true);
              }}
              loading={deleteAccount.isPending}
            />
          </Card>

          <SectionHeader title="Update diagnostics" className="mb-2.5 mt-6" />
          <Card padding="none">
            {updateFacts.map((fact, index) => (
              <View key={fact.label}>
                {index > 0 ? <Rule tone="hairline" /> : null}
                <ValueRow label={fact.label} value={fact.value} />
              </View>
            ))}
          </Card>

          {/* Centred, unlike every other line on the page — deliberately. The
              Plate grammar has no centred body copy, but this is not body
              copy: it is the edition mark on the last page of the lookbook,
              set in the attribution voice. */}
          {version ? (
            <Text variant="caption" className="mt-4 text-center text-byline">
              {`Cinch ${version}${build ? ` (${build})` : ''}`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* UX-08 — the success ending. Bottom-anchored over the page, no verb:
          there is nothing to undo about a restore, and a filler "Done" would be
          a control that looks like a choice and isn't (toast.tsx). */}
      <Toast
        visible={restoreOutcome === 'restored'}
        message={RESTORE_OUTCOMES.restored.message}
        onDismiss={() => setRestoreOutcome(null)}
      />

      {/* UX-08 — the question, in the shape the app already asks questions in.
          The keep-option is named for what is kept; "Cancel" inside a sign-out
          prompt is a coin flip. The session ending unwinds the whole stack from
          `AuthGate`, so there is nothing to close afterwards. */}
      <ConfirmSheet
        visible={signingOut}
        title={SIGN_OUT_CONFIRM.title}
        body={SIGN_OUT_CONFIRM.body}
        keepLabel={SIGN_OUT_CONFIRM.keepLabel}
        destructiveLabel={SIGN_OUT_CONFIRM.destructiveLabel}
        onKeep={() => setSigningOut(false)}
        onConfirm={() => {
          setSigningOut(false);
          void signOut();
        }}
      />

      {/* Mounted only while open, so the typed confirmation starts empty on
          every fresh opening. Stays up through a failure — the error and the
          button that resumes the deletion belong on the same surface. */}
      {deleting ? (
        <DeleteAccountCard
          pieceCount={pieceCount}
          paidPlan={paidPlan}
          pending={deleteAccount.isPending}
          errorText={deleteError}
          onDelete={() => deleteAccount.mutate()}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
