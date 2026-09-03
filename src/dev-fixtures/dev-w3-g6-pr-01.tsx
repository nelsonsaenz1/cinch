import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ToggleRow, ValueRow } from '@/components/ui/settled-row';
import { Text } from '@/components/ui/text';
import { membershipRowFor } from '@/features/billing/membership-row';
import { PLANS } from '@/features/billing/plans';
import { SHOW_WHERE_TO_BUY_DETAIL, SHOW_WHERE_TO_BUY_LABEL } from '@/features/commerce/copy';

/**
 * PR-01 — the profile sheet's rows, with membership still being read.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · CORRECTION 29 — Profile is a form sheet dismissed with Done, presented
 *   from Today's avatar. It is not a fifth tab and never was in this
 *   repository: `profile.tsx` has been a modal with a "Done" header since it
 *   was written, so the atlas's "previous behaviour" (an invented
 *   Today/Closet/You bar) describes a drawing rather than this app.
 * · CORRECTION 30 — MEASURED COUNTERS ONLY. Active and stored pieces are read
 *   off `items` against the plan's two ceilings, which mirror the two database
 *   triggers. The weekly outfit-usage read is gone because no such counter
 *   exists anywhere, and the global borrowing toggle is gone because lending is
 *   decided per garment (`items.borrowable`), never per account.
 * · CORRECTION 31 — the membership row prints "Checking…" rather than assuming
 *   Free. A Supabase read in flight is not an answer, and a row that fell back
 *   to Free would present a safety default as a fact about somebody's money.
 * · Show where to buy prints its state AS A WORD, so no preference rides on
 *   the track colour alone.
 * · No oxblood anywhere on these rows. The one accent-toned row in the whole
 *   app is Delete account, which is further down the real sheet.
 * · The free ceilings are 10 and 30, from `PLANS.free` — the atlas draws
 *   "4 of 20", which contradicts its own MB-08 page ("the Free total ceiling
 *   is 30"). The code is the authority and 30 is what prints.

/**
 * WHY THIS IS THE ROW SYSTEM AND NOT THE SHEET
 *
 * `profile.tsx` is six live queries deep — the header, the plan, the capacity
 * count, the style profile, the borrow requests and the blocked list — and a
 * fixture that seeded all six would be seeding react-query keys, not looking at
 * a screen. What PR-01 is actually an acceptance test OF is the settled row:
 * its geometry, its value placement, its toggle state-as-a-word and its 44pt
 * floor. Those are the components below, and they are the same ones the sheet
 * mounts — `ValueRow`, `ToggleRow`, `SettingsRow` and `membershipRowFor`, each
 * imported, none re-drawn. The sheet's own arrangement of them is checked on
 * the simulator against the real screen.
 */
export default function DevW3G6PR01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const membership = membershipRowFor({
    plan: 'free',
    paid: false,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    loading: true,
    unconfirmed: false,
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="title" trim accessibilityRole="header">
          Maya Fitzgerald
        </Text>
        <Text variant="caption" className="mt-1.5 text-muted">
          @mayaf
        </Text>

        <Card padding="none" className="mt-5">
          <ValueRow label="Active pieces" value={`10 of ${PLANS.free.items}`} />
          <Rule tone="hairline" />
          <ValueRow label="Stored pieces" value={`4 of ${PLANS.free.storedItems}`} />
        </Card>

        <SectionHeader title="Membership" className="mb-2.5 mt-6" />
        <Card padding="none">
          <View className="px-4 py-3.5" style={{ minHeight: 44 }}>
            <Text variant="body">{membership.label}</Text>
            <Text variant="note" className="mt-1">
              {membership.value}
            </Text>
          </View>
        </Card>

        <SectionHeader title="Settings" className="mb-2.5 mt-6" />
        <Card padding="none">
          <SettingsRow label="Notifications" onPress={() => undefined} />
          <Rule tone="hairline" />
          <SettingsRow label="Privacy & data" onPress={() => undefined} />
          <Rule tone="hairline" />
          <ToggleRow
            label={SHOW_WHERE_TO_BUY_LABEL}
            state={`On — ${SHOW_WHERE_TO_BUY_DETAIL}`}
            value
            onValueChange={() => undefined}
          />
          <Rule tone="hairline" />
          <SettingsRow label="Blocked people" detail="3" onPress={() => undefined} />
          <Rule tone="hairline" />
          <SettingsRow label="Help" onPress={() => undefined} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
