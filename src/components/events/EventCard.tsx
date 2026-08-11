import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatTemp } from '@/features/context/weather';
import { useRespondToInvite } from '@/features/events/mutations';
import type { EventSummary } from '@/features/events/types';
import type { WeatherContext } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * One word for a day's weather. The thresholds mirror `weatherSymbol` in
 * components/plan/day-row.tsx exactly — one interpretation of the numbers,
 * not a second one — because this line sits on the same Plan tab.
 */
export function conditionWord(w: WeatherContext): string {
  if (w.precipitationChance >= 0.5) return 'Rain likely';
  if (w.precipitationChance >= 0.25) return 'Maybe rain';
  if (w.windKph >= 25) return 'Windy';
  if (w.feelsLikeC >= 24) return 'Warm';
  if (w.feelsLikeC <= 4) return 'Cold';
  return 'Clear';
}

/** "Feels 72° · Clear" — the display-only weather clause on event surfaces. */
export function weatherLineFor(w: WeatherContext, units: 'C' | 'F' = 'F'): string {
  return `Feels ${formatTemp(w.feelsLikeC, units)} · ${conditionWord(w)}`;
}

/** True when the occasion starts and ends on one calendar day. A dateless
 *  occasion spans nothing, so it is trivially one day. */
export function isSameDay(startsAt: Date | null, endsAt: Date | null): boolean {
  return (
    !startsAt ||
    !endsAt ||
    (endsAt.getFullYear() === startsAt.getFullYear() &&
      endsAt.getMonth() === startsAt.getMonth() &&
      endsAt.getDate() === startsAt.getDate())
  );
}

/**
 * "Fri 8 Aug", "12–16 Sep" for a multi-day occasion, or "No date yet".
 *
 * The dateless case says so rather than falling back to today: a placeholder
 * date is a claim about when something is happening, and the whole point of
 * an undated occasion is that nobody has made that claim yet.
 */
export function whenLabel(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt) return 'No date yet';
  if (isSameDay(startsAt, endsAt)) {
    return startsAt.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return startsAt.getMonth() === endsAt!.getMonth()
    ? `${startsAt.getDate()}–${endsAt!.getDate()} ${month(endsAt!)}`
    : `${startsAt.getDate()} ${month(startsAt)} – ${endsAt!.getDate()} ${month(endsAt!)}`;
}

/** "4:00pm" — set close and lowercase, the atlas's register; 24-hour locales
 *  come through untouched ("16:00" has no dayPeriod to fold). Null in, null
 *  out: no date means no time, and callers drop the segment rather than
 *  printing an hour nobody chose. */
export function timeLabel(d: Date | null): string | null {
  if (!d) return null;
  return d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
}

/**
 * Mirrors `WEEK_DAYS` in plan.tsx — the Plan tab fetches a seven-day
 * forecast, so any day past that horizon has no honest weather to print.
 */
export const FORECAST_WINDOW_DAYS = 7;

/** Whole days between today and `d`, local calendar. A dateless occasion is
 *  -1 — the same answer as a day already gone, and for the same reason: both
 *  are outside every forecast, so every caller's `>= 0` gate refuses them. */
export function daysFromToday(d: Date | null): number {
  if (!d) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/**
 * An occasion, as a list cell — the Plan atlas's event card (P-06): serif
 * title with a quiet caps tag set right (INVITED in oxblood for an unanswered
 * invitation, "4 GOING" in the muted register once that question is settled),
 * a metadata line, a weather line that prints only inside the forecast window
 * and says "Outside the forecast window" beyond it rather than guessing, the
 * Going / Can't-make-it pair on an invitation, and the ruled "Your look" foot
 * once the viewer has shared one.
 *
 * Venue, time and weather render for members only; an invitee's card stays
 * coarse until she joins — §7.1 is a product rule, so the withholding happens
 * at the surface even though RLS already handed an invitee the row. (The
 * atlas draws the invitation card with its venue in view; the product rule
 * wins until the spec says otherwise.)
 */
export function EventCard({
  event,
  weather,
  units = 'F',
  onPress,
}: {
  event: EventSummary;
  /** The event day's forecast, when the caller has one. Display-only. */
  weather?: WeatherContext | null;
  units?: 'C' | 'F';
  onPress: () => void;
}) {
  const theme = useTheme();
  const respond = useRespondToInvite();

  const isMember = event.isHost || event.myState === 'joined';
  const isInvited = event.myState === 'invited';

  const going =
    event.invitedCount > event.memberCount
      ? `${event.memberCount} of ${event.invitedCount} going`
      : `${event.memberCount} going`;

  // "Sat 9 Aug · 4:00pm · The Stanley, Denver" for members; for an invitee
  // just the date and the occasion word — enough to say what kind of night it
  // is, nothing about where.
  const when = whenLabel(event.startsAt, event.endsAt);
  const metadata = isMember
    ? [when, isSameDay(event.startsAt, event.endsAt) ? timeLabel(event.startsAt) : null, event.venueName]
        .filter(Boolean)
        .join(' · ')
    : [
        when,
        event.occasion ? event.occasion[0]!.toUpperCase() + event.occasion.slice(1) : 'You’re invited',
      ].join(' · ');

  // Weather prints only when the day falls inside the seven-day window; past
  // it the card says so plainly instead of guessing. An in-window day whose
  // forecast simply hasn't arrived yet prints nothing — absence, not a claim.
  // A dateless occasion prints nothing either, and not even "outside the
  // window": there is no day for weather to belong to, so any forecast handed
  // in for it would be some other day's.
  const contextLine = !isMember
    ? going
    : !event.startsAt
      ? null
      : weather
        ? weatherLineFor(weather, units)
        : daysFromToday(event.startsAt) >= FORECAST_WINDOW_DAYS
          ? 'Outside the forecast window'
          : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        event.title,
        isInvited ? 'Invited' : null,
        metadata,
        contextLine,
        going,
        isMember && event.myLookState === 'posted' ? 'Your look shared' : null,
      ]
        .filter(Boolean)
        .join('. ')}
      className="mb-3 rounded-plate border border-rule bg-surface p-4 active:opacity-70">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="plate" className="flex-1" numberOfLines={1}>
          {event.title}
        </Text>
        {/* The card's one decision. An unanswered invitation is the loud
            state — oxblood, spent here and nowhere else on the card; a
            settled card carries only its headcount, in the quiet register.
            Inline colour, not a className — the colophon variant carries
            text-muted, and NativeWind gives no precedence between two
            text-* utilities on one element (see button.tsx). */}
        <Text
          variant="colophon"
          style={{ color: isInvited ? theme.accent : theme.faint }}>
          {isInvited ? 'Invited' : `${event.memberCount} going`}
        </Text>
      </View>

      {metadata ? (
        <Text variant="label" className="mt-2" numberOfLines={1}>
          {metadata}
        </Text>
      ) : null}

      {contextLine ? (
        <Text variant="label" className="mt-1.5" style={{ color: theme.faint }} numberOfLines={1}>
          {contextLine}
        </Text>
      ) : null}

      {isInvited ? (
        <>
          <View className="mt-3.5 flex-row gap-2">
            {/* Ink and outline, never oxblood: accepting a plan is the card's
                primary but not the screen's. hitSlop tops the 40pt row up to
                the 44pt floor. */}
            <Pressable
              onPress={() => respond.mutate({ eventId: event.id, response: 'joined' })}
              disabled={respond.isPending}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Going to ${event.title}`}
              accessibilityState={{ disabled: respond.isPending }}
              style={{ minHeight: 40, backgroundColor: theme.ink }}
              className="flex-1 items-center justify-center rounded-md active:opacity-70">
              <Text variant="label" className="font-semibold" style={{ color: theme.canvas }}>
                Going
              </Text>
            </Pressable>
            <Pressable
              onPress={() => respond.mutate({ eventId: event.id, response: 'declined' })}
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
              <Text variant="caption" className="mt-2" style={{ color: theme.critical }}>
                That didn’t save. Check your connection and try again.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {isMember && event.myLookState === 'posted' ? (
        // The atlas foot draws the chosen look's swatch trio and "Chosen";
        // EventSummary carries neither the look's colours nor a crowned state
        // yet (see types.ts on myLookState), so until the schema widens this
        // prints the honest half: the row, and the fact a look is shared.
        <View className="mt-3 flex-row items-center gap-2 border-t border-rule pt-3">
          <Text variant="eyebrow">Your look</Text>
          <Text variant="label" className="ml-auto" style={{ color: theme.faint }}>
            Shared
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
