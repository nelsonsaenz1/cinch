import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Rule, ScreenHeader, Text } from '@/components/ui';
import { Placement } from '@/features/billing/placements';
import {
  canUpgrade,
  upgradeDelta,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_KEEPS_LINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
} from '@/features/billing/upgrade-delta';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * MB-09 — Standard → Pro. Only the difference.
 *
 * Reached from MB-08's "Move to Pro" row, which renders only once the
 * subscription read has confirmed a paid plan below Pro. A free account has no
 * upgrade — it has a first purchase, which is the paywall's own job at
 * `reveal_complete` and the limit placements — and a Pro member has nothing
 * above them.
 *
 * ── WHERE THE PRICES ARE ──────────────────────────────────────────────────
 *
 * Not here. The atlas draws two term rows with "App Store price" in the price
 * position and says those positions are live StoreKit reads; this app has no
 * StoreKit module, so it cannot make one, and every price it has ever shown
 * came from Superwall rendering its own document. So this page states the
 * three entitlement deltas it CAN source, and the CTA opens placement
 * `membership_upgrade` → campaign 101571 → paywall 254200 (Cinch Membership
 * v3), which carries all four products and renders both terms in the reader's
 * own currency.
 *
 * That is the atlas's requirement met rather than its sketch copied: the
 * requirement is that no price is ever a literal in a layout, and the sketch
 * put the read in a layout this app cannot give one to. Nothing about a price,
 * a period, a per-month figure, a renewal or a trial appears in this file, and
 * `tests/upgrade-delta.test.ts` fails if one arrives.
 *
 * ── WHY THIS IS NOT A DEAD CONTROL ────────────────────────────────────────
 *
 * `present()` resolves on every path — `granted`, `declined` or `unavailable`
 * — and paywall 254200 is still unpublished, so today it resolves
 * `unavailable` and the fail-safe in `use-gate.ts` tears the empty sheet down.
 * A button that silently did nothing after that would be the dead control the
 * refusals forbid, so the outcome is drawn. When the document is published
 * this branch simply stops being reached.
 */
export default function MembershipUpgradeScreen() {
  const router = useRouter();
  const plan = usePlan();
  const gate = useGate();
  const [unavailable, setUnavailable] = useState(false);
  const [opening, setOpening] = useState(false);

  const open = useCallback(() => {
    setOpening(true);
    setUnavailable(false);
    void gate
      .present(Placement.MembershipUpgrade)
      .then((outcome) => {
        // `declined` is a person closing a paywall they read, which needs no
        // message — the page they came back to is still true. Only a paywall
        // that never arrived is worth saying anything about.
        if (outcome === 'unavailable') setUnavailable(true);
      })
      .finally(() => setOpening(false));
  }, [gate]);

  const rows = upgradeDelta(plan.plan);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Standard → Pro" />

      <ScrollView className="flex-1" contentContainerClassName="px-gutter pb-16 pt-2">
        {plan.loading ? (
          <Text variant="body" className="text-muted">
            Checking…
          </Text>
        ) : !canUpgrade(plan.plan) ? (
          // Reachable only as a typed deep link. It says what is true rather
          // than drawing a table about a move this account cannot make.
          <Text variant="body" className="text-muted">
            There is no upgrade to make from this membership.
          </Text>
        ) : (
          <>
            <Text variant="body">What changes if you move up</Text>

            <Card padding="none" className="mt-5">
              {rows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 ? <Rule tone="hairline" /> : null}
                  <View
                    // The label and its pair wrap independently at larger type,
                    // the settled row's own rule. VoiceOver reads the arrow as
                    // the word it means, never as a symbol.
                    accessibilityRole="text"
                    accessibilityLabel={`${row.label}, ${row.from} becomes ${row.to}`}
                    style={{ minHeight: MIN_TAP_TARGET }}
                    className="flex-row flex-wrap items-center justify-between gap-x-3 px-4 py-3">
                    <Text variant="body">{row.label}</Text>
                    <Text variant="caption" className="flex-none text-muted">
                      {row.from} → {row.to}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>

            <Text variant="note" className="mt-4">
              {UPGRADE_KEEPS_LINE}
            </Text>

            {unavailable ? (
              <Text variant="note" className="mt-5">
                {UPGRADE_UNAVAILABLE_LINE}
              </Text>
            ) : null}

            {/* The one accent on the page, and the only place in group 6 that
                spends it: this is the single act the screen exists for. */}
            <Button
              title={UPGRADE_CTA}
              variant="primary"
              loading={opening}
              onPress={open}
              className="mt-6"
            />
            <Button
              title={UPGRADE_DECLINE}
              variant="secondary"
              onPress={() => router.back()}
              className="mt-2.5"
            />

            <Text variant="note" className="mt-5">
              {UPGRADE_PRORATION_LINE}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
