import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayRow, DayRowBuilding, DayRowUnplanned } from '@/components/plan/day-row';
import { NoticeBand } from '@/components/ui/notice-band';
import { Text } from '@/components/ui/text';
import { PL_PARTIAL_WEEK, PL_TODAY } from '@/features/plan/w3-g4-fixtures';
import { weekProgressLine } from '@/features/plan/week-lines';

const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * PL-03 — partial week, planning failed, offline.
 *
 * Three states on one frame BECAUSE THEY CO-OCCUR IN PRACTICE. In the running
 * app one is on screen at a time; drawn together here so their wording can be
 * compared, which is the atlas's own reason for the composition.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The masthead's progress is a COUNT — "Three days planned, four to go" —
 *   never a bar and never a percentage. Both halves are counted from the days
 *   the screen is showing.
 * · A day being planned keeps its date label and shows placeholders in the
 *   EXACT geometry the plan will occupy: the same 142pt image column, the same
 *   two type lines. Nothing moves when the plan lands. No shimmer and no
 *   spinner, so the frame can be captured.
 * · An unplanned day says so IN WORDS and offers the one action that fills it.
 *   It is not an empty card and not a dashed outline.
 * · A failure is SCOPED TO ITS DAY and names what it did not touch. The two
 *   recoveries are peers — one automatic, one manual — and neither is filled.
 * · Offline prints the TIME THE WEEK WAS READ rather than "a while ago", names
 *   the weather as the stale part, and confirms the plans themselves are local
 *   and editable.
 *
 * DETERMINISM: `today={PL_TODAY}`; the offline band's "8:02 this morning" is a
 * literal in this file rather than a formatted `Date.now()`, for the same
 * reason the rest of the fixture is frozen.
 */
export default function DevW3G4PL03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const [thursday, friday, saturday] = PL_PARTIAL_WEEK;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display" trim accessibilityRole="header">
          Your week
        </Text>
        <Text variant="note" className="mt-2">
          {weekProgressLine(3, 7)}
        </Text>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        {/* Planned and kept. */}
        <DayRow
          day={thursday!}
          today={PL_TODAY}
          resolveImage={resolve}
          planned
          onPlan={() => undefined}
        />

        {/* Being planned — the skeleton mirrors the day row exactly. */}
        <DayRowBuilding day={{ ...friday!, outfit: null }} today={PL_TODAY} />

        {/* Nothing planned, and the one action that fills it. */}
        <DayRowUnplanned day={saturday!} today={PL_TODAY} onPlan={() => undefined} />

        {/* Per-day failure, not per-week. */}
        <NoticeBand
          className="mx-gutter mt-4"
          cause="Planning failed"
          title="Friday could not be saved"
          body="The other days are unaffected and stay as they are. Nothing was removed from your week."
          actions={[
            { label: 'Try Friday again', onPress: () => undefined },
            { label: 'Choose it myself', onPress: () => undefined },
          ]}
        />

        {/* Offline — the stale time printed, and what is stale named. */}
        <NoticeBand
          className="mx-gutter mt-3"
          cause="Offline"
          title="Showing the week as of 8:02 this morning"
          body="Weather may have moved since then. Your plans are stored on this phone and are safe to read and change."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
