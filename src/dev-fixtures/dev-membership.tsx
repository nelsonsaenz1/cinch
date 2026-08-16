import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { contextLineFor } from '@/features/billing/context-lines';
import { MembershipThanksView } from '@/features/billing/membership-thanks-view';
import { Placement, type PlacementName } from '@/features/billing/placements';
import { PLANS } from '@/features/billing/plans';

/**
 * DEV ONLY — MB-02/MB-03's six context lines, and MB-06 in both its states,
 * at `cinch://dev-membership`.
 *
 * "Any state without a dev route is a state nobody has looked at" — this
 * wave's own standing rule (see the contract's §9.6). The paywall body
 * itself (MB-01, MB-04, MB-05) is Superwall's document and cannot be
 * previewed from the client at all; everything on THIS screen is app-owned
 * and is exactly the part a simulator pass can and must check.
 */

const CONTEXT_LINE_ROWS: readonly { placement: PlacementName; label: string }[] = [
  { placement: Placement.OpenStylist, label: 'MB-02 · Entered from the stylist' },
  { placement: Placement.AddGarmentOverLimit, label: 'MB-03 · Garment limit' },
  { placement: Placement.GenerateOutfitOverLimit, label: 'MB-03 · Generation limit' },
  { placement: Placement.TrialExpired, label: 'MB-03 · Trial expiry' },
  { placement: Placement.EventHostingOverLimit, label: 'MB-03 · Event hosting' },
];

function LineRow({ label, line }: { label: string; line: string | null }) {
  return (
    <View>
      <Text variant="caption" className="text-muted">
        {label}
      </Text>
      <Text variant="body" className="mt-1">
        {line ?? '(no line — the paywall collapses the block)'}
      </Text>
    </View>
  );
}

export default function DevMembershipScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-2">
        <SectionHeader title="The six context lines" className="mb-2.5" />
        <Card padding="md">
          <View style={{ gap: 16 }}>
            {CONTEXT_LINE_ROWS.map((row) => (
              <LineRow key={row.placement} label={row.label} line={contextLineFor(row.placement)} />
            ))}
            <LineRow
              label="MB-03 · Packing — a trip has been answered"
              line={contextLineFor(Placement.PackingAccess, {
                trip: { destinationName: 'Lisbon', days: 4 },
              })}
            />
            <LineRow
              label="MB-03 · Packing — reached from K-01, before any trip"
              line={contextLineFor(Placement.PackingAccess)}
            />
            <LineRow
              label="repeat_upsell — deliberately no line (MB-01 collapses it)"
              line={contextLineFor(Placement.RepeatUpsell)}
            />
          </View>
        </Card>

        <SectionHeader title="MB-06 · renewal known" className="mb-2.5 mt-8" />
        <Card padding="lg">
          <MembershipThanksView
            loading={false}
            planKnown
            planName={`Cinch ${PLANS.pro.name}`}
            renewsOn="8 August 2027"
            returnLabel="Back to the stylist"
            onBack={() => {}}
            onManage={() => {}}
          />
        </Card>

        <SectionHeader
          title="MB-06 · renewal not yet known — webhook hasn't landed"
          className="mb-2.5 mt-8"
        />
        <Card padding="lg">
          <MembershipThanksView
            loading={false}
            planKnown
            planName={`Cinch ${PLANS.pro.name}`}
            renewsOn={null}
            returnLabel="Back to the trip"
            onBack={() => {}}
            onManage={() => {}}
          />
        </Card>

        <SectionHeader title="MB-06 · confirming plan with the App Store" className="mb-2.5 mt-8" />
        <Card padding="lg">
          <MembershipThanksView
            loading
            planKnown={false}
            planName=""
            renewsOn={null}
            returnLabel="Back to your closet"
            onBack={() => {}}
            onManage={() => {}}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
