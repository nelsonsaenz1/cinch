import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StylistOpening } from '@/components/stylist/sheet-parts';
import { Text } from '@/components/ui/text';
import {
  DENIAL_COPY,
  DOORS,
  LOCAL_FACT_MARK,
  allowanceDisplay,
  allowanceMarkLabel,
  planLine,
  quotaResetLine,
  showsAllowanceMark,
} from '@/features/stylist/stylist-spec';

/**
 * DEV ONLY · Redesign 16 — the openings, the allowance mark and the denials.
 *
 * Deep-linkable — `cinch:///dev-r16-stylist?pose=standard-back-half`. Not a
 * convenience: `simctl` opens URLs and cannot tap, so a state that only a
 * finger can reach has no reproducible evidence.
 *
 * ── WHAT THIS COVERS ────────────────────────────────────────────────────────
 *
 * The frames whose correctness is a matter of WHICH SENTENCE IS SAID and
 * WHETHER A MARK EXISTS: the five plan openings, the neutral loading state,
 * the allowance mark at its threshold, and the four denials that must never
 * read as one another. `dev-stylist` covers the conversation states, and both
 * draw the shipping components rather than copies of them.
 *
 * The door wells are empty here on purpose. Every well on the real screen is a
 * signed image of a garment the reader owns, and a fixture that fabricated one
 * would be checking the fixture — the empty well is also the accepted
 * appearance when a closet has too few pieces to fill four.
 */

type Pose =
  | 'free'
  | 'standard'
  | 'standard-back-half'
  | 'pro'
  | 'trialing'
  | 'plan-loading'
  | 'denial-plan'
  | 'denial-quota'
  | 'denial-consent'
  | 'denial-transport'
  | 'local-fact';

const POSES: readonly Pose[] = [
  'free',
  'standard',
  'standard-back-half',
  'pro',
  'trialing',
  'plan-loading',
  'denial-plan',
  'denial-quota',
  'denial-consent',
  'denial-transport',
  'local-fact',
];

/** plan, trialing, loading, successfulUsed — the server's own shape. */
const PLANS: Partial<Record<Pose, [string, boolean, boolean, number | null]>> = {
  free: ['free', false, false, null],
  standard: ['standard', false, false, 1],
  'standard-back-half': ['standard', false, false, 3],
  pro: ['pro', false, false, null],
  trialing: ['pro', true, false, null],
  'plan-loading': ['', false, true, null],
};

const DENIALS: Partial<Record<Pose, keyof typeof DENIAL_COPY>> = {
  'denial-plan': 'plan_excluded',
  'denial-quota': 'quota',
  'denial-consent': 'consent',
  'denial-transport': 'transport',
};

export default function DevR16Stylist() {
  const params = useLocalSearchParams<{ pose?: string }>();
  const linked = (POSES as readonly string[]).includes(params.pose ?? '')
    ? (params.pose as Pose)
    : 'standard-back-half';

  // The URL is the source of truth; a tap is an override the URL clears.
  const [pose, setPose] = useState<Pose>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPose(linked);
  }

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const plan = PLANS[pose];
  const denial = DENIALS[pose];

  const line = plan ? planLine(plan[0], plan[1], plan[2]) : null;
  const display = plan ? allowanceDisplay(plan[3]) : null;
  const markVisible = plan
    ? showsAllowanceMark({
        plan: plan[0],
        planLoading: plan[2],
        usageLoading: plan[3] === null,
        display,
      })
    : false;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter pt-4">
          <Text variant="eyebrow">Redesign 16 · Stylist</Text>
          <View className="mt-2 flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {POSES.map((p) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={p}
                onPress={() => setPose(p)}
                style={{ minHeight: 44, justifyContent: 'center' }}
                className={p === pose ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
                <Text variant="label">{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {plan ? (
          <View style={{ paddingTop: 20 }}>
            <StylistOpening
              salutation="Evening"
              line="Grey and 63° — a coat kind of day."
              starts={DOORS}
              footer={
                // The mark, and ONLY in the back half. Nothing renders on the
                // full-quota pose, which is the point of the pair.
                markVisible && display ? (
                  <Text variant="note">{allowanceMarkLabel(display.remaining)}</Text>
                ) : line ? (
                  <Text variant="note">{line}</Text>
                ) : null
              }
            />
          </View>
        ) : null}

        {denial ? (
          <View className="px-gutter" style={{ paddingTop: 32 }}>
            <Text variant="title" trim>
              {DENIAL_COPY[denial].title}
            </Text>
            <Text variant="note" className="mt-3">
              {DENIAL_COPY[denial].body}
            </Text>
            {denial === 'quota' ? (
              <Text variant="note" className="mt-2">
                {quotaResetLine('month')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {pose === 'local-fact' ? (
          <View className="px-gutter" style={{ paddingTop: 32 }}>
            <Text variant="body">You own four coats.</Text>
            <Text variant="note" className="mt-2">
              {LOCAL_FACT_MARK}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
