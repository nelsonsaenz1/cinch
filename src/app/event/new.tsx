import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { socialDenialCopy, useCreateEvent } from '@/features/events/mutations';
import type { EventVisibility } from '@/features/events/types';
import { isValidReservationUrl, reservationPlatform } from '@/features/events/venue-search';
import { dateKey } from '@/lib/date';
import { useTheme } from '@/theme/tokens';

/**
 * Plan an occasion — one sheet, no wizard.
 *
 * Everything here is MANUAL by founder decision: the host types the title and
 * the venue, picks a day and a time, optionally pastes a reservation link
 * (stored verbatim, deep-linked out from the detail screen). Venue search and
 * calendar import are deliberate seams, parked in
 * `features/events/venue-search.ts` — this form is built to need neither.
 */

/** How far ahead the day picker reaches. Two weeks covers "next Saturday"
 *  twice over; anything further is rare enough to plan closer to the day. */
const DAYS_AHEAD = 14;

/** The occasion vocabulary. Free text in the schema; a fixed set in the UI so
 *  the styling engine downstream meets words it knows. `travel` is the one
 *  the card treats differently (packing, not a single look). */
const OCCASIONS = ['dinner', 'drinks', 'wedding', 'party', 'travel', 'other'] as const;

/** 30-minute steps, kept inside the hours dinner plans actually live in. */
const TIME_STEP = 30;
const TIME_MIN = 6 * 60;
const TIME_MAX = 23 * 60 + 30;

/** "7:30 PM" from minutes-from-midnight. */
function formatMinutes(total: number): string {
  const h24 = Math.floor(total / 60);
  const mm = total % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** A `YYYY-MM-DD` route param as a local calendar date, or null if malformed. */
function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** One circular stepper button — the same 1px-ring grammar as the back button. */
function StepButton({
  symbol,
  onPress,
  disabled,
  label,
}: {
  symbol: SFSymbol;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 36, height: 36 }}
      className={`items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark ${
        disabled ? 'opacity-30' : ''
      }`}>
      <SymbolView name={symbol} size={13} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

export default function NewEventScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  const create = useCreateEvent();

  // The next two weeks of days, today first. Computed once — the list only
  // shifts at midnight, and a render mid-evening does not need to notice.
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const [title, setTitle] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const fromParam = parseDateParam(dateParam);
    return dateKey(fromParam ?? new Date());
  });
  const [minutes, setMinutes] = useState(19 * 60); // 7:00 PM — dinner o'clock
  const [occasion, setOccasion] = useState<(typeof OCCASIONS)[number]>('dinner');
  const [nights, setNights] = useState(1); // travel only; ignored otherwise
  const [partySize, setPartySize] = useState<number | null>(null);
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [reservationUrl, setReservationUrl] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('invite_only');

  const reservationTrimmed = reservationUrl.trim();
  const reservationInvalid =
    reservationTrimmed.length > 0 && !isValidReservationUrl(reservationTrimmed);
  const platform = reservationPlatform(reservationTrimmed || null);

  const canCreate = title.trim().length > 0 && !reservationInvalid && !create.isPending;

  const submit = () => {
    const day = days.find((d) => dateKey(d) === selectedDay) ?? days[0]!;
    const startsAt = new Date(day);
    startsAt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

    // Only travel carries an end date in this pass — the founder's card mock
    // ties multi-day to packing, and a dinner has no meaningful "ends".
    const endsAt =
      occasion === 'travel' ? new Date(startsAt.getTime() + nights * 86_400_000) : null;

    create.mutate(
      {
        title,
        startsAt,
        endsAt,
        partySize,
        occasion,
        dressCode: dressCode || null,
        visibility,
        venueName: venueName || null,
        venueAddress: venueAddress || null,
        reservationUrl: reservationTrimmed || null,
      },
      {
        onSuccess: (eventId) => {
          // Straight into the invite step — an occasion with no guests is a
          // note to self, and the spec drops the host into inviting on create.
          router.replace(`/event/${eventId}`);
          router.push(`/event/${eventId}/invite`);
        },
      },
    );
  };

  const inputClassName =
    'rounded-card border border-hairline px-3.5 py-2.5 font-body text-body text-ink dark:border-hairline-dark dark:text-ink-dark';

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">New occasion</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-16"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="mt-4">
          <Text variant="title" trim>
            Plan an occasion
          </Text>
        </View>

        <Text variant="eyebrow" className="mb-3 mt-7">
          What
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Dinner at Rosemary’s"
          placeholderTextColor={theme.faint}
          maxLength={80}
          accessibilityLabel="Occasion title"
          className={inputClassName}
        />
        <View className="mt-3 flex-row flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Chip
              key={o}
              label={o[0]!.toUpperCase() + o.slice(1)}
              selected={occasion === o}
              onPress={() => setOccasion(o)}
            />
          ))}
        </View>

        <Text variant="eyebrow" className="mb-3 mt-7">
          When
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {days.map((d, i) => (
            <Chip
              key={dateKey(d)}
              label={
                i === 0
                  ? 'Today'
                  : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
              }
              selected={selectedDay === dateKey(d)}
              onPress={() => setSelectedDay(dateKey(d))}
            />
          ))}
        </ScrollView>
        <View className="mt-4 flex-row items-center gap-4">
          <StepButton
            symbol="minus"
            label="Half an hour earlier"
            disabled={minutes <= TIME_MIN}
            onPress={() => setMinutes((m) => Math.max(TIME_MIN, m - TIME_STEP))}
          />
          <Text variant="stat" className="min-w-24 text-center">
            {formatMinutes(minutes)}
          </Text>
          <StepButton
            symbol="plus"
            label="Half an hour later"
            disabled={minutes >= TIME_MAX}
            onPress={() => setMinutes((m) => Math.min(TIME_MAX, m + TIME_STEP))}
          />
        </View>
        {occasion === 'travel' ? (
          <View className="mt-4 flex-row items-center gap-4">
            <StepButton
              symbol="minus"
              label="One night fewer"
              disabled={nights <= 1}
              onPress={() => setNights((n) => Math.max(1, n - 1))}
            />
            <Text variant="stat" className="min-w-24 text-center">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </Text>
            <StepButton
              symbol="plus"
              label="One night more"
              disabled={nights >= 30}
              onPress={() => setNights((n) => Math.min(30, n + 1))}
            />
          </View>
        ) : null}

        <Text variant="eyebrow" className="mb-3 mt-7">
          Where
        </Text>
        {/* Manual by design. When device-local venue search ships it slots in
            here as a typeahead over these same two fields — the seam and its
            reasoning live in features/events/venue-search.ts. */}
        <TextInput
          value={venueName}
          onChangeText={setVenueName}
          placeholder="Venue (optional)"
          placeholderTextColor={theme.faint}
          accessibilityLabel="Venue name"
          className={inputClassName}
        />
        <TextInput
          value={venueAddress}
          onChangeText={setVenueAddress}
          placeholder="City or address (optional)"
          placeholderTextColor={theme.faint}
          accessibilityLabel="Venue city or address"
          className={`${inputClassName} mt-2`}
        />
        <TextInput
          value={reservationUrl}
          onChangeText={setReservationUrl}
          placeholder="Have a reservation? Paste the link"
          placeholderTextColor={theme.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Reservation link"
          className={`${inputClassName} mt-2`}
        />
        {reservationInvalid ? (
          <Text variant="label" className="mt-2 text-critical dark:text-critical">
            Paste the full https:// link.
          </Text>
        ) : platform ? (
          <Text variant="label" className="mt-2 text-muted dark:text-muted-dark">
            Opens in {platform} for everyone who joins.
          </Text>
        ) : null}

        <Text variant="eyebrow" className="mb-3 mt-7">
          Who
        </Text>
        <View className="flex-row items-center gap-4">
          <StepButton
            symbol="minus"
            label="Smaller party"
            disabled={partySize === null}
            onPress={() => setPartySize((n) => (n === null || n <= 2 ? null : n - 1))}
          />
          <Text variant="stat" className="min-w-24 text-center">
            {partySize === null ? 'Any size' : `Table for ${partySize}`}
          </Text>
          <StepButton
            symbol="plus"
            label="Bigger party"
            disabled={partySize !== null && partySize >= 100}
            onPress={() => setPartySize((n) => (n === null ? 2 : Math.min(100, n + 1)))}
          />
        </View>
        <View className="mt-4 flex-row gap-2">
          <Chip
            label="Invite only"
            selected={visibility === 'invite_only'}
            onPress={() => setVisibility('invite_only')}
          />
          <Chip
            label="Friends can ask"
            selected={visibility === 'friends'}
            onPress={() => setVisibility('friends')}
          />
        </View>
        <Text variant="caption" className="mt-2 text-faint dark:text-faint-dark">
          There is no public option. Only people you invite — or, if you allow
          it, your friends — ever know this occasion exists.
        </Text>

        <Text variant="eyebrow" className="mb-3 mt-7">
          Dress
        </Text>
        <TextInput
          value={dressCode}
          onChangeText={setDressCode}
          placeholder="“Cocktail-ish”, “she said wear color” (optional)"
          placeholderTextColor={theme.faint}
          accessibilityLabel="Dress code note"
          className={inputClassName}
        />

        {create.isError ? (
          <Text
            variant="label"
            accessibilityLiveRegion="polite"
            className="mt-6 text-critical dark:text-critical">
            {socialDenialCopy(create.error) ??
              'That didn’t save. Check your connection and try again.'}
          </Text>
        ) : null}

        <Button
          title="Plan it"
          haptic
          loading={create.isPending}
          disabled={!canCreate}
          onPress={submit}
          className="mt-8"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
