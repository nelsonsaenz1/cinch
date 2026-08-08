import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { Placement, type PlacementName } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { getUserId } from '@/lib/supabase';

import { socialFrom } from './queries';
import type { EventMemberState, EventVisibility, VenueCoords } from './types';

/**
 * Event writes are plain inserts and updates — RLS and the database triggers
 * are the authority on every rule that matters (who may invite, which state
 * transitions exist, how many events a plan may host, how fast anyone may
 * act). This file's job is the write itself, the cache invalidation after it,
 * and turning the two refusals the server issues on purpose into designed
 * moments instead of red toasts.
 */

// ---------------------------------------------------------------------------
// Server refusals
// ---------------------------------------------------------------------------

/** Why the server said no, as far as the UI is concerned. */
export type SocialDenial =
  /** A rate-limit trigger fired (errcode 54000). Comes back on its own. */
  | { kind: 'rate_limited' }
  /** `enforce_event_limit()` refused the insert — a plan boundary. */
  | { kind: 'event_limit' };

/**
 * Classify an error thrown by a social write, or null when it is an ordinary
 * failure (network, RLS, validation) the caller should surface as its own copy.
 *
 * Both refusals arrive as Postgres errors with stable errcodes, set
 * deliberately in the migrations so this branch never string-matches prose:
 * `54000` for every rate limit, `check_violation` (23514) with the
 * `event_limit_reached` sentinel for the hosting cap.
 */
export function classifySocialDenial(error: unknown): SocialDenial | null {
  if (!error || typeof error !== 'object') return null;
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  if (code === '54000' || message.includes('rate_limited')) return { kind: 'rate_limited' };
  if (message.includes('event_limit_reached')) return { kind: 'event_limit' };
  return null;
}

/** Ready-made copy for a denial, in the stylist's voice. Null = not a denial. */
export function socialDenialCopy(error: unknown): string | null {
  const denial = classifySocialDenial(error);
  if (!denial) return null;
  return denial.kind === 'rate_limited'
    ? 'That was a lot at once. Give it a minute and try again.'
    : 'Your plan is hosting as many occasions as it can right now.';
}

/**
 * The hosting-limit paywall moment.
 *
 * Declared in `Placement` alongside the other four now that the build wave is
 * integrated; this alias is kept only so the call sites below read the same as
 * they did. The matching Superwall campaign still has to be created — until it
 * is, an unmatched placement proceeds without a paywall and the retry meets the
 * database trigger again, so nothing is given away.
 */
const EVENT_HOSTING_PLACEMENT: PlacementName = Placement.EventHostingOverLimit;

// ---------------------------------------------------------------------------
// Shared invalidation
// ---------------------------------------------------------------------------

/** Every cache an event write can age out, in one place. */
function invalidateEvent(qc: QueryClient, eventId?: string) {
  void qc.invalidateQueries({ queryKey: ['my-events'] });
  if (eventId) {
    void qc.invalidateQueries({ queryKey: ['event', eventId] });
    void qc.invalidateQueries({ queryKey: ['event-members', eventId] });
  }
}

// ---------------------------------------------------------------------------
// What the client normalizes before writing
// ---------------------------------------------------------------------------

/**
 * The two lengths the new-occasion form draws (§3.2), both well inside what
 * the schema allows — `title` takes 80, `note` takes 1000. The tighter number
 * is a design decision about what fits on a card and reads as a note rather
 * than an essay, so it is enforced here as well as at the keyboard: a
 * `maxLength` prop is a courtesy, not a boundary, and it does not survive a
 * paste on every platform or a second call site written later.
 */
const TITLE_MAX = 60;
const NOTE_MAX = 280;

/** Trim, then cap — in that order, so trailing spaces never spend the budget. */
function capped(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/** The same, for a nullable column. Empty after trimming becomes null, because
 *  a column of blank strings is a column of values every reader then has to
 *  re-check. An empty TITLE is not routed through here on purpose: that column
 *  is `not null` with its own length CHECK, and the server is the one that
 *  gets to refuse a nameless occasion. */
function cappedOrNull(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Coordinates → the `venue_meta` blob, with the geocoder stamped on.
 *
 * The vendor name is written here rather than passed in by the screen: the
 * data layer is what knows where the coordinates came from, and a column that
 * records its own provenance is the only way a future reader can tell an
 * Open-Meteo gazetteer hit from whatever writes this column next (MKLocalSearch
 * is the deferred one — see features/events/venue-search.ts).
 */
function venueMetaJson(coords: VenueCoords | null): Record<string, unknown> | null {
  return coords
    ? { latitude: coords.latitude, longitude: coords.longitude, source: 'open-meteo' }
    : null;
}

// ---------------------------------------------------------------------------
// Create / update / cancel
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  /** Null is a real answer: a named occasion with no date yet (N-10). */
  startsAt: Date | null;
  dressCode: string | null;
  note: string | null;
  venueName: string | null;
  venueAddress: string | null;
  /** Coordinates from a resolved place, or null for a value typed verbatim —
   *  only the resolved one carries a forecast (new-occasion-spec.md §5). */
  venueMeta: VenueCoords | null;
}

/**
 * Create an occasion. The `handle_new_event` trigger seats the host as a
 * joined member in the same transaction, so the returned id can be routed to
 * immediately with a complete roster of one.
 *
 * The input is exactly the five fields the redesigned form collects, and
 * nothing else is written. `occasion`, `party_size`, `reservation_url` and
 * `ends_at` were dropped from the form (spec §0.4) and their columns stay for
 * the occasions that already carry them; `visibility` is deliberately omitted
 * so the column default — `invite_only`, the strictest option — applies
 * without the client having to name it. An omitted value cannot be the wrong
 * value.
 */
export function useCreateEvent() {
  const qc = useQueryClient();
  const gate = useGate();

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<string> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await socialFrom('events')
        .insert({
          host_id: userId,
          title: capped(input.title, TITLE_MAX),
          starts_at: input.startsAt?.toISOString() ?? null,
          dress_code: input.dressCode?.trim() || null,
          note: cappedOrNull(input.note, NOTE_MAX),
          venue_name: input.venueName?.trim() || null,
          venue_address: input.venueAddress?.trim() || null,
          venue_meta: venueMetaJson(input.venueMeta),
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => invalidateEvent(qc),
    onError: (error) => {
      // The plan boundary gets the designed moment; everything else is the
      // screen's own error copy. On a grant the sheet's Create button is still
      // sitting there — the user retries with a plan the trigger now accepts,
      // which keeps the server the sole authority (see capture.tsx for the
      // same shape of reasoning).
      if (classifySocialDenial(error)?.kind === 'event_limit') {
        void gate.present(EVENT_HOSTING_PLACEMENT, async () => {
          await qc.invalidateQueries({ queryKey: ['subscription'] });
        });
      }
    },
  });
}

/**
 * Fields the host may change after creation.
 *
 * Spelled out rather than derived from `CreateEventInput`, which it used to
 * be: the create path shrank to the five fields the redesigned form collects,
 * and the edit path did not. Occasions created before this pass still carry
 * `occasion`, `party_size`, `visibility`, `ends_at` and `reservation_url`,
 * and a host who wants to clear or change one must still be able to. Every
 * key is optional and `undefined` means "not part of this patch" — the only
 * way `null` can keep meaning "clear this column".
 */
export interface UpdateEventPatch {
  title?: string;
  /** Null clears the date, returning the occasion to N-10's thin state. */
  startsAt?: Date | null;
  endsAt?: Date | null;
  partySize?: number | null;
  occasion?: string | null;
  dressCode?: string | null;
  visibility?: EventVisibility;
  venueName?: string | null;
  venueAddress?: string | null;
  venueMeta?: VenueCoords | null;
  note?: string | null;
  /** Stored verbatim — the founder's call. The schema insists on https. */
  reservationUrl?: string | null;
}

/**
 * Host edits — RLS refuses anyone else's touch outright.
 *
 * This is what N-10's "Add a date" and "Add a place" chips write through: the
 * detail page fills the missing pieces in place, so a one-key patch is the
 * common case and every key has to be independently omissible.
 */
export function useUpdateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, patch }: { eventId: string; patch: UpdateEventPatch }) => {
      const update: Record<string, unknown> = {};
      if (patch.title !== undefined) update.title = capped(patch.title, TITLE_MAX);
      if (patch.startsAt !== undefined) update.starts_at = patch.startsAt?.toISOString() ?? null;
      if (patch.endsAt !== undefined) update.ends_at = patch.endsAt?.toISOString() ?? null;
      if (patch.partySize !== undefined) update.party_size = patch.partySize;
      if (patch.occasion !== undefined) update.occasion = patch.occasion;
      if (patch.dressCode !== undefined) update.dress_code = patch.dressCode?.trim() || null;
      if (patch.visibility !== undefined) update.visibility = patch.visibility;
      if (patch.venueName !== undefined) update.venue_name = patch.venueName?.trim() || null;
      if (patch.venueAddress !== undefined)
        update.venue_address = patch.venueAddress?.trim() || null;
      // Coordinates travel with the name they were resolved for: a patch that
      // sets one and not the other is how a venue ends up carrying the last
      // place's weather, so the place field always sends both.
      if (patch.venueMeta !== undefined) update.venue_meta = venueMetaJson(patch.venueMeta);
      if (patch.note !== undefined) update.note = cappedOrNull(patch.note, NOTE_MAX);
      if (patch.reservationUrl !== undefined)
        update.reservation_url = patch.reservationUrl?.trim() || null;
      if (Object.keys(update).length === 0) return;

      const { error } = await socialFrom('events').update(update).eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

/**
 * Cancel, never delete. `canceled_at` keeps the row so members' screens can
 * say what happened instead of 404ing, and the hosting-limit trigger already
 * excludes canceled events from the count.
 */
export function useCancelEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const { error } = await socialFrom('events')
        .update({ canceled_at: new Date().toISOString() })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Put someone on the list. Insert-only: the RLS with-check pins state to
 * `invited`, role to `attendee`, `invited_by` to the caller, and screens
 * blocks — a spoofed payload fails, it doesn't sneak.
 */
export function useInviteMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const inviterId = await getUserId();
      if (!inviterId) throw new Error('Not signed in.');

      const { error } = await socialFrom('event_members').insert({
        event_id: eventId,
        user_id: userId,
        role: 'attendee',
        state: 'invited',
        invited_by: inviterId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

/**
 * Put several people on the list in one Done tap — the Invite Friends State
 * Atlas's batch picker (IF-01…IF-05). Nothing sends until this fires; the
 * checkmarks up to that point are a draft the caller owns entirely.
 *
 * Sent as N individual inserts via `Promise.allSettled`, not one multi-row
 * insert: Postgres commits or fails a single INSERT statement atomically, and
 * IF-05's whole point is that a partial failure is reported *per person* —
 * "Two of three went out", never one rolled-up error. Splitting the request
 * client-side is what makes that honest instead of invented after the fact.
 *
 * Resolves with one outcome per user, in input order, and never throws —
 * a caller checking `.ok` per row is the only way to render "who failed"
 * without also having to unpack a `Promise.allSettled` shape.
 */
export interface InviteMemberOutcome {
  userId: string;
  ok: boolean;
  error?: unknown;
}

export function useInviteMembers() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userIds,
    }: {
      eventId: string;
      userIds: string[];
    }): Promise<InviteMemberOutcome[]> => {
      const inviterId = await getUserId();
      if (!inviterId) throw new Error('Not signed in.');

      const settled = await Promise.allSettled(
        userIds.map((userId) =>
          socialFrom('event_members').insert({
            event_id: eventId,
            user_id: userId,
            role: 'attendee',
            state: 'invited',
            invited_by: inviterId,
          }),
        ),
      );

      return settled.map((result, i) => {
        const userId = userIds[i]!;
        if (result.status === 'rejected') return { userId, ok: false, error: result.reason };
        const { error } = result.value as { error: unknown };
        return error ? { userId, ok: false, error } : { userId, ok: true };
      });
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

/**
 * Answer an invitation. `joined` puts the occasion on the member's Plan;
 * `declined` is silent by design — no other member is ever told, and the
 * roster query never even fetches declined rows.
 */
export function useRespondToInvite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      response,
    }: {
      eventId: string;
      response: Extract<EventMemberState, 'joined' | 'declined'>;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await socialFrom('event_members')
        .update({ state: response })
        .eq('event_id', eventId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

/** Walk away. A hard delete of one's own row — the RLS allows exactly that —
 *  so the roster shows absence, not an exit announcement. */
export function useLeaveEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await socialFrom('event_members')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}

/**
 * Host removes a member. An update to `removed`, not a delete: the transition
 * trigger enforces that this is the only state a host may set on someone
 * else's row, and the tombstone is what keeps a revoked invite revoked.
 */
export function useRemoveMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const { error } = await socialFrom('event_members')
        .update({ state: 'removed' })
        .eq('event_id', eventId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => invalidateEvent(qc, eventId),
  });
}
