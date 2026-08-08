import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { SocialTermsSheet } from '@/components/social/social-terms-sheet';
import { Text } from '@/components/ui/text';
import { isSocialTermsError, useAcceptSocialTerms } from '@/features/auth/use-social-terms';
import { useOccasionWeather } from '@/features/events/occasion-weather';
import { socialDenialCopy, useCreateEvent } from '@/features/events/mutations';
import type { VenueCoords } from '@/features/events/types';
import { useTheme } from '@/theme/tokens';

/**
 * What's the occasion? — the New Occasion State Atlas, N-01…N-08.
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

/** The four the atlas draws, in ascending formality. Stored as the display
 *  string in `dress_code`, which is free text — older occasions hold whatever
 *  the previous free-text field took, and still render it. */
const DRESS_CODES = ['Casual', 'Smart casual', 'Cocktail', 'Black tie'] as const;

/** A `YYYY-MM-DD` route param as a local calendar date, or null if malformed.
 *  Nothing passes this yet; the seam is kept because Plan's calendar is where
 *  "new occasion on this day" belongs when it ships. */
function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function NewOccasionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  const create = useCreateEvent();

  const [name, setName] = useState('');
  const [day, setDay] = useState<Date | null>(() => parseDateParam(dateParam));
  const [minutes, setMinutes] = useState<number | null>(() =>
    parseDateParam(dateParam) ? DEFAULT_TIME_MINUTES : null,
  );
  const [placeText, setPlaceText] = useState('');
  const [placeAddress, setPlaceAddress] = useState<string | null>(null);
  const [coords, setCoords] = useState<VenueCoords | null>(null);
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

  const weather = useOccasionWeather(startsAt, coords);

  const ready = name.trim().length > 0;
  const canCreate = ready && !create.isPending;

  /** Any edit marks the form dirty. Wrapped once rather than at each call site
   *  so a field added later cannot forget to do it. */
  function edited<T>(set: (value: T) => void) {
    return (value: T) => {
      setTouched(true);
      set(value);
    };
  }

  const onPlaceChange = (text: string) => {
    setTouched(true);
    setPlaceText(text);
    // Typing after a pick means the text is no longer the place that was
    // resolved, so the coordinates go with it. Keeping them would attach last
    // night's forecast to whatever is being typed now.
    setPlaceAddress(null);
    setCoords(null);
  };

  const onPlaceSelect = (selection: PlaceSelection) => {
    setTouched(true);
    setPlaceText(selection.name);
    if (selection.kind === 'resolved') {
      setPlaceAddress(selection.address);
      setCoords({ latitude: selection.latitude, longitude: selection.longitude });
    } else {
      setPlaceAddress(null);
      setCoords(null);
    }
  };

  const cancel = () => {
    if (touched) setDiscardSheet(true);
    else router.back();
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
        venueAddress: placeAddress,
        venueMeta: coords,
      },
      {
        // Replace, and nothing else. The form dismisses and the detail page is
        // pushed under it, so Back goes to Plan and not to a form the user has
        // already finished — and inviting is an action on that page now, not a
        // screen the host is chased into.
        onSuccess: (eventId) => router.replace(`/event/${eventId}`),
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      {/* The header is local rather than `ScreenHeader`: the atlas draws a text
          Cancel where every other screen draws the circular back disc, and this
          is the one screen you leave by abandoning rather than by going back. */}
      <View className="flex-row items-center px-gutter pt-2">
        <Pressable
          onPress={cancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          className="active:opacity-60">
          <Text variant="body" style={{ color: theme.muted }}>
            Cancel
          </Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text variant="colophon">New occasion</Text>
        </View>
        {/* Balances Cancel so the title sits centred on the screen, not on the
            space left over beside it. */}
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingScreen className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-gutter pb-8"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {/* Padding, not margin: `trim` carries negative margins of its own
              and a stacked `mt-*` resolves against them to roughly nothing. */}
          <View className="pb-5 pt-3">
            <Text variant="display" trim>
              What&apos;s the occasion?
            </Text>
          </View>

          <OccasionField
            label="Name"
            value={name}
            onChangeText={edited(setName)}
            placeholder="Dinner, a wedding, a birthday…"
            maxLength={NAME_MAX}
            counterFrom={COUNTER_FROM}
            counterCopy={(remaining, cap) => `Names cap at ${cap} characters — ${remaining} left.`}
            accessibilityLabel="Name of the occasion"
            returnKeyType="next"
          />

          {/* When — one question, two controls, so one eyebrow over both. */}
          <FieldGroup label="When" optional className="mt-[18px]">
            <View className="flex-row gap-2">
              <FieldButton
                value={day ? whenLabel(day, null) : null}
                placeholder="Pick a date"
                onPress={() => setDateSheet(true)}
                accessibilityLabel="Pick a date"
                className="flex-1"
              />
              <FieldButton
                value={minutes === null ? null : formatMinutes(minutes)}
                placeholder="Time"
                onPress={() => setTimeSheet(true)}
                // A time with no day is not an answer to anything, so the
                // control waits for the date rather than offering to be filled
                // in an order that cannot be stored.
                disabled={!day}
                accessibilityLabel="Pick a time"
                style={{ width: 118 }}
              />
            </View>
            {weather ? <FieldNote>{weatherLineFor(weather)}</FieldNote> : null}
          </FieldGroup>

          <PlaceField
            value={placeText}
            onChangeText={onPlaceChange}
            onSelect={onPlaceSelect}
            className="mt-[18px]"
          />

          <FieldGroup label="Dress code" optional className="mt-[18px]">
            <View className="flex-row flex-wrap gap-2">
              {DRESS_CODES.map((code) => (
                <Chip
                  key={code}
                  label={code}
                  size="tap"
                  selected={dressCode === code}
                  // Tapping the chosen chip clears it. An occasion with no
                  // dress code is a real answer, not an unfinished one.
                  onPress={() => edited(setDressCode)(dressCode === code ? null : code)}
                />
              ))}
            </View>
          </FieldGroup>

          <OccasionField
            label="Note for the group"
            value={note}
            onChangeText={edited(setNote)}
            placeholder="Anything they should know before they pick a look"
            optional
            multiline
            maxLength={NOTE_MAX}
            counterFrom={COUNTER_FROM}
            accessibilityLabel="Note for the group"
            className="mt-[18px]"
          />
        </ScrollView>

        {/* The footer is docked, not the last thing in the scroll: the atlas
            pins the button to the bottom of the frame, and a create button you
            have to scroll to find is a create button that looks conditional. */}
        <View
          className="border-t border-hairline bg-canvas px-gutter pt-5 dark:border-hairline-dark dark:bg-canvas-dark"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
          <Button
            title="Create occasion"
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
            <View className="mt-2.5 items-center" accessibilityLiveRegion="polite">
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
        onChange={edited(setMinutes)}
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
      <DiscardSheet
        visible={discardSheet}
        onDiscard={() => {
          setDiscardSheet(false);
          router.back();
        }}
        onKeepEditing={() => setDiscardSheet(false)}
      />
    </SafeAreaView>
  );
}
