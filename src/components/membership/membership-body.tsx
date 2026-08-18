import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import {
  CANCEL_ROW_LABEL,
  cancellationConsequence,
  UPGRADE_ROW_LABEL,
} from '@/features/billing/manage-membership';
import type { Plan, PlanCopy } from '@/features/billing/plans';
import { canUpgrade } from '@/features/billing/upgrade-delta';
import {
  BACK_TO_SETTINGS,
  CANCEL_ROW_MARK,
  CANCEL_ROW_SUBLABEL,
  CAPACITY_KICKER,
  CHANGE_KICKER,
  capacityAdvice,
  capacityRows,
  endingNote,
  MASTHEAD_CHECKING,
  MASTHEAD_UNREAD,
  MEMBERSHIP_EYEBROW,
  mastheadTier,
  NO_MEMBERSHIP_LINE,
  PRO_IS_LARGEST,
  RESTORE_PENDING_NOTE,
  RESTORE_ROW_LABEL,
  RESTORE_ROW_PENDING,
  RESTORE_ROW_SUBLABEL,
  termMark,
  TRY_AGAIN,
  UNCONFIRMED_BODY,
  UNCONFIRMED_TITLE,
  UPGRADE_ROW_SUBLABEL,
  type RestoreEnding,
} from '@/features/membership/manage-membership-spec';

import {
  CapacityRowsSkeleton,
  CapacityRowView,
  Masthead,
  MembershipKicker,
  MembershipNotice,
  MembershipPlate,
  TintedAction,
} from './membership-parts';

/**
 * MB-08 / redesign 30 — managing what you already pay for, as one pure
 * component.
 *
 * Every read, mutation and router call stays in `app/membership.tsx`; this is
 * the drawing, so the `dev-mm-*` fixtures can pose all of it. Same split as
 * `SettingsBody` / `app/settings.tsx` in redesign 29.
 *
 * ── STILL A MANAGEMENT PAGE ───────────────────────────────────────────────
 *
 * The redesign gives it colour and it does not give it a sales voice. There is
 * no price, no term, no retention attempt, no "are you sure", and exactly ONE
 * upsell row — "Move to Pro", only for a member who has somewhere to move.
 * A Pro member's page has no upgrade row at all, and says so once rather than
 * drawing a control that can never act.
 *
 * ── WHAT IS DRAWN, AND FROM WHAT ──────────────────────────────────────────
 *
 * The masthead is the tier and the term, both from `usePlan()`. The capacity
 * plate is the only two entitlements `useCapacity()` can COUNT, against the
 * ceilings in `PLANS`. The near-limit advice and the free line both derive
 * from `PLANS`, whose two ceilings are what the database triggers enforce.
 * Nothing on this page is typed.
 *
 * `cancellationConsequence()` — the whole original paragraph, every clause
 * traced — is not set as body copy anywhere on the page any more. It rides on
 * the closing note as its `accessibilityLabel`, so a screen reader still hears
 * every clause the frames took out of the visible column. That is the AX rule
 * this program has held on nine pages: the prose a redesign removes becomes a
 * label, never nothing.
 */
export type MembershipBodyProps = {
  onBack: () => void;

  // ── The read ────────────────────────────────────────────────────────────
  loading: boolean;
  /** The row could not be READ. Never drawn as free. */
  unconfirmed: boolean;
  onRetry: () => void;
  plan: Plan;
  copy: PlanCopy;
  trialing: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;

  // ── The counts. `null` is in flight, never zero. ────────────────────────
  used: number | null;
  stored: number | null;

  // ── Changing it ─────────────────────────────────────────────────────────
  onUpgrade: () => void;
  onCancelBilling: () => void;
  /** False in a keyless build — the row is absent, not disabled. */
  restoreAvailable: boolean;
  restoring: boolean;
  onRestore: () => void;
  /** The ending of the last restore, drawn in place. Null before any attempt. */
  restoreEnding: RestoreEnding | null;

  /** The way back from the free refusal, which is a different act from `onBack`. */
  onBackToSettings: () => void;
};

export function MembershipBody(props: MembershipBodyProps) {
  const {
    loading,
    unconfirmed,
    plan,
    copy,
    trialing,
    trialEndsAt,
    currentPeriodEnd,
    used,
    stored,
    restoreAvailable,
    restoring,
    restoreEnding,
  } = props;

  const manageable = plan !== 'free';
  const rows = capacityRows({ copy, used, stored });
  const advice = capacityAdvice({ copy, used, stored });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        align="leading"
        title="Settings"
        onBack={props.onBack}
        backLabel={BACK_TO_SETTINGS}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-gutter pb-16 pt-6">
        {/* THE READ IN FLIGHT. The masthead keeps its shape and says
            "Checking…" in the plate position, so nothing jumps when the answer
            lands and no tier is guessed on the way. */}
        {loading ? (
          <>
            <Masthead eyebrow={MEMBERSHIP_EYEBROW} title={MASTHEAD_CHECKING} quiet />
            <MembershipPlate className="mt-6">
              <View className="px-4 py-4">
                <CapacityRowsSkeleton />
              </View>
            </MembershipPlate>
          </>
        ) : unconfirmed ? (
          // THE READ FAILED. Not "free" — telling a paying member they have no
          // membership is the worst available lie on this page. No alarm
          // colour either: the server checks entitlements independently, so
          // nothing has actually been taken away while this cannot read.
          <>
            <Masthead eyebrow={MEMBERSHIP_EYEBROW} title={MASTHEAD_UNREAD} />
            <MembershipNotice
              tone="blush"
              title={UNCONFIRMED_TITLE}
              body={UNCONFIRMED_BODY}
              action={TRY_AGAIN}
              onAction={props.onRetry}
              className="mt-6"
            />
          </>
        ) : !manageable ? (
          // A CONFIRMED FREE ACCOUNT, reached by a typed deep link — the app
          // itself never routes here from Profile's row. One sentence and a way
          // back. No upsell is placed on a refusal.
          <>
            <Masthead eyebrow={MEMBERSHIP_EYEBROW} title={MASTHEAD_UNREAD} />
            <Text variant="body" className="mt-4 text-muted">
              {NO_MEMBERSHIP_LINE}
            </Text>
            <TintedAction
              label={BACK_TO_SETTINGS}
              onPress={props.onBackToSettings}
              className="mt-5"
            />
          </>
        ) : (
          <>
            <Masthead
              eyebrow={MEMBERSHIP_EYEBROW}
              title={mastheadTier(copy)}
              mark={termMark({ trialing, trialEndsAt, currentPeriodEnd })}
            />

            {/* WHAT YOU HAVE. The plate is drawn whether or not the counts
                have landed; only the numbers wait. Omitting the whole plate
                would reflow the page under the reader when they arrive. */}
            <MembershipPlate className="mt-6">
              <View className="px-4 py-4">
                <MembershipKicker title={CAPACITY_KICKER} />
                <View className="mt-3.5">
                  {rows.length > 0 ? (
                    rows.map((row, i) => (
                      <CapacityRowView key={row.label} row={row} first={i === 0} />
                    ))
                  ) : (
                    <CapacityRowsSkeleton />
                  )}
                </View>
              </View>
            </MembershipPlate>

            {/* Near a ceiling, and only then. Two ceilings with two different
                remedies — see `capacityAdvice`. */}
            {advice ? (
              <MembershipNotice title={advice.title} body={advice.body} className="mt-3" />
            ) : null}

            <MembershipPlate className="mt-3">
              <View className="px-4 pt-4">
                <MembershipKicker title={CHANGE_KICKER} />
              </View>

              {/* The one upsell, for a member with somewhere to move. No price
                  and no term in it: the sub-line is the entitlement fact that
                  makes the move legible, and the terms are rendered from the
                  store two surfaces on. */}
              {canUpgrade(plan) ? (
                <SettingsRow
                  label={UPGRADE_ROW_LABEL}
                  sublabel={UPGRADE_ROW_SUBLABEL}
                  onPress={props.onUpgrade}
                />
              ) : null}

              {canUpgrade(plan) ? <Rule tone="hairline" /> : null}

              <SettingsRow
                label={CANCEL_ROW_LABEL}
                sublabel={CANCEL_ROW_SUBLABEL}
                detail={CANCEL_ROW_MARK}
                external
                onPress={props.onCancelBilling}
              />

              {/* Only where Superwall is configured. A restore row that cannot
                  reach StoreKit is a dead end wearing a chevron. */}
              {restoreAvailable ? (
                <>
                  <Rule tone="hairline" />
                  {/* `affordance="none"`, though the frame draws a chevron:
                      this row acts in place and reports into the notice below
                      it, and `settings-row-spec.ts` records that the chevron it
                      shipped with promised a destination that never existed.
                      Listed as a deviation. `loading` already makes the row
                      inert — `disabled` would also dim it, which reads as a
                      rejection of the tap that started the request. */}
                  <SettingsRow
                    label={RESTORE_ROW_LABEL}
                    sublabel={restoring ? RESTORE_ROW_PENDING : RESTORE_ROW_SUBLABEL}
                    loading={restoring}
                    affordance="none"
                    onPress={props.onRestore}
                  />
                </>
              ) : null}
            </MembershipPlate>

            {/* The restore's ending, in place. The row that caused it is still
                on screen and still pressable underneath. */}
            {restoreAvailable && restoring ? (
              <Text variant="note" className="mt-3">
                {RESTORE_PENDING_NOTE}
              </Text>
            ) : restoreAvailable && restoreEnding ? (
              <MembershipNotice
                tone="blush"
                announce
                title={restoreEnding.title}
                body={restoreEnding.body}
                action={restoreEnding.action}
                onAction={restoreEnding.action ? props.onRestore : undefined}
                className="mt-3"
              />
            ) : null}

            {/* Pro's absence, stated once — not a disabled control.
                A TRIALING account is folded to `pro` by `usePlan()` and has no
                upgrade row either, but it is not a Pro member and must not be
                told it has bought the largest membership. */}
            {plan === 'pro' && !trialing ? (
              <MembershipNotice
                title={PRO_IS_LARGEST.title}
                body={PRO_IS_LARGEST.body}
                className="mt-3"
              />
            ) : null}

            {/* The standing note, and the whole traced paragraph behind it.
                The artifact's expanded "If this membership ends" block is an
                annotation of this line rather than a second state — see the
                note in `manage-membership-spec.ts` — and its content is what
                the label says, verbatim, so no clause reaches fewer readers
                than it did before the redesign. */}
            <Text
              variant="note"
              className="mt-5"
              accessibilityLabel={cancellationConsequence(currentPeriodEnd)}>
              {endingNote()}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
