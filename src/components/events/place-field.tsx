import * as Location from 'expo-location';
import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import {
  FieldAlert,
  FieldBox,
  FieldGroup,
  INPUT_RESET,
  toneFor,
} from '@/components/events/occasion-field';
import { Text } from '@/components/ui/text';
import { searchPlaces, type Place } from '@/features/context/weather';
import { fieldValueMaxLines } from '@/features/events/new-layout';
import {
  searchVenues,
  setVenueSearchProvider,
  venuePanelOpen,
  venueQueryInitial,
  venueQueryReduce,
  venueRows,
  venueSearchAvailable,
  venueSearchable,
  venueSelection,
  venueStatusLine,
  type VenuePlaceSelection,
  type VenueQueryEvent,
  type VenueQueryState,
  VENUE_DEBOUNCE_MS,
  VENUE_LOCATION_DENIED_LINE,
  VENUE_MIN_QUERY,
} from '@/features/events/venue-search';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTheme } from '@/theme/tokens';
import { MAX_TEXT_SCALE } from '@/theme/type-scale';

import { VenueSearch } from '../../../modules/venue-search';

/**
 * The native handle, registered once at module scope.
 *
 * `venue-search.ts` is deliberately import-free so its state machine can be
 * unit-tested by a Node runner that cannot bundle `expo-modules-core` — so the
 * component that owns the field is the file that hands the seam its
 * implementation. `null` on any runtime without the module, which is a state
 * the field is designed for rather than an error.
 */
const nativeVenueSearch = VenueSearch;
setVenueSearchProvider(
  nativeVenueSearch ? (query, options) => nativeVenueSearch.search(query, options) : null,
);

/**
 * What the user settled on for Where (N-06).
 *
 * The shape itself lives in `venue-search.ts` beside the adapters that turn it
 * into a write — one definition for the two screens that act on it. This name
 * stays because it is the field's vocabulary and every call site already reads
 * in it.
 */
export type PlaceSelection = VenuePlaceSelection;

export type PlaceFieldProps = {
  /** The text in the field. The parent owns it; see `onChangeText` below. */
  value: string;
  /**
   * Every keystroke. **A change means the value is no longer resolved** — the
   * parent must drop ALL of the resolved metadata it was holding (address,
   * coordinates, category, URL, place identifier), because the moment the text
   * stops being the place that was picked, every one of those is about
   * somewhere else. `resolvedVenueMetaFor` / `emptyResolvedVenueMeta` in
   * `venue-search.ts` are the single definition of that empty state.
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

/** The gazetteer's own debounce, unchanged from what shipped. */
const GAZETTEER_DEBOUNCE_MS = 250;

/** The region clause: `Colorado, United States`. Either half may be missing. */
function regionOf(place: Place): string {
  return [place.admin1, place.country].filter(Boolean).join(', ');
}

/**
 * Where — the place field (N-06, LP-05).
 *
 * ── Which search answers ───────────────────────────────────────────────────
 *
 * MapKit, on this device, whenever `modules/venue-search` is linked into the
 * running binary. It is THE venue-suggestion source and it has no second
 * opinion: a denied location, an offline phone, zero results and a MapKit
 * error all land in the same place, which is the field's own
 * `Use "…" as typed` row, quietly explained by one line. That row is not a
 * failure path — it is the designed answer, present from the first searchable
 * keystroke and never removed. Typing is never blocked and Create is never
 * gated on a selection.
 *
 * The Open-Meteo gazetteer is retained for exactly one case and must not grow
 * a second: a runtime where the native module is ABSENT (Expo Go, or any
 * bundle running on a binary built before this landed). There it is still the
 * shipping coordinate path the occasion forecast depends on
 * (`occasion-weather.ts` needs a latitude/longitude or it prints nothing), and
 * removing it would silently delete the weather line from those runtimes. It
 * is never consulted as a fallback for a MapKit search that ran — not on
 * denial, not offline, not on empty, not on error.
 *
 * ── Location ───────────────────────────────────────────────────────────────
 *
 * Optional, always. With no permission MapKit picks its own region and the
 * search still works. `Search near me` is the only thing in this flow that can
 * raise the system prompt — an explicit action taken while the user is visibly
 * typing a place, which is the context the prompt needs — and a refusal costs
 * one quiet line and nothing else.
 *
 * Nothing here is logged, measured or sent anywhere. The query, the
 * coordinates and the results exist for as long as the panel does.
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
  const [state, dispatch] = useReducer(venueQueryReduce, venueQueryInitial());

  /**
   * The query moves on the keystroke, not in an effect.
   *
   * Deliberate: a `dispatch` in an effect keyed on `value` is the
   * cascading-render pattern `react-hooks/set-state-in-effect` exists to
   * catch, and it would also reopen the panel every time the PARENT sets the
   * text — restoring a draft, or seating the name of the row just chosen.
   * Suggestions are a response to typing, so typing is what moves them.
   */
  const change = (text: string) => {
    dispatch({ type: 'query', text });
    onChangeText(text);
  };

  const choose = (selection: PlaceSelection) => {
    dispatch({ type: 'settled' });
    onSelect(selection);
  };

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
          // The app's ceiling for running text — see the same line in
          // `occasion-field.tsx`. A raw `TextInput` does not inherit what
          // `Text` applies, and the two fields must scale together or the
          // form has two type scales in it.
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          className="flex-1 font-body text-body"
          style={{ color: theme.ink, ...INPUT_RESET }}
        />
      </FieldBox>

      {venueSearchAvailable() ? (
        <VenuePanel state={state} dispatch={dispatch} onChoose={choose} />
      ) : (
        <GazetteerPanel state={state} onChoose={choose} />
      )}
    </FieldGroup>
  );
}

// ---------------------------------------------------------------------------
// MapKit
// ---------------------------------------------------------------------------

/** Where the permission conversation currently stands. `idle` means it has
 *  never been raised, which is where every session starts. */
type LocationState = 'idle' | 'asking' | 'granted' | 'denied';

function VenuePanel({
  state,
  dispatch,
  onChoose,
}: {
  state: VenueQueryState;
  dispatch: Dispatch<VenueQueryEvent>;
  onChoose: (selection: PlaceSelection) => void;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const maxLines = fieldValueMaxLines(fontScale);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  /** A ref, not state: a coarse region changes what the NEXT search asks for,
   *  and re-rendering the panel to record it would be noise. */
  const region = useRef<{ latitude: number; longitude: number } | null>(null);

  const debounced = useDebouncedValue(state.query, VENUE_DEBOUNCE_MS);
  const searchable = venueSearchable(state);
  const requestId = state.requestId;

  useEffect(() => {
    if (!searchable) return;
    if (debounced.length < VENUE_MIN_QUERY) return;

    let live = true;
    void searchVenues(debounced, region.current ?? {}).then((outcome) => {
      // Belt and braces. The reducer drops stale ids on its own — that is
      // latest-request-wins and it is the part under test — and this drops a
      // reply arriving after the field is gone.
      if (live) dispatch({ type: 'result', requestId, outcome });
    });

    return () => {
      live = false;
    };
  }, [debounced, dispatch, requestId, searchable]);

  /**
   * The only thing in this flow that can raise the location prompt.
   *
   * `getLastKnownPositionAsync` rather than `getCurrentPositionAsync`: a
   * cached fix is instant, costs no radio, and a city-scale region bias does
   * not need ten-metre accuracy. A null cached fix is not a failure — MapKit
   * simply keeps choosing its own region.
   */
  const searchNearMe = async () => {
    setLocationState('asking');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState('denied');
        return;
      }

      const position = await Location.getLastKnownPositionAsync();
      if (position) {
        region.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }
      setLocationState('granted');

      // Re-ask with the bias, at the id the reducer is already holding — so a
      // keystroke landing mid-permission still wins.
      const outcome = await searchVenues(state.query, region.current ?? {});
      dispatch({ type: 'result', requestId: state.requestId, outcome });
    } catch {
      // A permission call that threw is neither a denial nor a grant. Leave
      // the offer where it was; the search is unbiased and still works.
      setLocationState('idle');
    }
  };

  if (!venuePanelOpen(state)) return null;

  const rows = venueRows(state);
  const status = venueStatusLine(state);
  const offerLocation = locationState === 'idle' || locationState === 'asking';

  return (
    <>
      <View
        className="mt-rhythm overflow-hidden rounded-md border border-rule"
        accessibilityRole="list"
        accessibilityLabel="Place results">
        {rows.map((row, index) =>
          row.kind === 'venue' ? (
            <PlaceRow
              key={`venue:${row.venue.id ?? `${row.venue.name}:${index}`}`}
              // Every result is divided from what follows it, because what
              // follows it is always another offer.
              divided
              accessibilityLabel={
                row.venue.locality ? `${row.venue.name}, ${row.venue.locality}` : row.venue.name
              }
              onPress={() => onChoose(venueSelection(row.venue))}>
              {/* Venue name over its short locality. No image — the program's
                  rule, and a row with a photo in it stops being a list of
                  names and starts being a directory. The clamp comes off at
                  the accessibility sizes; see `PlaceRow` for why the two are
                  stacked rather than sharing a baseline. */}
              <Text variant="body" numberOfLines={maxLines}>
                {row.venue.name}
              </Text>
              {row.venue.locality ? (
                <Text variant="note" numberOfLines={maxLines}>
                  {row.venue.locality}
                </Text>
              ) : null}
            </PlaceRow>
          ) : (
            /* Always last of the answers, always present. The escape hatch,
               set in `muted` so it reads as the quieter of the offers without
               being hidden. It echoes the whole typed string, which is the
               longest thing this panel ever prints — 598pt of it against a
               319pt row at the top of the scale — so it is the one row that
               must never be clamped to a width it cannot have. */
            <PlaceRow
              key="typed"
              divided={offerLocation}
              accessibilityLabel={`Use ${row.text} as typed`}
              onPress={() => onChoose({ kind: 'typed', name: row.text })}>
              <Text variant="body" style={{ color: theme.muted }}>
                {`Use “${row.text}” as typed`}
              </Text>
            </PlaceRow>
          ),
        )}

        {offerLocation ? (
          <PlaceRow
            divided={false}
            accessibilityLabel="Search near me"
            accessibilityHint="Ranks nearby places using your location. Asks permission first."
            onPress={() => void searchNearMe()}
            disabled={locationState === 'asking'}>
            <Text variant="body" style={{ color: theme.muted }}>
              {locationState === 'asking' ? 'Checking…' : 'Search near me'}
            </Text>
          </PlaceRow>
        ) : null}
      </View>

      {/* ONE quiet line, never two: the search's own state, or the note that
          location was refused — the refusal wins, because it is the one the
          user just caused. */}
      {locationState === 'denied' ? (
        <QuietLine>{VENUE_LOCATION_DENIED_LINE}</QuietLine>
      ) : status ? (
        <QuietLine>{status}</QuietLine>
      ) : null}
    </>
  );
}

/** The one-line state under the panel. `note` in `muted`, announced politely —
 *  it changes while a screen reader may be sitting on the field. */
function QuietLine({ children }: { children: React.ReactNode }) {
  return (
    <View className="mt-rhythm" accessibilityLiveRegion="polite">
      <Text variant="note">{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The gazetteer, for runtimes with no native module
// ---------------------------------------------------------------------------

/**
 * The pre-LP-05 field, preserved exactly.
 *
 * Reached ONLY when `modules/venue-search` is absent from the running binary.
 * It is here because the occasion forecast needs coordinates and this is the
 * shipping path that produces them — not because MapKit needs a backstop. Do
 * not wire this to a MapKit failure: a venue search that ran and found nothing
 * has an answer, and it is the as-typed row.
 */
function GazetteerPanel({
  state,
  onChoose,
}: {
  state: VenueQueryState;
  onChoose: (selection: PlaceSelection) => void;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const maxLines = fieldValueMaxLines(fontScale);
  const [outcome, setOutcome] = useState<{ places: Place[]; failed: boolean } | null>(null);

  const query = state.query;
  const debounced = useDebouncedValue(query, GAZETTEER_DEBOUNCE_MS);
  const searching = venueSearchable(state) && debounced.length >= VENUE_MIN_QUERY;

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

  const failed = searching && outcome?.failed === true;
  const results = searching && outcome && !outcome.failed ? outcome.places : [];
  const panelOpen = searching && !failed;

  return (
    <>
      {panelOpen ? (
        <View
          className="mt-rhythm overflow-hidden rounded-md border border-rule"
          accessibilityRole="list"
          accessibilityLabel="Place results">
          {results.map((place) => (
            <PlaceRow
              key={`${place.latitude},${place.longitude},${place.name}`}
              divided
              accessibilityLabel={`${place.name}, ${regionOf(place)}`}
              onPress={() =>
                onChoose({
                  kind: 'resolved',
                  name: place.name,
                  address: regionOf(place),
                  latitude: place.latitude,
                  longitude: place.longitude,
                  // Open-Meteo's gazetteer, named as such: this panel is the
                  // one path that is NOT MapKit, and the column records which.
                  source: 'open-meteo',
                  // The gazetteer resolves cities and landmarks; it has no
                  // category, no URL and no identifier the app may keep.
                  category: null,
                  url: null,
                  placeId: null,
                })
              }>
              <Text variant="body" numberOfLines={maxLines}>
                {place.name}
              </Text>
              <Text variant="note" numberOfLines={maxLines}>
                {regionOf(place)}
              </Text>
            </PlaceRow>
          ))}
          <PlaceRow
            divided={false}
            accessibilityLabel={`Use ${query} as typed`}
            onPress={() => onChoose({ kind: 'typed', name: query })}>
            <Text variant="body" style={{ color: theme.muted }}>
              {`Use “${query}” as typed`}
            </Text>
          </PlaceRow>
        </View>
      ) : null}

      {failed ? (
        // No retry button, by design: the next keystroke is the retry, and a
        // button would ask the user to fix the network before finishing a form
        // that does not need the network at all.
        //
        // The forecast clause came off the sentence for the same reason: it
        // explained a consequence nothing on screen was about to show — the
        // weather line simply does not appear — while the reader's actual
        // question at that moment is whether their typing survived.
        <FieldAlert>Couldn’t look up places just now. What you typed is kept.</FieldAlert>
      ) : null}
    </>
  );
}

/**
 * One row of the results panel — 48pt tall at the spec's padding, so the 44pt
 * floor is drawn rather than borrowed from hitSlop.
 *
 * ── WHY THIS IS A COLUMN AND NOT A ROW ─────────────────────────────────────
 *
 * It used to be `flex-row items-baseline gap-2`, name and locality sharing one
 * baseline, and that is the shape the atlas draws. It is also where the New
 * Event page was cutting text off, at every Dynamic Type size including the
 * default one.
 *
 * React Native defaults `flexShrink` to 0, unlike the web. The name carried no
 * flex at all, so it reported its full intrinsic width to the row and the row
 * grew rather than the name wrapping; the locality, on `flex-1` (basis 0), was
 * squeezed to nothing; and the panel's `overflow-hidden` then cut the overrun
 * off at the border with no ellipsis to show for it. `numberOfLines={1}` did
 * nothing, because — in the words of the largest-type walk that found the same
 * bug on the closet cards — "`numberOfLines={1}` does nothing until something
 * constrains the width."
 *
 * Measured against real Helvetica Neue on the 393pt design width, where the row
 * has 319pt of text to spend:
 *
 *   `The Stanley Hotel & Concert Hall` + `Estes Park`
 *     at the default size   249.0 + 8 + 62.1 = 319.1pt   — over, by a hair
 *     at the top of the scale 448.3 + 8 + 111.8 = 568.1pt — over by 249pt
 *
 * The fix is not a tighter clamp. `EventCard` settled this exact question when
 * it stopped clamping venue names — "a one-line clamp on a venue name is
 * exactly the forced truncation the stress board forbids… the venue is how
 * somebody finds the room" — so the row stacks the name over its locality,
 * each on the full measure, and grows downward the way every other list row in
 * the app does. Nothing is cut at any size, and the panel reads as a list of
 * places rather than a run-on line.
 */
function PlaceRow({
  children,
  onPress,
  divided,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  divided: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      // Padding untouched at the atlas's `py-3.5 px-4`, so a one-line row is
      // the 48pt it was drawn as. Only the two-line rows grow, and only by the
      // locality they were losing.
      className={`gap-0.5 px-4 py-3.5 active:opacity-60 ${
        divided ? 'border-b border-rule' : ''
      }`}>
      {children}
    </Pressable>
  );
}
