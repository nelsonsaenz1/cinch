/**
 * OpenRouter client.
 *
 * Deliberately thin and provider-shaped rather than generic: OpenRouter speaks
 * the OpenAI chat-completions dialect, so this is the only file that knows that.
 * Swapping to Anthropic later means writing a sibling module with the same
 * exported signature, not touching any call site.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Fallback ceiling on one provider call, for a caller that supplies none.
 *
 * Without a deadline, `fetch` inherits none at all: a provider that accepts the
 * connection and then stalls holds an Edge Function invocation open until the
 * platform kills it, and the caller's own retry doubles that. Two attempts at
 * 30s is the budget a user will still sit through.
 *
 * The real number now lives in `ai_config.timeout_ms`, one row per workload,
 * beside the model it governs. It moved there because it was the wrong thing to
 * compile in: when a model got slower than the constant, half of every Today
 * page's outfits died and the only fix was a redeploy — while the model id, the
 * thing that caused it, was a column anyone could edit.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Anything URL-shaped, replaced wholesale.
 *
 * Error text from this module is written to `ai_calls.error`, a table read by
 * whoever is debugging cost. Provider errors quote the request back, and a
 * tagging request carries a signed URL to a private photograph of someone's
 * clothes — short-lived, but a bearer token for the object while it lasts, and
 * an operational log is not where it belongs. `data:` is included because an
 * inlined image would otherwise land in the same column.
 */
const URL_LIKE = /\b(?:https?|data|blob):[^\s"'`)\]}]+/gi;

export function redactUrls(text: string): string {
  return text.replace(URL_LIKE, '[redacted-url]');
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type CompletionResult<T> = {
  parsed: T;
  promptTokens: number | null;
  completionTokens: number | null;
  /** OpenRouter reports actual charged cost, which beats reconstructing it. */
  costUsd: number | null;
  latencyMs: number;
};

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    /**
     * The deadline elapsed, as opposed to the provider refusing or the network
     * breaking. Callers surface this differently: "it is taking too long" is a
     * true and useful thing to tell someone, and "something went wrong" is not.
     */
    readonly timedOut = false,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * Turns whatever `fetch` or a body read threw into an OpenRouterError.
 *
 * Shared by both, and that sharing is the point. This used to live inline
 * around the `fetch` call only, which left the body read — `response.json()`
 * below — outside it. That is not a corner: OpenRouter answers a non-streaming
 * request by sending headers promptly and the body when the model has finished,
 * so a model that is merely slow resolves `fetch` and then stalls the read. The
 * deadline rides on the same signal and fires there, and a DOMException from
 * that read escaped as itself.
 *
 * Two things followed, and both were live in production. `ai_calls.error` filled
 * up with the raw "Signal timed out." instead of a sentence naming the budget,
 * so the table could not tell a slow model from a broken one without someone
 * recognising the DOM's wording. And because a bare DOMException is not an
 * OpenRouterError, `retryable` read as false and the retry loop broke after one
 * attempt — the second attempt the loop was written for never happened, which
 * is why every failure logged ~30s rather than ~60s.
 */
function asOpenRouterError(err: unknown, timeoutMs: number): OpenRouterError {
  if (err instanceof OpenRouterError) return err;

  const name = err instanceof Error ? err.name : '';

  // A timeout is worth the caller's second attempt — it is usually a slow model
  // rather than a broken request.
  if (name === 'TimeoutError') {
    return new OpenRouterError(
      `OpenRouter did not respond within ${timeoutMs}ms.`,
      undefined,
      true,
      true,
    );
  }

  // A caller-supplied abort is not retryable: the work it belonged to is gone.
  if (name === 'AbortError') {
    return new OpenRouterError('OpenRouter request was cancelled.', undefined, false);
  }

  // Network-level failure, or a body that arrived truncated. Redacted like
  // everything else here, because the message can quote the request.
  return new OpenRouterError(
    `OpenRouter request failed: ${redactUrls(err instanceof Error ? err.message : String(err))}`,
    undefined,
    true,
  );
}

/**
 * Calls a model and returns the parsed JSON object matching `schema`.
 *
 * `strict: true` plus `additionalProperties: false` is what makes the response
 * structurally guaranteed rather than merely requested — every candidate model
 * was checked for `response_format` support before being put in ai_config.
 * We still validate on the way back, because a schema guarantees shape, not
 * semantics.
 */
export async function completeStructured<T>(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  /**
   * Overrides DEFAULT_TIMEOUT_MS. Callers pass `ai_config.timeout_ms`, so the
   * deadline is tuned per workload from the same row as the model it applies to.
   */
  timeoutMs?: number;
}): Promise<CompletionResult<T>> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // The timeout has to cover reading the body too, not just the handshake — a
  // response that streams one byte a minute is the same stall — so it rides on
  // the same signal rather than being a timer around the fetch call.
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;

  // Everything from here to the parsed body runs under one classifier, so the
  // deadline means the same thing wherever it fires.
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter uses these for its model-usage leaderboard and for
        // attributing traffic; harmless but good citizenship.
        'HTTP-Referer': 'https://cinch.app',
        'X-Title': 'Cinch',
      },
      signal,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        ...opts.params,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: opts.schemaName,
            strict: true,
            schema: opts.schema,
          },
        },
        // Ask OpenRouter to report what the call actually cost.
        usage: { include: true },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // 429 and 5xx are worth another attempt; 4xx generally is not — a malformed
      // schema will fail identically forever and retrying just burns budget.
      const retryable = response.status === 429 || response.status >= 500;
      // Redact before slicing: slicing first can cut a signed URL mid-token and
      // still leave the part that identifies the object.
      throw new OpenRouterError(
        `OpenRouter ${response.status}: ${redactUrls(body).slice(0, 400)}`,
        response.status,
        retryable,
      );
    }

    // The read that the deadline actually tends to fire on.
    const json = await response.json();

    const choice = json?.choices?.[0];
    const finishReason = choice?.finish_reason;
    if (finishReason === 'length') {
      // Truncated mid-object — the JSON will not parse and retrying with the same
      // max_tokens will truncate again. Surface it distinctly.
      throw new OpenRouterError('Model output hit max_tokens before completing the object.');
    }

    const raw = choice?.message?.content;
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new OpenRouterError('Model returned no content.');
    }

    let parsed: T;
    try {
      parsed = JSON.parse(raw) as T;
    } catch {
      // Model output, which is prompt-derived, so it gets the same treatment.
      throw new OpenRouterError(
        `Model returned non-JSON content: ${redactUrls(raw).slice(0, 200)}`,
      );
    }

    const usage = json?.usage ?? {};
    return {
      parsed,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      costUsd: typeof usage.cost === 'number' ? usage.cost : null,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    // Deliberately catches the body read and the parse as well as the fetch.
    // `asOpenRouterError` passes an OpenRouterError straight through, so the
    // status-, truncation- and content-specific throws above keep their own
    // wording and their own `retryable`.
    throw asOpenRouterError(err, timeoutMs);
  }
}
