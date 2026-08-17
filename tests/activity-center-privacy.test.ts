/**
 * The three promises the Activity Center makes that a screenshot cannot check.
 *
 *   1. The client's taxonomy IS the database's enum, label for label. A union
 *      transcribed by hand drifts, and the drift is silent — a row of a type the
 *      client does not know is dropped, so the surface simply stops mentioning a
 *      whole class of thing and nobody notices.
 *   2. **No count, anywhere.** §12's rule is that the entry glyph carries
 *      presence and never quantity, and the only version of that which survives
 *      contact with a future contributor is that no count EXISTS on the path.
 *   3. **Analytics carries no payload and no identity.** §8's allow-list, run as
 *      a property test against planted identifiers rather than read as a
 *      convention.
 *
 * All three are asserted against the FILES — the migration text, the source of
 * the modules — because each is a promise about what is absent, and absence is
 * not something a call can return.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  activityActionProps,
  activityFailedProps,
  activityItemOpenedProps,
  activityOpenedProps,
  classifyActivityError,
  latencyBucket,
} from '../src/features/activity-center/analytics';
import { ACTIVITY_EVENT_TYPES } from '../src/features/activity-center/types';

const MIGRATION = 'supabase/migrations/20260820000000_activity_center.sql';

// Repo-relative, matching `tests/activity-retention.test.ts`: the runner's cwd
// is the repository root, so a path relative to the module would be a second
// convention for the same thing.
function read(path: string): string {
  return readFileSync(path, 'utf8');
}

// ---------------------------------------------------------------------------
// 1 · The union is the enum
// ---------------------------------------------------------------------------

test('the client union is exactly the activity_event_type enum, in order', () => {
  const sql = read(MIGRATION);
  const block = /create type activity_event_type as enum \(([\s\S]*?)\);/.exec(sql);
  assert.ok(block, 'the enum has moved or been renamed');

  const labels = [...block[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert.deepEqual(labels, [...ACTIVITY_EVENT_TYPES]);
});

test('the reaction words the sentence knows are the words the schema allows', () => {
  // `sentence.ts` title-cases three words without importing Daily Social's copy.
  // The shared authority both answer to is the CHECK constraint, so that is what
  // this reads.
  const daily = read('supabase/migrations/20260817000000_daily_social.sql');
  // The quoted form specifically: that file's own header quotes
  // `check (reaction in (-1, 1))` when explaining why `outfit_reactions` could
  // not hold this, and an unanchored pattern finds the comment first.
  const check = /check \(reaction in \((\s*'[^)]*)\)\)/.exec(daily);
  assert.ok(check, 'the reaction domain has moved');
  const words = [...check[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert.deepEqual(words.sort(), ['cozy', 'noted', 'sharp']);
});

// ---------------------------------------------------------------------------
// 2 · No count
// ---------------------------------------------------------------------------

test('the dot is an exists, not a count — there is no number to render', () => {
  const sql = read(MIGRATION);
  const fn = /create function activity_has_unseen\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(sql);
  assert.ok(fn, 'activity_has_unseen has moved');
  assert.match(fn[1]!, /select exists/);
  assert.doesNotMatch(fn[1]!, /count\s*\(/i);
});

test('activity_has_unseen returns a boolean and takes no argument to forge', () => {
  const sql = read(MIGRATION);
  assert.match(sql, /create function activity_has_unseen\(\) returns boolean/);
});

test('no unread count leaks out of the query or grouping layers', () => {
  for (const path of [
    'src/features/activity-center/queries.ts',
    'src/features/activity-center/grouping.ts',
    'src/features/activity-center/merge.ts',
    'src/components/activity-center/entry-button.tsx',
    'src/components/activity-center/glyphs.tsx',
  ]) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /\b(unseenCount|unreadCount|badgeCount|newCount)\b/,
      `${path} named a count`,
    );
  }
});

test('the entry button renders a boolean dot and never a number', () => {
  const source = read('src/components/activity-center/entry-button.tsx');
  // The only thing that gates the dot is the boolean hook.
  assert.match(source, /const unseen = useHasUnseenActivity\(\)/);
  // And nothing interpolates a value into the glyph.
  assert.doesNotMatch(source, /\{\s*unseen\s*\}/);
});

// ---------------------------------------------------------------------------
// 3 · Analytics — §8's allow-list, as a property test
// ---------------------------------------------------------------------------

/**
 * Values planted so that any leak is unmistakable in a failure message. Each is
 * something a careless builder could plausibly have picked up from an
 * `ActivityEvent`, a profile, or a raw error.
 */
const PLANTED = [
  '11111111-1111-4111-8111-111111111111', // a user id
  'c0000000-0000-4000-8000-00000000000a', // a circle id
  'Sunday Roasts', // a group name
  'Love this', // free text
  'maya@example.test', // an address
  'permission denied for table activity_events', // raw error text
];

/** Every string that appears anywhere in a property object, keys included. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => [k, ...stringsIn(v)]);
}

function assertClean(props: unknown, label: string): void {
  const strings = stringsIn(props);
  for (const planted of PLANTED) {
    for (const s of strings) {
      assert.ok(!s.includes(planted), `${label} leaked "${planted}" as "${s}"`);
    }
  }
  // And every value is bounded: a number, a boolean, or a short enum.
  for (const [key, v] of Object.entries(props as Record<string, unknown>)) {
    if (typeof v === 'string') {
      assert.ok(v.length <= 32, `${label}.${key} carried an unbounded string`);
    } else {
      assert.ok(
        typeof v === 'number' || typeof v === 'boolean',
        `${label}.${key} was neither a number, a boolean nor a short enum`,
      );
    }
  }
}

test('every builder emits bounded, non-identifying properties', () => {
  assertClean(activityOpenedProps({ hadUnseen: true, latencyMs: 4_200 }), 'opened');

  for (const type of ACTIVITY_EVENT_TYPES) {
    assertClean(
      activityItemOpenedProps({ eventType: type, wasGrouped: true, isRevoked: false }),
      `itemOpened:${type}`,
    );
  }

  for (const action of ['open', 'accept', 'decline', 'dismiss', 'undo', 'clear_all', 'retry'] as const) {
    assertClean(activityActionProps({ action, surface: 'activity' }), `action:${action}`);
    assertClean(
      activityActionProps({ action, surface: 'detail', eventType: 'circle.invite.received' }),
      `action:${action}:typed`,
    );
  }

  for (const cls of ['offline', 'unauthorized', 'server', 'unknown'] as const) {
    assertClean(activityFailedProps({ errorClass: cls, surface: 'detail' }), `failed:${cls}`);
  }
});

/**
 * The module with its prose removed.
 *
 * The docblocks HAVE to name `actor_id`, `payload` and the rest — they exist to
 * explain what is being refused and why — so a naive grep over the file finds
 * the explanation and reports it as the leak. Stripping comments is what makes
 * the assertion about the CODE, which is the only place a leak could live.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('no builder accepts an ActivityEvent — the narrowing is at the call site', () => {
  const code = codeOnly(read('src/features/activity-center/analytics.ts'));
  // The rule is structural: if a builder took the event, one spread would ship
  // four identifiers and a group name.
  assert.doesNotMatch(code, /:\s*ActivityEvent\b/);
  assert.doesNotMatch(code, /\.payload\b/);
  assert.doesNotMatch(code, /\b(actorId|recipientId|subjectId|circleId)\b/);
});

test('the error classifier reads codes and never the message', () => {
  const source = read('src/features/activity-center/analytics.ts');
  const fn = /export function classifyActivityError[\s\S]*$/.exec(source)![0];
  assert.doesNotMatch(fn, /\.message/);

  assert.equal(classifyActivityError({ name: 'TypeError', message: 'Network request failed' }), 'offline');
  assert.equal(classifyActivityError({ status: 403, message: 'permission denied' }), 'unauthorized');
  assert.equal(classifyActivityError({ code: '42501' }), 'unauthorized');
  assert.equal(classifyActivityError({ status: 503 }), 'server');
  assert.equal(classifyActivityError({}), 'unknown');
  assert.equal(classifyActivityError(null), 'unknown');
});

test('latency is a band, never a millisecond', () => {
  assert.equal(latencyBucket(12), 'under_300ms');
  assert.equal(latencyBucket(500), '300ms_1s');
  assert.equal(latencyBucket(2_000), '1_3s');
  assert.equal(latencyBucket(9_999), 'over_3s');
  assert.equal(latencyBucket(Number.NaN), 'under_300ms');
});

// ---------------------------------------------------------------------------
// 4 · The writes the client is not allowed to make
// ---------------------------------------------------------------------------

test('the client interface cannot express an insert into activity_events', () => {
  const source = read('src/features/activity-center/client.ts');
  const block = /from\(relation: 'activity_events'\)[\s\S]*?\};/.exec(source);
  assert.ok(block, 'the client interface has moved');
  assert.doesNotMatch(block[0]!, /\binsert\s*\(/);
});

test('the grant list carries select, update and delete — and never insert', () => {
  const sql = read(MIGRATION);
  const grant = /grant ([a-z, ]+) on activity_events to authenticated;/.exec(sql);
  assert.ok(grant, 'the grant has moved');
  const verbs = grant[1]!.split(',').map((v) => v.trim()).sort();
  assert.deepEqual(verbs, ['delete', 'select', 'update']);
});

test('there is no insert policy for a client to satisfy', () => {
  const sql = read(MIGRATION);
  const policies = [...sql.matchAll(/create policy "([^"]+)" on activity_events\s+for (\w+)/g)].map(
    (m) => m[2],
  );
  assert.deepEqual(policies.sort(), ['delete', 'select', 'update']);
});

test('only seen_at and dismissed_at may move under a caller', () => {
  const sql = read(MIGRATION);
  const fn = /create function assert_activity_event_update\(\)[\s\S]*?\$\$;/.exec(sql);
  assert.ok(fn, 'the update guard has moved');
  for (const column of [
    'recipient_id',
    'event_type',
    'actor_id',
    'subject_type',
    'subject_id',
    'circle_id',
    'payload',
    'created_at',
    'revoked_at',
  ]) {
    assert.match(fn[0]!, new RegExp(`new\\.${column}\\s+is distinct from old\\.${column}`), column);
  }
  assert.doesNotMatch(fn[0]!, /new\.seen_at\s+is distinct from/);
  assert.doesNotMatch(fn[0]!, /new\.dismissed_at\s+is distinct from/);
});

test('the retention window in the purge is the thirty days the copy states', () => {
  const sql = read(MIGRATION);
  assert.match(sql, /created_at < now\(\) - interval '30 days'/);
  const copy = read('src/features/activity-center/copy.ts');
  assert.match(copy, /older than 30 days/);
});
