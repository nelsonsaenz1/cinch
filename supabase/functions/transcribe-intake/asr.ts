/**
 * The provider call, once, for both things that need it.
 *
 * `transcribe-intake` now serves two purposes — the bulk walkthrough and a
 * single-item catalogue query — and they differ entirely in their BOOKKEEPING
 * (one drives an `intake_sessions` row through a status machine, the other
 * touches no table at all) while being identical in the part that is hard: read
 * the object, check its size, sign a URL, post multipart to a provider whose
 * error shapes have already cost this codebase one silent outage, and redact
 * whatever comes back.
 *
 * Copying that block for the second caller would mean the next fix to it lands
 * in one copy. The `response_format: 'json'` note below is exactly such a fix,
 * and it took a production investigation to find — so the block moved here
 * instead, and both callers get it.
 *
 * WHAT IS NOT HERE, DELIBERATELY: quota, auth, deletion and every database
 * write. Those differ per purpose, and a core that did them would have to know
 * which purpose it was serving — which is the coupling this split exists to
 * remove.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { recordAiCall } from '../_shared/ai-calls.ts';
import { loadAiSettings } from '../_shared/ai-config.ts';
import { redactUrls } from '../_shared/openrouter.ts';

export const BUCKET = 'intake-audio';

/** Only needs to outlive our own fetch of the object. */
const SIGNED_URL_TTL_SECONDS = 300;

/** §7's server-side caps. The client enforces both too; this is the half that
 *  cannot be edited by whoever is calling. */
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_DURATION_MS = 12 * 60 * 1000;

/**
 * Audio upload plus decode. Slower than any text call in the app.
 *
 * A FLOOR, not the value: `ai_config.timeout_ms` for `voice_transcription` is
 * what actually bounds the call, and this is what happens when no row exists.
 * Same for the model. Both were compiled in until this packet, which meant
 * swapping a retired ASR model needed an App Store release.
 */
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MODEL = 'openai/whisper-large-v3';
const DEFAULT_MAX_TOKENS = 1_024;

/**
 * Decoder bias. Whisper-class models accept a prompt that conditions the
 * decoder toward a vocabulary, and garment nouns are exactly the words a
 * general model gets wrong — "chinos" as "cheenos", "poplin" as "popland".
 * Measurably better recall on the only words in the recording that matter.
 *
 * Shared by both purposes on purpose. A catalogue query is "James Perse men's
 * T-shirt" — the same vocabulary, with the maker's name added to it, and brand
 * names are the single thing dictation gets wrong most often here.
 */
const GARMENT_VOCABULARY =
  'crewneck, chinos, loafers, blazer, midi, mules, cardigan, trousers, oxford, ' +
  'poplin, corduroy, shearling, turtleneck, cashmere, merino, denim, chambray, ' +
  'espadrilles, brogues, trench, parka, gilet, culottes, boucle, herringbone';

export type AsrFailure =
  | 'no_audio'
  | 'too_large'
  | 'audio_unreadable'
  | 'transcription_failed';

export type AsrOutcome =
  | { ok: true; transcript: string; bytes: number }
  | { ok: false; failure: AsrFailure; status: number };

/**
 * Turn one stored object into words.
 *
 * `objectName` is the FILENAME only. The caller never passes a path: this
 * builds `${userId}/${objectName}` itself, so there is no argument through
 * which a request can name somebody else's object. That was true of the
 * walkthrough before this split and it stays true of both callers now.
 *
 * On `too_large` the object is removed here, because a file over the cap will
 * never transcribe and leaving it would be keeping audio for no reason. Every
 * OTHER failure leaves it in place — a retry must not have to ask the user to
 * speak again, and `reap_intake_audio` takes it within 24 hours regardless.
 * Deletion on SUCCESS belongs to the caller, which knows what else has to
 * happen first.
 */
export async function transcribeStoredAudio(
  admin: SupabaseClient<Database>,
  apiKey: string,
  { userId, objectName, label }: { userId: string; objectName: string; label: string },
): Promise<AsrOutcome> {
  const objectPath = `${userId}/${objectName}`;

  const settings = await loadAiSettings(admin, 'voice_transcription', {
    modelId: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  // Size is checked before the model call, not after: the bucket's own
  // file_size_limit already refuses an oversized upload, and this catches the
  // case where the limit is later loosened without this being revisited.
  const { data: listed } = await admin.storage.from(BUCKET).list(userId, { search: objectName });
  const size = listed?.[0]?.metadata?.size as number | undefined;

  if (size === undefined) return { ok: false, failure: 'no_audio', status: 404 };
  if (size > MAX_BYTES) {
    await admin.storage.from(BUCKET).remove([objectPath]);
    return { ok: false, failure: 'too_large', status: 413 };
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return { ok: false, failure: 'audio_unreadable', status: 500 };
  }

  /**
   * The ledger row this call never wrote.
   *
   * Every other model call in the app lands in `ai_calls`; the ASR call did
   * not, which meant transcription was the one workload nobody could cost, and
   * the one whose failure rate could only be inferred from user complaints.
   *
   * WHAT GOES IN IT: model, latency, attempts, success, and a redacted failure
   * reason. WHAT DOES NOT: the transcript, the object name, the signed URL, and
   * the audio. `ai_calls.error` is read by whoever is debugging cost, and a
   * transcript is the user's own sentence — the same argument `redactUrls`
   * already makes about signed URLs on the tagging path.
   *
   * `attempts` is 1 because this call does not retry. Recording a hard-coded 1
   * where there is no loop is truthful; recording nothing, as it did before,
   * left the column null on every ASR row and unusable in aggregate.
   */
  const startedAt = Date.now();
  const ledger = async (succeeded: boolean, error: string | null) => {
    await recordAiCall(admin, {
      user_id: userId,
      workload: 'voice_transcription',
      provider: settings.provider,
      model_id: settings.modelId,
      prompt_tokens: null,
      completion_tokens: null,
      cost_usd: null,
      latency_ms: Date.now() - startedAt,
      succeeded,
      attempts: 1,
      error,
    });
  };

  try {
    const audio = await fetch(signed.signedUrl, {
      signal: AbortSignal.timeout(settings.timeoutMs),
    });
    if (!audio.ok) throw new Error(`audio fetch ${audio.status}`);

    const form = new FormData();
    form.append('file', await audio.blob(), objectName);
    form.append('model', settings.modelId);
    form.append('prompt', GARMENT_VOCABULARY);
    /**
     * `json`, NOT `text`.
     *
     * This one word is why voice intake never worked. OpenAI's own
     * transcription API accepts `text` and returns a bare string, and this line
     * was written against that documentation — but OpenRouter's implementation
     * of the same endpoint does not:
     *
     *   asr 400: Unsupported response_format "text".
     *            Only "json" and "verbose_json" are supported.
     *
     * Every call the function made was rejected before the audio was even read,
     * and a bare `catch {}` discarded the message. The result looked exactly
     * like a transcription that failed for a mundane reason.
     *
     * It is in the shared core now precisely because it is this expensive to
     * rediscover.
     */
    form.append('response_format', 'json');

    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(settings.timeoutMs),
    });

    if (!response.ok) {
      // The BODY, not just the status. A bare status once told us this function
      // had never succeeded and nothing else.
      const detail = redactUrls(await response.text().catch(() => '')).slice(0, 500);
      throw new Error(`asr ${response.status}: ${detail}`);
    }

    const body = await response.json();
    // `{ text: "…" }`. Anything else is a provider that answered 200 with a
    // shape we do not recognise, which must not read as a silent recording —
    // that branch belongs to a user who did not speak.
    if (typeof body?.text !== 'string') {
      throw new Error(
        `asr returned no text field: ${redactUrls(JSON.stringify(body)).slice(0, 200)}`,
      );
    }

    await ledger(true, null);
    return { ok: true, transcript: body.text.trim(), bytes: size };
  } catch (error) {
    // WHATEVER ELSE CHANGES HERE, THIS LOGS. The one thing an ASR integration
    // cannot afford is to fail quietly, because the failure is indistinguishable
    // from a user who did not speak.
    //
    // `label` is the caller's own opaque handle — a session id or a catalogue
    // request id. Neither is user content, and no transcript, filename or signed
    // URL reaches this line.
    const reason = redactUrls(
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
    console.error(
      `transcribe-intake FAILED (${label}, user=${userId}, model=${settings.modelId}, bytes=${size}): ${reason}`,
    );
    // Truncated: `ai_calls.error` is an operational column, not a log sink, and
    // a provider that echoes a long request back would otherwise fill it.
    await ledger(false, reason.slice(0, 300));
    return { ok: false, failure: 'transcription_failed', status: 502 };
  }
}

/** Remove the object. Called on success, and on a silent take. */
export async function deleteStoredAudio(
  admin: SupabaseClient<Database>,
  userId: string,
  objectName: string,
): Promise<void> {
  await admin.storage.from(BUCKET).remove([`${userId}/${objectName}`]);
}
