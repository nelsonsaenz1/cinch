import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { weatherLineFor, whenLabel } from '@/components/events/EventCard';
import { DateSheet } from '@/components/events/date-sheet';
import { DiscardSheet } from '@/components/events/discard-sheet';
import {
  FieldAlert,
  FieldButton,
  FieldGroup,
  FieldNote,
  OccasionField,
} from '@/components/events/occasion-field';
import { PlaceField, type PlaceSelection } from '@/components/events/place-field';
import { DEFAULT_TIME_MINUTES, formatMinutes, TimeSheet } from '@/components/events/time-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import {
  KeyboardAvoidingScreen,
  KeyboardAwareScrollView,
} from '@/components/ui/keyboard-aware-scroll-view';
import { SocialTermsSheet } from '@/components/social/social-terms-sheet';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { isSocialTermsError, useAcceptSocialTerms } from '@/features/auth/use-social-terms';
import {
  createEventDraftStore,
  emptyEventDraft,
  fromDraftDay,
  isEventDraftEmpty,
  toDraftDay,
  EVENT_DRAFT_DEBOUNCE_MS,
  type EventDraft,
} from '@/features/events/event-draft';
import {
  TIME_CONTROL_MIN_WIDTH,
  whenControlsStacked,
} from '@/features/events/new-layout';
import { useOccasionWeather } from '@/features/events/occasion-weather';
import { socialDenialCopy, useCreateEvent } from '@/features/events/mutations';
import {
  emptyResolvedVenueMeta,
  resolvedVenueMetaFor,
  venueMetaForColumn,
  type ResolvedVenueMeta,
} from '@/features/events/venue-search';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * New event — the New Occasion State Atlas, N-01…N-08, as corrected by LP-03,
 * LP-05, LP-06 and LP-08.
 *
 * Five fields in one scroll, in the order a person says them out loud: name,
 * when, where, dress code, a note for the group. Not a wizard — a wizard would
 * make the four optional fields feel mandatory by giving each its own screen —
 * and not a form that refuses: **the only required field is the name**, and the
 * button that waits for it says so in a sentence instead of sitting there grey.
 *
 * The spec is `docs/design/new-occasion-spec.md`; the atlas it transcribes is
 * archived beside it. The pieces this screen assembles all live in
 * `components/events/`, so what is left here is state, the submit, and the
 * order the questions are asked in.
 *
 * What this form deliberately no longer collects — occasion type, party size,
 * visibility, a reservation link, a multi-day span — is recorded in §0 of the
 * spec with what each cost. The columns are all still there and older
 * occasions still render every one of them.
 *
 * ── LP-08: leaving, and coming back ────────────────────────────────────────
 *
 * ONE dirty-state guard, not three. `beforeRemove` is the single place that
 * decides whether this screen may go away, so the swipe-back gesture, the
 * Cancel text, and any programmatic navigation all reach the same question and
 * the same sheet. A screen with a Cancel handler and a separate gesture
 * handler eventually disagrees with itself, and the disagreement is always
 * discovered by somebody losing typing.
 *
 * The draft is written to this device, debounced, under a key scoped to the
 * signed-in user and to this form (`event-draft.ts`). It survives a kill and a
 * restore; it is cleared on explicit discard, on an account change, and on a
 * successful create — the last of those only after the insert has been
 * acknowledged, because a draft cleared optimistically is a draft lost to a
 * failed write. A failed submit changes nothing: everything typed is still
 * here and still saved.
 */

/** The name cap. 60, not the schema's 80: a name is a thing you say, and the
 *  card it lands on has one line for it. Mirrored in `mutations.ts`, which is
 *  the boundary that actually enforces it. */
const NAME_MAX = 60;

/** The note cap, likewise inside the column's 1000. */
const NOTE_MAX = 280;

/** How close to the cap the counter starts watching. "The count appears in the
 *  last ten characters and not before — a counter that watches from the first
 *  keystroke reads as a warning." */
const COUNTER_FROM = 10;

/** The docked footer's height before it has laid out once — the default-size
 *  sum of its ink button and its insets. Only ever the value for the first
 *  frame; `onLayout` replaces it with the real one, at whatever type size the
 *  reader is actually at. */
const FOOTER_HEIGHT_ESTIMATE = 120;

/** The four the atlas draws, in ascending formality. Stored as the display
 *  string in `dress_code`, which is free text — older occasions hold whatever
 *  the previous free-text field took, and still render it. */
const DRESS_CODES = ['Casual', 'Smart casual', 'Cocktail', 'Black tie'] as const;

/** A `YYYY-MM-DD` route param as a local calendar date, or null if malformed.
 *  Nothing passes this yet; the seam is kept because Plan's calendar is where
 * "new occasion on this day" belongs when it ships. */
function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function NewOccasionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const session = useSession();

  /**
   * The docked footer's real height, measured rather than assumed.
   *
   * The scroll used to end in a flat `pb-32` — 128pt of padding standing in for
   * a footer whose height is the sum of a wrapping button label, an optional
   * helper sentence, an optional failure line and the home indicator. At the
   * top of the type scale that footer measures past 170pt, so the last of the
   * Note field sat permanently underneath it with no scroll left to reveal it:
   * the same shape of bug the largest-type walk found on Today, where "because
   * the content fits without scrolling, there is no scroll to reveal what is
   * hidden."
   *
   * `onLayout` is the only honest source for this. The fallback below is the
   * default-size footer, used for the single frame before the first layout
   * lands.
   */
  const [footerHeight, setFooterHeight] = useState(FOOTER_HEIGHT_ESTIMATE);

  const create = useCreateEvent();

  const [name, setName] = useState('');
  const [day, setDay] = useState<Date | null>(() => parseDateParam(dateParam));
  const [minutes, setMinutes] = useState<number | null>(() =>
    parseDateParam(dateParam) ? DEFAULT_TIME_MINUTES : null,
  );
  const [placeText, setPlaceText] = useState('');
  /** Everything a resolved pick knows beyond the name, as ONE value (LP-05).
   *  Five setters is five chances to leave one behind on the next keystroke. */
  const [venueMeta, setVenueMeta] = useState<ResolvedVenueMeta>(emptyResolvedVenueMeta);
  const [dressCode, setDressCode] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // One boolean for the whole form, set by a field's first *change* and never
  // by focus: Cancel only asks when there is something to discard, and moving
  // through a form without typing is not something to discard.
  const [touched, setTouched] = useState(false);

  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [discardSheet, setDiscardSheet] = useState(false);

  /** The two halves of When as one instant, or null while the date is unset.
   *  Picking a date seats 7:00pm at the same moment, so the time control never
   *  reads empty next to a filled date — and the stored instant is always the
   *  one printed on the button. */
  const startsAt = (() => {
    if (!day) return null;
    const at = new Date(day);
    const m = minutes ?? DEFAULT_TIME_MINUTES;
    at.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return at;
  })();

  const weather = useOccasionWeather(startsAt, venueMeta.coords);

  const ready = name.trim().length > 0;
  const canCreate = ready && !create.isPending;
  const stackWhen = whenControlsStacked(fontScale);

  // -------------------------------------------------------------------------
  // The draft
  // -------------------------------------------------------------------------

  const store = useMemo(() => createEventDraftStore(AsyncStorage), []);
  const userId = session.loading ? null : session.userId;

  /** Restored (or found empty) — nothing is written before this is true, or a
   *  first render would save an empty draft over a real one. */
  const [hydrated, setHydrated] = useState(false);
  /** The account the current draft belongs to, `undefined` before the first
   *  settled session. */
  const scope = useRef<string | null | undefined>(undefined);

  const draft: EventDraft = {
    name,
    day: toDraftDay(day),
    minutes,
    placeText,
    placeAddress: venueMeta.address,
    coords: venueMeta.coords,
    placeCategory: venueMeta.category,
    placeUrl: venueMeta.url,
    placeId: venueMeta.placeId,
    dressCode,
    note,
  };

  const applyDraft = (next: EventDraft) => {
    setName(next.name);
    setDay(fromDraftDay(next.day));
    setMinutes(next.minutes);
    setPlaceText(next.placeText);
    setVenueMeta({
      address: next.placeAddress,
      coords: next.coords,
      category: next.placeCategory,
      url: next.placeUrl,
      placeId: next.placeId,
    });
    setDressCode(next.dressCode);
    setNote(next.note);
    // A restored draft is dirty by definition: it is unsaved typing, and
    // leaving it should ask the same question leaving fresh typing does.
    setTouched(!isEventDraftEmpty(next));
  };

  useEffect(() => {
    if (session.loading) return;

    const previous = scope.current;
    scope.current = userId;

    // An account change — including signing out — takes the previous
    // account's draft with it. Nobody's typing is ever shown to, or kept for,
    // somebody else's session.
    if (previous !== undefined && previous !== userId) {
      void store.clear(previous);
      applyDraft(emptyEventDraft());
      setHydrated(true);
      return;
    }

    let live = true;
    void store.load(userId).then((restored) => {
      if (!live) return;
      // The route param wins over a draft: arriving from "new occasion on this
      // day" is an explicit instruction about the date.
      if (restored && !parseDateParam(dateParam)) applyDraft(restored);
      setHydrated(true);
    });

    return () => {
      live = false;
    };
    // `dateParam` is read once at mount by design; re-running on a param
    // change would re-hydrate over live typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.loading, store, userId]);

  useEffect(() => {
    if (!hydrated || !touched) return;
    const timer = setTimeout(() => {
      void store.save(userId, draft);
    }, EVENT_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // The draft object is rebuilt every render; its FIELDS are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    touched,
    store,
    userId,
    name,
    day,
    minutes,
    placeText,
    venueMeta,
    dressCode,
    note,
  ]);

  // -------------------------------------------------------------------------
  // Leaving
  // -------------------------------------------------------------------------

  /**
   * Refs, not state, because the `beforeRemove` listener is registered once
   * and must read the CURRENT answer rather than the one that was true when it
   * was installed.
   */
  const dirty = useRef(false);
  // Mirrored in an effect rather than assigned during render: a ref written
  // while rendering is the pattern `react-hooks/refs` exists to catch, and the
  // listener below only ever reads it from an event.
  useEffect(() => {
    dirty.current = touched;
  }, [touched]);
  /** Set the instant a create succeeds, so the replace that follows is not
   *  challenged by a guard that has not caught up yet. */
  const leaving = useRef(false);
  /** The navigation the guard interrupted, replayed verbatim on Discard — so
   *  a swipe-back still goes back and a deep link still lands where it meant
   *  to. */
  const blocked = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current || !dirty.current) return;
        event.preventDefault();
        blocked.current = event.data.action;
        setDiscardSheet(true);
      }),
    [navigation],
  );

  /** The one route out. Everything — the text button, the back gesture, a
   *  programmatic push — goes through `beforeRemove` above. */
  const cancel = () => {
    router.back();
  };

  const discard = () => {
    setDiscardSheet(false);
    leaving.current = true;
    void store.clear(userId);
    const action = blocked.current;
    blocked.current = null;
    if (action) navigation.dispatch(action);
    else router.back();
  };

  const keepEditing = () => {
    setDiscardSheet(false);
    blocked.current = null;
  };

  /**
   * The terms gate, met as a sentence rather than as a failed save.
   *
   * `assert_social_terms()` (migration 20260808101000) raises
   * `social_terms_required` on every social INSERT by a user who has not
   * accepted, and creating an occasion is one. Without this the trigger's
   * refusal reaches the footer as "check your connection and try again",
   * which is both wrong and unfixable by the person reading it — the terms
   * sheet was written for exactly this moment and had no call site.
   *
   * Accepting re-submits, because the user's answer to "before you post" is
   * that they still want to post.
   */
  const acceptTerms = useAcceptSocialTerms();
  const termsBlocked = isSocialTermsError(create.error);

  const submit = () => {
    create.mutate(
      {
        title: name,
        startsAt,
        dressCode,
        note: note.trim() || null,
        venueName: placeText.trim() || null,
        venueAddress: venueMeta.address,
        // The coordinate pair, plus the two optional MapKit breadcrumbs the
        // jsonb bag can hold and the venue COLUMNS cannot — category and the
        // stable place identifier. `venueMetaForColumn` decides which of the
        // resolved record survives the boundary; the URL deliberately does
        // not, and a typed venue sends null.
        venueMeta: venueMetaForColumn(venueMeta),
      },
      {
        // Replace, and nothing else. The form dismisses and the detail page is
        // pushed under it, so Back goes to Plan and not to a form the user has
        // already finished — and inviting is an action on that page now, not a
        // screen the host is chased into.
        //
        // The draft is cleared HERE and nowhere earlier: this callback is the
        // server's acknowledgement, and a draft dropped before it would be a
        // draft lost to a failed insert.
        onSuccess: (eventId) => {
          leaving.current = true;
          void store.clear(userId);
          router.replace(`/event/${eventId}`);
        },
        // Nothing on failure. Every field still holds what was typed, the
        // draft is still on disk, and the footer says so.
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The header is local rather than `ScreenHeader`: the atlas draws a text
          Cancel where every other screen draws the circular back disc, and this
          is the one screen you leave by abandoning rather than by going back. */}
      <View className="flex-row items-center px-gutter pt-rhythm">
        <Pressable
          onPress={cancel}
          // 12, not 8. `Cancel` is one line of `body` — a 22pt line box — so
          // eight points a side made a 38pt target, four short of the floor.
          // Twelve clears it (46) and there is nothing else on this row for
          // the extra slop to reach into.
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          className="active:opacity-60">
          <Text variant="body" style={{ color: theme.muted }}>
            Cancel
          </Text>
        </Pressable>
        {/* No second title here (LP-06). The accepted table gives this surface
            ONE visible headline, `New event`, and it is the editorial one
            below — a colophon repeating it in the chrome would be the same
            word twice on a screen whose remaining job is five labels. */}
      </View>

      {/* `automaticallyAdjustKeyboardInsets` (UIScrollView's own keyboard
          avoidance) rather than a padded ancestor around the scroll: it insets
          the scroll view AND carries the focused field up above the keyboard,
          which a shrinking parent does not do. The footer keeps its own
          `KeyboardAvoidingView` below, so the two mechanisms each own exactly
          one thing and never compound. */}
      <KeyboardAwareScrollView
        className="flex-1"
        // Bottom padding clears the docked footer as MEASURED, plus one gutter
        // of air so the last field never ends flush against it. The scroll's
        // own inset accounts for the keyboard; this accounts for the button
        // floating above it, and a constant could not — see `footerHeight`.
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: footerHeight + GUTTER }}
        showsVerticalScrollIndicator={false}>
        {/* Padding, not margin: `trim` carries negative margins of its own
            and a stacked `mt-*` resolves against them to roughly nothing.
            The headline and NOTHING under it: LP-06 gives this surface no
            supporting line, because `Name`, `When`, `Where`, `Dress code` and
            `Note` already say what the form wants.

            24 below, against the 20 between fields: the headline has to sit a
            step further from the first eyebrow than the eyebrows sit from each
            other, or the page reads as six things in a list instead of a title
            over five. */}
        <View className="pb-bare pt-bezel">
          <Text variant="display" trim>
            New event
          </Text>
        </View>

        <OccasionField
          label="Name"
          value={name}
          onChangeText={(text) => {
            setTouched(true);
            setName(text);
          }}
          // Two examples, not three. A SINGLE-LINE `TextInput` does not wrap
          // its placeholder — it scrolls, so an over-long one is simply cut at
          // the right edge with nothing to show it was — and three examples
          // measured 429.6pt against 323 at the top of the type scale, which
          // put `a birthday…` off the end of the first field on the page. Two
          // still say "any kind of occasion", one casual and one formal, and
          // the ellipsis carries the rest.
          placeholder="Dinner, a wedding…"
          maxLength={NAME_MAX}
          counterFrom={COUNTER_FROM}
          accessibilityLabel="Name of the occasion"
          // `done`, not `next`. There is no next TEXT field to go to — what
          // follows the name is two sheets and a row of chips — so a Next key
          // was a promise the keyboard could not keep.
          returnKeyType="done"
        />

        {/* When — one question, two controls, so one eyebrow over both.
            Across at the sizes that hold them and stacked above that; the
            threshold and the arithmetic behind it are in `new-layout.ts`. */}
        <FieldGroup label="When" optional className="mt-gutter">
          <View className={stackWhen ? 'gap-2' : 'flex-row gap-2'}>
            <FieldButton
              value={day ? whenLabel(day, null) : null}
              placeholder="Pick a date"
              onPress={() => setDateSheet(true)}
              accessibilityLabel="Pick a date"
              // `flex-1` only while the two share a ROW. In a column it is
              // `flex-basis: 0` inside a container with no definite height,
              // which is how a control ends up measuring nothing; stacked, the
              // parent's own `stretch` gives it the full width already.
              className={stackWhen ? '' : 'flex-1'}
            />
            <FieldButton
              value={minutes === null ? null : formatMinutes(minutes)}
              // `Pick a time`, matching its neighbour, because the two boxes
              // are the only controls on this form that are NOT text fields
              // and the verb is what says so. A bare `Time` under a `WHEN`
              // eyebrow reads as an empty input beside a filled one.
              placeholder="Pick a time"
              onPress={() => setTimeSheet(true)}
              // A time with no day is not an answer to anything, so the
              // control waits for the date rather than offering to be filled
              // in an order that cannot be stored — and says which, rather
              // than leaving a screen reader with a dead control and no
              // reason for it.
              disabled={!day}
              accessibilityLabel="Pick a time"
              accessibilityHint={day ? undefined : 'Pick a date first.'}
              // A FLOOR, never a width. The atlas's 118 was a promise about
              // how wide a formatted time is, and `12:30pm` breaks it at 1.35
              // — the top of the standard type range, reached without touching
              // an accessibility size. Stacked, the control takes the measure
              // and the floor stops mattering.
              style={stackWhen ? undefined : { minWidth: TIME_CONTROL_MIN_WIDTH }}
            />
          </View>
          {weather ? <FieldNote>{weatherLineFor(weather)}</FieldNote> : null}
        </FieldGroup>

        <PlaceField
          value={placeText}
          onChangeText={(text) => {
            setTouched(true);
            setPlaceText(text);
            // Typing after a pick means the text is no longer the place that
            // was resolved, so ALL FIVE resolved fields go with it — address,
            // coordinates, category, URL, place identifier. Keeping any one of
            // them would attach last night's forecast, or somebody else's
            // MapKit identifier, to whatever is being typed now.
            setVenueMeta(emptyResolvedVenueMeta());
          }}
          onSelect={(selection: PlaceSelection) => {
            setTouched(true);
            setPlaceText(selection.name);
            setVenueMeta(resolvedVenueMetaFor(selection));
          }}
          className="mt-gutter"
        />

        <FieldGroup label="Dress code" optional className="mt-gutter">
          <View className="flex-row flex-wrap gap-2">
            {DRESS_CODES.map((code) => (
              <Chip
                key={code}
                label={code}
                size="tap"
                selected={dressCode === code}
                // Tapping the chosen chip clears it. An occasion with no
                // dress code is a real answer, not an unfinished one.
                onPress={() => {
                  setTouched(true);
                  setDressCode(dressCode === code ? null : code);
                }}
              />
            ))}
          </View>
        </FieldGroup>

        <OccasionField
          // `Note`, per the accepted label set — the atlas retains exactly
          // `Name`, `Where` and `Note`. The accessibility label stays the
          // longer sentence: read out of the form's visual context, "Note"
          // alone does not say whose note it is or who reads it.
          label="Note"
          value={note}
          onChangeText={(text) => {
            setTouched(true);
            setNote(text);
          }}
          // The clause about picking a look came off: the placeholder sat
          // under a `NOTE` eyebrow on a form whose whole subject is what to
          // wear, so it was spending eight words to say where it already was.
          placeholder="Anything they should know"
          optional
          multiline
          maxLength={NOTE_MAX}
          counterFrom={COUNTER_FROM}
          accessibilityLabel="Note for the group"
          className="mt-gutter"
        />
      </KeyboardAwareScrollView>

      {/* The footer is docked, not the last thing in the scroll: the atlas
          pins the button to the bottom of the frame, and a create button you
          have to scroll to find is a create button that looks conditional.
          `KeyboardAvoidingScreen` wraps the footer ALONE so it rises with the
          keyboard and stays tappable, without also padding the scroll view
          that is already insetting itself. */}
      <KeyboardAvoidingScreen>
        <View
          className="border-t border-hairline bg-canvas px-gutter pt-gutter"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{ paddingBottom: Math.max(insets.bottom, GUTTER) }}>
          <Button
            // `Create event`, not `Create occasion`. The screen is titled
            // `New event` and the tab that opens it says events; the button is
            // the last word the reader sees before committing and it says the
            // same noun the rest of the flow does. "Occasion" survives in the
            // data layer's own vocabulary, which nobody reads.
            title="Create event"
            variant="ink"
            disabledTone="filled"
            haptic
            loading={create.isPending}
            disabled={!canCreate}
            onPress={submit}
          />
          {/* The form's opening line, not its complaint. Present from the
              moment the form opens, gone the moment there is a name — it never
              turns red, never appears only after a failed attempt, and never
              moves the button. Whitespace is not a name: the check is on the
              trimmed string, so a spacebar leaves everything where it was. */}
          {!ready ? (
            <View className="mt-rhythm items-center" accessibilityLiveRegion="polite">
              <Text variant="note">Give it a name and Cinch can plan it.</Text>
            </View>
          ) : null}
          {/* The terms refusal is not a failure to report — it raises the
              sheet below instead, and the footer stays quiet. */}
          {create.isError && !termsBlocked ? (
            <FieldAlert>
              {socialDenialCopy(create.error) ??
                'That didn’t save. Everything you typed is still here — check your connection and try again.'}
            </FieldAlert>
          ) : null}
        </View>
      </KeyboardAvoidingScreen>

      <DateSheet
        visible={dateSheet}
        value={day}
        onChange={(picked) => {
          setTouched(true);
          setDay(picked);
          // Seat the default the moment a day exists, so the pair reads
          // "Sat 9 Aug · 7:00pm" rather than leaving a half-answered row.
          setMinutes((current) => current ?? DEFAULT_TIME_MINUTES);
        }}
        onClose={() => setDateSheet(false)}
      />
      <TimeSheet
        visible={timeSheet}
        value={minutes}
        onChange={(picked) => {
          setTouched(true);
          setMinutes(picked);
        }}
        onClose={() => setTimeSheet(false)}
      />
      <SocialTermsSheet
        visible={termsBlocked}
        busy={acceptTerms.isPending}
        onAccept={() => acceptTerms.mutate(undefined, { onSuccess: submit })}
        // Declining leaves the form exactly as it was, with everything typed
        // still in it. `reset()` clears the error so the sheet closes without
        // the occasion being created or the draft being thrown away.
        onDecline={() => create.reset()}
      />
      <DiscardSheet visible={discardSheet} onDiscard={discard} onKeepEditing={keepEditing} />
    </SafeAreaView>
  );
}
