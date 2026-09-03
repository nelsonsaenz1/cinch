import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import {
  CANCEL_ROW_LABEL,
  cancellationConsequence,
  UPGRADE_ROW_LABEL,
} from '@/features/billing/manage-membership';
import { PLANS, type Plan, type PlanCopy } from '@/features/billing/plans';
import { planDelta, UPGRADE_UNAVAILABLE_LINE } from '@/features/billing/upgrade-delta';
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
  PRO_IS_LARGEST,
  RESTORE_PENDING_NOTE,
  RESTORE_ROW_LABEL,
  RESTORE_ROW_PENDING,
  RESTORE_ROW_SUBLABEL,
  termMark,
  TRY_AGAIN,
  UNCONFIRMED_BODY,
  UNCONFIRMED_TITLE,
  UPGRADE_OPENING,
  UPGRADE_ROW_SUBLABEL,
  type RestoreEnding,
} from '@/features/membership/manage-membership-spec';
import {
  COMPARISON_KICKER,
  freeLead,
  membershipSurface,
  NOTHING_STARTED,
  PLANS_CTA,
  trialEndsBody,
  trialEndsTitle,
} from '@/features/membership/membership-surface';

import {
  CapacityRowsSkeleton,
  CapacityRowView,
  DeltaTable,
  Masthead,
  MembershipKicker,
  MembershipNotice,
  MembershipPlate,
  TintedAction,
} from './membership-parts';

/**
 * MB-08 / redesign 30 — the membership page, as one pure component.
 *
 * Every read, mutation and router call stays in `app/membership.tsx`; this is
 * the drawing, so the `dev-mm-*` fixtures can pose all of it. Same split as
 * `SettingsBody` / `app/settings.tsx` in redesign 29.
 *
 * ── FIVE STATES, ONE RESOLVER ─────────────────────────────────────────────
 *
 * `membershipSurface()` decides which; this file draws what it returns and
 * asks no question of its own. It used to branch on `plan !== 'free'`, which
 * put a legacy-trial account (a free row the fold lifts to `pro`) on the
 * manage page while MB-09 told the same account it was already on Pro, and
 * put a genuinely free account on a one-sentence dead end. Both bugs were the
 * same bug: two pages inventing the same boolean. See `membership-surface.ts`.
 *
 * ── STILL NOT A SALES PAGE ────────────────────────────────────────────────
 *
 * There is no price, no term, no retention attempt and no "are you sure"
 * anywhere in the file. A paying member gets exactly ONE upsell row — "Move to
 * Pro", only where there is somewhere to move — and a free or trialing account
 * gets exactly ONE door, which is the paywall the rest of the app already
 * opens through `useGate`. A refusal is never dressed as an offer, and an
 * offer is never drawn as a refusal.
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
  /**
   * A live subscription, as against access. `usePlan().paid` and nothing
   * re-derived here — see `membership-surface.ts` for why `plan !== 'free'`
   * is not the same question.
   */
  paid: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;

  // ── The counts. `null` is in flight, never zero. ────────────────────────
  used: number | null;
  stored: number | null;

  // ── Changing it ─────────────────────────────────────────────────────────
  /** MB-09's row — a paying member below Pro, and nobody else. */
  onUpgrade: () => void;
  /**
   * The first-purchase door, through `useGate` and the `membership_upgrade`
   * placement. The three outcome props under it are what keep it from being a
   * dead control when the paywall never arrives.
   */
  onSeePlans: () => void;
  opening: boolean;
  unavailable: boolean;
  declined: boolean;
  onCancelBilling: () => void;
  /** False in a keyless build — the row is absent, not disabled. */
  restoreAvailable: boolean;
  restoring: boolean;
  onRestore: () => void;
  /** The ending of the last restore, drawn in place. Null before any attempt. */
  restoreEnding: RestoreEnding | null;

  /** A second way back, drawn under the states that are not the manage page. */
  onBackToSettings: () => void;
};

export function MembershipBody(props: MembershipBodyProps) {
  const {
    plan,
    copy,
    used,
    stored,
    restoreAvailable,
    restoring,
    restoreEnding,
    opening,
    unavailable,
    declined,
  } = props;

  // THE ONE DECISION. Every branch below reads this and nothing else — no page
  // may ask `plan !== 'free'` again and get its own answer.
  const surface = membershipSurface({
    plan,
    paid: props.paid,
    trialing: props.trialing,
    trialEndsAt: props.trialEndsAt,
    currentPeriodEnd: props.currentPeriodEnd,
    loading: props.loading,
    unconfirmed: props.unconfirmed,
  });

  const rows = capacityRows({ copy, used, stored });
  const advice = capacityAdvice({ copy, used, stored });

  /** The counts plate, which every settled state draws — free included. */
  const capacityPlate = (
    <MembershipPlate className="mt-6">
      <View className="px-4 py-4">
        <MembershipKicker title={CAPACITY_KICKER} />
        <View className="mt-3.5">
          {rows.length > 0 ? (
            rows.map((row, i) => <CapacityRowView key={row.label} row={row} first={i === 0} />)
          ) : (
            <CapacityRowsSkeleton />
          )}
        </View>
      </View>
    </MembershipPlate>
  );

  /**
   * The door, and both of its endings.
   *
   * One primary action per zone, and it is the only oxblood control the page
   * has ever carried. `declined` confirms and stops — there is no second ask
   * anywhere on this screen — and `unavailable` says the terms could not be
   * loaded rather than leaving a button that appears to do nothing.
   */
  const planDoor = (
    <>
      {declined ? (
        <MembershipNotice
          tone="blush"
          announce
          title={NOTHING_STARTED.title}
          body={NOTHING_STARTED.body}
          className="mt-5"
        />
      ) : null}
      {unavailable ? (
        <MembershipNotice
          tone="blush"
          announce
          title={UPGRADE_UNAVAILABLE_LINE}
          action={TRY_AGAIN}
          onAction={props.onSeePlans}
          className="mt-5"
        />
      ) : null}
      <View className="mt-6">
        <Button
          title={opening ? UPGRADE_OPENING : PLANS_CTA}
          variant="primary"
          loading={opening}
          accessibilityHint="Opens the App Store terms"
          onPress={props.onSeePlans}
        />
        <TintedAction
          label={BACK_TO_SETTINGS}
          onPress={props.onBackToSettings}
          busy={opening}
          className="mt-2.5"
        />
      </View>
    </>
  );

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
        {surface.kind === 'reading' ? (
          <>
            <Masthead eyebrow={MEMBERSHIP_EYEBROW} title={MASTHEAD_CHECKING} quiet />
            <MembershipPlate className="mt-6">
              <View className="px-4 py-4">
                <CapacityRowsSkeleton />
              </View>
            </MembershipPlate>
          </>
        ) : surface.kind === 'unconfirmed' ? (
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
        ) : surface.comparison ? (
          // A CONFIRMED FREE ACCOUNT, or one riding out a server-granted
          // trial. Neither has a subscription to manage, and neither is a dead
          // end: the page names what they have now, what a membership adds,
          // and opens exactly one door — the same gate and the same placement
          // every other first purchase in the app goes through.
          <>
            <Masthead
              eyebrow={MEMBERSHIP_EYEBROW}
              title={mastheadTier(copy)}
              mark={termMark({
                trialing: surface.kind === 'trialing',
                trialEndsAt: surface.trialEndsAt,
                currentPeriodEnd: null,
              })}
            />

            {/* The one-line consequence. A trial gets the date the SERVER
                wrote and what happens after it; a free account gets the two
                ceilings it is living inside. Neither is an offer. */}
            {surface.kind === 'trialing' ? (
              <MembershipNotice
                title={trialEndsTitle(surface.trialEndsAt)}
                body={trialEndsBody()}
                className="mt-5"
              />
            ) : (
              <Text variant="body" className="mt-4 text-muted">
                {freeLead()}
              </Text>
            )}

            {capacityPlate}

            {/* WHAT A MEMBERSHIP ADDS — one plate per paid tier, every figure
                out of `PLANS`, no price anywhere. The terms are rendered from
                the store on the paywall the button below opens. */}
            {(['standard', 'pro'] as const)
              .filter((tier) => tier !== plan)
              .map((tier) => (
                <DeltaTable
                  key={tier}
                  kicker={`${COMPARISON_KICKER} · ${PLANS[tier].name.toUpperCase()}`}
                  rows={planDelta(plan, tier)}
                  toName={PLANS[tier].name}
                  className="mt-3"
                />
              ))}

            {/* Only where Superwall is configured — a restore that cannot
                reach StoreKit is a dead end wearing a chevron. It belongs on
                this page as much as on the paid one: a membership bought on
                another device is exactly what an account reading as free may
                be missing. */}
            {restoreAvailable ? (
              <MembershipPlate className="mt-3">
                <SettingsRow
                  label={RESTORE_ROW_LABEL}
                  sublabel={restoring ? RESTORE_ROW_PENDING : RESTORE_ROW_SUBLABEL}
                  loading={restoring}
                  affordance="none"
                  onPress={props.onRestore}
                />
              </MembershipPlate>
            ) : null}

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

            {planDoor}
          </>
        ) : (
          <>
            <Masthead
              eyebrow={MEMBERSHIP_EYEBROW}
              title={mastheadTier(copy)}
              // `trialing: false` on purpose. This branch is a PAID account,
              // and a paid row that still carries an old `trial_ends_at` is
              // paying — the term that governs it is the billing period, not
              // the grant it happens to have outlived.
              mark={termMark({
                trialing: false,
                trialEndsAt: null,
                currentPeriodEnd: surface.currentPeriodEnd,
              })}
            />

            {/* WHAT YOU HAVE. The plate is drawn whether or not the counts
                have landed; only the numbers wait. Omitting the whole plate
                would reflow the page under the reader when they arrive. */}
            {capacityPlate}

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
              {surface.upgradable ? (
                <SettingsRow
                  label={UPGRADE_ROW_LABEL}
                  sublabel={UPGRADE_ROW_SUBLABEL}
                  onPress={props.onUpgrade}
                />
              ) : null}

              {surface.upgradable ? <Rule tone="hairline" /> : null}

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
                Only a PAID Pro member reaches this line. A trialing account is
                folded to `pro` by `usePlan()` and has no upgrade row either,
                but it has not bought the largest membership and is drawn by
                the comparison branch above instead. */}
            {surface.plan === 'pro' ? (
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
              accessibilityLabel={cancellationConsequence(surface.currentPeriodEnd)}>
              {endingNote()}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
