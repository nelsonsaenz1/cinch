import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { PLANS, type Plan } from '@/features/billing/plans';
import {
  planDelta,
  upgradeDelta,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_KEEPS_LINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
} from '@/features/billing/upgrade-delta';
import {
  BACK_TO_MEMBERSHIP,
  MASTHEAD_CHECKING,
  TRY_AGAIN,
  UPGRADE_DECLINED,
  UPGRADE_DELTA_KICKER,
  UPGRADE_EYEBROW,
  UPGRADE_HEADLINE,
  UPGRADE_OPENING,
  UPGRADE_PRORATION_TITLE,
  UPGRADE_REFUSED_TITLE,
  upgradeRefusedBody,
} from '@/features/membership/manage-membership-spec';
import {
  COMPARISON_KICKER,
  NOTHING_STARTED,
  PLANS_CTA,
  trialEndsBody,
  trialEndsTitle,
  upgradeSurface,
} from '@/features/membership/membership-surface';

import {
  DeltaTable,
  Masthead,
  MembershipNotice,
  TintedAction,
} from './membership-parts';

/**
 * MB-09 / redesign 30 — the difference between what you have and what you could.
 *
 * ── FOUR ANSWERS, NOT TWO ─────────────────────────────────────────────────
 *
 * `upgradeSurface()` decides which, off the same resolver MB-08 uses. The page
 * shipped with one refusal string covering everything that was not a Standard
 * member, so a FREE account — the person this app most wants to convert — was
 * told "This account is already on Pro", and so was anyone on a legacy trial,
 * whose free row `usePlan()` folds up to `pro`. That sentence is now shown
 * only to the one account it is true of; free and trialing accounts get the
 * comparison and the same gate, because what they have is not an upgrade, it
 * is a first purchase.
 *
 * ── WHERE THE PRICES ARE ──────────────────────────────────────────────────
 *
 * Not here, and the redesign does not move them here. This app has no StoreKit
 * module and cannot make a live read; every price Cinch has ever shown came
 * from Superwall rendering its own document. So this page states the
 * entitlement deltas it CAN source — straight off `upgradeDelta()` and
 * `planDelta()`, which read `PLANS` and nothing else — and the CTA opens
 * placement `membership_upgrade` → campaign 101571 → paywall 254200, which
 * carries all four products and renders both terms in the reader's own
 * currency. The campaign's audience is "no active Pro entitlement", which a
 * free or trialing account satisfies, so the door needs no new placement and
 * no dashboard change.
 *
 * Nothing about a price, a period, a per-month figure, a saving, a renewal or
 * a trial appears in this file, and `tests/upgrade-delta.test.ts` and
 * `tests/manage-membership-layout.test.ts` both fail if one arrives.
 *
 * ── THE ONE ACCENT ON THE PAGE ────────────────────────────────────────────
 *
 * "See both terms" is the single act the screen exists for, and it is the only
 * filled oxblood control in either membership page. The decline under it is a
 * tinted blush fill rather than a hairline ghost — the directive's own words —
 * and it is a REAL exit with no second ask behind it.
 *
 * ── WHY THIS IS NOT A DEAD CONTROL ────────────────────────────────────────
 *
 * `present()` resolves on every path — `granted`, `declined` or `unavailable`.
 * Paywall 254200 was still unpublished when this shipped, so today it can
 * resolve `unavailable` and the fail-safe in `use-gate.ts` tears the empty
 * sheet down. A button that silently did nothing after that would be the dead
 * control the refusals forbid, so both outcomes are drawn: a decline as a quiet
 * confirmation, an unavailable paywall as the exact shipped sentence.
 */
export type UpgradeBodyProps = {
  onBack: () => void;
  loading: boolean;
  /** The read failed. Same waiting state as `loading` — see `upgradeSurface`. */
  unconfirmed: boolean;
  plan: Plan;
  /** A live subscription, as against access. `usePlan().paid`, unmodified. */
  paid: boolean;
  trialing: boolean;
  trialEndsAt: Date | null;
  /** The vendor sheet is being summoned. Both controls lock. */
  opening: boolean;
  /** The paywall never arrived. Distinct from a decline, which needs no apology. */
  unavailable: boolean;
  /** The reader closed a paywall they read. Confirmed once, never re-asked. */
  declined: boolean;
  onOpen: () => void;
  onDecline: () => void;
};

export function UpgradeBody(props: UpgradeBodyProps) {
  const { plan, opening, unavailable, declined } = props;

  const surface = upgradeSurface({
    plan,
    paid: props.paid,
    trialing: props.trialing,
    trialEndsAt: props.trialEndsAt,
    currentPeriodEnd: null,
    loading: props.loading,
    unconfirmed: props.unconfirmed,
  });
  const rows = upgradeDelta(plan);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        align="leading"
        title="Membership"
        onBack={props.onBack}
        backLabel={BACK_TO_MEMBERSHIP}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-gutter pb-10 pt-6">
        {surface.kind === 'reading' ? (
          <Masthead eyebrow={UPGRADE_EYEBROW} title={MASTHEAD_CHECKING} quiet />
        ) : surface.kind === 'at-top' ? (
          // A PAYING PRO MEMBER, and nobody else. Reachable only as a typed
          // deep link — the row that leads here is drawn only for a member who
          // can actually make the move. It says what is true and offers a way
          // back, rather than opening a placement that could not apply.
          <>
            <Masthead eyebrow={UPGRADE_EYEBROW} title={UPGRADE_REFUSED_TITLE} />
            <Text variant="body" className="mt-4 text-muted">
              {upgradeRefusedBody()}
            </Text>
            <TintedAction
              label={BACK_TO_MEMBERSHIP}
              onPress={props.onBack}
              className="mt-5"
            />
          </>
        ) : surface.kind === 'plans' ? (
          // FREE, OR ON A SERVER-GRANTED TRIAL. There is no upgrade here and
          // there never was one to refuse: there is a first purchase. Same
          // comparison MB-08 draws, same gate, same placement — this route is
          // simply the one Profile and a deep link land on.
          <>
            <Masthead
              eyebrow={UPGRADE_EYEBROW}
              title={
                surface.trialEndsAt ? trialEndsTitle(surface.trialEndsAt) : UPGRADE_HEADLINE
              }
            />

            {surface.kind === 'plans' && surface.trialEndsAt ? (
              <Text variant="body" className="mt-4 text-muted">
                {trialEndsBody()}
              </Text>
            ) : null}

            {(['standard', 'pro'] as const)
              .filter((tier) => tier !== surface.owned)
              .map((tier) => (
                <DeltaTable
                  key={tier}
                  kicker={`${COMPARISON_KICKER} · ${PLANS[tier].name.toUpperCase()}`}
                  rows={planDelta(surface.owned, tier)}
                  toName={PLANS[tier].name}
                  className="mt-6"
                />
              ))}

            <Text variant="note" className="mt-4">
              {UPGRADE_KEEPS_LINE}
            </Text>

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
                onAction={props.onOpen}
                className="mt-5"
              />
            ) : null}

            <View className="mt-auto pt-8">
              <Button
                title={opening ? UPGRADE_OPENING : PLANS_CTA}
                variant="primary"
                loading={opening}
                accessibilityHint="Opens the App Store terms"
                onPress={props.onOpen}
              />
              <TintedAction
                label={BACK_TO_MEMBERSHIP}
                onPress={props.onDecline}
                busy={opening}
                className="mt-2.5"
              />
            </View>
          </>
        ) : (
          <>
            <Masthead eyebrow={UPGRADE_EYEBROW} title={UPGRADE_HEADLINE} />

            {/* WHAT CHANGES — on blush, because this plate is the whole
                argument the page makes and the only one it is allowed to
                make. Three rows, each with the current figure and the new
                one, so nothing has to be remembered from another screen. */}
            <DeltaTable
              kicker={UPGRADE_DELTA_KICKER}
              rows={rows}
              toName={PLANS.pro.name}
              className="mt-6"
            />

            <Text variant="note" className="mt-4">
              {UPGRADE_KEEPS_LINE}
            </Text>

            {/* A decline is a normal ending and the page it returns to is still
                true, so this confirms and stops. There is no second ask. */}
            {declined ? (
              <MembershipNotice
                tone="blush"
                announce
                title={UPGRADE_DECLINED.title}
                body={UPGRADE_DECLINED.body}
                className="mt-5"
              />
            ) : null}

            {/* The paywall never arrived. The exact shipped sentence, drawn as
                one paragraph rather than split into a title and a body that
                would say the same clause twice. */}
            {unavailable ? (
              <MembershipNotice
                tone="blush"
                announce
                title={UPGRADE_UNAVAILABLE_LINE}
                action={TRY_AGAIN}
                onAction={props.onOpen}
                className="mt-5"
              />
            ) : null}

            {/* The commitment sits at the foot of the column, as the frames
                set it. `grow` on the scroll content is what puts it there on a
                tall device and lets it scroll on a short one. */}
            <View className="mt-auto pt-8">
              <Button
                title={opening ? UPGRADE_OPENING : UPGRADE_CTA}
                variant="primary"
                loading={opening}
                accessibilityHint="Opens the App Store terms"
                onPress={props.onOpen}
              />
              <TintedAction
                label={UPGRADE_DECLINE}
                onPress={props.onDecline}
                busy={opening}
                className="mt-2.5"
              />

              {/* Who works out the balance, said plainly rather than computed.
                  Proration is Apple's; naming a figure would be inventing one. */}
              <MembershipNotice
                title={UPGRADE_PRORATION_TITLE}
                body={UPGRADE_PRORATION_LINE}
                className="mt-5"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
