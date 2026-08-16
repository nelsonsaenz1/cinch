import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SettingsRow } from '@/components/ui/settings-row';
import { ToggleRow, ValueRow } from '@/components/ui/settled-row';
import { Text } from '@/components/ui/text';
import { membershipRowFor } from '@/features/billing/membership-row';
import { SHOW_WHERE_TO_BUY_DETAIL, SHOW_WHERE_TO_BUY_LABEL } from '@/features/commerce/copy';

/**
 * PR-01 / AX — largest Dynamic Type: rows grow, values wrap under.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · THE SETTLED ROW'S ONE RULE AT LARGER TYPE: when a label and its value can
 *   no longer share a line, the value moves UNDERNEATH. Neither is ever
 *   truncated — a settings value is the answer to the question its label asks,
 *   and a truncated answer is worse than a taller row. `flex-wrap` plus
 *   `flex-none` on the value is the whole mechanism: no measurement, no
 *   breakpoint, and it behaves identically at every size rather than at the one
 *   somebody tested.
 * · TOGGLES KEEP THEIR TRAILING POSITION, because the switch is the
 *   affordance; the printed state takes the second line, where it already is.
 * · The membership row shows a CONFIRMED read here, so its facts stack rather
 *   than compete.
 *
 * Set the system text size to the largest supported before reading this frame;
 * nothing in the code branches on it.
 */
export default function DevW3G6PR01AX() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const membership = membershipRowFor({
    plan: 'standard',
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: new Date('2027-03-03T00:00:00Z'),
    loading: false,
    unconfirmed: false,
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Card padding="none">
          <ValueRow label="Active pieces" value="10 of 10" />
          <Rule tone="hairline" />
          <ValueRow label="Stored pieces" value="4 of 30" />
        </Card>

        <Card padding="none" className="mt-6">
          <SettingsRow
            label={membership.label}
            sublabel={membership.value}
            onPress={() => undefined}
          />
          <Rule tone="hairline" />
          <SettingsRow label="Notifications" onPress={() => undefined} />
          <Rule tone="hairline" />
          <ToggleRow
            label={SHOW_WHERE_TO_BUY_LABEL}
            state={`On — ${SHOW_WHERE_TO_BUY_DETAIL}`}
            value
            onValueChange={() => undefined}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
