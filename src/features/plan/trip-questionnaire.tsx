import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, KeyboardAwareScrollView, Text } from '@/components/ui';
import { searchPlaces, type Place } from '@/features/context/weather';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { DateRangePicker } from '@/components/plan/date-range-picker';

import { looksSentence } from './packing-math';
import {
  COMPANIONS,
  DAY_PARTS,
  TRIP_QUESTIONS,
  VIBES,
  daysBetween,
  describeDates,
  type Trip,
} from './trip';
import { useTripQuestionnaire } from './use-trip-questionnaire';

/**
 * Four questions before anything is packed.
 *
 * Set the way every other hard-left composition in the app is set — eyebrow,
 * one serif line, the controls, nothing centred and no progress furniture
 * beyond the honest "2 of 4". The answers are chips because a chip is one tap
 * and a text field is a small essay; the only keyboard in the flow is the place
 * search, and even there what is kept is the geocoder's answer rather than the
 * string typed.
 *
 * The chip is hand-rolled for the same reason `stylist.tsx` hand-rolls its
 * `AnswerChip`: the shared `Chip` buys its 44pt target with `hitSlop`, which
 * overlaps into its neighbours once answers wrap onto two or three lines. This
 * one is 44pt of real geometry, so a wrapped grid stays honest about what was
 * tapped.
 */

function AnswerChip({
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
        'justify-center rounded-md border px-4 active:opacity-60',
        selected
          ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
          : 'border-rule dark:border-rule-dark',
      ].join(' ')}>
      {/* Inline colour, never a second `text-*` class: NativeWind gives no
          precedence between two of them on one element (chip.tsx L40-44). */}
      <Text variant="body" style={{ color: selected ? theme.canvas : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The place search — the one keyboard in the flow. */
function DestinationStep({ onPick }: { onPick: (place: Place) => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const places = useQuery({
    queryKey: ['places', query],
    enabled: query.trim().length >= 2,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => searchPlaces(query, signal),
  });

  return (
    <>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Lisbon, Tokyo, Aspen…"
        placeholderTextColor={theme.muted}
        accessibilityLabel="Destination"
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        className="rounded-md border border-hairline px-3.5 py-3 text-ink dark:border-hairline-dark dark:text-ink-dark"
      />

      {(places.data?.length ?? 0) > 0 ? (
        <View className="mt-3 overflow-hidden rounded-md border border-hairline dark:border-hairline-dark">
          {places.data!.map((place) => (
            <Pressable
              key={`${place.name}-${place.latitude}-${place.longitude}`}
              onPress={() => onPick(place)}
              accessibilityRole="button"
              style={{ minHeight: MIN_TAP_TARGET }}
              className="justify-center border-b border-hairline px-4 active:opacity-60 dark:border-hairline-dark">
              <Text variant="body">
                {place.name}
                <Text variant="label">{place.country ? `  ${place.country}` : ''}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* No spinner and no "no results": a two-letter query mid-typing is not a
          failed search, and a place lookup that fails leaves the field exactly
          where it was, which is its own retry. */}
      <Text variant="body" className="mt-6 text-muted dark:text-muted-dark">
        Cinch reads the place — how warm it is, how dressed-up it is, what people
        actually wear there — and packs from what you already own.
      </Text>
    </>
  );
}

export function TripQuestionnaire({ onComplete }: { onComplete: (trip: Trip) => void }) {
  const q = useTripQuestionnaire(onComplete);

  /** Null until the dates are answered, which is what the arithmetic waits on. */
  const tripLength =
    q.draft.startsOn && q.draft.endsOn ? daysBetween(q.draft.startsOn, q.draft.endsOn) : null;

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="px-gutter pb-16 pt-2"
      showsVerticalScrollIndicator={false}>
      <Text variant="eyebrow">
        Packing · {q.position} of {q.total}
      </Text>

      <View className="mt-3">
        <Text variant="title" trim>
          {TRIP_QUESTIONS[q.step]}
        </Text>
      </View>

      <View className="mt-6">
        {q.step === 'destination' ? (
          <DestinationStep onPick={(place) => q.answer('destination', { destination: place })} />
        ) : null}

        {q.step === 'companions' ? (
          <View className="flex-row flex-wrap gap-2">
            {COMPANIONS.map((c) => (
              <AnswerChip
                key={c.key}
                label={c.label}
                onPress={() => q.answer('companions', { companions: c.key })}
              />
            ))}
          </View>
        ) : null}

        {q.step === 'dates' ? (
          <>
            <DateRangePicker
              startsOn={q.draft.startsOn}
              endsOn={q.draft.endsOn}
              onChange={(range) =>
                q.setDates(range.startsOn, range.endsOn)
              }
            />
            <Text variant="body" className="mt-6 text-muted dark:text-muted-dark">
              Real dates, not a length — Cinch pulls the forecast for the days
              you are actually there.
            </Text>
            <Button
              title={
                q.draft.startsOn && q.draft.endsOn
                  ? describeDates(q.draft.startsOn, q.draft.endsOn)
                  : 'Pick your dates'
              }
              onPress={() => q.answer('dates', {})}
              disabled={!q.draft.startsOn || !q.draft.endsOn}
              haptic
              className="mt-8 self-stretch"
            />
          </>
        ) : null}

        {q.step === 'shape' ? (
          <>
            <Text variant="label">Vibe</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {VIBES.map((v) => (
                <AnswerChip
                  key={v.key}
                  label={v.label}
                  selected={q.draft.vibes.includes(v.key)}
                  onPress={() => q.toggleVibe(v.key)}
                />
              ))}
            </View>

            <View className="mt-6">
              <Text variant="label">Day parts</Text>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {DAY_PARTS.map((p) => (
                <AnswerChip
                  key={p.key}
                  label={p.label}
                  selected={q.draft.parts.includes(p.key)}
                  onPress={() => q.togglePart(p.key)}
                />
              ))}
            </View>

            {/* The running arithmetic — how the questionnaire stays honest
                about what it is about to produce. The look count, and nothing
                else: a predicted piece count would be a promise made before
                the search that produces it (packing-math.ts). */}
            {tripLength !== null && q.draft.parts.length > 0 ? (
              <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                {looksSentence(tripLength, q.draft.parts)}
              </Text>
            ) : (
              <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                Pick as many as are true. This decides how many looks the bag has
                to carry.
              </Text>
            )}

            {/* The screen's one oxblood action, and the only button in the
                flow — every other answer commits on the tap that gives it. */}
            <Button
              title="Pack the bag"
              onPress={q.complete}
              disabled={q.draft.vibes.length === 0 || q.draft.parts.length === 0}
              haptic
              className="mt-8 self-stretch"
            />
          </>
        ) : null}
      </View>

      {q.canGoBack ? (
        <Pressable
          onPress={q.back}
          accessibilityRole="button"
          accessibilityLabel="Back to the previous question"
          hitSlop={12}
          className="mt-8 self-start active:opacity-60">
          <Text variant="label" className="underline">
            Back
          </Text>
        </Pressable>
      ) : null}
    </KeyboardAwareScrollView>
  );
}
