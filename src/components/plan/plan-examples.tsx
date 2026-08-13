import { View } from 'react-native';

import { ExampleCard, ExampleGarments, ExampleMonogram } from '@/components/examples/example-card';
import { Text } from '@/components/ui/text';
import { PL_C1, PL_C2, PL_C3 } from '@/features/examples/example-copy';

/**
 * PL-C1 / PL-C2 / PL-C3 — the three Plan empty states, showing what they become.
 *
 * ── WHAT THIS REPLACED, AND WHY IT HAD TO GO ──────────────────────────────
 *
 * `example-ghosts.tsx` drew the same three sections as GHOST FURNITURE: grey
 * bars at the real layout's proportions, in the `ghost` voice, trailing off
 * behind a canvas fade. It was careful work and it was the wrong picture. A row
 * of grey bars is the universal sign for "this is still loading", so an empty
 * Plan looked like a broken Plan — and the acceptance check the correction
 * writes is exactly that: "Example is composed of garment photographs — not
 * rectangles, wireframes or skeletons — and does not shimmer."
 *
 * So the ghosts are gone and what stands in their place is finished content:
 * real garment photographs, real sentences, a labelled card. It is fiction, and
 * it says so on itself, twice — once on the badge and once in the caption.
 *
 * ── WHAT STAYED THE SAME ──────────────────────────────────────────────────
 *
 * Every inert rule the ghosts obeyed, now enforced in one place by
 * `ExampleCard`: no touch, no VoiceOver descendants, one summary, no motion.
 * And the controls AROUND these — the tab strip, "New event", "New trip", the
 * primary button above each one — are untouched and fully operable. An example
 * never becomes the thing it depicts.
 */

/** Mon…Sun, from the week the strip above is showing. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * PL-C1 — a planned week. Three days, not seven.
 *
 * "A plausible week rather than a demo of completeness": a week with every day
 * filled is a picture of an app nobody could keep up with.
 *
 * The day numbers are the ONE dynamic thing in any example in this app. They
 * follow the selected week so the card cannot contradict the strip above it —
 * an example showing the 11th under a strip showing the 18th reads as stale
 * data rather than as fiction. The occasions and the weather stay fixed
 * fictional strings: no forecast call is made for an example.
 */
export function ExampleWeek({ weekStart }: { weekStart: Date }) {
  return (
    <View className="px-gutter pb-6 pt-2">
      <ExampleCard id="PL-C1" title={PL_C1.title} caption={PL_C1.caption}>
        {PL_C1.days.map((day, i) => {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + day.weekdayIndex);

          return (
            <View
              key={day.occasion}
              className={i > 0 ? 'mt-3.5 border-t border-hairline pt-3.5' : ''}>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View style={{ width: 34 }}>
                  <Text variant="noteSmall">{WEEKDAYS[day.weekdayIndex]}</Text>
                  <Text variant="statSmall">{date.getDate()}</Text>
                </View>
                <ExampleGarments pieces={day.pieces} size={44} />
                <View className="flex-1">
                  <Text variant="note" numberOfLines={1}>
                    {day.occasion}
                  </Text>
                  <Text variant="noteSmall" numberOfLines={1}>
                    {day.weather}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ExampleCard>
    </View>
  );
}

/**
 * PL-C2 — two events, one crowded and one quiet.
 *
 * The asymmetry is the point: two equally busy events would imply that a busy
 * social life is the price of entry. The board lines under each state real
 * product behaviour — looks open before the event and lock at its start — so
 * the example teaches something that is actually true when the reader gets
 * there. No follower counts and no public audience: there is neither.
 */
export function ExampleEvents() {
  return (
    <View className="px-gutter pb-6 pt-2">
      <ExampleCard id="PL-C2" title={PL_C2.title} caption={PL_C2.caption}>
        {PL_C2.events.map((event, i) => (
          <View key={event.name} className={i > 0 ? 'mt-4 border-t border-hairline pt-4' : ''}>
            <ExampleGarments pieces={event.pieces} size={54} />
            <Text variant="note" className="mt-2.5" numberOfLines={1}>
              {event.name}
            </Text>
            <Text variant="noteSmall">{`${event.date} · ${event.where}`}</Text>
            <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
              {event.monograms.map((letter) => (
                <ExampleMonogram key={letter} letter={letter} size={22} />
              ))}
              <Text variant="noteSmall" className="flex-1">
                {event.board}
              </Text>
            </View>
          </View>
        ))}
      </ExampleCard>
    </View>
  );
}

/**
 * PL-C3 — the packed trip, shown before the gate.
 *
 * The order is deliberate and it is the whole correction: the payoff, then the
 * price of it. Two of five days and the piece list, so the shape of a packed
 * trip is legible without the card claiming to be complete.
 *
 * The dates are fictional and FIXED — deliberately not derived from today —
 * because a relative date here would eventually render as a trip that ended
 * last week, and an example that reads as expired data is worse than no
 * example.
 */
export function ExampleTrip() {
  return (
    <ExampleCard id="PL-C3" title={PL_C3.title} caption={PL_C3.caption}>
      <View className="flex-row items-baseline" style={{ gap: 8 }}>
        <Text variant="plate">{PL_C3.place}</Text>
        <Text variant="noteSmall">{PL_C3.dates}</Text>
      </View>
      <Text variant="noteSmall" className="mt-0.5">
        {PL_C3.summary}
      </Text>

      {PL_C3.days.map((day) => (
        <View key={day.label} className="mt-3 flex-row items-center" style={{ gap: 12 }}>
          <View style={{ width: 46 }}>
            <Text variant="noteSmall">{day.label}</Text>
            <Text variant="noteSmall">{day.occasion}</Text>
          </View>
          <ExampleGarments pieces={day.pieces} size={44} />
        </View>
      ))}

      <View className="mt-4 border-t border-hairline pt-3">
        <Text variant="noteSmall">{PL_C3.piecesToTakeLabel}</Text>
        <View className="mt-2">
          <ExampleGarments pieces={PL_C3.piecesToTake} size={38} />
        </View>
      </View>
    </ExampleCard>
  );
}
