import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import {
  upgradeDelta,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_KEEPS_LINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
} from '@/features/billing/upgrade-delta';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * MB-09 — Standard → Pro, only the difference. Unparked 2026-08-12 (D-5).
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · ONLY THE DELTA. Three rows, each carrying the current figure and the new
 *   one, so nothing has to be remembered from another screen. Both numeric
 *   rows come off `PLANS`, which mirrors the two database ceilings; packing is
 *   a delta row because correction 18 resolved it as Pro-only.
 * · NO PRICE, NO PERIOD, NO TRIAL, NO PRORATION FIGURE — anywhere on the page.
 *   The atlas draws two term rows with "App Store price" in them and calls
 *   those positions live StoreKit reads. This app has no StoreKit module, so
 *   the terms are rendered by paywall 254200 (Cinch Membership v3), which
 *   carries all four products, and the CTA opens it. The requirement is that a
 *   price is never a literal in a layout; that is met, and it is met more
 *   strictly than the sketch, because no price position exists here at all.
 * · THE CTA NAMES THE ACT, NOT THE TERMS. "See both terms" is what the button
 *   does. A label carrying a figure would be the literal the page exists to
 *   avoid, and the atlas's own note says the CTA "names the term but not a
 *   figure".
 * · "Stay on Standard" is a real 44 pt exit with no second attempt after it.
 * · THE UNAVAILABLE LINE IS DRAWN HERE, in situ, because it is the state a
 *   reviewer will actually meet today: paywall 254200 is `published_at: null`,
 *   so `present()` resolves `unavailable` and the fail-safe in `use-gate.ts`
 *   tears the empty sheet down. A button that silently did nothing after that
 *   would be a dead control; this says what happened and that nothing changed.
 *   On the shipping screen it appears only after a failed attempt.
 * · VoiceOver reads each row as "active pieces, 150 becomes 1,000" — the arrow
 *   as the word it means, never as a symbol.
 *
 * DETERMINISM: every string is computed from `PLANS`. No query, no clock, no
 * network, and the gate is never called from this route.
 */
export default function DevW3G6MB09() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const rows = upgradeDelta('standard');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Standard → Pro" />
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-2">
        <Text variant="body">What changes if you move up</Text>

        <Card padding="none" className="mt-5">
          {rows.map((row, i) => (
            <View key={row.label}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <View
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

        <Text variant="note" className="mt-5">
          {UPGRADE_UNAVAILABLE_LINE}
        </Text>

        <Button title={UPGRADE_CTA} variant="primary" onPress={() => undefined} className="mt-6" />
        <Button
          title={UPGRADE_DECLINE}
          variant="secondary"
          onPress={() => undefined}
          className="mt-2.5"
        />

        <Text variant="note" className="mt-5">
          {UPGRADE_PRORATION_LINE}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
