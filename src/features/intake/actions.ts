import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import { intakeCommitted, intakeAbandoned, type AbandonState } from './analytics';
import { resolveSpokenColour } from './colour-lexicon';
import type { IntakeDraftRow } from './queries';

/** Same untyped-client cast as `queries.ts`, for the same reason and with the
 *  same removal condition — see the note there. */
const intakeDb = supabase as unknown as SupabaseClient;

/**
 * The writes a walkthrough makes.
 *
 * Three of them, and the order matters in exactly one place: colours are
 * resolved and saved BEFORE commit, because `commit_intake_session` reads
 * `colour_oklch` straight out of the draft and has no colour maths of its own.
 * A draft committed with a null colour becomes a garment with no colour, and a
 * garment with no colour is a drawn silhouette with no fill — a body-shaped
 * hole on the shelf.
 */

/**
 * Persist one card's edits.
 *
 * Called as the procession walks rather than batched at the end. A batch would
 * be one round trip instead of twenty, and would also mean a cold start loses
 * every correction made since the walkthrough began — which is the thing the
 * session table exists to prevent.
 */
export async function saveDraft(draftId: string, patch: Partial<IntakeDraftRow>): Promise<void> {
  const { error } = await intakeDb.from('intake_drafts').update(patch).eq('id', draftId);
  if (error) throw error;
}

/** Where the procession is, so a cold start reopens on the same card. */
export async function saveCursor(sessionId: string, cursor: number): Promise<void> {
  const { error } = await intakeDb
    .from('intake_sessions')
    .update({ cursor })
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * Resolve every confirmed draft's colour word into a real colour.
 *
 * `parse-closet` leaves `colour_oklch` null on purpose — the lexicon is client
 * code and resolving it server-side would put a second copy of a hundred-entry
 * table in a second runtime. This is where that debt is paid, in one pass, just
 * before commit.
 *
 * Only the confirmed ones: resolving a rejected draft's colour is work nobody
 * will ever see, and a held draft gets resolved when it is eventually committed.
 */
export async function resolveDraftColours(drafts: IntakeDraftRow[]): Promise<void> {
  const pending = drafts.filter((d) => d.state === 'confirmed' && d.colour_oklch === null);
  if (pending.length === 0) return;

  await Promise.all(
    pending.map((d) =>
      saveDraft(d.id, { colour_oklch: resolveSpokenColour(d.colour_term) }),
    ),
  );
}

export type CommitResult = { committed: number; held: number };

/**
 * Turn the confirmed drafts into garments.
 *
 * `commit_intake_session` is `security invoker`, so RLS is the ownership check
 * and the plan ceiling fires inside it exactly once. A `held` above zero is not
 * an error — it is M-07, and the drafts it refers to are still on the table for
 * M-08's picker to offer.
 */
export async function commitIntake(
  sessionId: string,
  drafts: IntakeDraftRow[],
): Promise<CommitResult> {
  await resolveDraftColours(drafts);

  const { data, error } = await intakeDb.rpc('commit_intake_session', {
    p_session_id: sessionId,
  });
  if (error) throw error;

  // The function returns a single row; PostgREST hands back an array for a
  // set-returning function whatever its cardinality.
  const row = (Array.isArray(data) ? data[0] : data) as CommitResult | undefined;
  const result = { committed: row?.committed ?? 0, held: row?.held ?? 0 };

  intakeCommitted(result.committed, result.held);
  return result;
}

/**
 * Leave a walkthrough without committing it.
 *
 * Marks the session and stops. It does NOT delete the drafts, and it does not
 * delete the transcript: §4.6 again, and because "abandoned" is very often
 * "interrupted" — the cheapest possible recovery is the row still being there
 * if they come back. `reap_intake_audio` takes the recording within 24 hours
 * either way, which is the part that actually has to expire.
 */
export async function abandonIntake(
  sessionId: string,
  state: AbandonState,
  cursor: number,
  total: number,
): Promise<void> {
  const { error } = await intakeDb
    .from('intake_sessions')
    .update({ status: 'abandoned' })
    .eq('id', sessionId);
  if (error) throw error;

  intakeAbandoned(state, cursor, total);
}
