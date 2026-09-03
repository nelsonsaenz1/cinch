/**
 * Deterministic AI Packet 1 — the four claims this packet makes.
 *
 * Three of them are about SOURCE rather than behaviour, and deliberately so.
 * "The ASR model is no longer compiled in" and "packing no longer bills the
 * stylist" are properties of which symbols appear in which file; a test that
 * exercised them at runtime would need a provider and a database, and would
 * pass just as happily against a file that had quietly regained a hard-coded
 * model beside the configured one.
 *
 * The fourth — canonicalisation — is real logic and is tested as logic.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseQuery } from '../supabase/functions/_shared/catalog-query.ts';
import {
  demandIntent,
  isRecordableIntent,
  latencyBucket,
} from '../supabase/functions/_shared/demand-intent.ts';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Source with comments removed.
 *
 * Every file below EXPLAINS in prose why a symbol is absent — "this call used
 * to record itself as tagging" — so scanning raw text would make writing the
 * reason down the thing that fails the test.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// 1 · Configuration is server-owned
// ---------------------------------------------------------------------------

test('no model choice is compiled into a call site', () => {
  // A model id is a string with a slash in it. Any of those left in the body
  // of these files is a choice that cannot be changed without a release —
  // which is the whole defect this packet exists to fix.
  const cases = [
    ['supabase/functions/transcribe-intake/asr.ts', 'DEFAULT_MODEL'],
    ['supabase/functions/parse-closet/index.ts', 'DEFAULT_MODEL'],
    // packing-brief was deleted 2026-09-03: the memo is computed on the device.
  ] as const;

  for (const [file, allowed] of cases) {
    const src = stripComments(read(file));
    assert.match(src, /loadAiSettings\(/, `${file} does not read ai_config`);

    const models = src.match(/'[a-z0-9-]+\/[a-z0-9.-]+'/g) ?? [];
    for (const model of models) {
      const line = src.split('\n').find((l) => l.includes(model)) ?? '';
      assert.ok(
        line.includes(allowed),
        `${file} names ${model} outside its ${allowed} fallback: ${line.trim()}`,
      );
    }
  }
});

test('every configured timeout is the one the call actually uses', () => {
  // The packing brief read `ai_config` and then ignored its timeout, which is
  // the failure mode a config table invites: half-wired, and indistinguishable
  // from wired at a glance.
  for (const file of [
    'supabase/functions/transcribe-intake/asr.ts',
    'supabase/functions/parse-closet/index.ts',
  ]) {
    const src = stripComments(read(file));
    assert.match(src, /settings\.timeoutMs/, `${file} does not use the configured timeout`);
    assert.match(src, /settings\.modelId/, `${file} does not use the configured model`);
  }
});

// ---------------------------------------------------------------------------
// 2 · The ledger tells the truth
// ---------------------------------------------------------------------------

test('the two remaining ledger workloads bill themselves', () => {
  const asr = stripComments(read('supabase/functions/transcribe-intake/asr.ts'));
  assert.match(asr, /workload: 'voice_transcription'/, 'ASR still writes no ledger row');
  assert.match(asr, /recordAiCall/);

  const parse = stripComments(read('supabase/functions/parse-closet/index.ts'));
  assert.match(parse, /workload: 'closet_parsing'/);
  assert.ok(!/workload: 'tagging'/.test(parse), 'the parser still bills tagging');
  // `packing_brief` remains an enum member for the ledger's history; nothing
  // writes it since the function was deleted (2026-09-03).
});

test('but the quota each one spends is unchanged', () => {
  // This is the assertion that stops an accounting change from becoming a
  // membership change. `stylist_chat` excludes free entirely; packing riding on
  // it IS the server half of the Pro boundary, and moving it would hand packing
  // to anyone with a Standard subscription.
  // (Packing's server half went with the packing-brief function on
  // 2026-09-03; its Pro lock is now use-packing-access.ts alone.)

  const parse = stripComments(read('supabase/functions/parse-closet/index.ts'));
  assert.match(parse, /enforceAiQuota\(admin, userId, 'tagging'\)/, 'the parser changed its allowance');

  // And the shared plan table still knows only the four kinds that have prices.
  const plans = stripComments(read('supabase/functions/_shared/plans.ts'));
  assert.ok(
    !/voice_transcription|closet_parsing|packing_brief/.test(plans),
    'a ledger workload leaked into PLAN_LIMITS, which is a pricing decision',
  );
});

test('a retried call records the attempts it really made', () => {
  // The counter must be incremented inside the loop, not derived from its
  // bound — `attempts: 2` on a call that succeeded first time is as untrue as
  // null. The exhaustive form below asserts every ledger writer carries one.
  for (const file of [
    'supabase/functions/transcribe-intake/asr.ts',
    'supabase/functions/parse-closet/index.ts',
  ]) {
    const src = stripComments(read(file));
    if (/recordAiCall\(/.test(src)) assert.match(src, /attempts: /, `${file} records no attempt count`);
  }
});

/**
 * The three callers Packet 1 did not reach.
 *
 * Packet 1 wired the workloads it CREATED — ASR, the parser, packing — and left
 * `tagging`, `stylist_chat` and `outfit_generation` on the pattern they already
 * had: a compiled timeout and no attempt count. That is a half-built control
 * plane, and a half-built one is worse than none, because the operational
 * queries look complete. All six callers are held to the same bar below.
 */
const RETROFITTED = [
  'supabase/functions/tag-item/index.ts',
  'supabase/functions/stylist-chat/index.ts',
  'supabase/functions/generate-outfits/index.ts',
] as const;

test('the older callers read their timeout from the row too', () => {
  for (const file of RETROFITTED) {
    const src = stripComments(read(file));
    assert.match(
      src,
      /timeoutMs: (settings\.timeoutMs|config\.timeout_ms \?\?)/,
      `${file} still compiles its timeout in`,
    );
  }
  // And the column is actually selected — reading `config.timeout_ms` from a
  // select that never asked for it is undefined, which silently falls back to
  // the compiled value and looks wired.
  for (const file of RETROFITTED.slice(1)) {
    assert.match(stripComments(read(file)), /select\('[^']*timeout_ms/, `${file} never selects it`);
  }
});

test('every retrying caller counts its own retries', () => {
  for (const file of RETROFITTED) {
    const src = stripComments(read(file));
    assert.match(src, /attemptsMade = attempt \+ 1/, `${file} derives attempts from the bound`);
    assert.match(src, /attempts: attemptsMade/, `${file} leaves attempts null`);
  }
});

test('no OpenRouter caller is left writing a null attempt count', () => {
  // The exhaustive form of the two tests above: any file that both calls the
  // provider and writes a ledger row must say how many times it called.
  const callers = [
    ...RETROFITTED,
    'supabase/functions/parse-closet/index.ts',
    'supabase/functions/transcribe-intake/asr.ts',
    'supabase/functions/garment-search/index.ts',
  ];
  for (const file of callers) {
    const src = stripComments(read(file));
    if (!/recordAiCall\(/.test(src)) continue;
    assert.match(src, /attempts: /, `${file} records a call without its attempt count`);
  }
});

test('the rescue model is the only second call, and it happens once', () => {
  const tag = stripComments(read('supabase/functions/tag-item/index.ts'));
  // Escalation is guarded on the FIRST pass only. Without `attempt === 0` a
  // rescue that fails validation would escalate again, which is the loop the
  // plan forbids — and it would be a loop nobody notices, because each pass
  // looks like a reasonable retry on its own.
  assert.match(tag, /attempt === 0 && settings\.validatorPolicy === 'rescue' && settings\.rescueModelId/);
  // A rejection that is not rescued becomes a state the user can act on.
  assert.match(tag, /status: 'needs_review'/);
  // And nothing re-runs a result that PASSED. A second model checking the first
  // costs twice for one answer and proves nothing the validator did not.
  assert.ok(
    !/checked\.ok[\s\S]{0,200}rescueModelId/.test(tag),
    'a passing result is being sent for a second opinion',
  );
});

// ---------------------------------------------------------------------------
// 3 · The aggregate cannot hold a sentence
// ---------------------------------------------------------------------------

const MIGRATION = 'supabase/migrations/20260813203052_ai_control_plane_and_demand.sql';

test('the demand table has no column a phrase could live in', () => {
  const sql = read(MIGRATION);
  const table = sql.slice(
    sql.indexOf('create table if not exists public.catalogue_demand_daily'),
    sql.indexOf('comment on table public.catalogue_demand_daily'),
  );
  assert.ok(table.length > 0, 'the demand table moved; this test is now blind');

  for (const forbidden of ['user_id', 'query', 'transcript', 'title', 'url', 'session']) {
    assert.ok(
      !new RegExp(`^\\s+${forbidden}\\b`, 'm').test(table),
      `catalogue_demand_daily grew a ${forbidden} column`,
    );
  }
  // And the shape constraints that make the text columns unable to hold one.
  assert.match(table, /catalogue_demand_brand_shape/);
  assert.match(table, /catalogue_demand_class_shape/);
});

test('nothing signed in can read or write the aggregate', () => {
  const sql = read(MIGRATION);
  assert.match(sql, /alter table public\.catalogue_demand_daily enable row level security/);
  assert.match(sql, /revoke all on public\.catalogue_demand_daily from anon, authenticated/);
  assert.ok(
    !/create policy[\s\S]*catalogue_demand_daily/.test(sql),
    'a policy would open the aggregate to whoever it names',
  );
  // Both counter functions: invoker, revoked from the world, granted to one role.
  const grants = sql.match(/grant execute on function public\.record_catalogue_demand/g) ?? [];
  assert.equal(grants.length, 2, 'a counter function lost its explicit grant');
  assert.ok(!/security definer/i.test(sql), 'a SECURITY DEFINER function appeared in public');
});

test('the by-key counter can only move a row a real search created', () => {
  const sql = read(MIGRATION);
  const fn = sql.slice(sql.indexOf('function public.record_catalogue_demand_by_key'));
  assert.ok(!/insert into/i.test(fn), 'a caller can conjure a demand row from a hash');
  assert.match(fn, /length\(p_intent_key\) <> 64/, 'anything is accepted as a key');
});

// ---------------------------------------------------------------------------
// 4 · Canonicalisation — the part that is real logic
// ---------------------------------------------------------------------------

test('a guessed brand is never stored, only a recognised one', () => {
  // THE line the privacy argument turns on. `parseQuery` will happily report a
  // brand it inferred from a leading run of words — which is whatever the user
  // typed first, and therefore a fragment of their sentence.
  const src = stripComments(read('supabase/functions/_shared/demand-intent.ts'));
  assert.match(src, /brandSource !== 'known'/);
  assert.ok(
    !/leading-run'\s*\)?\s*return\s+parsed\.brand/.test(src),
    'a guessed brand reaches the aggregate',
  );
});

test('the intent carries four fields and no more', () => {
  const src = read('supabase/functions/_shared/demand-intent.ts');
  const type = src.slice(src.indexOf('export type DemandIntent'), src.indexOf('export type LatencyBucket'));
  const fields = (type.match(/^\s{2}\w+:/gm) ?? []).map((f) => f.trim().replace(':', ''));
  assert.deepEqual(
    fields.sort(),
    ['audience', 'brandSlug', 'colourFamily', 'garmentClass'],
    'the demand intent grew a field nobody argued for',
  );
});

test('the RPC has no parameter a query could be passed through', () => {
  // The call lives next door to the canonicalisation — see `demand.ts`'s
  // header for why the two files are split.
  const src = read('supabase/functions/_shared/demand.ts');
  const call = src.slice(src.indexOf("admin.rpc('record_catalogue_demand'"), src.indexOf('if (error)'));
  const params = (call.match(/p_\w+:/g) ?? []).map((p) => p.replace(':', ''));
  for (const p of params) {
    assert.ok(
      !/query|text|phrase|description|transcript/.test(p),
      `record_catalogue_demand is passed ${p}`,
    );
  }
  assert.ok(params.includes('p_brand_slug') && params.includes('p_garment_class'));
});

test('the client sends a hash and never the words again', () => {
  const importer = stripComments(read('src/features/catalogue/use-catalogue-import.ts'));
  assert.match(importer, /intentKey: intentKey \?\? undefined/);
  // The import body carries ids, URLs and labels from the catalogue — never the
  // query that found them.
  const body = importer.slice(importer.indexOf("action: 'import-batch'"), importer.indexOf('if (error)'));
  assert.ok(!/query|description|text:/.test(body), 'the import request carries the query');

  const bounds = stripComments(read('supabase/functions/garment-search/bounds.ts'));
  assert.match(bounds, /\/\^\[0-9a-f\]\{64\}\$\//, 'the server accepts a key of any shape');
});

// ---------------------------------------------------------------------------
// 5 · The acceptance case, end to end through the real parser
// ---------------------------------------------------------------------------

test('the launch query becomes structured intent and nothing else', () => {
  const intent = demandIntent(parseQuery("James Perse men's T-shirt", ['James Perse']));

  assert.equal(intent.brandSlug, 'james-perse');
  assert.equal(intent.garmentClass, 'top');
  assert.equal(intent.audience, 'mens');
  assert.equal(intent.colourFamily, null);

  // Nothing in the result contains a word the user typed that is not one of the
  // four vocabulary values — the whole claim, checked rather than asserted.
  const values = Object.values(intent).filter(Boolean).join(' ');
  assert.ok(!/perse t-shirt|t shirt|men's/i.test(values));
});

test('word order and punctuation cannot make a second intent', () => {
  const known = ['James Perse'];
  const a = demandIntent(parseQuery("James Perse men's T-shirt", known));
  const b = demandIntent(parseQuery('James Perse t shirt for men', known));
  const c = demandIntent(parseQuery('  JAMES PERSE  MENS TEE!  ', known));

  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('an unrecognised brand is dropped rather than kept as text', () => {
  // No `known` list, so `parseQuery` falls back to guessing a brand from the
  // leading words — which here is the user's own phrasing.
  const parsed = parseQuery('my favourite little shop tee', []);
  const intent = demandIntent(parsed);

  assert.equal(intent.brandSlug, null, 'a guessed brand was stored');
  // The class still lands, which is the point: the row is useful without it.
  assert.equal(intent.garmentClass, 'top');
  assert.equal(isRecordableIntent(intent), true);
});

test('nothing recognised is not recorded at all', () => {
  const intent = demandIntent(parseQuery('something nice for saturday', []));
  assert.equal(intent.brandSlug, null);
  assert.equal(intent.garmentClass, null);
  assert.equal(isRecordableIntent(intent), false);
});

test('a hundred and ten shades collapse into families', () => {
  const known = ['James Perse'];
  const navy = demandIntent(parseQuery('James Perse navy tee', known));
  const cobalt = demandIntent(parseQuery('James Perse cobalt tee', known));
  assert.equal(navy.colourFamily, 'blue');
  assert.equal(cobalt.colourFamily, 'blue');
  // But a genuinely different family stays different.
  assert.equal(demandIntent(parseQuery('James Perse olive tee', known)).colourFamily, 'green');
});

test('latency buckets are the three the table counts', () => {
  assert.equal(latencyBucket(999), 'fast');
  assert.equal(latencyBucket(1_000), 'medium');
  assert.equal(latencyBucket(3_000), 'medium');
  assert.equal(latencyBucket(3_001), 'slow');
});
