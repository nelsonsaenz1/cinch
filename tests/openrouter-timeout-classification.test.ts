/**
 * The deadline must be classified wherever it fires — including in the body read.
 *
 * WHY THIS IS BEHAVIOURAL AND NOT A SOURCE SCAN
 *
 * The bug this pins was invisible to structure. The timeout was already on the
 * signal, the classifier already existed inline, and the retry loop already
 * asked the right question. The defect was one brace: `response.json()` sat
 * outside the `try`, and OpenRouter answers a non-streaming request by sending
 * headers promptly and the body when the model has finished — so a merely-slow
 * model resolves `fetch` and stalls the READ. The DOMException escaped as
 * itself, `retryable` read false because a DOMException is not an
 * OpenRouterError, and the second attempt the loop was written for never ran.
 *
 * A source assertion would have passed against the broken file. So these drive
 * the real `completeStructured` with a stubbed `fetch` and assert on what it
 * throws.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { completeStructured, OpenRouterError } from '../supabase/functions/_shared/openrouter.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const CALL = {
  apiKey: 'test-key',
  model: 'test/model',
  messages: [{ role: 'user' as const, content: 'hello' }],
  schema: {} as Record<string, unknown>,
  schemaName: 'test_schema',
  maxTokens: 128,
};

/** Runs `fn` with `globalThis.fetch` stubbed, and always puts it back. */
async function withFetch(stub: typeof globalThis.fetch, fn: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
}

/** What `AbortSignal.timeout` actually throws when the deadline elapses. */
const timeoutError = () => new DOMException('Signal timed out.', 'TimeoutError');

test('a deadline that fires during the BODY READ is classified, retryable, and named', async () => {
  // Headers arrive; the model is still thinking; the read stalls and the
  // deadline fires there. This is the exact production shape.
  const stub = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => {
        throw timeoutError();
      },
      text: async () => '',
    }) as unknown as Response) as unknown as typeof globalThis.fetch;

  await withFetch(stub, async () => {
    const err = await completeStructured({ ...CALL, timeoutMs: 4200 }).then(
      () => null,
      (e: unknown) => e,
    );

    assert.ok(err instanceof OpenRouterError, 'a body-read timeout must not escape as a DOMException');
    assert.equal(err.retryable, true, 'a timeout is worth the second attempt');
    assert.equal(err.timedOut, true, 'the caller needs to know it was the deadline, not an outage');
    // The budget, not the DOM's wording — `ai_calls.error` is read by people.
    assert.match(err.message, /4200ms/);
    assert.doesNotMatch(err.message, /Signal timed out/);
  });
});

test('a deadline that fires during the FETCH is classified the same way', async () => {
  const stub = (async () => {
    throw timeoutError();
  }) as unknown as typeof globalThis.fetch;

  await withFetch(stub, async () => {
    const err = await completeStructured({ ...CALL, timeoutMs: 30_000 }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof OpenRouterError);
    assert.equal(err.retryable, true);
    assert.equal(err.timedOut, true);
  });
});

test('a caller-supplied cancel is neither retryable nor a timeout', async () => {
  const stub = (async () => {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }) as unknown as typeof globalThis.fetch;

  await withFetch(stub, async () => {
    const err = await completeStructured({ ...CALL, timeoutMs: 30_000 }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof OpenRouterError);
    assert.equal(err.retryable, false, 'the work it belonged to is already gone');
    assert.equal(err.timedOut, false);
  });
});

test('an HTTP failure keeps its own status and is not reported as a timeout', async () => {
  const stub = (async () =>
    ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
      json: async () => ({}),
    }) as unknown as Response) as unknown as typeof globalThis.fetch;

  await withFetch(stub, async () => {
    const err = await completeStructured({ ...CALL, timeoutMs: 30_000 }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof OpenRouterError);
    assert.equal(err.status, 429);
    assert.equal(err.retryable, true, '429 is worth another attempt');
    assert.equal(err.timedOut, false, 'a refusal is not the deadline');
  });
});

test('a good response still parses, so the shared classifier costs nothing', async () => {
  const stub = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: '{"picks":[]}' } }],
        usage: { prompt_tokens: 11, completion_tokens: 3, cost: 0.5 },
      }),
      text: async () => '',
    }) as unknown as Response) as unknown as typeof globalThis.fetch;

  await withFetch(stub, async () => {
    const result = await completeStructured<{ picks: unknown[] }>({ ...CALL, timeoutMs: 30_000 });
    assert.deepEqual(result.parsed, { picks: [] });
    assert.equal(result.promptTokens, 11);
    assert.equal(result.costUsd, 0.5);
  });
});

test('the read is inside the classifier, not merely after the fetch', () => {
  // The one structural claim worth pinning: a future edit that moves the body
  // read back out would still pass the behavioural tests only by accident.
  const src = body('supabase/functions/_shared/openrouter.ts');
  const tryAt = src.indexOf('try {');
  const readAt = src.indexOf('await response.json()');
  const catchAt = src.lastIndexOf('} catch (err) {');
  assert.ok(tryAt >= 0 && readAt >= 0 && catchAt >= 0);
  assert.ok(tryAt < readAt, 'the body read must open inside the try');
  assert.ok(readAt < catchAt, 'the body read must close before the classifier');
  assert.match(src, /throw asOpenRouterError\(err, timeoutMs\)/);
});

test('generate-outfits tells the client a timeout apart from an outage', () => {
  const src = body('supabase/functions/generate-outfits/index.ts');
  assert.match(src, /timedOut = err instanceof OpenRouterError && err\.timedOut/);
  assert.match(src, /reason: timedOut \? 'styling_timeout' : 'styling_offline'/);
  // The retry gate itself is unchanged — it was never wrong.
  assert.match(src, /const retryable = err instanceof OpenRouterError && err\.retryable/);
});

test('Today carries the timeout through to a different sentence', () => {
  const hook = body('src/features/styling/use-outfits.ts');
  assert.match(hook, /reason\?: 'styling_offline' \| 'styling_timeout'/);
  assert.match(hook, /ai\.data\?\.reason === 'styling_timeout' \? 'timeout' : 'offline'/);
  assert.match(hook, /\| 'timeout'/);

  const screen = body('src/app/(tabs)/index.tsx');
  assert.match(screen, /refreshFailed === 'timeout'/);
  assert.match(screen, /Styling took too long just now/);
  // The outage line survives unchanged — this adds a case, it does not replace one.
  assert.match(screen, /Couldn’t refresh just now/);
});
