import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { getUserId, supabase } from '@/lib/supabase';

import { intakeFailed, type FailureCause } from './analytics';

/**
 * use-transcription — a recording becomes words, or an honest reason it did not.
 *
 * §6: "upload → transcript, with retry and offline hold." Two steps, in order,
 * against `transcribe-intake` (see that function's own header for the deletion
 * contract this hook has to respect):
 *
 *   1. Put the take at the exact Storage path the function derives itself —
 *      `{user_id}/{session_id}.m4a` — so it is found, not 404'd as `no_audio`.
 *   2. Invoke the function with `{ sessionId, durationMs }` and turn whatever
 *      comes back into one of the causes V-13 draws a distinct screen for.
 *
 * THE OFFLINE HOLD (refusal #7, "nothing is ever lost")
 *
 * `use-recorder.ts` (not this file) is where the take is written to disk and
 * where `localUri` comes from. This hook's whole contract with that file is:
 * never delete what was handed in unless the server has confirmed the words are
 * safe. Concretely —
 *
 *   - `transcribe-intake` deletes the STORAGE object itself, inside the same
 *     request, the instant it has a transcript. This hook never calls
 *     `storage.remove` for that reason — doing so would race the function, and
 *     succeeding would just mean two callers agreeing to delete something once.
 *   - The one thing this hook is responsible for deleting is the DEVICE copy —
 *     the local file `localUri` still points at — and only `onSuccess`, after
 *     the transcript has actually landed. Every failure path leaves it exactly
 *     where it was, so "Retry" always has something to retry with.
 *   - Retrying never re-records. It calls `mutate()` again with the same
 *     `localUri`, which re-runs the upload step. That step tolerates the object
 *     already being there (see `uploadAudio`'s 409 branch) — which matters
 *     because most retryable failures leave the object in place server-side
 *     (`transcribe-intake`'s own comment: "The object SURVIVES this branch,
 *     deliberately"), and the bucket's migration deliberately grants no UPDATE
 *     policy on `storage.objects`, so a second `upload()` to a survived object
 *     cannot succeed as an overwrite — it can only be told the object is
 *     already there, which this hook treats as "good, carry on."
 *
 * THE ERROR UNION
 *
 * `transcribe-intake` answers with a small, closed set of JSON error codes,
 * each at its own HTTP status, and a screen cannot make V-13's "four distinct
 * causes, four distinct screens" promise off a bare thrown string — it would
 * have to string-match, which is exactly what this file exists to make
 * unnecessary. `TranscriptionFailure` mirrors the function's vocabulary
 * directly instead of pre-collapsing it into V-13's four rows: `silent`,
 * `too_long`, `too_large`, `no_audio` and `transcription_failed` each keep
 * their own tag, and the 402/403-free 402 vs 429 quota shapes keep their own
 * fields (`retryAfterSeconds` matters for one and not the other). Collapsing
 * happens exactly once, in `toFailureCause` below, and only for the analytics
 * bucket — the screen gets the full-resolution reason.
 */

const BUCKET = 'intake-audio';

// ---------------------------------------------------------------------------
// The error union
// ---------------------------------------------------------------------------

export type TranscriptionFailure =
  /** V-13 row 2. The mic worked; nothing was said, or nothing loud enough to
   *  keep. The Storage object is already gone by the time this arrives — see
   *  `transcribe-intake`'s SUCCESS comment — so re-sending the same audio will
   *  reproduce this exactly. Needs a new recording, not a retry. */
  | { kind: 'silent' }
  /** Defensive: the client already caps recording at 12 minutes (§3, V-02), so
   *  reaching this means the cap was bypassed somehow, not that anyone spoke
   *  for longer than allowed. */
  | { kind: 'too_long'; maxMinutes: number }
  /** The object exceeded 25 MB and the server deleted it itself. Like `silent`,
   *  retrying with the same file reproduces the same failure — the fix is a
   *  shorter take, not another attempt. */
  | { kind: 'too_large' }
  /** Nothing was found at `{user_id}/{session_id}.m4a}`. Ordinarily this means
   *  this hook's own upload step never actually landed (a killed app mid-PUT,
   *  a dropped connection) — calling `mutate()` again re-attempts the upload
   *  from the still-retained local file, which is exactly the fix. */
  | { kind: 'no_audio' }
  /** The ASR call itself failed after the object was confirmed present. The
   *  object survives this one server-side (§ above) — a retry only re-invokes,
   *  it does not need to re-upload, though it is harmless if it does. */
  | { kind: 'transcription_failed' }
  /** 402 — this plan does not include transcription at all. Retrying will not
   *  help; only an upgrade will. */
  | { kind: 'quota_upgrade_required'; message: string }
  /** 429 — the plan includes it and this period's allowance is spent. */
  | { kind: 'quota_exceeded'; message: string; retryAfterSeconds: number }
  /** No structured answer came back at all — `FunctionsRelayError`,
   *  `FunctionsFetchError`, a thrown network error mid-upload, or a 5xx this
   *  hook could not otherwise place. V-13 row 4: "I can't reach the
   *  transcriber. Your recording is safe." The one case the offline-hold
   *  promise exists for. */
  | { kind: 'offline' }
  /** A recognised HTTP response that does not carry one of the codes above —
   *  a config fault (`OPENROUTER_API_KEY` missing), an auth edge case, a write
   *  the function itself could not complete. Rare, and rare enough that giving
   *  it its own V-13 row is not worth the screen count; it reads the same as
   *  `offline` to the person holding the phone. */
  | { kind: 'service_error'; message?: string };

export class TranscriptionError extends Error {
  constructor(readonly failure: TranscriptionFailure) {
    super(describeFailure(failure));
    this.name = 'TranscriptionError';
  }
}

function describeFailure(failure: TranscriptionFailure): string {
  switch (failure.kind) {
    case 'silent':
      return "I didn't catch anything.";
    case 'too_long':
      return `That recording ran past ${failure.maxMinutes} minutes.`;
    case 'too_large':
      return 'That recording was too large to send.';
    case 'no_audio':
      return "Cinch couldn't find the recording to send.";
    case 'transcription_failed':
      return "I can't reach the transcriber. Your recording is safe.";
    case 'quota_upgrade_required':
    case 'quota_exceeded':
      return failure.message;
    case 'offline':
      return "I can't reach the transcriber. Your recording is safe.";
    case 'service_error':
      return failure.message ?? 'Something went wrong. Your recording is safe.';
  }
}

/**
 * True for the two causes where the audio itself is the problem, not the
 * connection to it — retrying with the identical bytes will fail identically.
 * V-13 phrases these as "Try again" (re-record) rather than "Retry".
 */
export function needsNewRecording(failure: TranscriptionFailure): boolean {
  return failure.kind === 'silent' || failure.kind === 'too_large';
}

/**
 * Collapse the full-resolution failure into the closed vocabulary
 * `intakeFailed` accepts (`FailureCause`, defined in `buckets.ts` to mirror
 * `intake_sessions.error_code`). `too_long`, `too_large`, `no_audio` and
 * `service_error` have no dedicated bucket — all four are, from the funnel's
 * point of view, "something about this take could not be sent or read", which
 * is what `audio_unreadable` already means for the one server code
 * (`audio_unreadable` itself, a failed signed-URL) that does have a bucket.
 */
function toFailureCause(failure: TranscriptionFailure): FailureCause {
  switch (failure.kind) {
    case 'silent':
      return 'silent';
    case 'transcription_failed':
      return 'transcription_failed';
    case 'quota_upgrade_required':
    case 'quota_exceeded':
      return 'quota_exhausted';
    case 'offline':
      return 'offline';
    case 'too_long':
    case 'too_large':
    case 'no_audio':
    case 'service_error':
      return 'audio_unreadable';
  }
}

// ---------------------------------------------------------------------------
// Reading the function's error body
// ---------------------------------------------------------------------------

type TranscribeErrorBody = {
  error?: string;
  /** Present on `too_long` only. */
  maxMinutes?: number;
  /** Present on the two quota shapes (`plan_upgrade_required`, `ai_quota_exceeded`). */
  message?: string;
  /** Present on `ai_quota_exceeded` only — `plan_upgrade_required` has no clock
   *  to wait out, per `_shared/quota.ts`'s own comment on why that one shows an
   *  upgrade rather than a retry time. */
  retryAfterSeconds?: number;
};

/** Same idiom as `ingest/upload-queue.ts` and `ingest/use-garment-search.ts`:
 *  the status and JSON body of a non-2xx `functions.invoke`, as far as either
 *  can be read. */
async function readHttpError(
  error: unknown,
): Promise<{ status: number | null; body: TranscribeErrorBody | null }> {
  if (!(error instanceof FunctionsHttpError)) return { status: null, body: null };
  const response = (error as { context?: unknown }).context as Response | undefined;
  if (!response) return { status: null, body: null };
  try {
    return { status: response.status, body: (await response.json()) as TranscribeErrorBody };
  } catch {
    return { status: response.status, body: null };
  }
}

function classify(status: number | null, body: TranscribeErrorBody | null): TranscriptionFailure {
  switch (body?.error) {
    case 'silent':
      return { kind: 'silent' };
    case 'too_long':
      return { kind: 'too_long', maxMinutes: body?.maxMinutes ?? 12 };
    case 'too_large':
      return { kind: 'too_large' };
    case 'no_audio':
      return { kind: 'no_audio' };
    case 'transcription_failed':
      return { kind: 'transcription_failed' };
    case 'plan_upgrade_required':
      return {
        kind: 'quota_upgrade_required',
        message: body?.message ?? 'Transcribing your closet needs a plan upgrade.',
      };
    case 'ai_quota_exceeded':
      return {
        kind: 'quota_exceeded',
        message: body?.message ?? "You've used this period's allowance.",
        retryAfterSeconds: body?.retryAfterSeconds ?? 60,
      };
    default:
      // Covers `bad_request`, `unauthenticated`, `session_unavailable`,
      // `not_found`, `audio_unreadable`, `transcript_unwritable`, the
      // missing-API-key 500, and anything the function starts returning later
      // that this file has not been taught yet — all of it reads as
      // `service_error` rather than crashing on an unrecognised shape.
      return { kind: 'service_error', message: body?.error ?? (status ? `http_${status}` : undefined) };
  }
}

// ---------------------------------------------------------------------------
// The upload
// ---------------------------------------------------------------------------

/**
 * Put the take where `transcribe-intake` will look for it, and only there.
 *
 * The path is derived from `userId`/`sessionId` exactly as the function derives
 * it server-side (`${userId}/${sessionId}.m4a`) — not accepted as a parameter
 * from anywhere else, so there is no way to call this with a path that lands on
 * somebody else's object or a stale one of the caller's own.
 */
async function uploadAudio(userId: string, sessionId: string, localUri: string): Promise<void> {
  const path = `${userId}/${sessionId}.m4a`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new TranscriptionError({ kind: 'offline' });
  }

  const file = new File(localUri);

  let result;
  try {
    result = await file.upload(data.signedUrl, {
      httpMethod: 'PUT',
      mimeType: 'audio/m4a',
      headers: { 'content-type': 'audio/m4a' },
      // Survives the app being backgrounded mid-upload, same reasoning as the
      // photo path in `ingest/upload-queue.ts`.
      sessionType: 'background',
    });
  } catch {
    throw new TranscriptionError({ kind: 'offline' });
  }

  // The expected shape of a retry finding its own earlier upload still there.
  // `20260810140300_intake_audio_bucket.sql` grants INSERT and DELETE on this
  // bucket's objects but deliberately no UPDATE ("a rewritable audio path would
  // let a caller swap the file between upload and transcription"), so a second
  // PUT to a path that already holds an object cannot succeed as an overwrite —
  // the server can only ever answer 409. Since `transcribe-intake` leaves the
  // object in place on every retryable failure specifically so the retry does
  // not have to re-send, a 409 here means the earlier attempt's upload is
  // exactly the one already on the server, and there is nothing left to do.
  if (result.status === 409) return;

  if (result.status >= 400) {
    throw new TranscriptionError({ kind: 'offline' });
  }
}

// ---------------------------------------------------------------------------
// Local cleanup
// ---------------------------------------------------------------------------

/**
 * The device-side half of "the recording is transcribed and deleted."
 *
 * Never throws — a stray local file after a successful transcription is a few
 * megabytes on one phone, not a broken promise. The promise V-01 makes is about
 * what CINCH holds, and by the time this runs the server's copy is already
 * gone; the local copy was only ever this hook's insurance against losing the
 * recording to a failed call.
 */
function deleteLocalRecording(localUri: string): void {
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort, as above.
  }
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export type TranscribeInput = {
  sessionId: string;
  /** Wherever `use-recorder.ts` left the finished take. Untouched by this hook
   *  until `onSuccess` — see the file header. */
  localUri: string;
  durationMs: number;
};

export type TranscribeResult = { transcript: string };

/**
 * Upload, then transcribe. `mutate()` is also the retry: calling it again with
 * the same `TranscribeInput` is the entire retry story (see the file header on
 * why re-uploading is always safe).
 */
export function useTranscription() {
  return useMutation<TranscribeResult, TranscriptionError, TranscribeInput>({
    mutationFn: async ({ sessionId, localUri, durationMs }) => {
      const userId = await getUserId();
      if (!userId) {
        throw new TranscriptionError({ kind: 'service_error', message: 'not_signed_in' });
      }

      await uploadAudio(userId, sessionId, localUri);

      const { data, error } = await supabase.functions.invoke<{ transcript?: string }>(
        'transcribe-intake',
        { body: { sessionId, durationMs } },
      );

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const { status, body } = await readHttpError(error);
          throw new TranscriptionError(classify(status, body));
        }
        // `FunctionsFetchError` (never reached the network) or
        // `FunctionsRelayError` (reached Supabase, not this function) — neither
        // carries a body to classify, and both are the connection failing
        // rather than the function answering. V-13's offline row either way.
        throw new TranscriptionError({ kind: 'offline' });
      }

      if (!data?.transcript) {
        throw new TranscriptionError({
          kind: 'service_error',
          message: 'transcribe-intake returned 200 with no transcript',
        });
      }

      return { transcript: data.transcript };
    },

    onSuccess: (_result, variables) => {
      deleteLocalRecording(variables.localUri);
    },

    onError: (err) => {
      intakeFailed(toFailureCause(err.failure));
    },
  });
}
