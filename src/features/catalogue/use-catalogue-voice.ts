/**
 * CPV2-02 and CPV2-03 — one spoken sentence becomes the words in the field.
 *
 * WHAT THIS IS NOT: a second voice feature. The recorder is the shipping
 * `useRecorder` (permission, metering, the twelve-minute cap, finalising on
 * backgrounding — all of it already built and verified), the upload is the
 * shipping `uploadAudio`, and the failure vocabulary is the shipping
 * `TranscriptionFailure`. The only new thing is that the request carries
 * `purpose: 'catalogue-query'` and an opaque id instead of a session id.
 *
 * WHY THERE IS NO SESSION. A walkthrough is a durable thing: it survives being
 * closed, it can be resumed, and `intake_sessions_resumable_idx` will offer it
 * back. A single spoken query is none of those. Creating a session row for it
 * would leave an orphan in `recording` that the resume prompt then offers the
 * user as unfinished work they never started — so the server mode writes
 * nothing and this hook has no session to create.
 *
 * THE TRANSCRIPT NEVER AUTO-SEARCHES. It lands in the field and stops. Dictation
 * mishears brand names more than it mishears anything else, and "James Purse"
 * would spend a metered request to return nothing. CPV2-03 gives the transcript
 * its own primary action for exactly this reason, and §2 calls the transcript
 * editable — which only means something if the user gets to look at it first.
 */

import { useCallback, useRef, useState } from 'react';

import { getUserId, supabase } from '@/lib/supabase';
import {
  classify,
  deleteLocalRecording,
  readHttpError,
  TranscriptionError,
  uploadAudio,
  type TranscriptionFailure,
} from '@/features/intake/use-transcription';
import { useRecorder, type RecorderResult } from '@/features/intake/use-recorder';
import { newRequestId } from './request-id';
import type { SharedValue } from 'react-native-reanimated';
import { FunctionsHttpError } from '@supabase/supabase-js';

/** What the screen draws. One value — two of these can never both be true. */
/**
 * CPV2-02's ceiling, stated on screen as "of 0:30".
 *
 * The walkthrough's twelve minutes is a wardrobe read aloud; this is one
 * sentence naming one garment. A bound the user is told about is also a bound
 * that stops a pocket recording from spending a two-minute ASR call.
 */
export const CATALOGUE_MAX_RECORDING_MS = 30_000;

export type VoiceStage =
  | 'idle'
  | 'permission-denied'
  | 'recording'
  | 'transcribing'
  | 'failed';

export type CatalogueVoice = {
  stage: VoiceStage;
  /** Set on `failed`. Carries whether a new recording is needed. */
  failure: TranscriptionFailure | null;
  /** Live length while recording, for the elapsed line. */
  elapsedMs: number;
  /**
   * 0…1, updated ~30Hz, read on the UI thread by the meter.
   *
   * Passed straight through from `useRecorder` rather than mirrored into state:
   * a 30Hz `setState` would re-render the whole screen thirty times a second to
   * move ten bars.
   */
  amplitude: SharedValue<number>;
  /** Ask for the microphone and open it. */
  start: () => Promise<void>;
  /** Finish and transcribe. The transcript arrives via `onTranscript`. */
  stop: () => Promise<void>;
  /** Abandon: stop the microphone, delete the take, keep the field as it was. */
  cancel: () => Promise<void>;
  /** Retry the LAST take without re-recording. Null when there is nothing to retry. */
  retry: (() => Promise<void>) | null;
};

export function useCatalogueVoice(onTranscript: (transcript: string) => void): CatalogueVoice {
  const recorder = useRecorder(CATALOGUE_MAX_RECORDING_MS);
  const [stage, setStage] = useState<VoiceStage>('idle');
  const [failure, setFailure] = useState<TranscriptionFailure | null>(null);
  const [retryable, setRetryable] = useState(false);

  // The last finished take, held only so `retry` does not need a new recording.
  // Cleared on success and on cancel — the local file is deleted with it.
  const lastTake = useRef<{ result: RecorderResult; requestId: string } | null>(null);

  const transcribe = useCallback(
    async (take: RecorderResult, requestId: string) => {
      setStage('transcribing');
      setFailure(null);

      try {
        const userId = await getUserId();
        if (!userId) throw new TranscriptionError({ kind: 'service_error', message: 'not_signed_in' });

        // Same upload the walkthrough uses, including its 409-means-the-earlier
        // -attempt-is-already-there branch, which is what makes `retry` safe.
        await uploadAudio(userId, requestId, take.uri);

        const { data, error } = await supabase.functions.invoke<{ transcript?: string }>(
          'transcribe-intake',
          {
            body: {
              purpose: 'catalogue-query',
              requestId,
              durationMs: take.durationMs,
            },
          },
        );

        if (error) {
          if (error instanceof FunctionsHttpError) {
            const { status, body } = await readHttpError(error);
            throw new TranscriptionError(classify(status, body));
          }
          // Never reached the network, or reached Supabase and not this
          // function. Neither carries a body to classify; both are offline.
          throw new TranscriptionError({ kind: 'offline' });
        }

        if (!data?.transcript) {
          throw new TranscriptionError({
            kind: 'service_error',
            message: 'transcribe-intake returned 200 with no transcript',
          });
        }

        // The server has already deleted its copy. This is the device half of
        // the same promise.
        deleteLocalRecording(take.uri);
        lastTake.current = null;
        setRetryable(false);
        setStage('idle');
        onTranscript(data.transcript);
      } catch (err) {
        // The take SURVIVES a failure, on the device and on the server, so the
        // retry does not ask somebody to say it again. `reap_intake_audio`
        // takes the server copy within 24 hours regardless.
        setFailure(
          err instanceof TranscriptionError ? err.failure : { kind: 'service_error', message: 'unknown' },
        );
        setStage('failed');
      }
    },
    [onTranscript],
  );

  const start = useCallback(async () => {
    const granted = await recorder.requestPermission();
    if (granted !== 'granted') {
      // A denial is a settled state with its own recovery (Settings), not a
      // failure of the recording — so it is its own stage and never an error row.
      setStage('permission-denied');
      return;
    }
    setFailure(null);
    lastTake.current = null;
    setRetryable(false);
    await recorder.start();
    setStage('recording');
  }, [recorder]);

  const stop = useCallback(async () => {
    const take = await recorder.stop('user');
    if (!take) {
      // The microphone opened and captured nothing. Same state as a silent
      // recording, without spending a request to be told so.
      setFailure({ kind: 'silent' });
      setStage('failed');
      return;
    }
    const requestId = newRequestId();
    lastTake.current = { result: take, requestId };
    setRetryable(true);
    await transcribe(take, requestId);
  }, [recorder, transcribe]);

  const cancel = useCallback(async () => {
    if (recorder.isRecording) {
      const take = await recorder.stop('user');
      if (take) deleteLocalRecording(take.uri);
    }
    if (lastTake.current) deleteLocalRecording(lastTake.current.result.uri);
    lastTake.current = null;
    setRetryable(false);
    setFailure(null);
    setStage('idle');
  }, [recorder]);

  /**
   * Retry the take that failed, without asking anyone to speak again.
   *
   * `retryable` is STATE and `lastTake` is a ref, and both are needed: reading
   * the ref during render to decide whether to offer the control is a
   * rules-of-hooks violation (a ref's value is not a render input), while
   * holding the take itself in state would re-render on every recording. So the
   * flag drives the UI and the ref carries the payload.
   *
   * The SAME request id, so a retry whose first upload already landed hits
   * `uploadAudio`'s 409 branch and re-sends no audio at all.
   */
  const retry = useCallback(async () => {
    const held = lastTake.current;
    if (held) await transcribe(held.result, held.requestId);
  }, [transcribe]);

  return {
    stage,
    failure,
    elapsedMs: recorder.elapsedMs,
    amplitude: recorder.amplitude,
    start,
    stop,
    cancel,
    retry: retryable ? retry : null,
  };
}
