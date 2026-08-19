import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayExpanded } from '@/components/plan/day-expanded';
import { DayRow } from '@/components/plan/day-row';
import { Text } from '@/components/ui/text';
import { PL_FORECASTS, PL_TODAY, PL_WEEK } from '@/features/plan/w3-g4-fixtures';
import { weekSubtitle } from '@/features/plan/week-lines';

const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * PL-02 — day expanded, occasion present.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The expansion happens IN PLACE. The rows above and below keep their
 *   two-line form and their position; the open day becomes the full plate —
 *   editorial line, complete reasoning, the composed-look grid at four pieces
 *   at 88pt, and the piece list in prose.
 * · The occasion is PRESENT BUT QUIET: it joins the date label in oxblood text
 *   and nothing else on the frame changes shape because a dinner exists.
 * · Keeping a plan is the one oxblood action; asking for another is its peer.
 * · There is no "mark worn" anywhere on this frame. Marking a plan worn happens
 *   on Today or in the diary, never here — and `plan_outfit_tx` deliberately
 *   does not touch `wear_count`, so the screen could not honour one if it drew
 *   it.
 *
 * ── The occasion is CINCH'S, not the device calendar's ────────────────────
 *
 * The atlas annotates this as "calendar title in the label, never stored". The
 * app reads EventKit for TODAY ONLY (`loadTodaysEvents`), so a device-calendar
 * title for Friday is not a fact it holds; what it does hold is its own
 * occasions, already read on the Plan screen for the Events mode, which carry a
 * title and a start time for any day of the week. That is what is drawn.
 *
 * DETERMINISM: `today={PL_TODAY}`, frozen fixture, no clock and no network.
 */
export default function DevW3G4PL02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const [thursday, friday, saturday] = PL_WEEK;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display" trim accessibilityRole="header">
          Your week
        </Text>
        <Text variant="note" className="mt-2">
          {weekSubtitle(PL_TODAY, PL_WEEK.length, PL_FORECASTS)}
        </Text>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        <DayRow day={thursday!} today={PL_TODAY} resolveImage={resolve} onPlan={() => undefined} />

        <DayExpanded
          day={friday!}
          today={PL_TODAY}
          resolveImage={resolve}
          occasion="Sarah’s birthday dinner, 8:00 pm"
          onKeep={() => undefined}
          onTryAnother={() => undefined}
          // The fixture poses the OPEN frame and must keep posing it, so the
          // collapse is inert here. Required rather than optional on the
          // component so a real mount cannot forget the tap's inverse.
          onCollapse={() => undefined}
        />

        <DayRow
          day={saturday!}
          today={PL_TODAY}
          resolveImage={resolve}
          isLast
          onPlan={() => undefined}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
