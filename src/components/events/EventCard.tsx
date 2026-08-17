import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatTemp } from '@/features/context/weather';
import { eventCardLabel, eventCardLines } from '@/features/events/event-lines';
import { useRespondToInvite } from '@/features/events/mutations';
import type { EventSummary } from '@/features/events/types';
import { haptics } from '@/lib/haptics';
import type { WeatherContext } from '@/lib/styling';
import { motion, useTheme } from '@/theme/tokens';

/**
 * The pure date helpers this file used to own, re-exported.
 *
 * They moved to `features/events/event-lines.ts` so the test bundler can reach
 * them — esbuild cannot parse React Native's Flow source, so nothing importable
 * from a `.tsx` is testable. The re-export keeps `event/new.tsx`,
 * `event/[id]/invite.tsx` and `features/events/occasion-weather.ts` on the
 * import path they already had.
 */
export {
  daysFromToday,
  FORECAST_WINDOW_DAYS,
  isSameDay,
  timeLabel,
  whenLabel,
} from '@/features/events/event-lines';

/**
 * One word for a day's weather. The thresholds mirror `weatherSymbol` in
 * components/plan/day-row.tsx exactly — one interpretation of the numbers,
 * not a second one.
 */
export function conditionWord(w: WeatherContext): string {
  if (w.precipitationChance >= 0.5) return 'Rain likely';
  if (w.precipitationChance >= 0.25) return 'Maybe rain';
  if (w.windKph >= 25) return 'Windy';
  if (w.feelsLikeC >= 24) return 'Warm';
  if (w.feelsLikeC <= 4) return 'Cold';
  return 'Clear';
}

/**
 * "Feels 72° · Clear" — the display-only weather clause.
 *
 * NO LONGER PRINTED ON A CARD (LP-10). It survives because the occasion's own
 * page still states the forecast once, beside the date it belongs to, and
 * `event/new.tsx` previews it while the date is being chosen. A card is
 * informational, not a miniature detail page.
 */
export function weatherLineFor(w: WeatherContext, units: 'C' | 'F' = 'F'): string {
  return `Feels ${formatTemp(w.feelsLikeC, units)} · ${conditionWord(w)}`;
}

/**
 * An occasion, as a list cell — LP-10's strict hierarchy and nothing else:
 *
 *   1. title + the one actionable state (INVITED, in oxblood);
 *   2. date/time, or `No date yet`;
 *   3. venue, or `No place yet` — the occasion word instead for someone who
 *      has not joined, because §7.1 withholds the place until they do;
 *   4. one compact people/look signal, when there is one worth printing.
 *
 * Everything that decides WHICH of those strings appears lives in
 * `features/events/event-lines.ts`, where it can be tested; this file draws
 * them.
 *
 * Removed by LP-10 and listed so nobody restores one by accident: the weather
 * clause and its "Outside the forecast window" companion, the second headcount
 * beside the title, and the ruled `Your look / Shared` foot. The `weather` prop
 * went with them.
 *
 * DYNAMIC TYPE. The title takes two lines and the date, venue and signal take
 * as many as they need. A one-line clamp on a venue name is exactly the forced
 * truncation the stress board forbids: "The Stanley Hotel & Concert Hall" at
 * AX3 is unreadable as an ellipsis, and the venue is how somebody finds the
 * room.
 */
export function EventCard({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  const theme = useTheme();
  const respond = useRespondToInvite();

  const model = eventCardLines(event);
  const isInvited = model.state !== null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={eventCardLabel(model)}
      className="mb-3 rounded-plate border border-rule bg-surface p-4 active:opacity-70">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="plate" className="flex-1" numberOfLines={2}>
          {model.title}
        </Text>
        {/* The card's one decision, and the only place its oxblood is spent.
            A settled card carries nothing here — the headcount that used to
            sit in this slot is now one clause of the signal line, printed
            once. Inline colour, not a className: `colophon` already carries
            text-muted, and NativeWind gives no precedence between two `text-*`
            utilities on one element (see button.tsx). */}
        {model.state ? (
          <Text variant="colophon" style={{ color: theme.accent }}>
            {model.state}
          </Text>
        ) : null}
      </View>

      <Text variant="label" className="mt-2">
        {model.when}
      </Text>

      {model.where ? (
        <Text variant="label" className="mt-1.5">
          {model.where}
        </Text>
      ) : null}

      {/* The quietest line on the card, and it is `muted` rather than `faint`.
          `faint` (#8A8578) fails AA as text; `muted` (#6B665C) clears it at
          5.46:1 and is the token eyebrows and colophons are already set in.
          The old justification — fourth thing a reader needs, repeated on the
          occasion's own page — argued for quietness, not for illegibility,
          and LP-10 made this line carry real information (`4 of 6 going ·
          Your look shared`) rather than decoration. This file came off the
          FAINT_TEXT_DEBT list in tests/constitution.test.ts in the same
          commit; putting `faint` back here would fail that test.

          It fades IN because it is what an answered invitation settles into:
          the two buttons below dissolve out and the headcount arrives in
          their place. NativeWind's className does not reach Animated.* (the
          css-interop transform only registers plain RN primitives), so
          `mt-1.5` is the inline 6 — the wrapper pattern plan.tsx's mode panes
          already use. */}
      {model.signal ? (
        <Animated.View
          style={{ marginTop: 6 }}
          entering={FadeIn.duration(motion.duration.fast)}>
          <Text variant="label" style={{ color: theme.muted }}>
            {model.signal}
          </Text>
        </Animated.View>
      ) : null}

      {/* The RSVP pair, and its exit. `FadeOut` rather than a hard unmount:
          when the mutation lands the query refetches and this whole block
          disappears in one frame, which reads as the card breaking rather
          than as the answer being taken. Reanimated's timings carry
          `ReduceMotion.System` in this codebase (tokens.ts), so the dissolve
          settles instantly with Reduce Motion on — no separate guard here. */}
      {isInvited ? (
        <Animated.View exiting={FadeOut.duration(motion.duration.fast)}>
          <View className="mt-3.5 flex-row gap-2">
            {/* Ink and outline, never oxblood: accepting a plan is the card's
                primary but not the screen's. hitSlop tops the 40pt row up to
                the 44pt floor.

                The haptics go through `lib/haptics`, not expo-haptics: the
                press is a `selection` (a value changing under the finger) and
                ACCEPTING is a `success` — the intent whose own doc names "an
                invite was accepted". Declining gets the selection tick and
                nothing more; a refusal is not congratulated. */}
            <Pressable
              onPress={() => {
                haptics.selection();
                respond.mutate(
                  { eventId: event.id, response: 'joined' },
                  { onSuccess: () => haptics.success() },
                );
              }}
              disabled={respond.isPending}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Going to ${event.title}`}
              accessibilityState={{ disabled: respond.isPending }}
              style={{ minHeight: 40, backgroundColor: theme.ink }}
              className="flex-1 items-center justify-center rounded-md active:opacity-70">
              <Text variant="label" style={{ color: theme.canvas }}>
                Going
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.selection();
                respond.mutate({ eventId: event.id, response: 'declined' });
              }}
              disabled={respond.isPending}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Can’t make it to ${event.title}`}
              accessibilityState={{ disabled: respond.isPending }}
              style={{ minHeight: 40 }}
              className="flex-1 items-center justify-center rounded-md border border-rule active:opacity-60">
              <Text variant="label">Can’t make it</Text>
            </Pressable>
          </View>
          {/* The refused RSVP says so under the pair it belongs to — quiet,
              inline, announced (the audit's silent-failure note). */}
          {respond.isError ? (
            <View accessibilityLiveRegion="polite">
              <Text variant="noteSmall" className="mt-2" style={{ color: theme.critical }}>
                That didn’t save. Check your connection and try again.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
