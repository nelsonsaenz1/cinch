/**
 * The catalogue query, transcribed on the phone when the phone can do it.
 *
 * ── Scope, and the line that is not crossed ────────────────────────────────
 *
 * ONE SHORT PHRASE. "James Perse men's T-shirt" is four words into a search
 * field, and sending it to a cloud recogniser costs a round trip, a consent, a
 * slice of quota and an upload of somebody's voice — for a sentence Apple's own
 * recogniser handles offline in under a second.
 *
 * THE BULK WALKTHROUGH IS UNTOUCHED and stays on `transcribe-intake`. Twelve
 * minutes of a wardrobe read aloud is a different problem: on-device accuracy
 * degrades over long audio, the walkthrough's entire value is getting garment
 * nouns right, and the cloud path already does that with a vocabulary prompt.
 * Moving it here would be a downgrade wearing a privacy win's clothes.
 *
 * ── Why the cloud offer is EXPLICIT rather than a fallback ─────────────────
 *
 * `requiresOnDeviceRecognition` is set unconditionally on the native side, so
 * the recogniser refuses rather than quietly using Apple's servers. That is the
 * only way "on-device" is a claim instead of a hope — but it means a device
 * without an on-device model for the locale simply cannot do it, and plenty of
 * real hardware is in that position.
 *
 * When that happens the user is TOLD, and offered the existing consent-gated
 * cloud path as a choice. A silent fall-through would upload their voice under
 * a promise that it would not, which is the exact failure this whole packet is
 * meant to remove.
 */

import { LocalSpeech } from '../../../modules/garment-cutout';
import type {
  SpeechAuthorization,
  SpeechFailureReason,
  SpeechSupport,
} from '../../../modules/garment-cutout';

export * from './local-speech-policy';

/** Read support, or null when there is no native module to ask. */
export function speechSupport(locale?: string): SpeechSupport | null {
  if (!LocalSpeech) return null;
  try {
    return LocalSpeech.support(locale ?? null);
  } catch {
    return null;
  }
}

export async function requestSpeechPermission(): Promise<SpeechAuthorization> {
  if (!LocalSpeech) return 'restricted';
  try {
    return await LocalSpeech.requestAuthorization();
  } catch {
    return 'restricted';
  }
}

export type LocalTranscript =
  | { ok: true; transcript: string; confidence: number }
  | { ok: false; because: SpeechFailureReason | 'unsupported_device' };

/**
 * Transcribe a finished recording locally.
 *
 * The file already exists — `useRecorder` wrote it — and re-opening the
 * microphone here would mean two audio sessions for one utterance and a second
 * place that can leave it on.
 *
 * A failure is never an error the screen has to catch. It is a reason, and the
 * reason is what the cloud offer is worded from.
 */
export async function transcribeLocally(
  uri: string,
  locale?: string,
): Promise<LocalTranscript> {
  if (!LocalSpeech) return { ok: false, because: 'unsupported_device' };

  try {
    const result = await LocalSpeech.transcribe(uri, locale ?? null);
    if (result.ok) {
      return { ok: true, transcript: result.transcript, confidence: result.confidence };
    }
    return { ok: false, because: result.reason };
  } catch {
    return { ok: false, because: 'recognition_failed' };
  }
}

