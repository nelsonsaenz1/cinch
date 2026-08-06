import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { PlacementName } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { getUserId } from '@/lib/supabase';

import { socialFrom } from './queries';
import type { EventMemberState, EventVisibility } from './types';

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
 * `placements.ts` belongs to the billing slice and this slice may not edit it,
 * so the name is declared here and cast. INTEGRATION MUST: move this constant
 * into `Placement` in `src/features/billing/placements.ts` and create the
 * matching Superwall campaign. Until the campaign exists, registering the
 * placement simply proceeds without a paywall (documented Superwall behaviour
 * for unmatched placements) — the retry then meets the database trigger again,
 * so nothing is ever given away; the moment is just less designed.
 */
const EVENT_HOSTING_PLACEMENT = 'event_hosting_over_limit' as unknown as PlacementName;

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
// Create / update / cancel
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  partySize: number | null;
  occasion: string | null;
  dressCode: string | null;
  visibility: EventVisibility;
  venueName: string | null;
  venueAddress: string | null;
  /** Stored verbatim — the founder's call. The schema insists on https. */
  reservationUrl: string | null;
}

/**
 * Create an occasion. The `handle_new_event` trigger seats the host as a
 * joined member in the same transaction, so the returned id can be routed to
 * immediately with a complete roster of one.
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
          title: input.title.trim(),
          starts_at: input.startsAt.toISOString(),
          ends_at: input.endsAt ? input.endsAt.toISOString() : null,
          party_size: input.partySize,
          occasion: input.occasion,
          dress_code: input.dressCode?.trim() || null,
          visibility: input.visibility,
          venue_name: input.venueName?.trim() || null,
          venue_address: input.venueAddress?.trim() || null,
          reservation_url: input.reservationUrl?.trim() || null,
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

/** Fields the host may change after creation. */
export type UpdateEventPatch = Partial<
  Omit<CreateEventInput, 'startsAt' | 'endsAt'> & { startsAt: Date; endsAt: Date | null }
>;

/** Host edits — RLS refuses anyone else's touch outright. */
export function useUpdateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, patch }: { eventId: string; patch: UpdateEventPatch }) => {
      const update: Record<string, unknown> = {};
      if (patch.title !== undefined) update.title = patch.title.trim();
      if (patch.startsAt !== undefined) update.starts_at = patch.startsAt.toISOString();
      if (patch.endsAt !== undefined) update.ends_at = patch.endsAt?.toISOString() ?? null;
      if (patch.partySize !== undefined) update.party_size = patch.partySize;
      if (patch.occasion !== undefined) update.occasion = patch.occasion;
      if (patch.dressCode !== undefined) update.dress_code = patch.dressCode?.trim() || null;
      if (patch.visibility !== undefined) update.visibility = patch.visibility;
      if (patch.venueName !== undefined) update.venue_name = patch.venueName?.trim() || null;
      if (patch.venueAddress !== undefined)
        update.venue_address = patch.venueAddress?.trim() || null;
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
