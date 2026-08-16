import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ValueRow } from '@/components/ui/settled-row';
import { Text } from '@/components/ui/text';
import {
  CANCEL_ROW_DETAIL,
  CANCEL_ROW_LABEL,
  cancellationConsequence,
  entitlementBand,
  paidAccessLine,
} from '@/features/billing/manage-membership';
import { PLANS } from '@/features/billing/plans';

/**
 * MB-08 — manage membership, Standard.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · A MANAGEMENT PAGE, NOT A SALES PAGE. No price, no accent, no retention
 *   attempt, and no upsell row.
 * · CORRECTION 36 — the band is the two counters that can be sourced, and
 *   nothing else. The stylist-message and hosted-event rows are gone because
 *   no client read exists for either: the stylist allowance lives server-side
 *   in `claim_ai_quota` and nothing counts live hosted events.
 * · CORRECTION 35 — NO AUTO-DOWNGRADE PROMISE. There is no job that files
 *   overflow into storage, and the free total ceiling is 30, so the overflow
 *   would generally have nowhere to go.
 * · WHAT REPLACES IT IS BETTER NEWS AND IS TRUE: both ceilings are enforced
 *   `before insert` and `before update of is_archived`, so neither fires on an
 *   existing row and a closet already over the line stays whole. Only adding
 *   and restoring stop.
 * · THE ATLAS'S "Cinch will ask, and will not choose for you" IS NOT DRAWN.
 *   That promises a chooser flow, and no such screen, mutation or job exists
 *   anywhere in `src/` or `supabase/` — it is dependency C. Promising a flow
 *   that does not exist is the same defect as promising an automatic one.
 * · "MOVE TO PRO" IS NOT DRAWN EITHER, and the reason is hard rather than
 *   scheduling: it would lead to MB-09, a selling surface whose prices are
 *   live StoreKit reads. This app has no StoreKit module; every price it has
 *   shown came from Superwall rendering its own paywall, and every placement
 *   name is a contract with a campaign that an unmatched name resolves
 *   silently past. The row would be a door that is a wall.
 * · Cancellation is named plainly and says where it actually happens. Cinch
 *   cannot cancel a store subscription and does not pretend to.
 *
 * DETERMINISM: the term date and both counts are literals.
 */
const PERIOD_END = new Date('2027-03-03T00:00:00Z');

export default function DevW3G6MB08() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const band = entitlementBand({ copy: PLANS.standard, used: 148, stored: 12 });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Your membership" />
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-2">
        <Text variant="body">{paidAccessLine(PLANS.standard, PERIOD_END)}</Text>

        <Card padding="none" className="mt-5">
          {band.map((row, i) => (
            <View key={row.label}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <ValueRow label={row.label} value={row.value} />
            </View>
          ))}
        </Card>

        <SectionHeader title="Changing it" className="mb-2.5 mt-6" />
        <Card padding="none">
          <SettingsRow
            label={CANCEL_ROW_LABEL}
            sublabel={CANCEL_ROW_DETAIL}
            external
            onPress={() => undefined}
          />
          <Rule tone="hairline" />
          <SettingsRow label="Restore a purchase" onPress={() => undefined} />
        </Card>

        <Text variant="note" className="mt-5">
          {cancellationConsequence(PERIOD_END)}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
