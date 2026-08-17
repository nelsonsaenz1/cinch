import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { getUserId } from '@/lib/supabase';

import { DAILY_SOCIAL_EVENTS, wornSharingChangedProps } from './analytics';
import { dailySocialDb, rowsOf } from './client';

/**
 * DS-07 — the owner's own switch, and the one column behind it.
 *
 * ── ONE COLUMN, WHICH IS ALSO THE BOUNDARY ────────────────────────────────
 *
 * `profiles.worn_outfits_shared_since` is null when sharing is off and holds
 * the instant sharing began when it is on. One column rather than a boolean
 * beside a timestamp, because two columns can disagree and the disagreeing
 * state — true beside null — is the one that fails open. So the switch reads
 * "is this column non-null", and nothing in the client ever needs to know the
 * instant itself.
 *
 * ── THE CLIENT DOES NOT GET TO PICK THE INSTANT, AND MUST NOT TRY ─────────
 *
 * Turning sharing on writes *some* non-null timestamp and the
 * `profiles_worn_outfits_boundary` trigger overrides it with `now()`. That
 * override is the enforcement, not a courtesy: `profiles: owner can update` is
 * a plain RLS policy, so an owner could otherwise write a timestamp dated 2020
 * into their own row and expose their entire history. Do not fight it, do not
 * read the value back to "confirm" it, and do not send a value chosen to mean
 * something — the client expresses on or off, the database decides when.
 *
 * Off and on again re-enters the trigger's first branch and starts a fresh
 * boundary, so nothing worn while sharing was off is ever backfilled.
 *
 * ── DEFAULT OFF, AND THIS FILE MUST NOT MOVE IT ───────────────────────────
 *
 * The column is null for every account that has never touched this switch, and
 * an absent profile row reads the same way. That is the opposite default from
 * the four flags beside it on the same screen, and deliberately: those
 * preserved behaviour that already shipped, this creates a path that never
 * existed, and new exposure starts closed.
 */

export const WORN_SHARING_KEY = ['worn-outfits-sharing'] as const;

/** The one column, as it arrives. */
interface WornSharingRow {
  worn_outfits_shared_since: string | null;
}

/**
 * Whether the signed-in user is sharing what they wear.
 *
 * Answers false while the row is in flight, which is the correct default for
 * every account that has never opened this screen — the switch opens in the
 * position it is overwhelmingly likely to hold and settles rather than
 * flickering, the same argument `/privacy/visibility` already makes about the
 * four flags.
 */
export function useWornSharing() {
  return useQuery({
    queryKey: WORN_SHARING_KEY,
    queryFn: async (): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return false;

      const { data, error } = await dailySocialDb()
        .from('profiles')
        .select('worn_outfits_shared_since')
        .eq('user_id', userId)
        .limit(1);

      if (error) throw new Error(error.message);

      const row = rowsOf<WornSharingRow>(data)[0];
      // A profile row that does not exist yet is not sharing. Null is off, and
      // absence is null.
      return Boolean(row?.worn_outfits_shared_since);
    },
  });
}

export function useSetWornSharing() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ shared }: { shared: boolean }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      // `update`, not `upsert`, for the reason `use-closet-visibility.ts`
      // gives: an upsert would write a profile row for an account that has
      // none, and a privacy switch is not the thing that should bring a
      // profile into existence.
      const { error } = await dailySocialDb()
        .from('profiles')
        .update({
          // Any non-null value turns it on. The trigger replaces this with
          // `now()`, which is the point — see the note at the top of the file.
          worn_outfits_shared_since: shared ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },

    onMutate: async ({ shared }) => {
      await qc.cancelQueries({ queryKey: WORN_SHARING_KEY });
      const previous = qc.getQueryData<boolean>(WORN_SHARING_KEY);
      qc.setQueryData(WORN_SHARING_KEY, shared);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(WORN_SHARING_KEY, context.previous);
      }
    },
    onSuccess: (_data, { shared }) => {
      // A boolean. With a default of off, this is the number the unit lives or
      // dies on, and it needs nothing else to be that number.
      track(DAILY_SOCIAL_EVENTS.wornSharingChanged, wornSharingChangedProps(shared));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: WORN_SHARING_KEY });
      // Nothing else on THIS device changes. `daily-looks` is what the
      // caller's friends wore, and their sharing is their own; the people this
      // switch affects re-read the view on their own devices and get the new
      // truth without being told.
    },
  });
}
