import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import { membershipRowFor, type MembershipRowInput } from '@/features/billing/membership-row';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * PR-02 — the membership row in four states. A comparison frame: only one of
 * these is ever on screen in the shipping app.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · CORRECTION 31 — the row is a SUPABASE SUBSCRIPTION READ, not a store call.
 *   `usePlan()` selects `plan, trial_ends_at, current_period_end`; that is the
 *   whole source, and `membershipRowFor` is the whole mapping.
 * · READING IS ITS OWN STATE rather than a silent fallback to Free. The
 *   fallback is indistinguishable from a real answer, which is how a member on
 *   a slow network gets told they are not one.
 * · ON A FAILED READ the row says it cannot confirm, offers a retry, and omits
 *   any date — a guessed date on a failed read is worse than none. It also
 *   says nothing is locked, which is true: the server checks entitlements
 *   independently of this read.
 * · TRIAL IS SHOWN ONLY WHEN THE READ RETURNS ONE. Nothing here assumes a
 *   trial exists, and no duration is drawn — correction 06 governs that, and a
 *   placement named `trialing` does not prove a configured offer.
 * · CORRECTION 30 — there is NO Free row. The frozen contract describes no Free
 *   membership object, so `visible` is false and nothing draws.
 * · NO PRICE APPEARS IN ANY OF THE FOUR. A settings row is a layout, and a
 *   price typed into a layout is wrong in every country but one.
 *
 * DETERMINISM: both dates are literals; nothing reads the clock.
 */
const STATES: readonly (readonly [string, MembershipRowInput])[] = [
  [
    'Reading',
    { plan: 'free', paid: false, trialing: false, trialEndsAt: null, currentPeriodEnd: null, loading: true, unconfirmed: false },
  ],
  [
    'Standard, active',
    {
      plan: 'standard',
      paid: true,
      trialing: false,
      trialEndsAt: null,
      currentPeriodEnd: new Date('2027-03-03T00:00:00Z'),
      loading: false,
      unconfirmed: false,
    },
  ],
  [
    'Pro, in trial',
    {
      plan: 'pro',
      paid: false,
      trialing: true,
      trialEndsAt: new Date('2026-09-12T00:00:00Z'),
      currentPeriodEnd: null,
      loading: false,
      unconfirmed: false,
    },
  ],
  [
    'Read failed',
    { plan: 'free', paid: false, trialing: false, trialEndsAt: null, currentPeriodEnd: null, loading: false, unconfirmed: true },
  ],
];

export default function DevW3G6PR02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="title" trim accessibilityRole="header">
          Membership row
        </Text>
        <Text variant="note" className="mt-3">
          One row shape, four reads. Only one is on screen.
        </Text>

        {STATES.map(([title, input]) => {
          const row = membershipRowFor(input);
          return (
            <Fragment key={title}>
              <SectionHeader title={title} className="mb-2.5 mt-6" />
              <Card padding="none">
                {row.chevron ? (
                  <SettingsRow label={row.label} sublabel={row.value} onPress={() => undefined} />
                ) : (
                  <View
                    className="flex-row items-center justify-between gap-3 px-4 py-3.5"
                    style={{ minHeight: MIN_TAP_TARGET }}>
                    <View className="flex-1">
                      <Text variant="body">{row.label}</Text>
                      {row.value ? (
                        <Text variant="note" className="mt-1">
                          {row.value}
                        </Text>
                      ) : null}
                    </View>
                    {row.retry ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry reading your membership"
                        onPress={() => undefined}
                        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                        className="flex-none">
                        <Text variant="label" className="text-ink">
                          Retry
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </Card>
            </Fragment>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
