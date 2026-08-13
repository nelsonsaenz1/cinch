import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { enforceAiQuota } from '../_shared/quota.ts';
import {
  deleteStoredAudio,
  MAX_DURATION_MS,
  transcribeStoredAudio,
} from './asr.ts';

/**
 * transcribe-intake — a recording becomes words, and then stops existing.
 *
 * TWO PURPOSES, ONE PROVIDER CALL, ONE PROMISE.
 *
 *   `walkthrough` (the default, and the ONLY behaviour before this change) is
 *   the bulk intake: one recording per session, driving an `intake_sessions`
 *   row from `transcribing` to `parsing`. Byte-compatible — a body with no
 *   `purpose` field is a walkthrough, so every deployed client keeps working
 *   without knowing this field exists.
 *
 *   `catalogue-query` is one spoken sentence for the Catalogue Photo V2
 *   matcher. It writes NOTHING. No session row is created, updated or read,
 *   because a single-item lookup is not an intake session and creating one
 *   would leave an orphan in `recording` forever that the resume logic
 *   (`intake_sessions_resumable_idx`) would then offer the user as unfinished
 *   work they never started.
 *
 * THE DELETION IS THE FEATURE, NOT HOUSEKEEPING, and it is identical for both.
 * The audio is removed the moment a transcript exists, before anything else can
 * fail; on a transient failure the object survives so the retry does not ask
 * somebody to speak again, and `reap_intake_audio` takes it within 24 hours
 * either way. That function deletes by AGE across the whole bucket, so it
 * covers catalogue objects with no change — which is why this packet needed no
 * migration.
 *
 * WHAT `catalogue-query` DOES NOT RELAX. Auth, the duration cap, the size cap,
 * the AI quota claim, the timeout and the redacted diagnostics are all the
 * walkthrough's, unchanged, because none of them was ever about the walkthrough.
 */

/** A client-generated opaque handle. Validated as a UUID so it cannot be bent
 *  into a path — the object name is built from it below. */
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Purpose = 'walkthrough' | 'catalogue-query';

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return Response.json(
          { error: 'OPENROUTER_API_KEY is not configured.' },
          { status: 500 },
        );
      }

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      const userId = ctx.userClaims?.id;

      if (!userId) {
        return Response.json({ error: 'unauthenticated' }, { status: 401 });
      }

      let purpose: Purpose;
      let handle: string;
      let durationMs: number;
      try {
        const body = await req.json();
        // Absent means walkthrough. That default IS the compatibility promise.
        const raw = body?.purpose === undefined ? 'walkthrough' : String(body.purpose);
        if (raw !== 'walkthrough' && raw !== 'catalogue-query') {
          return Response.json({ error: 'bad_request' }, { status: 400 });
        }
        purpose = raw;
        durationMs = Number(body?.durationMs ?? 0);

        if (purpose === 'walkthrough') {
          handle = String(body?.sessionId ?? '');
          if (!handle) throw new Error('sessionId is required');
        } else {
          handle = String(body?.requestId ?? '');
          if (!REQUEST_ID.test(handle)) throw new Error('requestId must be a uuid');
        }
      } catch {
        return Response.json({ error: 'bad_request' }, { status: 400 });
      }

      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
        return Response.json(
          { error: 'too_long', maxMinutes: MAX_DURATION_MS / 60000 },
          { status: 413 },
        );
      }

      const objectName = `${handle}.m4a`;

      return purpose === 'catalogue-query'
        ? await catalogueQuery(admin, apiKey, userId, handle, objectName)
        : await walkthrough(db, admin, apiKey, userId, handle, objectName, durationMs);
    },
  ),
};

/**
 * The bulk walkthrough. Unchanged in behaviour, statuses and status codes.
 *
 * Every line here was in `index.ts` before the split; the only edit is that the
 * provider call is now `transcribeStoredAudio`. `tests/transcribe-contract.test.ts`
 * pins the response codes so "unchanged" is a claim with a test behind it.
 */
async function walkthrough(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  apiKey: string,
  userId: string,
  sessionId: string,
  objectName: string,
  durationMs: number,
): Promise<Response> {
  // RLS proves ownership. The audio path is derived from the caller's own id,
  // never accepted from the body.
  const { data: session, error: sessionError } = await db
    .from('intake_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) return Response.json({ error: 'session_unavailable' }, { status: 503 });
  if (!session) return Response.json({ error: 'not_found' }, { status: 404 });

  await db
    .from('intake_sessions')
    .update({ status: 'transcribing', duration_ms: Math.round(durationMs) })
    .eq('id', sessionId);

  // Claimed before the call and never refunded — the posture every AI path
  // here shares. See _shared/quota.ts.
  const quotaResponse = await enforceAiQuota(admin, userId, 'tagging');
  if (quotaResponse) {
    await db
      .from('intake_sessions')
      .update({ status: 'failed', error_code: 'quota_exhausted' })
      .eq('id', sessionId);
    return quotaResponse;
  }

  const outcome = await transcribeStoredAudio(admin, apiKey, {
    userId,
    objectName,
    label: `session=${sessionId}`,
  });

  if (!outcome.ok) {
    if (outcome.failure === 'no_audio') {
      return Response.json({ error: 'no_audio' }, { status: 404 });
    }
    if (outcome.failure === 'too_large') {
      return Response.json({ error: 'too_large' }, { status: 413 });
    }
    const code = outcome.failure === 'audio_unreadable' ? 'audio_unreadable' : 'transcription_failed';
    await db.from('intake_sessions').update({ status: 'failed', error_code: code }).eq('id', sessionId);
    return Response.json({ error: code }, { status: outcome.status });
  }

  // SUCCESS. The audio goes now, before anything else can fail — including the
  // database write below. An orphaned transcript is recoverable; an orphaned
  // recording is the thing we promised would not exist.
  await deleteStoredAudio(admin, userId, objectName);

  if (!outcome.transcript) {
    // V-13, "silent recording". The microphone worked and returned nothing.
    await db
      .from('intake_sessions')
      .update({ status: 'failed', error_code: 'silent' })
      .eq('id', sessionId);
    return Response.json({ error: 'silent' }, { status: 422 });
  }

  const { error: updateError } = await db
    .from('intake_sessions')
    .update({ status: 'parsing', transcript: outcome.transcript })
    .eq('id', sessionId);

  if (updateError) {
    return Response.json({ error: 'transcript_unwritable' }, { status: 500 });
  }

  return Response.json({ transcript: outcome.transcript });
}

/**
 * One spoken sentence for the catalogue matcher.
 *
 * THE WHOLE POINT IS WHAT IS MISSING. There is no `db` parameter, so this
 * function cannot read or write `intake_sessions` even by accident — the
 * isolation is enforced by the signature rather than by everyone remembering.
 * `tests/transcribe-contract.test.ts` asserts the absence, because a future
 * edit that adds a status update here would create exactly the orphaned session
 * this mode exists to avoid.
 *
 * The transcript is RETURNED AND NOT STORED. It is one line of a person's own
 * words, it is about to be typed into a field they can edit, and Cinch has no
 * use for a copy — the catalogue search that follows sends the words to the
 * licensed feed and keeps nothing either.
 */
async function catalogueQuery(
  admin: SupabaseClient<Database>,
  apiKey: string,
  userId: string,
  requestId: string,
  objectName: string,
): Promise<Response> {
  // Same allowance, same workload, claimed before the call and never refunded.
  // A catalogue lookup that spoke costs an ASR call exactly as a walkthrough
  // does, and exempting it would be a hole in the ceiling rather than a feature.
  const quotaResponse = await enforceAiQuota(admin, userId, 'tagging');
  if (quotaResponse) return quotaResponse;

  const outcome = await transcribeStoredAudio(admin, apiKey, {
    userId,
    objectName,
    label: `catalogue=${requestId}`,
  });

  if (!outcome.ok) {
    // The object survives every branch but `too_large` (handled inside the
    // core), so the retry re-sends nothing and the reaper still takes it.
    return Response.json({ error: outcome.failure }, { status: outcome.status });
  }

  await deleteStoredAudio(admin, userId, objectName);

  if (!outcome.transcript) {
    return Response.json({ error: 'silent' }, { status: 422 });
  }

  return Response.json({ transcript: outcome.transcript });
}
