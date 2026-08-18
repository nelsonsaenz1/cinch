import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { NoticeBand } from '@/components/ui/notice-band';
import { Rule } from '@/components/ui/rule';
import { BackButton } from '@/components/ui/screen-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/toast';
import type { MembershipRow } from '@/features/billing/membership-row';
import { SHOW_WHERE_TO_BUY_DETAIL, SHOW_WHERE_TO_BUY_LABEL } from '@/features/commerce/copy';
import { DeleteAccountCard } from '@/features/profile/delete-account-card';
import {
  DAILY_STYLING_DISCLOSURE,
  DAILY_STYLING_FACT,
  DAILY_STYLING_LABEL,
  RESTORE_OUTCOMES,
  SETTINGS_TITLE,
  SIGN_OUT_CONFIRM,
} from '@/features/profile/settings-copy';
import {
  diagnosticsSummary,
  PRIVACY_POLICY_DETAIL,
  restoreRowDetail,
  SETTINGS_KICKERS,
  versionMark,
  WHERE_TO_BUY_FAILED,
  whereToBuyDetail,
  whereToBuyHint,
} from '@/features/settings/settings-spec';
import type { UpdateDiagnostic } from '@/features/updates/diagnostics';

import {
  DiagnosticsRow,
  InviteRow,
  MembershipPlate,
  PreferenceRow,
  SettingsKicker,
  SettingsPlate,
  StatementRow,
} from './settings-parts';

/**
 * Redesign 29's Settings page, as one pure component.
 *
 * Every read, mutation and router call stays in `app/settings.tsx`; this is the
 * drawing, so the `dev-se-*` fixtures can pose all of it — including the three
 * sheets, which is the half of this page that was previously unphotographable.
 * Same split as `ActivityBody` / `app/activity.tsx` in redesign 28.
 *
 * ── THE ORDER, AND WHY IT IS THE ORDER ────────────────────────────────────
 *
 * Membership · Styling · People · Utility · Account · Diagnostics · the edition
 * mark. It is the frames' order and it is also the shipped order with two
 * additions: the utility group and the account group had no heads (the atlas's
 * "these rows serve the app rather than any one topic"), and the frames give
 * them UTILITY and ACCOUNT. A head over Sign out and Delete account is worth
 * more than the restraint it costs — those two rows are the reason somebody
 * scrolls to the bottom of this page, and an unlabelled plate is the one thing
 * on the page a reader has to identify by its contents.
 *
 * ── NOTHING ON THIS PAGE IS A BADGE ───────────────────────────────────────
 *
 * "2 waiting" and a blocked count are facts in the trailing column. A count
 * that has not been READ is omitted rather than printed as 0 — `null`, not a
 * fallback — because a 0 standing in for a pending or failed read tells
 * somebody their blocks are gone, which is the one thing that row must never
 * say by accident.
 */
export type SettingsBodyProps = {
  onBack: () => void;

  // ── Membership ──────────────────────────────────────────────────────────
  membership: MembershipRow;
  onMembership: () => void;
  onMembershipRetry: () => void;

  // ── Styling ─────────────────────────────────────────────────────────────
  whereToBuy: boolean;
  whereToBuyWriting: boolean;
  whereToBuyFailed: boolean;
  onWhereToBuy: (next: boolean) => void;
  onWhereToBuyRetry: () => void;
  onPrivacy: () => void;

  // ── People ──────────────────────────────────────────────────────────────
  /** `cinchstyle.com/i/@handle`, or null while the profile read is in flight. */
  inviteLink: string | null;
  onInvite: () => void;
  onFriends: () => void;
  /** Null until the borrow list has genuinely answered. */
  borrowWaiting: number | null;
  onBorrow: () => void;
  /** Null until the block list has genuinely answered. */
  blockedCount: number | null;
  onBlocked: () => void;
  notificationsAvailable: boolean;
  onNotifications: () => void;

  // ── Utility ─────────────────────────────────────────────────────────────
  restoreAvailable: boolean;
  restoring: boolean;
  onRestore: () => void;
  restoreNotice: { cause: string; title: string; body: string; action: string } | null;
  restoredToast: boolean;
  onDismissToast: () => void;
  onHelp: () => void;
  onPolicy: () => void;

  // ── Account ─────────────────────────────────────────────────────────────
  onSignOut: () => void;
  signOutAsking: boolean;
  signingOut: boolean;
  onSignOutKeep: () => void;
  onSignOutConfirm: () => void;
  onDelete: () => void;
  deletePending: boolean;
  deleteOpen: boolean;
  deletePieceCount: number | null;
  deletePaidPlan: boolean;
  deleteError: string | null;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;

  // ── Diagnostics ─────────────────────────────────────────────────────────
  diagnostics: readonly UpdateDiagnostic[];
  diagnosticsOpen: boolean;
  onToggleDiagnostics: () => void;
  version: string | null;
  build: string | null;
};

export function SettingsBody(props: SettingsBodyProps) {
  const mark = versionMark(props.version, props.build);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* `pt-5` clears the sheet grabber, the clearance profile.tsx, privacy.tsx
          and help.tsx all use. The chevron returns to Profile, which stays
          mounted underneath — this is a push inside the sheet, not a second
          sheet over it. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={props.onBack} label="Back to Profile" />
      </View>

      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter">
          <Text variant="title" trim accessibilityRole="header" className="pb-4 pt-4">
            {SETTINGS_TITLE}
          </Text>

          {/* One row, five reads, and none of them a price. A confirmed member
              gets the chevron into `/membership`; a failed read gets Retry and
              nothing else; a confirmed FREE account gets no plate at all,
              because the frozen contract describes no Free membership object
              for one to be about. `membershipRowFor` decides all of it. */}
          {props.membership.visible ? (
            <MembershipPlate
              row={props.membership}
              onOpen={props.onMembership}
              onRetry={props.onMembershipRetry}
            />
          ) : null}

          <SettingsKicker title={SETTINGS_KICKERS.styling} className="mb-2.5 mt-6" />
          <SettingsPlate>
            <StatementRow
              label={DAILY_STYLING_LABEL}
              fact={DAILY_STYLING_FACT}
              hidden={DAILY_STYLING_DISCLOSURE}
            />
            <Rule tone="hairline" />
            {/* C-03 — the one switch that turns every merchant row and product
                sheet off app-wide (commerce-directive.md §6 refusal 6). It
                writes `profiles.show_where_to_buy`, and the Gap Feed and the
                friend-piece "Find it" row both read it, client- and
                server-side. The governed disclosure goes to VoiceOver in full;
                the visible line is the frame's. */}
            <PreferenceRow
              label={SHOW_WHERE_TO_BUY_LABEL}
              detail={whereToBuyDetail({
                on: props.whereToBuy,
                writing: props.whereToBuyWriting,
              })}
              hint={whereToBuyHint(SHOW_WHERE_TO_BUY_DETAIL)}
              value={props.whereToBuy}
              writing={props.whereToBuyWriting}
              onChange={props.onWhereToBuy}
            />
            <Rule tone="hairline" />
            {/* The doorway to Privacy & data, which owns three things that used
                to be scattered: AI consent and its record, the data export, and
                the deletion explanation. No On/Off detail — a slot that reports
                one of three subjects misleads about the other two. */}
            <SettingsRow label="Privacy & data" onPress={props.onPrivacy} />
          </SettingsPlate>

          {/* The failed write, under the control that caused it, with the
              switch already back where it was. */}
          {props.whereToBuyFailed ? (
            <NoticeBand
              className="mt-3"
              cause={WHERE_TO_BUY_FAILED.cause}
              title={WHERE_TO_BUY_FAILED.title}
              body={WHERE_TO_BUY_FAILED.body}
              actions={[{ label: WHERE_TO_BUY_FAILED.action, onPress: props.onWhereToBuyRetry }]}
            />
          ) : null}

          {/* Still "People", not "People & notifications": the Notifications
              row below is real only on a binary that carries the push module,
              and a head that changes with the build is worse than one that
              says less. */}
          <SettingsKicker title={SETTINGS_KICKERS.people} className="mb-2.5 mt-6" />
          <SettingsPlate>
            {props.inviteLink ? (
              <>
                <InviteRow linkDisplay={props.inviteLink} onPress={props.onInvite} />
                <Rule tone="hairline" />
              </>
            ) : null}
            <SettingsRow label="Friends" onPress={props.onFriends} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Borrow requests"
              detail={props.borrowWaiting ? `${props.borrowWaiting} waiting` : undefined}
              onPress={props.onBorrow}
            />
            <Rule tone="hairline" />
            <SettingsRow
              label="Blocked people"
              detail={props.blockedCount === null ? undefined : String(props.blockedCount)}
              onPress={props.onBlocked}
            />
            {/* Notifications, on the builds that can send them. On a binary with
                no push module the row is ABSENT — no token is registered and no
                permission is ever asked for. A row whose destination cannot
                work is a dead end wearing a chevron. Restore purchases, one
                plate down, is the same pattern for the same reason. */}
            {props.notificationsAvailable ? (
              <>
                <Rule tone="hairline" />
                <SettingsRow label="Notifications" onPress={props.onNotifications} />
              </>
            ) : null}
          </SettingsPlate>

          <SettingsKicker title={SETTINGS_KICKERS.utility} className="mb-2.5 mt-6" />
          <SettingsPlate>
            {props.restoreAvailable ? (
              <>
                {/* No chevron: it acts here and reports here. See
                    `settings-row-spec.ts` on the third promise. */}
                <SettingsRow
                  label="Restore purchases"
                  sublabel={restoreRowDetail(props.restoring)}
                  affordance="none"
                  onPress={props.onRestore}
                  loading={props.restoring}
                />
                <Rule tone="hairline" />
              </>
            ) : null}
            {/* Help is native and leads the pair, because it is the one people
                actually want. The policy stays below it and stays external: it
                is a second door to more detail, not the first door to any. */}
            <SettingsRow label="Help" onPress={props.onHelp} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Privacy Policy"
              detail={PRIVACY_POLICY_DETAIL}
              external
              onPress={props.onPolicy}
            />
          </SettingsPlate>

          {/* The two recoverable restore endings, inline and under the row that
              caused them, with the retry named rather than implied. The band
              announces itself politely, so VoiceOver gets the ending the alert
              used to force on everybody. */}
          {props.restoreNotice ? (
            <NoticeBand
              className="mt-3"
              cause={props.restoreNotice.cause}
              title={props.restoreNotice.title}
              body={props.restoreNotice.body}
              actions={[
                {
                  label: props.restoreNotice.action,
                  onPress: props.onRestore,
                  loading: props.restoring,
                },
              ]}
            />
          ) : null}

          {/* The way out, in both weights. Delete account is the only
              critical-coloured thing in the app, and Sign out sits directly
              above it in plain ink so the two can never be confused at a
              glance. Sign out's question is a sheet because it is the one thing
              here that undoes itself; deletion keeps its typed-DELETE card. */}
          <SettingsKicker title={SETTINGS_KICKERS.account} className="mb-2.5 mt-6" />
          <SettingsPlate>
            <SettingsRow label="Sign out" onPress={props.onSignOut} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Delete account"
              tone="accent"
              onPress={props.onDelete}
              loading={props.deletePending && !props.deleteOpen}
            />
          </SettingsPlate>

          <SettingsKicker title={SETTINGS_KICKERS.diagnostics} className="mb-2.5 mt-6" />
          <DiagnosticsRow
            summary={diagnosticsSummary(props.diagnostics)}
            facts={props.diagnostics}
            expanded={props.diagnosticsOpen}
            onToggle={props.onToggleDiagnostics}
          />

          {/* The edition mark, set in the attribution voice and aligned with
              the measure like every other line on the page — the shipped one
              was centred, and the frames set it left under the last plate. */}
          {mark ? (
            <Text variant="caption" className="mt-4 text-muted">
              {mark}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* The success ending. Bottom-anchored over the page, no verb: there is
          nothing to undo about a restore, and a filler "Done" would be a
          control that looks like a choice and isn't. */}
      <Toast
        visible={props.restoredToast}
        message={RESTORE_OUTCOMES.restored.message}
        onDismiss={props.onDismissToast}
      />

      {/* The question, in the shape the app already asks questions in. The
          keep-option is named for what is kept; "Cancel" inside a sign-out
          prompt is a coin flip. The session ending unwinds the whole stack from
          `AuthGate`, so there is nothing to close afterwards. */}
      <ConfirmSheet
        visible={props.signOutAsking}
        title={SIGN_OUT_CONFIRM.title}
        body={SIGN_OUT_CONFIRM.body}
        keepLabel={SIGN_OUT_CONFIRM.keepLabel}
        destructiveLabel={SIGN_OUT_CONFIRM.destructiveLabel}
        destructiveBusy={props.signingOut}
        onKeep={props.onSignOutKeep}
        onConfirm={props.onSignOutConfirm}
      />

      {/* Mounted only while open, so the typed confirmation starts empty on
          every fresh opening. Stays up through a failure — the error and the
          button that resumes the deletion belong on the same surface. */}
      {props.deleteOpen ? (
        <DeleteAccountCard
          pieceCount={props.deletePieceCount}
          paidPlan={props.deletePaidPlan}
          pending={props.deletePending}
          errorText={props.deleteError}
          onDelete={props.onDeleteConfirm}
          onClose={props.onDeleteClose}
        />
      ) : null}
    </SafeAreaView>
  );
}
