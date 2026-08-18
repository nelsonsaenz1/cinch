import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateSheet } from '@/components/events/date-sheet';
import { DiscardSheet } from '@/components/events/discard-sheet';
import { GuestSheet, type GuestCandidate } from '@/components/events/guest-sheet';
import { NewEventBody, type NewEventView } from '@/components/events/new-event-body';
import { NoteSheet } from '@/components/events/note-sheet';
import { PlaceSheet } from '@/components/events/place-sheet';
import type { PlaceSelection } from '@/components/events/place-field';
import { DEFAULT_TIME_MINUTES, TimeSheet } from '@/components/events/time-sheet';
import { SocialTermsSheet } from '@/components/social/social-terms-sheet';
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
import { socialDenialCopy, useCreateEvent, useInviteMembers } from '@/features/events/mutations';
import { COPY, newEventStacked } from '@/features/events/new-event-spec';
import {
  emptyResolvedVenueMeta,
  resolvedVenueMetaFor,
  venueMetaForColumn,
  type ResolvedVenueMeta,
} from '@/features/events/venue-search';
import { useFriends } from '@/features/social-graph/queries';
import { profileName } from '@/features/social-graph/types';
import { haptics } from '@/lib/haptics';

/**
 * New Event — the wiring. Redesign 02, accepted 2026-08-17.
 *
 * The drawing is in `components/events/new-event-body.tsx`; this file is the
 * state, the draft, the sheets and the submit. That is the split every rebuilt
 * page in this repo makes, and the reason the six accepted frames can be
 * opened as `dev-ne-01…06` without a session or a network.
 *
 * ── WHAT THE REDESIGN CHANGED ─────────────────────────────────────────────
 *
 * The page is a sheet-based composer rather than a scrolled form. The serif
 * title IS the name field; every other question is a 56pt row that opens one
 * sheet and comes back with one answer; answered rows tint blush; there is one
 * full-width oxblood CTA; and creating fires the success haptic the direction
 * asks for on every meaningful commit.
 *
 * ── WHAT IT DID NOT ───────────────────────────────────────────────────────
 *
 * · **The date stays optional.** An event may float with no date at all —
 *   `canCreateEvent` gates on the NAME and nothing else, and the accepted
 *   default frame showing a date answered is a frame, not a requirement.
 * · **The group note keeps its semantics** — the group's note, capped at 280
 *   inside the column's 1000, written to `note` and nowhere else.
 * · **The draft is preserved exactly as it was.** One `beforeRemove` guard for
 *   the text Cancel, the swipe-back gesture and any programmatic navigation;
 *   debounced writes under a key scoped to the signed-in user; cleared on
 *   explicit discard, on an account change, and — only after the insert is
 *   acknowledged — on a successful create. A failed submit changes nothing.
 * · **The venue keeps the existing manual entry.** `PlaceSheet` wraps the same
 *   `PlaceField` that shipped: MapKit where the native module is linked, the
 *   gazetteer where it is not, and the `Use "…" as typed` row always.
 * · **`useCreateEvent`'s contract is untouched.** No new column, no new table,
 *   no new endpoint. The guest picker's selection is sent afterwards through
 *   the existing `useInviteMembers` batch mutation, against an event that
 *   already exists — which is the only moment an invite has an id to hang on.
 *
 * ── ONE FIELD THE ARTIFACT DOES NOT DRAW ──────────────────────────────────
 *
 * Dress code. The accepted frames ask six questions — name, date, time, venue,
 * who's going, note — and dress code is not among them, so its chip row is
 * gone from the composer. The COLUMN is untouched and so is the draft's field:
 * a restored draft carrying a dress code still submits it, and every occasion
 * that already has one still renders it. Recorded here rather than silently,
 * because it is the one thing on this page a reader can no longer set.
 */

/** A `YYYY-MM-DD` route param as a local calendar date, or null if malformed.
 *  The seam Plan's calendar uses for "new occasion on this day". */
function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function NewOccasionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const session = useSession();

  const create = useCreateEvent();
  const invite = useInviteMembers();
  const friends = useFriends();

  const nameRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [day, setDay] = useState<Date | null>(() => parseDateParam(dateParam));
  const [minutes, setMinutes] = useState<number | null>(() =>
    parseDateParam(dateParam) ? DEFAULT_TIME_MINUTES : null,
  );
  const [placeText, setPlaceText] = useState('');
  /** Everything a resolved pick knows beyond the name, as ONE value (LP-05).
   *  Five setters is five chances to leave one behind on the next keystroke. */
  const [venueMeta, setVenueMeta] = useState<ResolvedVenueMeta>(emptyResolvedVenueMeta);
  /**
   * A dress code carried in from a restored draft, never set here.
   *
   * The redesigned composer does not ask for one (see the header). The value
   * is still round-tripped so a draft written before this pass does not lose a
   * field between being saved and being submitted.
   */
  const [dressCode, setDressCode] = useState<string | null>(null);
  const [note, setNote] = useState('');
  /**
   * Who the host has ticked. NOT part of the draft, deliberately: it is a set
   * of edges in the friends graph rather than typing, it is re-chosen in two
   * taps, and persisting somebody's guest list to disk under a key that
   * outlives the session is a privacy cost with no matching benefit.
   */
  const [guestIds, setGuestIds] = useState<string[]>([]);

  // One boolean for the whole form, set by a field's first *change* and never
  // by focus: Cancel only asks when there is something to discard.
  const [touched, setTouched] = useState(false);

  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [venueSheet, setVenueSheet] = useState(false);
  const [guestSheet, setGuestSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [discardSheet, setDiscardSheet] = useState(false);

  /**
   * The commit, as ONE flag covering the insert and the invites behind it.
   *
   * `create.isPending` goes false the instant the event row comes back, and
   * the invites are still going out at that point — without this the CTA would
   * blink from "Creating…" back to "Create event" and then navigate, which
   * reads as a failed press.
   */
  const [committing, setCommitting] = useState(false);

  /** The two halves of When as one instant, or null while the date is unset. */
  const startsAt = (() => {
    if (!day) return null;
    const at = new Date(day);
    const m = minutes ?? DEFAULT_TIME_MINUTES;
    at.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return at;
  })();

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
      setGuestIds([]);
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
  }, [hydrated, touched, store, userId, name, day, minutes, placeText, venueMeta, dressCode, note]);

  // -------------------------------------------------------------------------
  // Leaving
  // -------------------------------------------------------------------------

  /**
   * Refs, not state, because the `beforeRemove` listener is registered once
   * and must read the CURRENT answer rather than the one that was true when it
   * was installed.
   */
  const dirty = useRef(false);
  useEffect(() => {
    dirty.current = touched;
  }, [touched]);
  /** Set the instant a create succeeds, so the replace that follows is not
   *  challenged by a guard that has not caught up yet. */
  const leaving = useRef(false);
  /** The navigation the guard interrupted, replayed verbatim on Discard. */
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

  /** The one route out. Everything — the text Cancel, the sheet's own dismiss
   *  gesture, a programmatic push — goes through `beforeRemove` above. */
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

  // -------------------------------------------------------------------------
  // Committing
  // -------------------------------------------------------------------------

  /**
   * The terms gate, met as a sentence rather than as a failed save.
   *
   * `assert_social_terms()` raises `social_terms_required` on every social
   * INSERT by a user who has not accepted, and creating an occasion is one.
   * Accepting re-submits, because the user's answer to "before you post" is
   * that they still want to post.
   */
  const acceptTerms = useAcceptSocialTerms();
  const termsBlocked = isSocialTermsError(create.error);

  const submit = () => {
    setCommitting(true);
    create.mutate(
      {
        title: name,
        startsAt,
        dressCode,
        note: note.trim() || null,
        venueName: placeText.trim() || null,
        venueAddress: venueMeta.address,
        venueMeta: venueMetaForColumn(venueMeta),
      },
      {
        onSuccess: async (eventId) => {
          leaving.current = true;
          // Cleared HERE and nowhere earlier: this callback is the server's
          // acknowledgement, and a draft dropped before it would be a draft
          // lost to a failed insert.
          void store.clear(userId);
          // The direction's own line: "success notification on … event
          // created". It fires on the server's answer, never on the tap.
          haptics.success();

          if (guestIds.length > 0) {
            // Best effort, and deliberately not a gate. The event exists; a
            // roster that came up short is fixed on the event's own Invite
            // screen, which is where the per-person outcomes belong. Refusing
            // to navigate would strand the host on a composer whose work has
            // already been committed.
            try {
              await invite.mutateAsync({ eventId, userIds: guestIds });
            } catch {
              // `useInviteMembers` resolves per person and does not throw for
              // a refused row; this catches the one case that does — a session
              // that vanished between the two writes.
            }
          }

          // Replace, and nothing else: the sheet dismisses and the detail page
          // is pushed under it, so Back goes to Plan and not to a composer the
          // user has already finished.
          router.replace(`/event/${eventId}`);
        },
        // Nothing on failure. Every field still holds what was entered, the
        // draft is still on disk, and the footer says so.
        onError: () => setCommitting(false),
      },
    );
  };

  // -------------------------------------------------------------------------
  // The view
  // -------------------------------------------------------------------------

  const candidates: GuestCandidate[] = (friends.data ?? []).map((friend) => ({
    userId: friend.userId,
    name: profileName(friend),
    username: friend.username,
  }));

  const guestNames = guestIds
    .map((id) => candidates.find((candidate) => candidate.userId === id)?.name)
    .filter((n): n is string => Boolean(n));

  const view: NewEventView = {
    name,
    onChangeName: (text) => {
      setTouched(true);
      setName(text);
    },
    nameRef,
    onCancel: cancel,

    day,
    onPickDate: () => setDateSheet(true),
    minutes,
    onPickTime: () => setTimeSheet(true),

    venueName: placeText,
    venueAddress: venueMeta.address,
    onPickVenue: () => setVenueSheet(true),

    guestNames,
    onPickGuests: () => setGuestSheet(true),

    note,
    onEditNote: () => setNoteSheet(true),

    onCreate: submit,
    pending: create.isPending || committing,
    // The terms refusal raises the sheet below instead of printing a line, so
    // the footer stays quiet for it.
    error:
      create.isError && !termsBlocked
        ? (socialDenialCopy(create.error) ?? COPY.errorBody)
        : null,
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <NewEventBody view={view} large={newEventStacked(fontScale)} />

      <DateSheet
        visible={dateSheet}
        value={day}
        onChange={(picked) => {
          setTouched(true);
          setDay(picked);
          // Seat the default the moment a day exists, so the pair reads
          // "Saturday, 12 September" over "7:00pm" rather than leaving a
          // half-answered When.
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
      <PlaceSheet
        visible={venueSheet}
        initialText={placeText}
        onDone={(selection: PlaceSelection | null) => {
          setVenueSheet(false);
          setTouched(true);
          if (!selection) {
            setPlaceText('');
            setVenueMeta(emptyResolvedVenueMeta());
            return;
          }
          setPlaceText(selection.name);
          setVenueMeta(resolvedVenueMetaFor(selection));
        }}
        onClose={() => setVenueSheet(false)}
      />
      <GuestSheet
        visible={guestSheet}
        friends={candidates}
        value={guestIds}
        onDone={(ids) => {
          setGuestSheet(false);
          setTouched(true);
          setGuestIds(ids);
        }}
        onClose={() => setGuestSheet(false)}
      />
      <NoteSheet
        visible={noteSheet}
        value={note}
        onDone={(text) => {
          setNoteSheet(false);
          setTouched(true);
          setNote(text);
        }}
        onClose={() => setNoteSheet(false)}
      />
      <SocialTermsSheet
        visible={termsBlocked}
        busy={acceptTerms.isPending}
        onAccept={() => acceptTerms.mutate(undefined, { onSuccess: submit })}
        // Declining leaves the composer exactly as it was, with everything
        // still in it. `reset()` clears the error so the sheet closes without
        // the occasion being created or the draft being thrown away.
        onDecline={() => {
          setCommitting(false);
          create.reset();
        }}
      />
      <DiscardSheet visible={discardSheet} onDiscard={discard} onKeepEditing={keepEditing} />
    </SafeAreaView>
  );
}
