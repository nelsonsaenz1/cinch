/**
 * The note, on its way out.
 *
 * The `support-mail` Edge Function is Unit E's, built in parallel; nothing here
 * builds it and nothing here may be taken as its specification. This is the
 * CLIENT side of the contract as the build brief states it, written so a
 * mismatch shows up as a typed field rather than as a silent drop:
 *
 *     POST support-mail  { topic, body, query?, articleId?, diagnostics }
 *     200  { ok: true }
 *     non-2xx  { error: string }
 *     429  { error: <a human sentence, shown verbatim> }
 *
 * ── The 429 sentence, and why it is not "something went wrong" ────────────
 *
 * Throttling is the one failure here with a real reason behind it, and the
 * server is the only thing that knows the reason. `supabase.functions.invoke`
 * does NOT put a non-2xx body on `data` — it throws a `FunctionsHttpError` and
 * hangs the original `Response` off `context`, which is the trap
 * `features/billing/use-gate.ts:36-42` documents at length and the reason this
 * awaits `.json()` rather than reading a field. Miss it, and a rate limit reads
 * as a network failure and the reader taps Send four more times.
 *
 * ── Attachments are NOT assumed ───────────────────────────────────────────
 *
 * `attachment` is sent under a shape this unit proposes and Unit E has not
 * agreed: `{ filename, mimeType, base64 }`, one image, base64 without a data-
 * URI prefix. It is declared optional on both sides of that sentence — the
 * request type marks it, and `MAX_ATTACHMENT_BYTES` keeps it inside anything a
 * function body could plausibly accept. If Unit E cannot take it, the honest
 * fix is to remove the attach row from HS-04, NOT to keep a control that
 * quietly discards a file somebody chose. See the report accompanying this
 * work.
 */

import { supabase } from '@/lib/supabase';

import type { SupportDiagnostics } from '@/features/help/diagnostics';

/**
 * The four chips on HS-04, as values.
 *
 * Ids rather than labels on the wire: the label is copy and will be edited,
 * and a mail rule keyed on the word "Something is broken" breaks the first
 * time somebody improves the sentence.
 */
export type SupportTopic = 'broken' | 'question' | 'billing' | 'idea';

export type SupportTopicOption = {
  readonly id: SupportTopic;
  readonly label: string;
};

export const SUPPORT_TOPICS: readonly SupportTopicOption[] = [
  { id: 'broken', label: 'Something is broken' },
  { id: 'question', label: 'A question' },
  { id: 'billing', label: 'Billing' },
  { id: 'idea', label: 'An idea' },
];

export type SupportAttachment = {
  readonly filename: string;
  readonly mimeType: string;
  /** Base64 WITHOUT a `data:` prefix. */
  readonly base64: string;
};

export type SupportRequest = {
  readonly topic: SupportTopic;
  readonly body: string;
  /** The search that found nothing, when the note was started from HS-03. */
  readonly query?: string;
  /** The article the reader said did not answer it, from HS-02's "Not quite". */
  readonly articleId?: string;
  readonly diagnostics: SupportDiagnostics;
  /** See the docblock — a proposed shape, not an agreed one. */
  readonly attachment?: SupportAttachment;
};

/**
 * A base64 image bigger than this is refused before it is sent.
 *
 * A screenshot picked at quality 0.7 is comfortably inside it; a burst of a
 * 48-megapixel photograph is not. The refusal is in front of the reader with a
 * plain sentence rather than behind a 413 they cannot act on — 1.5 MB of base64
 * is roughly 1.1 MB of image, which is a very large screenshot.
 */
export const MAX_ATTACHMENT_BYTES = 1_500_000;

/**
 * A failure with something worth showing.
 *
 * `message` is always a whole sentence fit to print — either the server's own
 * (the throttle case) or one written here. Nothing calls `String(error)` on
 * this and hopes.
 */
export class SupportMailError extends Error {
  readonly kind: 'throttled' | 'unavailable' | 'refused' | 'offline';

  constructor(message: string, kind: SupportMailError['kind']) {
    super(message);
    this.name = 'SupportMailError';
    this.kind = kind;
  }
}

/** Read `{ error }` off a non-2xx response, or null if it is unreadable. */
async function serverSentence(response: Response): Promise<string | null> {
  try {
    // `clone()` for the reason use-gate.ts gives: a body can be consumed once,
    // and something else may want to look at it.
    const parsed = (await response.clone().json()) as { error?: unknown };
    const sentence = typeof parsed.error === 'string' ? parsed.error.trim() : '';
    return sentence.length > 0 ? sentence : null;
  } catch {
    return null;
  }
}

/**
 * What a send is allowed to claim afterwards.
 *
 * HS-05 is drawn saying "A copy is in your mail, sent to sophie@mail.com". That
 * is a claim about what the FUNCTION did, and this side of the wire cannot know
 * it — so the sentence is printed only when the function says so, by returning
 * the address it copied. The agreed response shape is `{ ok: true }`; this asks
 * Unit E for one optional field more, and degrades to a confirmation with no
 * copy sentence when it is absent. Nothing on the screen promises a mail that
 * may not exist.
 */
export type SupportSendResult = {
  /** The address the function says it copied, or null if it did not say. */
  readonly copySentTo: string | null;
};

/**
 * Send it. Resolves on `{ ok: true }`; throws a `SupportMailError` otherwise.
 */
export async function sendSupportMail(request: SupportRequest): Promise<SupportSendResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
    copySentTo?: string;
  }>(
    'support-mail',
    {
      body: {
        topic: request.topic,
        body: request.body,
        ...(request.query ? { query: request.query } : null),
        ...(request.articleId ? { articleId: request.articleId } : null),
        diagnostics: request.diagnostics,
        ...(request.attachment ? { attachment: request.attachment } : null),
      },
    },
  );

  if (error) {
    const response = (error as { context?: unknown }).context;

    if (response instanceof Response) {
      const sentence = await serverSentence(response);

      // The throttle. The server's sentence is the whole point of this branch:
      // it knows how long, and this side does not.
      if (response.status === 429) {
        throw new SupportMailError(
          sentence ?? 'That went out a moment ago. Give it a few minutes before the next one.',
          'throttled',
        );
      }

      // 404 is what a merge looks like before `supabase functions deploy
      // support-mail` has run. It must not read as "your note was rejected".
      if (response.status === 404) {
        throw new SupportMailError(
          'The note could not be sent from this build yet. Writing to hello@mail.cinchstyle.com from your own mail reaches the same two people.',
          'unavailable',
        );
      }

      throw new SupportMailError(sentence ?? 'The note did not go through.', 'refused');
    }

    throw new SupportMailError(
      'The note did not go out — that usually means the connection dropped. It is still here; try again.',
      'offline',
    );
  }

  // A 200 whose body does not say `ok` is not a success, and treating it as one
  // is how "sent" appears over a note nobody received.
  if (!data?.ok) {
    throw new SupportMailError(
      typeof data?.error === 'string' && data.error.trim().length > 0
        ? data.error
        : 'The note did not go through.',
      'refused',
    );
  }

  const copy = typeof data.copySentTo === 'string' ? data.copySentTo.trim() : '';
  return { copySentTo: copy.length > 0 ? copy : null };
}
