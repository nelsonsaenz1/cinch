import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { FieldAlert, FieldBox, FieldGroup, toneFor } from '@/components/events/occasion-field';
import { Text } from '@/components/ui/text';
import { searchPlaces, type Place } from '@/features/context/weather';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTheme } from '@/theme/tokens';

/**
 * What the user settled on for Where (N-06).
 *
 * Two kinds, and the difference is the whole design. A `resolved` pick came
 * back from the gazetteer and carries coordinates, so the occasion earns a
 * forecast. A `typed` one is whatever the user wrote, kept verbatim, and
 * simply does not — "a friend's flat has no listing, and an event should not
 * be blocked on a geocoder agreeing it exists."
 */
export type PlaceSelection =
  | {
      kind: 'resolved';
      /** Writes `venue_name`. */
      name: string;
      /** The region line — writes `venue_address`. */
      address: string;
      latitude: number;
      longitude: number;
    }
  | { kind: 'typed'; name: string };

export type PlaceFieldProps = {
  /** The text in the field. The parent owns it; see `onChangeText` below. */
  value: string;
  /**
   * Every keystroke. **A change means the value is no longer resolved** — the
   * parent must drop any coordinates it was holding, because the moment the
   * text stops being the place that was picked, the forecast attached to it is
   * about somewhere else.
   */
  onChangeText: (text: string) => void;
  /** Fired on an explicit row tap only, resolved or as-typed. */
  onSelect: (selection: PlaceSelection) => void;
  /** `null` drops the eyebrow — for a sheet whose title already asks this. */
  label?: string | null;
  optional?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  className?: string;
};

/** Long enough that "de" does not fetch the world; short enough for "LA". */
const MIN_QUERY = 2;

/**
 * 250ms. Long enough to swallow the middle of a word, short enough that the
 * panel is already there when the finger stops. The value is per-keystroke
 * debounce, not a request timeout — see the abort below.
 */
const DEBOUNCE_MS = 250;

/** The region clause: `Colorado, United States`. Either half may be missing. */
function regionOf(place: Place): string {
  return [place.admin1, place.country].filter(Boolean).join(', ');
}

/**
 * Where — the place field (N-06).
 *
 * The gazetteer is Open-Meteo's, the same vendor as the forecast: no key, and
 * no second name in the privacy policy. It resolves cities and landmarks, not
 * venues, which is known and accepted — `The Stanley` falls to the as-typed
 * row, and that row is the atlas's own designed fallback rather than a gap in
 * it. Venue-level POI search is native and cannot ride an OTA update.
 */
export function PlaceField({
  value,
  onChangeText,
  onSelect,
  label = 'Where',
  optional = true,
  placeholder = 'A place or an address',
  accessibilityLabel = 'Where the occasion is',
  className = '',
}: PlaceFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  /**
   * The last answer the gazetteer gave, whatever kind of answer it was.
   *
   * One piece of state rather than a `results` and a `failed`, because the two
   * are never independent — a search either came back with places or it did
   * not — and because everything the panel derives from it is derived rather
   * than stored. Clearing results when the query gets too short used to be a
   * `setState` in the effect body, which is the cascading-render pattern
   * `react-hooks/set-state-in-effect` exists to catch: the query is already
   * state, so "is the panel searchable" is a computation, not a second copy.
   */
  const [outcome, setOutcome] = useState<{ places: Place[]; failed: boolean } | null>(null);
  /**
   * Set when a row is tapped, cleared by the next keystroke. Without it the
   * panel reopens under the answer the user just chose, because choosing a
   * place sets the field's text to that place's name — which is, to a
   * debounced effect, indistinguishable from typing it.
   */
  const [settled, setSettled] = useState(false);

  const query = value.trim();
  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const searching = !settled && debounced.length >= MIN_QUERY;

  useEffect(() => {
    if (!searching) return;

    // One in-flight request, aborted by the next keystroke. The gazetteer is
    // fast enough that two overlapping searches routinely land out of order,
    // and an abort is the only fix that does not involve guessing which reply
    // is the newer one.
    const next = new AbortController();

    searchPlaces(debounced, next.signal)
      .then((places) => {
        if (!next.signal.aborted) setOutcome({ places, failed: false });
      })
      .catch(() => {
        // An abort is not a failure — it is this effect doing its job — and
        // reporting it would flash the degraded state on every keystroke.
        if (!next.signal.aborted) setOutcome({ places: [], failed: true });
      });

    return () => next.abort();
  }, [debounced, searching]);

  const change = (text: string) => {
    setSettled(false);
    onChangeText(text);
  };

  const choose = (selection: PlaceSelection) => {
    setSettled(true);
    onSelect(selection);
  };

  const failed = searching && outcome?.failed === true;
  const results = searching && outcome && !outcome.failed ? outcome.places : [];

  // The panel is open whenever there is a query worth searching and the user
  // has not settled on an answer — including while the results are empty,
  // because the as-typed row is an answer on its own and waiting for a
  // gazetteer to agree before offering it defeats the point of having it.
  const panelOpen = searching && !failed;

  return (
    <FieldGroup label={label} optional={optional} className={className}>
      <FieldBox tone={toneFor(value, focused)}>
        <TextInput
          value={value}
          onChangeText={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.faint}
          accessibilityLabel={accessibilityLabel}
          autoCorrect={false}
          returnKeyType="search"
          className="flex-1 font-body text-body"
          style={{ color: theme.ink }}
        />
      </FieldBox>

      {panelOpen ? (
        <View
          className="mt-2.5 overflow-hidden rounded-md border border-rule"
          accessibilityLabel="Place results">
          {results.map((place) => (
            <PlaceRow
              key={`${place.latitude},${place.longitude},${place.name}`}
              // Every result is divided from what follows it, because what
              // follows it is always the as-typed row.
              divided
              accessibilityLabel={`${place.name}, ${regionOf(place)}`}
              onPress={() =>
                choose({
                  kind: 'resolved',
                  name: place.name,
                  address: regionOf(place),
                  latitude: place.latitude,
                  longitude: place.longitude,
                })
              }>
              <Text variant="body" numberOfLines={1}>
                {place.name}
              </Text>
              <Text variant="note" className="flex-1" numberOfLines={1}>
                {regionOf(place)}
              </Text>
            </PlaceRow>
          ))}
          {/* Always last, always present. The escape hatch, and set in `muted`
              so it reads as the quieter of the offers without being hidden. */}
          <PlaceRow
            divided={false}
            accessibilityLabel={`Use ${query} as typed`}
            onPress={() => choose({ kind: 'typed', name: query })}>
            <Text variant="body" numberOfLines={1} style={{ color: theme.muted }}>
              {`Use “${query}” as typed`}
            </Text>
          </PlaceRow>
        </View>
      ) : null}

      {failed ? (
        // No retry button, by design: the next keystroke is the retry, and a
        // button would ask the user to fix the network before finishing a form
        // that does not need the network at all.
        <FieldAlert>
          Couldn’t look up places just now. What you typed is kept — the occasion just won’t carry a
          forecast.
        </FieldAlert>
      ) : null}
    </FieldGroup>
  );
}

/** One row of the results panel — 48pt tall at the spec's padding, so the 44pt
 *  floor is drawn rather than borrowed from hitSlop. */
function PlaceRow({
  children,
  onPress,
  divided,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  divided: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`flex-row items-baseline gap-2 px-4 py-3.5 active:opacity-60 ${
        divided ? 'border-b border-rule' : ''
      }`}>
      {children}
    </Pressable>
  );
}
