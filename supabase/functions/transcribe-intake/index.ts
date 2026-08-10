import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { enforceAiQuota } from '../_shared/quota.ts';

/**
 * transcribe-intake — a recording becomes words, and then stops existing.
 *
 * Invoked once per walkthrough, between V-02 and V-04. The client uploads to
 * `intake-audio/{user_id}/{session_id}.m4a` and calls this with the session id;
 * the object is fetched here through a signed URL, sent to an ASR model, and
 * DELETED on success in the same request.
 *
 * THE DELETION IS THE FEATURE, NOT HOUSEKEEPING
 *
 * V-01 tells the user, before the microphone opens: "The recording is
 * transcribed and deleted. Cinch keeps the words, never the audio." §8 requires
 * that sentence to be true. Every early return below that happens after a
 * successful transcription deletes first — and on failure the object is left
 * for a retry and reaped within 24 hours by `reap_intake_audio`.
 *
 * WHY THIS IS NOT completeStructured
 *
 * `_shared/openrouter.ts` posts JSON to /chat/completions. Transcription is a
 * multipart audio upload to /audio/transcriptions, a different endpoint with a
 * different body — so the call is made directly here rather than bent through
 * a helper built for chat.
 */

const BUCKET = 'intake-audio';

/** Only needs to outlive our own fetch of the object. */
const SIGNED_URL_TTL_SECONDS = 300;

/** §7's server-side caps. The client enforces both too; this is the half that
 *  cannot be edited by whoever is calling. */
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_MS = 12 * 60 * 1000;

/** Audio upload plus decode. Slower than any text call in the app. */
const TRANSCRIBE_TIMEOUT_MS = 120_000;

const MODEL = 'openai/whisper-large-v3';

/**
 * Decoder bias. Whisper-class models accept a prompt that conditions the
 * decoder toward a vocabulary, and garment nouns are exactly the words a
 * general model gets wrong — "chinos" as "cheenos", "poplin" as "popland".
 * Measurably better recall on the only words in the recording that matter.
 */
const GARMENT_VOCABULARY =
  'crewneck, chinos, loafers, blazer, midi, mules, cardigan, trousers, oxford, ' +
  'poplin, corduroy, shearling, turtleneck, cashmere, merino, denim, chambray, ' +
  'espadrilles, brogues, trench, parka, gilet, culottes, boucle, herringbone';

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

      let sessionId: string;
      let durationMs: number;
      try {
        const body = await req.json();
        sessionId = String(body?.sessionId ?? '');
        durationMs = Number(body?.durationMs ?? 0);
        if (!sessionId) throw new Error('sessionId is required');
      } catch {
        return Response.json({ error: 'bad_request' }, { status: 400 });
      }

      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
        return Response.json(
          { error: 'too_long', maxMinutes: MAX_DURATION_MS / 60000 },
          { status: 413 },
        );
      }

      // RLS proves ownership. The audio path is derived from the caller's own
      // id below rather than accepted from the body, so there is no path here
      // that names somebody else's object.
      const { data: session, error: sessionError } = await db
        .from('intake_sessions')
        .select('id, status')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        return Response.json({ error: 'session_unavailable' }, { status: 503 });
      }
      if (!session) {
        return Response.json({ error: 'not_found' }, { status: 404 });
      }

      const objectPath = `${userId}/${sessionId}.m4a`;

      // Size is checked before the model call, not after: the bucket's own
      // file_size_limit already refuses an oversized upload, and this catches
      // the case where the limit is later loosened without this being revisited.
      const { data: listed } = await admin.storage
        .from(BUCKET)
        .list(userId, { search: `${sessionId}.m4a` });
      const size = listed?.[0]?.metadata?.size as number | undefined;

      if (size === undefined) {
        return Response.json({ error: 'no_audio' }, { status: 404 });
      }
      if (size > MAX_BYTES) {
        await admin.storage.from(BUCKET).remove([objectPath]);
        return Response.json({ error: 'too_large' }, { status: 413 });
      }

      await db.from('intake_sessions')
        .update({ status: 'transcribing', duration_ms: Math.round(durationMs) })
        .eq('id', sessionId);

      // Claimed before the call and never refunded — the posture every AI path
      // here shares. See _shared/quota.ts.
      const quotaResponse = await enforceAiQuota(admin, userId, 'tagging');
      if (quotaResponse) {
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'quota_exhausted' })
          .eq('id', sessionId);
        return quotaResponse;
      }

      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed?.signedUrl) {
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'audio_unreadable' })
          .eq('id', sessionId);
        return Response.json({ error: 'audio_unreadable' }, { status: 500 });
      }

      let transcript: string;
      try {
        const audio = await fetch(signed.signedUrl, {
          signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        });
        if (!audio.ok) throw new Error(`audio fetch ${audio.status}`);

        const form = new FormData();
        form.append('file', await audio.blob(), `${sessionId}.m4a`);
        form.append('model', MODEL);
        form.append('prompt', GARMENT_VOCABULARY);
        // The transcript is read as prose downstream and the timings are never
        // used, so the smallest useful response format is the right one.
        form.append('response_format', 'text');

        const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        });

        if (!response.ok) throw new Error(`asr ${response.status}`);
        transcript = (await response.text()).trim();
      } catch {
        // The object SURVIVES this branch, deliberately. A failed transcription
        // is the one case where keeping the audio is the kind thing to do — it
        // means the retry does not ask the user to describe their whole
        // wardrobe a second time. reap_intake_audio takes it within 24 hours
        // whether or not they come back.
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'transcription_failed' })
          .eq('id', sessionId);
        return Response.json({ error: 'transcription_failed' }, { status: 502 });
      }

      // SUCCESS. The audio goes now, before anything else can fail — including
      // the database write below. An orphaned transcript is recoverable; an
      // orphaned recording is the thing we promised would not exist.
      await admin.storage.from(BUCKET).remove([objectPath]);

      if (!transcript) {
        // V-13, "silent recording". The microphone worked and returned nothing
        // — a muted input, or a user who never spoke.
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'silent' })
          .eq('id', sessionId);
        return Response.json({ error: 'silent' }, { status: 422 });
      }

      const { error: updateError } = await db.from('intake_sessions')
        .update({ status: 'parsing', transcript })
        .eq('id', sessionId);

      if (updateError) {
        return Response.json({ error: 'transcript_unwritable' }, { status: 500 });
      }

      return Response.json({ transcript });
    },
  ),
};
