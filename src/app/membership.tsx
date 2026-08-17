import { useRouter, type Href } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Rule, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { SettingsRow } from '@/components/ui/settings-row';
import { ValueRow } from '@/components/ui/settled-row';
import {
  CANCEL_ROW_DETAIL,
  CANCEL_ROW_LABEL,
  CANCELLATION_NOTE,
  cancellationConsequence,
  entitlementBand,
  freeCeilingMark,
  isManageablePlan,
  paidThroughMark,
  UPGRADE_ROW_LABEL,
  upgradeRowDetail,
} from '@/features/billing/manage-membership';
import { canUpgrade } from '@/features/billing/upgrade-delta';
import { useCapacity } from '@/features/billing/use-capacity';
import { usePlan } from '@/features/billing/use-plan';
import { useRestorePurchases } from '@/features/profile/use-restore-purchases';

/**
 * Apple's own manage-subscriptions page. There is no StoreKit module installed
 * to present the native sheet in-app; this URL opens the App Store's
 * subscription list, which is where cancellation genuinely lives anyway.
 * `profile.tsx` and `features/help/articles.ts` each hold the same literal —
 * see the note on the one in `articles.ts` for why it is not imported.
 */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * MB-08 — manage membership. Reached from Profile's membership row, and only
 * once that row has CONFIRMED a paid plan.
 *
 * A management page, not a sales page: no price, no accent, no retention
 * attempt. It carries ONE upsell row, "Move to Pro", and only for a member who
 * has somewhere to move — a Pro member's page has no upsell on it at all. The
 * row was withheld for a packet because it could only lead to an unmatched
 * Superwall placement; campaign 101571 now routes `membership_upgrade` to
 * Membership v3, so it leads somewhere. It still carries no price and no term:
 * those are a live StoreKit read, and the paywall is what makes one.
 *
 * Every sentence on it comes out of `manage-membership.ts`, which carries the
 * `file:line` trace for each claim: what paid access does, what the free
 * ceilings are, and the fact — which is genuinely better news than the promise
 * it replaces — that nothing is deleted on the way down, because neither
 * ceiling trigger fires on an existing row.
 *
 * A free account never reaches this route through the app. It can still be
 * typed as a deep link, so the screen says so plainly rather than drawing an
 * empty band about a membership nobody has.
 */
export default function MembershipScreen() {
  const router = useRouter();
  const plan = usePlan();
  const capacity = useCapacity();
  const restore = useRestorePurchases();

  const band = entitlementBand({
    copy: plan.copy,
    // `useCapacity` returns 0 while its count is in flight, which is a claim
    // about somebody's closet rather than an absence of one. `loading` is what
    // distinguishes them, and a pending count draws no row at all.
    used: capacity.loading ? null : capacity.used,
    stored: capacity.loading ? null : capacity.stored,
  });

  // Empty until `current_period_end` has been read, and the colophon is simply
  // not drawn — no softened clause standing in for a date nobody has.
  const paidThrough = paidThroughMark(plan.currentPeriodEnd);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Your membership" />

      <ScrollView className="flex-1" contentContainerClassName="px-gutter pb-16 pt-2">
        {plan.loading ? (
          <Text variant="body" className="text-muted">
            Checking…
          </Text>
        ) : plan.unconfirmed ? (
          // The same refusal PR-02's failed read makes, for the same reason: a
          // membership that cannot be read is not a membership that has ended,
          // and no date is invented to fill the sentence.
          <>
            <Text variant="body">Your membership can’t be confirmed right now.</Text>
            <Text variant="note" className="mt-2.5">
              Nothing has changed and nothing is locked. The App Store still holds your
              subscription either way.
            </Text>
          </>
        ) : !isManageablePlan(plan.plan) ? (
          <Text variant="body" className="text-muted">
            There is no membership on this account to manage.
          </Text>
        ) : (
          <>
            {/* The masthead sets in type what used to be a run-on sentence:
                tier as the plate, term as the data line under it. No colophon
                at all when the period end has not been read — the type scale's
                way of saying the same "no guessed date" the failed-read branch
                above says in words. */}
            <Text variant="eyebrow">MEMBERSHIP</Text>
            {/* `trim` collapses the serif's tall line box to the cap height, so
                the margins around it are larger than they look on paper. */}
            <Text variant="plate" trim className="mt-3">
              Cinch {plan.copy.name}
            </Text>
            {paidThrough ? (
              <Text variant="colophon" className="mt-3">
                {paidThrough}
              </Text>
            ) : null}

            {band.length > 0 ? (
              <Card padding="none" className="mt-5">
                {band.map((row, i) => (
                  <View key={row.label}>
                    {i > 0 ? <Rule tone="hairline" /> : null}
                    <ValueRow label={row.label} value={row.value} />
                  </View>
                ))}
              </Card>
            ) : null}

            {/* The free ceilings, as the data line the band's numbers are
                measured against. The whole original paragraph rides along as
                the label, so VoiceOver still hears every clause — what stops,
                what does not, and that nothing is deleted. */}
            <Text
              variant="colophon"
              className="mt-2.5"
              accessibilityLabel={cancellationConsequence(plan.currentPeriodEnd)}
            >
              {freeCeilingMark()}
            </Text>

            <SectionHeader title="Changing it" className="mb-2.5 mt-6" />
            <Card padding="none">
              {/* Only for a member with somewhere to move. No price and no
                  term in the row: the sub-line is the entitlement fact that
                  makes the move legible, and the terms are rendered from the
                  store two surfaces on. */}
              {canUpgrade(plan.plan) ? (
                <>
                  <SettingsRow
                    label={UPGRADE_ROW_LABEL}
                    sublabel={upgradeRowDetail()}
                    onPress={() => router.push('/membership-upgrade' as Href)}
                  />
                  <Rule tone="hairline" />
                </>
              ) : null}
              <SettingsRow
                label={CANCEL_ROW_LABEL}
                sublabel={CANCEL_ROW_DETAIL}
                external
                onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
              />
              {/* Only in builds where Superwall is configured. A restore row
                  that cannot reach StoreKit is a dead end wearing a chevron. */}
              {restore.available ? (
                <>
                  <Rule tone="hairline" />
                  <SettingsRow
                    label="Restore a purchase"
                    onPress={restore.restore}
                    loading={restore.restoring}
                  />
                </>
              ) : null}
            </Card>

            <Text variant="note" className="mt-5">
              {CANCELLATION_NOTE}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
