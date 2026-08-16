import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayRow } from '@/components/plan/day-row';
import { Text } from '@/components/ui/text';
import { PL_FORECASTS, PL_TODAY, PL_WEEK } from '@/features/plan/w3-g4-fixtures';
import { weekSubtitle } from '@/features/plan/week-lines';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * PL-01 — week populated, six days scannable.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 79 — the outfit's name and its reasoning each get their own line and
 *   BOTH WRAP. No plan on this frame is described by half a sentence, and
 *   nothing is truncated to one line.
 * · audit 80 — three garment photographs at 44×52 stand for the outfit's core
 *   (top, bottom, shoe, read in layout order), with a SILHOUETTE in the same
 *   slot when a piece has no picture. Saturday's row is that case: a merino
 *   crewneck and black jeans described in words, and it loses no legibility.
 *   The images sit in their own 142pt column and the type in the remaining
 *   191pt, so the two never contend for the same space.
 * · Date and weather are ONE uppercase label. A Cinch occasion, where one
 *   exists, joins that label rather than opening a second line.
 * · Nothing on the row implies the outfit was worn: no tick, no filled state,
 *   no past tense. The oxblood checkmark that used to mark a committed day is
 *   gone — a kept plan says "Kept" in a word instead.
 * · "No oxblood spent": no day on this frame has been kept, so the frame
 *   carries no accent at all.
 *
 * The reasoning under each name is the REAL `explain()` over real note keys,
 * not a transcribed string, so the frame is evidence about the app rather than
 * about the fixture.
 *
 * DETERMINISM: `today={PL_TODAY}` is injected into every row. Without it the
 * label's "Today"/"Tomorrow" substitution would be read off the system clock
 * and the frame would change overnight. No clock, no random source, no network.
 */
export default function DevW3G4PL01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display" trim accessibilityRole="header">
          Your week
        </Text>
        {/* The range and the forecast's real spread. The city the atlas prints
            is absent: the week is fetched from coordinates and nothing in the
            app reverse-geocodes them to a place name. */}
        <Text variant="note" className="mt-2">
          {weekSubtitle(PL_TODAY, PL_WEEK.length, PL_FORECASTS)}
        </Text>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        {PL_WEEK.map((day, i) => (
          <DayRow
            key={day.date.toDateString()}
            day={day}
            today={PL_TODAY}
            resolveImage={resolve}
            occasion={i === 1 ? 'Sarah’s birthday dinner, 8:00 pm' : null}
            isLast={i === PL_WEEK.length - 1}
            onPlan={() => undefined}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
