import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { DateRangePicker } from '@/components/plan/date-range-picker';
import {
  NewTripBody,
  type NewTripChip,
  type NewTripMatch,
  type NewTripView,
} from '@/components/plan/new-trip-body';
import { Text } from '@/components/ui';
import { useFriends } from '@/features/social-graph/queries';
import { fetchClimateBand, formatTemp, searchPlaces, type Place } from '@/features/context/weather';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import {
  NEW_TRIP_COPY,
  NEW_TRIP_STACK_SCALE,
  canLeaveStep,
  progressDots,
  tripDatesLine,
  weatherMark,
} from './new-trip-spec';
import { looksSentence } from './packing-math';
import {
  COMPANIONS,
  DAY_PARTS,
  TRIP_QUESTIONS,
  VIBES,
  daysBetween,
  toIsoDate,
  type Trip,
} from './trip';
import { useRecentDestinations } from './use-trips';
import { useTripQuestionnaire, type TripQuestionnaireDevSeed } from './use-trip-questionnaire';

/**
 * Three questions before anything is packed. Redesign 05.
 *
 * This file holds the queries and hands one plain object to `NewTripBody`.
 * Nothing here draws — the split the Plan week, the event poster and the trips
 * shelf all make, and the reason is the same every time: a screen that reaches
 * for a geocoder, a climate archive and the social graph at the top cannot be
 * posed, and the accepted frames have to be openable without a session.
 *
 * ── WHAT CHANGED, AND WHAT DID NOT ───────────────────────────────────────────
 *
 * The ASKING was restyled into a stepped card flow — one question per card,
 * three progress dots, 48pt chips, a pinned 56pt CTA, and the destination's
 * weather mark riding above questions two and three once a real climate band
 * resolves. The ANSWERS are untouched: the same `Trip` with the same
 * destination, companions, dates, vibes and parts, the same closed
 * vocabularies, the same `Place` from the geocoder rather than the string
 * typed. `formalityFor` and `lookSchedule` read exactly what they read before.
 *
 * Free text still appears exactly once, in the destination search.
 *
 * ── THE GATE IS NOT HERE ─────────────────────────────────────────────────────
 *
 * `PackingTab` checks `usePackingAccess` BEFORE it renders this component, and
 * it fails closed: a free account gets the locked plate and the `packing_access`
 * placement, and never reaches a question. Nothing in this file reads a plan or
 * presents a placement, which is what makes that ordering checkable —
 * `tests/new-trip-layout.test.ts` pins it.
 */

/**
 * The old atlas's chip, kept for the wave-3 fixture routes that still draw it.
 *
 * `dev-packing-questions.tsx` poses the PK-01…PK-03 states as they were
 * accepted, and a fixture whose components have been deleted is a fixture that
 * stops compiling. The LIVE flow's chip is `NewTripChip` in `new-trip-body.tsx`
 * and looks nothing like this one — selection is a fill now, per §1 of the
 * directive.
 */
export function AnswerChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={[
        'flex-row items-center justify-center gap-2 rounded-md border px-4 active:opacity-60',
        selected ? 'border-ink' : 'border-rule',
      ].join(' ')}>
      {selected ? (
        <SymbolView name="checkmark" size={12} tintColor={theme.ink} resizeMode="scaleAspectFit" />
      ) : null}
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/**
 * One destination result — the geocoder's answer, plus the climate band that
 * tells two same-named places apart (K-02).
 *
 * Kept exported for the wave-3 fixture route, like `AnswerChip` above. The live
 * flow draws `MatchRow` inside `new-trip-body.tsx`.
 */
export function PlaceRow({
  place,
  band,
  onPick,
  units = 'F',
}: {
  place: Place;
  band: { lowC: number; highC: number } | null;
  onPick: (place: Place) => void;
  /** The app's own scale, not the atlas's. See `packing-memo.ts`. */
  units?: 'C' | 'F';
}) {
  const where = [place.admin1, place.country].filter(Boolean).join(', ');
  const subtitle = band
    ? `${formatTemp(band.lowC, units).replace('°', '')}–${formatTemp(band.highC, units)}`
    : null;

  return (
    <Pressable
      onPress={() => onPick(place)}
      accessibilityRole="button"
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 active:opacity-60">
      <View className="flex-1">
        <Text variant="body">{place.name}</Text>
        {where ? <Text variant="label">{where}</Text> : null}
      </View>
      {subtitle ? <Text variant="label">{subtitle}</Text> : null}
    </Pressable>
  );
}

/** K-02's "Recent" row, kept for the same fixture route. */
export function RecentChips({ places, onPick }: { places: Place[]; onPick: (place: Place) => void }) {
  if (!places.length) return null;
  return (
    <View className="mt-6">
      <Text variant="label">Recent</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {places.map((place) => (
          <AnswerChip
            key={`${place.name}-${place.latitude}-${place.longitude}`}
            label={place.name}
            onPress={() => onPick(place)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The live flow
// ---------------------------------------------------------------------------

const placeKey = (place: Place) => `${place.name}-${place.latitude}-${place.longitude}`;

export function TripQuestionnaire({
  onComplete,
  onAbandon,
  devSeed,
}: {
  onComplete: (trip: Trip) => void;
  /**
   * Leaving the first card backwards. Absent by default, which is today's
   * behaviour exactly: the flow is a tab, so abandoning it is choosing another
   * segment, and the held run survives that untouched (`use-trip-questionnaire`).
   */
  onAbandon?: () => void;
  /** Dev-only: opens the flow already partway answered. See the hook. */
  devSeed?: TripQuestionnaireDevSeed;
}) {
  const q = useTripQuestionnaire(onComplete, devSeed);
  const { fontScale } = useWindowDimensions();

  /** The typed string, seeded from an answer already given so Back restores it. */
  const [query, setQuery] = useState(() => q.draft.destination?.name ?? '');

  const recent = useRecentDestinations();
  const friends = useFriends();

  const trimmed = query.trim();
  /**
   * The search runs only while the field disagrees with the answer.
   *
   * Once a place is chosen the field carries its name, and re-issuing the same
   * query would redraw the match list underneath the answered field — the user
   * would appear to have to choose the city twice.
   */
  const settled = q.draft.destination !== null && trimmed === q.draft.destination.name;

  const places = useQuery({
    queryKey: ['places', trimmed],
    enabled: trimmed.length >= 2 && !settled,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => searchPlaces(trimmed, signal),
  });

  /**
   * The destination's climate band — the frames' weather mark.
   *
   * Read for the trip's FIRST DAY when there is one, and for today before the
   * dates are answered, so the mark on card two is about the place and the mark
   * on card three is about the trip. `fetchClimateBand` is the same archive read
   * `PlaceRow` has always made; no new endpoint and no new contract.
   */
  const today = useMemo(() => toIsoDate(new Date()), []);
  const destination = q.draft.destination;
  const bandOn = q.draft.startsOn ?? today;

  const band = useQuery({
    queryKey: ['packing-climate-band', destination?.name, destination?.latitude, destination?.longitude, bandOn],
    enabled: destination !== null,
    staleTime: 60 * 60_000,
    queryFn: ({ signal }) =>
      fetchClimateBand(destination!.latitude, destination!.longitude, bandOn, signal),
  });

  const mark = weatherMark(band.data ?? null, (c) => formatTemp(c, 'F'));

  const tripLength =
    q.draft.startsOn && q.draft.endsOn ? daysBetween(q.draft.startsOn, q.draft.endsOn) : null;

  const canAdvance = canLeaveStep(q.step, q.draft);

  const view: NewTripView = {
    index: q.index,
    total: q.total,
    question: TRIP_QUESTIONS[q.step],
    onBack: q.canGoBack ? q.back : null,
    onClose: q.canGoBack ? null : (onAbandon ?? null),

    ctaLabel: q.step === 'shape' ? NEW_TRIP_COPY.build : NEW_TRIP_COPY.next,
    ctaEnabled: canAdvance,
    onCta: () => {
      if (!canAdvance) return;
      if (q.step === 'shape') q.complete();
      else q.next(q.step);
    },

    destination:
      q.step === 'destination'
        ? {
            query,
            onQuery: setQuery,
            chosen: settled,
            matches: settled
              ? []
              : (places.data ?? []).map(
                  (place): NewTripMatch => ({
                    key: placeKey(place),
                    name: place.name,
                    // The region carries most of the disambiguation for
                    // same-named places inside one country.
                    sub: [place.admin1, place.country].filter(Boolean).join(', ') || null,
                    onPick: () => {
                      setQuery(place.name);
                      q.set('destination', { destination: place });
                    },
                  }),
                ),
            // Absent for a first trip — no placeholders, never an invented Lisbon.
            recents: (recent.data ?? []).map(
              (place): NewTripMatch => ({
                key: placeKey(place),
                name: place.name,
                sub: null,
                onPick: () => {
                  setQuery(place.name);
                  q.set('destination', { destination: place });
                },
              }),
            ),
          }
        : null,

    // Card one is the destination's own card, so it does not restate it.
    placeCard:
      q.step !== 'destination' && destination
        ? {
            name: destination.name,
            dates:
              q.draft.startsOn && q.draft.endsOn
                ? tripDatesLine(q.draft.startsOn, q.draft.endsOn)
                : null,
            mark,
          }
        : null,

    shape:
      q.step === 'shape'
        ? {
            purposes: VIBES.map(
              (v): NewTripChip => ({
                key: v.key,
                label: v.label,
                selected: q.draft.vibes.includes(v.key),
                onToggle: () => q.toggleVibe(v.key),
              }),
            ),
            companions: COMPANIONS.map(
              (c): NewTripChip => ({
                key: c.key,
                label: c.label,
                selected: q.draft.companions === c.key,
                onToggle: () => q.set('shape', { companions: c.key }),
              }),
            ),
            parts: DAY_PARTS.map(
              (p): NewTripChip => ({
                key: p.key,
                label: p.label,
                selected: q.draft.parts.includes(p.key),
                onToggle: () => q.togglePart(p.key),
              }),
            ),
            friends: (friends.data ?? [])
              .filter((f) => f.displayName || f.username)
              .map((f): NewTripChip => {
                const label = (f.displayName || f.username)!;
                return {
                  key: f.userId,
                  label,
                  selected: q.draft.friendIds.includes(f.userId),
                  onToggle: () => toggleFriend(f.userId),
                };
              }),
            arithmetic:
              tripLength !== null && q.draft.parts.length > 0
                ? looksSentence(tripLength, q.draft.parts)
                : 'Pick as many as are true. This decides how many looks the bag has to carry.',
          }
        : null,
  };

  /**
   * A friend attached to the trip.
   *
   * Changes only the summary row's display name (`draft.friendNames`); the
   * engine still reads the `companions` vocabulary key. Ids and names move
   * together or not at all.
   */
  function toggleFriend(id: string) {
    const named = (friends.data ?? []).filter((f) => f.displayName || f.username);
    const nextIds = q.draft.friendIds.includes(id)
      ? q.draft.friendIds.filter((x) => x !== id)
      : [...q.draft.friendIds, id];
    const nextNames = nextIds
      .map((fid) => {
        const friend = named.find((f) => f.userId === fid);
        return friend ? friend.displayName || friend.username : null;
      })
      .filter((n): n is string => Boolean(n));
    q.setCompanionFriends(nextIds, nextNames);
  }

  return (
    <NewTripBody
      view={view}
      dots={progressDots(q.index, q.total)}
      large={fontScale >= NEW_TRIP_STACK_SCALE}
      datePicker={
        q.step === 'dates' ? (
          <DateRangePicker
            startsOn={q.draft.startsOn}
            endsOn={q.draft.endsOn}
            onChange={(range) => q.setDates(range.startsOn, range.endsOn)}
          />
        ) : undefined
      }
    />
  );
}
