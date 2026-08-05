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
 * Default ceiling on one provider call.
 *
 * Without it, `fetch` inherits no deadline at all: a provider that accepts the
 * connection and then stalls holds an Edge Function invocation open until the
 * platform kills it, and the caller's own retry doubles that. Two attempts at
 * 30s is the budget a user will still sit through.
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
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
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
  /** Overrides DEFAULT_TIMEOUT_MS. Vision calls legitimately take longer. */
  timeoutMs?: number;
}): Promise<CompletionResult<T>> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // The timeout has to cover reading the body too, not just the handshake — a
  // response that streams one byte a minute is the same stall — so it rides on
  // the same signal rather than being a timer around the fetch call.
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
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
  } catch (err) {
    // A timeout is worth the caller's second attempt — it is usually a slow
    // model rather than a broken request. A caller-supplied abort is not: the
    // work it belonged to is already gone.
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError') {
      throw new OpenRouterError(
        `OpenRouter did not respond within ${timeoutMs}ms.`,
        undefined,
        true,
      );
    }
    if (name === 'AbortError') {
      throw new OpenRouterError('OpenRouter request was cancelled.', undefined, false);
    }
    // Network-level failure. Redacted like everything else here, because the
    // message can quote the request.
    throw new OpenRouterError(
      `OpenRouter request failed: ${redactUrls(err instanceof Error ? err.message : String(err))}`,
      undefined,
      true,
    );
  }

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
}
