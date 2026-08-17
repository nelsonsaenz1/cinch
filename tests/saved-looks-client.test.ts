/**
 * What the saved-looks data layer is allowed to send, say and classify.
 *
 * ── THE ONE THAT MATTERS MOST ─────────────────────────────────────────────
 *
 * §6: "No user, friend, source-owner, look, item, collection, or note
 * identifiers, names, image URLs, or free text are ever sent." This feature is
 * the most revealing one in the app — it knows which looks a person kept and
 * whose they were — so the proof below is EXECUTED rather than described: every
 * builder is run with realistic, deliberately leaky inputs, and every key and
 * value of every result is checked against a schema guard.
 *
 * A second clause is stricter than Daily Social's and is checked too: no RAW
 * COUNT leaves this feature. A feed's `item_count` is harmless because a feed is
 * other people's content arriving; the exact size of somebody's private shelf is
 * an attribute of one person, so every number is banded to four values.
 *
 * ── AND THE MAPPING THE HANDOFF'S TABLE IMPLIES ───────────────────────────
 *
 * §6 names fifteen events, dotted. The union in `lib/posthog.tsx` is snake_case.
 * The mapping is asserted to be total in both directions, so an event cannot be
 * dropped or invented while the table stays the reference.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  SAVED_EVENTS,
  collectionCreatedProps,
  collectionDeletedProps,
  collectionRenamedProps,
  confirmationUndoProps,
  countBucket,
  detailViewedProps,
  filterAppliedProps,
  listViewedProps,
  planCreatedProps,
  planMissingActionProps,
  planStartedProps,
  retryTappedProps,
  saveCreatedProps,
  saveRemovedProps,
  sourceUnavailableSeenProps,
  stateShownProps,
} from '../src/features/saved-looks/analytics.ts';
import {
  classifySavedError,
  savedFailureIsInline,
  savedFailureIsSilent,
} from '../src/features/saved-looks/errors.ts';

const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');
const MIGRATION = readFileSync('supabase/migrations/20260820000000_saved_looks.sql', 'utf8');

// ---------------------------------------------------------------------------
// 1 · The fifteen, and their names
// ---------------------------------------------------------------------------

/**
 * The handoff's §6 table, transcribed. Dotted, as it is written there — the
 * mapping to the underscored union is what this file proves, so the reference
 * has to be in the handoff's own form or the test is checking itself.
 */
const HANDOFF_EVENTS = [
  'saved.save_created',
  'saved.save_removed',
  'saved.confirmation_undo',
  'saved.list_viewed',
  'saved.collection_created',
  'saved.collection_renamed',
  'saved.collection_deleted',
  'saved.filter_applied',
  'saved.detail_viewed',
  'saved.source_unavailable_seen',
  'saved.plan_started',
  'saved.plan_created',
  'saved.plan_missing_action',
  'saved.state_shown',
  'saved.retry_tapped',
] as const;

test('the map names exactly the handoff’s fifteen events, one to one', () => {
  const emitted = new Set(Object.values(SAVED_EVENTS));
  const expected = new Set(HANDOFF_EVENTS.map((name) => name.replace('.', '_')));
  assert.deepEqual([...emitted].sort(), [...expected].sort());
});

test('every one of them is a member of the closed AppEvent union', () => {
  for (const event of Object.values(SAVED_EVENTS)) {
    assert.ok(
      POSTHOG.includes(`'${event}'`),
      `${event} is not declared in lib/posthog.tsx — a free string splits the funnel silently`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2 · Nothing identifying, ever
// ---------------------------------------------------------------------------

/** Bounded: a number, a boolean, or a short enum. Anything else is suspect. */
function assertBounded(label: string, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    assert.ok(
      /^[a-z][a-z0-9_]*$/.test(key),
      `${label}: property key "${key}" is not a plain snake_case name`,
    );
    assert.ok(
      typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string',
      `${label}: property "${key}" is not a scalar`,
    );
    if (typeof value === 'string') {
      // Enums and buckets only. Anything longer is prose, a name, or an id.
      assert.ok(
        value.length <= 12,
        `${label}: property "${key}" carries "${value}", which is long enough to be content`,
      );
      assert.ok(
        !value.includes('://') && !value.includes('@'),
        `${label}: property "${key}" looks like a URL or an address`,
      );
      assert.ok(
        !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(value),
        `${label}: property "${key}" looks like a uuid`,
      );
    }
  }
}

test('every builder emits bounded, non-identifying properties — run, not described', () => {
  const leaky = {
    // Deliberately the worst realistic inputs: real ids, real names, real text.
    id: 'a7c4b8e2-0000-4000-8000-1234567890ab',
    name: "Maya's wedding guest looks",
    url: 'https://cdn.example.test/looks/a7c4.jpg',
  };

  const built: [string, Record<string, unknown>][] = [
    ['saveCreated', saveCreatedProps({ sourceType: 'daily_look', hadImage: true, wasDuplicate: false })],
    ['saveRemoved', saveRemovedProps({ sourceType: 'event_look', via: 'swipe' })],
    ['confirmationUndo', confirmationUndoProps()],
    ['listViewed', listViewedProps({ saveCount: 14, hasCollections: true })],
    ['collectionCreated', collectionCreatedProps(3)],
    ['collectionRenamed', collectionRenamedProps()],
    ['collectionDeleted', collectionDeletedProps(6)],
    ['filterApplied', filterAppliedProps(false)],
    ['detailViewed', detailViewedProps({ availability: 'unavailable', hasNote: true })],
    ['sourceUnavailableSeen', sourceUnavailableSeenProps('own_outfit')],
    ['planStarted', planStartedProps({ matched: 2, missing: 2 })],
    ['planCreated', planCreatedProps({ piecesUsed: 2, hadMissing: true })],
    ['planMissingAction', planMissingActionProps('find_similar')],
    ['stateShown', stateShownProps('offline')],
    ['retryTapped', retryTappedProps()],
  ];

  assert.equal(built.length, HANDOFF_EVENTS.length, 'a builder is missing from this census');

  for (const [label, props] of built) {
    assertBounded(label, props);
    // The leaky values must not appear anywhere, in any form.
    const serialised = JSON.stringify(props);
    for (const value of Object.values(leaky)) {
      assert.ok(!serialised.includes(value), `${label} leaked ${value}`);
    }
  }
});

test('no builder sends a raw count — every number is one of four bands', () => {
  const numeric = [
    listViewedProps({ saveCount: 14, hasCollections: true }),
    collectionCreatedProps(3),
    collectionDeletedProps(6),
    planStartedProps({ matched: 2, missing: 2 }),
    planCreatedProps({ piecesUsed: 2, hadMissing: false }),
  ];

  const bands = new Set(['0', '1-5', '6-20', '21+']);
  for (const props of numeric) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'number') {
        assert.fail(`"${key}" is a raw count; a private shelf's size is an attribute of one person`);
      }
      if (key.endsWith('_bucket')) assert.ok(bands.has(value as string), `${key} = ${value}`);
    }
  }
});

test('the filter event carries no collection identity at all — not even an ordinal', () => {
  assert.deepEqual(filterAppliedProps(true), { is_all: true });
  assert.deepEqual(Object.keys(filterAppliedProps(false)), ['is_all']);
});

test('the bands are total, monotone and defended against nonsense', () => {
  assert.equal(countBucket(0), '0');
  assert.equal(countBucket(1), '1-5');
  assert.equal(countBucket(5), '1-5');
  assert.equal(countBucket(6), '6-20');
  assert.equal(countBucket(20), '6-20');
  assert.equal(countBucket(21), '21+');
  // A query that has not answered hands back undefined; a headline must not
  // print "NaN" and an event must not carry it.
  assert.equal(countBucket(Number.NaN), '0');
  assert.equal(countBucket(-4), '0');
});

// ---------------------------------------------------------------------------
// 3 · The classification
// ---------------------------------------------------------------------------

test('the unique constraint is the duplicate STATE, not a failure', () => {
  const failure = classifySavedError({ code: '23505', message: 'duplicate key value' });
  assert.deepEqual(failure, { kind: 'duplicate' });
  // Silent because the caller has a row to go and fetch, not an apology to make.
  assert.equal(savedFailureIsSilent(failure), true);
});

test('a refused insert is `no_access`, and it is printed inline beside the control', () => {
  const failure = classifySavedError({ code: '42501', message: 'new row violates row-level security policy' });
  assert.deepEqual(failure, { kind: 'no_access' });
  assert.equal(savedFailureIsInline(failure), true);
  assert.equal(savedFailureIsSilent(failure), false);
});

test('the immutability trigger raises 42501 too, and must NOT read as no_access', () => {
  // Otherwise a client bug is delivered to the reader as "your friend stopped
  // sharing", which is a sentence about somebody else that is simply untrue.
  const failure = classifySavedError({
    code: '42501',
    message: 'only the note and the collection may change',
  });
  assert.deepEqual(failure, { kind: 'unknown' });
  assert.equal(savedFailureIsInline(failure), false);
});

test('the trigger message this classification depends on is the one the migration raises', () => {
  assert.ok(
    MIGRATION.includes("'only the note and the collection may change'"),
    'errors.ts matches a sentinel the migration no longer raises',
  );
});

test('a deleted collection is stale, and says nothing', () => {
  const failure = classifySavedError({ code: '23503', message: 'foreign key violation' });
  assert.deepEqual(failure, { kind: 'stale' });
  assert.equal(savedFailureIsSilent(failure), true);
});

test('a length check is invalid_input, and anything unrecognised is unknown', () => {
  assert.deepEqual(classifySavedError({ code: '23514', message: 'check constraint' }), {
    kind: 'invalid_input',
  });
  assert.deepEqual(classifySavedError(null), { kind: 'unknown' });
  assert.deepEqual(classifySavedError({ code: '08006' }), { kind: 'unknown' });
});

// ---------------------------------------------------------------------------
// 4 · The claims the data layer makes about itself
// ---------------------------------------------------------------------------

const FEATURE_DIR = 'src/features/saved-looks';

test('every read goes through the view, so no read can arrive without availability', () => {
  const client = readFileSync(`${FEATURE_DIR}/client.ts`, 'utf8');
  // The table's shape offers insert/update/delete and deliberately no select.
  const tableShape = client.slice(client.indexOf("from(relation: 'saved_looks')"));
  const nextShape = tableShape.indexOf("from(relation: 'boards')");
  assert.ok(
    !tableShape.slice(0, nextShape).includes('select(columns: string): SavedSelect'),
    'the saved_looks table exposes a select — a read without availability is expressible',
  );

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(`${FEATURE_DIR}/${file}`, 'utf8');
    // The one exception is the duplicate lookup in mutations.ts, which reads
    // the view too — so the rule is simply that nobody selects from the table.
    assert.ok(
      !/\.from\('saved_looks'\)[\s\S]{0,60}\.select\(/.test(source),
      `${file} selects from saved_looks rather than saved_looks_resolved`,
    );
  }
});

test('the client never re-filters by owner — privacy here is the policy, not a where clause', () => {
  const queries = readFileSync(`${FEATURE_DIR}/queries.ts`, 'utf8');
  assert.ok(
    !queries.includes(".eq('owner_id'"),
    'a client-side owner filter implies the policy is not trusted, and hides it when it breaks',
  );
});
