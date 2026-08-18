import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import type { Plan } from '@/features/billing/plans';
import {
  canUpgrade,
  upgradeDelta,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_KEEPS_LINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
} from '@/features/billing/upgrade-delta';
import {
  BACK_TO_MEMBERSHIP,
  deltaSpoken,
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
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import {
  Masthead,
  MembershipKicker,
  MembershipNotice,
  MembershipPlate,
  TintedAction,
} from './membership-parts';

/**
 * MB-09 / redesign 30 — Standard → Pro. Only the difference.
 *
 * ── WHERE THE PRICES ARE ──────────────────────────────────────────────────
 *
 * Not here, and the redesign does not move them here. This app has no StoreKit
 * module and cannot make a live read; every price Cinch has ever shown came
 * from Superwall rendering its own document. So this page states the three
 * entitlement deltas it CAN source — straight off `upgradeDelta()`, which is
 * untouched — and the CTA opens placement `membership_upgrade` → campaign
 * 101571 → paywall 254200, which carries all four products and renders both
 * terms in the reader's own currency.
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
  plan: Plan;
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
  const theme = useTheme();
  const { loading, plan, opening, unavailable, declined } = props;
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
        {loading ? (
          <Masthead eyebrow={UPGRADE_EYEBROW} title={MASTHEAD_CHECKING} quiet />
        ) : !canUpgrade(plan) ? (
          // Reachable only as a typed deep link — the row that leads here is
          // drawn only for a member who can actually make the move. It says
          // what is true and offers a way back, rather than opening a placement
          // that could not apply to this account.
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
        ) : (
          <>
            <Masthead eyebrow={UPGRADE_EYEBROW} title={UPGRADE_HEADLINE} />

            {/* WHAT CHANGES — on blush, because this plate is the whole
                argument the page makes and the only one it is allowed to
                make. Three rows, each with the current figure and the new
                one, so nothing has to be remembered from another screen. */}
            <MembershipPlate tone="blush" className="mt-6">
              <View className="px-4 pb-1 pt-4">
                <MembershipKicker title={UPGRADE_DELTA_KICKER} />
              </View>
              {rows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 ? <Rule tone="hairline" /> : null}
                  <View
                    // One composed node. The arrow is read as the words it
                    // means, never as a symbol, and the label and its pair wrap
                    // independently at larger type — the settled row's own rule.
                    accessibilityRole="text"
                    accessibilityLabel={deltaSpoken(row)}
                    style={{ minHeight: MIN_TAP_TARGET }}
                    className="flex-row flex-wrap items-center justify-between gap-x-3 px-4 py-3">
                    <Text variant="body">{row.label}</Text>
                    <View className="flex-none flex-row items-center gap-2">
                      <Text variant="body" style={{ color: theme.muted }}>
                        {row.from}
                      </Text>
                      {/* Drawn, and hidden from VoiceOver: the composed label
                          above already says "Now … On Pro, …". */}
                      <Text
                        variant="body"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        style={{ color: theme.muted }}>
                        →
                      </Text>
                      <Text variant="body" style={{ color: theme.accent }}>
                        {row.to}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </MembershipPlate>

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
