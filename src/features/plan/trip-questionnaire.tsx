import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, KeyboardAwareScrollView, Text } from '@/components/ui';
import { useFriends } from '@/features/social-graph/queries';
import { fetchClimateBand, formatTemp, searchPlaces, type Place } from '@/features/context/weather';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { DateRangePicker } from '@/components/plan/date-range-picker';

import { looksSentence } from './packing-math';
import {
  COMPANIONS,
  DAY_PARTS,
  TRIP_QUESTIONS,
  TRIP_STEPS,
  VIBES,
  companionOf,
  daysBetween,
  describeDates,
  restateTrip,
  toIsoDate,
  type Trip,
  type TripStepKey,
} from './trip';
import { useRecentDestinations } from './use-trips';
import { useTripQuestionnaire, type TripDraft, type TripQuestionnaireDevSeed } from './use-trip-questionnaire';

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
        // PK-02: RING, TICK AND MEDIUM WEIGHT — three channels, and no fill.
        //
        // These chips were an ink fill, which is a fourth thing the constitution
        // reserves for actions: a screen showing six filled ink chips and one
        // filled ink button gives the reader no way to tell an answer from the
        // control that spends it. The ring is the ink border at full weight
        // against the rule's, the tick is a glyph, and the label steps up to
        // Medium. Colour carries none of it, so the state survives on a
        // greyscale display and under any colour-vision deficiency.
        selected ? 'border-ink' : 'border-rule',
      ].join(' ')}>
      {selected ? (
        <SymbolView
          name="checkmark"
          size={12}
          tintColor={theme.ink}
          resizeMode="scaleAspectFit"
        />
      ) : null}
      {/* Selection is the chip's ground and its label colour, never a weight
          (TY-01). One `text-*` source only: NativeWind gives no precedence
          between two colour utilities on one element (chip.tsx L40-44). */}
      <Text variant="body">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One destination result — the geocoder's answer, plus the climate band that
 * tells two same-named places apart (K-02).
 *
 * Presentational and exported, so the dev route can drive it with a fixture
 * band and no network call — the same split `dev-comments.tsx` uses for
 * `CommentRow`.
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
  // No band resolved (the archive has nothing for this place) falls back to
  // the region rather than a guessed range — never a guessed number here.
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
        {/* "Ohio, United States" — the region carries most of the
            disambiguation for same-named places inside one country, which is
            the case the climate band cannot help with. */}
        {where ? <Text variant="label">{where}</Text> : null}
      </View>
      {subtitle ? <Text variant="label">{subtitle}</Text> : null}
    </Pressable>
  );
}

/** `PlaceRow` wired to the real archive read — today's date, aborted on unmount. */
function PlaceRowLive({ place, onPick }: { place: Place; onPick: (place: Place) => void }) {
  const today = useMemo(() => toIsoDate(new Date()), []);
  const climate = useQuery({
    queryKey: ['packing-climate-band', place.name, place.latitude, place.longitude, today],
    queryFn: ({ signal }) => fetchClimateBand(place.latitude, place.longitude, today, signal),
    staleTime: 60 * 60_000,
  });
  return <PlaceRow place={place} band={climate.data ?? null} onPick={onPick} />;
}

/**
 * K-02's "Recent" row. Presentational and exported for the same reason as
 * `PlaceRow` — a fixture list, no network, for the dev route.
 */
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

/** The last three distinct destinations. Absent for a first trip — no placeholders. */
function RecentRow({ onPick }: { onPick: (place: Place) => void }) {
  const recent = useRecentDestinations();
  return <RecentChips places={recent.data ?? []} onPick={onPick} />;
}

/** The place search — the one keyboard in the flow. */
function DestinationStep({
  initialQuery = '',
  onPick,
}: {
  initialQuery?: string;
  onPick: (place: Place) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState(initialQuery);

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
        className="rounded-md border border-hairline px-3.5 py-3 text-ink"
      />

      {(places.data?.length ?? 0) > 0 ? (
        <View className="mt-3 overflow-hidden rounded-md border border-hairline">
          {places.data!.map((place) => (
            <PlaceRowLive
              key={`${place.name}-${place.latitude}-${place.longitude}`}
              place={place}
              onPick={onPick}
            />
          ))}
        </View>
      ) : null}

      <RecentRow onPick={onPick} />

      {/* No spinner and no "no results": a two-letter query mid-typing is not a
          failed search, and a place lookup that fails leaves the field exactly
          where it was, which is its own retry. */}
      <Text variant="body" className="mt-6 text-muted">
        Cinch reads the place — how warm it is, how dressed-up it is, what people
        actually wear there — and packs from what you already own.
      </Text>
    </>
  );
}

/**
 * Cinch friends attached on top of the closed companion vocabulary.
 *
 * Optional, and absent for anyone with no friends yet — the social graph's
 * own read path, reused rather than duplicated. A friend tapped here changes
 * only the summary row's display name (`draft.friendNames`); the engine still
 * reads the vocabulary key.
 */
function FriendsAttach({
  friendIds,
  onChange,
}: {
  friendIds: string[];
  onChange: (ids: string[], names: string[]) => void;
}) {
  const friends = useFriends();
  const named = (friends.data ?? []).filter((f) => f.displayName || f.username);
  if (!named.length) return null;

  function toggle(id: string) {
    const nextIds = friendIds.includes(id) ? friendIds.filter((x) => x !== id) : [...friendIds, id];
    const nextNames = nextIds
      .map((fid) => named.find((f) => f.userId === fid)?.displayName || named.find((f) => f.userId === fid)?.username)
      .filter((n): n is string => Boolean(n));
    onChange(nextIds, nextNames);
  }

  return (
    <View className="mt-6">
      <Text variant="label">Add friends (optional)</Text>
      <Text variant="body" className="mt-1 text-muted">
        Names their trip summary, not what gets packed.
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {named.map((f) => (
          <AnswerChip
            key={f.userId}
            label={(f.displayName || f.username)!}
            selected={friendIds.includes(f.userId)}
            onPress={() => toggle(f.userId)}
          />
        ))}
      </View>
    </View>
  );
}

/** `describeCompanions`'s list joiner, without the leading "with". */
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

type SummaryRow = { step: TripStepKey; label: string; value: string };

/** The three rows K-03 keeps visible at the top, tappable to revise. */
function summaryRows(draft: TripDraft): SummaryRow[] {
  const rows: SummaryRow[] = [];

  if (draft.destination) {
    rows.push({
      step: 'destination',
      label: 'Where',
      value: [draft.destination.name, draft.destination.country].filter(Boolean).join(', '),
    });
  }
  if (draft.companions) {
    rows.push({
      step: 'companions',
      label: 'Who with',
      // Friend names, when any were attached, else the vocabulary label —
      // never a typed or invented name.
      value: draft.friendNames.length ? joinNames(draft.friendNames) : companionOf(draft.companions).label,
    });
  }
  if (draft.startsOn && draft.endsOn) {
    rows.push({ step: 'dates', label: 'Dates', value: describeDates(draft.startsOn, draft.endsOn) });
  }

  return rows;
}

function AnsweredSummary({ rows, onRevise }: { rows: SummaryRow[]; onRevise: (step: TripStepKey) => void }) {
  if (!rows.length) return null;
  return (
    <View className="mb-5 overflow-hidden rounded-md border border-hairline">
      {rows.map((row, i) => (
        <Pressable
          key={row.step}
          onPress={() => onRevise(row.step)}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}: ${row.value}. Tap to revise.`}
          className={[
 'flex-row items-center justify-between px-4 py-3 active:opacity-60',
            i < rows.length - 1 ? 'border-b border-hairline' : '',
          ].join(' ')}>
          <Text variant="label">{row.label}</Text>
          <Text variant="body">{row.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TripQuestionnaire({
  onComplete,
  devSeed,
}: {
  onComplete: (trip: Trip) => void;
  /** Dev-only: opens the questionnaire already partway answered. See the hook. */
  devSeed?: TripQuestionnaireDevSeed;
}) {
  const q = useTripQuestionnaire(onComplete, devSeed);

  /** Null until the dates are answered, which is what the arithmetic waits on. */
  const tripLength =
    q.draft.startsOn && q.draft.endsOn ? daysBetween(q.draft.startsOn, q.draft.endsOn) : null;

  const answered = summaryRows(q.draft).filter(
    (row) => TRIP_STEPS.indexOf(row.step) < TRIP_STEPS.indexOf(q.step),
  );

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="px-gutter pb-16 pt-2"
      showsVerticalScrollIndicator={false}>
      <Text variant="eyebrow">
        Packing · {q.position} of {q.total}
      </Text>

      {answered.length > 0 ? (
        <View className="mt-4">
          <AnsweredSummary rows={answered} onRevise={q.goTo} />
        </View>
      ) : null}

      <View className="mt-3">
        <Text variant="title" trim>
          {TRIP_QUESTIONS[q.step]}
        </Text>
        {/* PK-02: THE TRIP FACTS ARE RESTATED UNDER THE QUESTION, so the answer
            is given in context — the last question is unanswerable without
            remembering where and how long. Every fragment is an answer already
            given, so none of it can be a guess, and it appears only once there
            is something to restate. */}
        {restateTrip(q.draft) ? (
          <Text variant="note" className="mt-2">
            {restateTrip(q.draft)}
          </Text>
        ) : null}
      </View>

      <View className="mt-6">
        {q.step === 'destination' ? (
          <DestinationStep
            initialQuery={q.draft.destination?.name ?? ''}
            onPick={(place) => q.answer('destination', { destination: place })}
          />
        ) : null}

        {q.step === 'companions' ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              {COMPANIONS.map((c) => (
                <AnswerChip
                  key={c.key}
                  label={c.label}
                  selected={q.draft.companions === c.key}
                  onPress={() => q.answer('companions', { companions: c.key })}
                />
              ))}
            </View>

            <FriendsAttach friendIds={q.draft.friendIds} onChange={q.setCompanionFriends} />
          </>
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
            <Text variant="body" className="mt-6 text-muted">
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
              <Text variant="body" className="mt-4 text-muted">
                {looksSentence(tripLength, q.draft.parts)}
              </Text>
            ) : (
              <Text variant="body" className="mt-4 text-muted">
                Pick as many as are true. This decides how many looks the bag has
                to carry.
              </Text>
            )}

            {/* PK-02's retention line — correction 17, and it is TRUE of this
                app rather than aspirational: `useStartTrip` writes the answered
                questionnaire to `trips` before anything is packed, and
                `useLastTrip` is what reopens it after a timeout without asking
                the four questions again.

                The atlas's second sentence, "Deleting the trip deletes them",
                is NOT drawn. There is no per-trip delete anywhere in the app —
                no control, no mutation, and no `.delete()` on `trips` in any
                client path — so the sentence would describe an operation the
                reader cannot perform. The row IS removed with the account
                (`user_id … on delete cascade`), which is the privacy page's
                claim to make, not this screen's. */}
            <Text variant="note" className="mt-6">
              Your answers are saved with the trip, so you can reopen the memo or build it again
              without answering twice.
            </Text>

            {/* The screen's one oxblood action, and the only button in the
                flow — every other answer commits on the tap that gives it.

                THERE IS NO "SKIP THIS ONE". The atlas offers one beneath the
                action; `trips.parts` is constrained to `array_length between 1
                and 4`, so a skipped fourth question produces a row the database
                refuses to accept and a bag with no looks in it to pack. A dead
                control is worse than an absent one. */}
            <Button
              title="Pack the bag"
              onPress={q.complete}
              disabled={q.draft.vibes.length === 0 || q.draft.parts.length === 0}
              haptic
              className="mt-6 self-stretch"
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
