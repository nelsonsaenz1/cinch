import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { Text } from '@/components/ui/text';
import type { EventSummary } from '@/features/events/types';
import type { WeatherContext } from '@/lib/styling';
import { formatTemp } from '@/features/context/weather';
import { useTheme } from '@/theme/tokens';

/**
 * One word for a day's weather. The thresholds mirror `weatherSymbol` in
 * components/plan/day-row.tsx exactly — one interpretation of the numbers,
 * not a second one — because this line sits on the same Plan tab.
 */
function conditionWord(w: WeatherContext): string {
  if (w.precipitationChance >= 0.5) return 'rain likely';
  if (w.precipitationChance >= 0.25) return 'maybe rain';
  if (w.windKph >= 25) return 'windy';
  if (w.feelsLikeC >= 24) return 'warm';
  if (w.feelsLikeC <= 4) return 'cold';
  return 'clear';
}

/** "19° clear" — the display-only weather clause on event surfaces. */
export function weatherLineFor(w: WeatherContext, units: 'C' | 'F' = 'F'): string {
  return `${formatTemp(w.feelsLikeC, units)} ${conditionWord(w)}`;
}

/** "Fri 8 Aug", or "12–16 Sep" for a multi-day occasion. */
function whenLabel(startsAt: Date, endsAt: Date | null): string {
  const sameDay =
    !endsAt ||
    (endsAt.getFullYear() === startsAt.getFullYear() &&
      endsAt.getMonth() === startsAt.getMonth() &&
      endsAt.getDate() === startsAt.getDate());
  if (sameDay) {
    return startsAt.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return startsAt.getMonth() === endsAt.getMonth()
    ? `${startsAt.getDate()}–${endsAt.getDate()} ${month(endsAt)}`
    : `${startsAt.getDate()} ${month(startsAt)} – ${endsAt.getDate()} ${month(endsAt)}`;
}

/** True when this occasion is dressed by packing, not by a single look. */
function isPackingEvent(event: EventSummary): boolean {
  if (event.occasion === 'travel') return true;
  if (!event.endsAt) return false;
  return whenLabel(event.startsAt, event.endsAt).includes('–');
}

type ChipTone = 'sand' | 'accent';

/**
 * The per-VIEWER status chip — the card's one decision. `NEEDS A LOOK` is the
 * single loud element on the Events page (oxblood, spent here and nowhere
 * else); everything settled is quiet sand. LOOK SET currently means "the
 * viewer has shared at least one look" — the closest honest reading of the
 * schema, which has no crowned/chosen state yet (see EventSummary.myLookState).
 */
function statusChip(event: EventSummary): { label: string; tone: ChipTone } | null {
  if (event.myState === 'invited') return { label: 'Invited', tone: 'sand' };
  if (isPackingEvent(event)) return { label: 'Packing', tone: 'sand' };
  if (event.myLookState === 'posted') return { label: 'Look set', tone: 'sand' };
  return { label: 'Needs a look', tone: 'accent' };
}

/** How many faces the cluster shows before collapsing into the count. */
const MAX_AVATARS = 3;

/**
 * An occasion, as a list cell — the founder's event-card mock: serif title
 * with the date set right, a quiet metadata line, then the people row with
 * the status chip. Venue (and the weather beside it) renders for members
 * only; an invitee's card stays coarse until she joins — §7.1 is a product
 * rule, so the withholding happens at the surface even though RLS already
 * handed an invitee the row.
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

  const isMember = event.isHost || event.myState === 'joined';
  const chip = statusChip(event);

  // "Shoreditch · 19° clear" for members; for an invitee just the occasion
  // word — enough to say what kind of night it is, nothing about where.
  const metadata = isMember
    ? [event.venueName, weather ? weatherLineFor(weather, units) : null].filter(Boolean).join(' · ')
    : event.occasion
      ? event.occasion[0]!.toUpperCase() + event.occasion.slice(1)
      : 'You’re invited';

  const going =
    event.invitedCount > event.memberCount
      ? `${event.memberCount} of ${event.invitedCount} going`
      : `${event.memberCount} going`;

  const faces = event.attendees.slice(0, MAX_AVATARS);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        event.title,
        whenLabel(event.startsAt, event.endsAt),
        metadata,
        going,
        chip?.label,
      ]
        .filter(Boolean)
        .join('. ')}
      className="mb-3 rounded-plate border border-rule bg-surface p-4 active:opacity-70 dark:border-rule-dark dark:bg-surface-dark">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="plate" className="flex-1" numberOfLines={1}>
          {event.title}
        </Text>
        <Text variant="label" className="text-muted dark:text-muted-dark">
          {whenLabel(event.startsAt, event.endsAt)}
        </Text>
      </View>

      {metadata ? (
        <Text variant="label" className="mt-1.5 text-muted dark:text-muted-dark" numberOfLines={1}>
          {metadata}
        </Text>
      ) : null}

      <View className="mt-3.5 flex-row items-center">
        {/* The overlapping cluster. Each chip after the first pulls left; the
            surface-coloured ring is what keeps the overlap legible. `name` is
            null exactly for the caller's own chip (`social_profiles` excludes
            self), which `Avatar`'s fallback reads as "ME". */}
        <View className="flex-row">
          {faces.map((a, i) => (
            <View key={a.userId} style={i > 0 ? { marginLeft: -8 } : undefined}>
              <Avatar name={a.name} size={28} fallback="ME" ring />
            </View>
          ))}
        </View>

        <Text variant="label" className="ml-2 flex-1 text-muted dark:text-muted-dark">
          {going}
        </Text>

        {chip ? (
          <View
            className={
              chip.tone === 'accent'
                ? 'rounded-md bg-accent px-2.5 py-1 dark:bg-accent-dark'
                : 'rounded-md bg-sand px-2.5 py-1'
            }>
            {/* Inline colour, not a className — the colophon variant carries
                text-faint, and NativeWind gives no precedence between two
                text-* utilities on one element (see button.tsx). */}
            <Text
              variant="colophon"
              style={{ color: chip.tone === 'accent' ? theme.canvas : theme.muted }}>
              {chip.label}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
