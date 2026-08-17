/**
 * The classification, the events, and the four claims the data layer makes
 * that only a source assertion can hold it to.
 *
 * ── THE ONE THAT MATTERS MOST ─────────────────────────────────────────────
 *
 * A block and a lapsed friendship must be INDISTINGUISHABLE. They arrive as
 * the same SQLSTATE from the same policy, and PC-10 says only "No longer a
 * mutual friend" — because naming a block tells the person it was made against
 * that it exists. The proof below is executed rather than described: every
 * 42501 the schema can raise on the invite and re-invite paths is classified,
 * and the set of distinct answers has exactly one member.
 *
 * ── AND THE ONE THE VOCABULARY CONTRACT TURNS ON ──────────────────────────
 *
 * Identifiers say circle; strings say group. This layer writes almost no
 * strings, and the ones it could write are error messages — so the test is
 * that it writes none: no prose anywhere in `src/features/circles`, and the
 * only sentence any file there constructs is "Not signed in.".
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  circleCreatedProps,
  circleDeletedProps,
  circleInvitationAnsweredProps,
  circleInviteBlockedProps,
  circleInviteSentProps,
  circleMemberReInvitedProps,
  circleMembershipEndedProps,
  circleRenamedProps,
  CIRCLE_EVENTS,
} from '../src/features/circles/analytics.ts';
import {
  circleFailureIsSilent,
  circleFailureNeedsTerms,
  classifyCircleError,
  type CircleFailure,
} from '../src/features/circles/errors.ts';

const MIGRATION = readFileSync(
  'supabase/migrations/20260818000000_private_circles.sql',
  'utf8',
);
const TERMS_MIGRATION = readFileSync(
  'supabase/migrations/20260808101000_social_terms_gate.sql',
  'utf8',
);

/** Source with comments stripped — the house helper, so prose in a comment is not a claim. */
const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const FEATURE_DIR = 'src/features/circles';
const FEATURE_FILES = readdirSync(FEATURE_DIR)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => `${FEATURE_DIR}/${name}`);

/** A PostgREST error, as the wire delivers it. */
const pg = (code: string, message: string, hint = '') => ({
  code,
  message,
  hint,
  details: '',
});

// ---------------------------------------------------------------------------
// 1 · Full, and only full
// ---------------------------------------------------------------------------

test('the seat cap is recognised by its hint and by its message', () => {
  // The trigger raises `check_violation` with both. Either alone is enough,
  // because a rewrite of one of them should not silently reclassify a full
  // group as a bad name.
  assert.deepEqual(
    classifyCircleError(pg('23514', 'circle_full: 12 of 12 seats taken', 'This group is full.')),
    { kind: 'group_full' },
  );
  assert.deepEqual(classifyCircleError(pg('23514', 'circle_full: 12 of 12 seats taken')), {
    kind: 'group_full',
  });
  assert.deepEqual(classifyCircleError(pg('23514', 'some other wording', 'This group is full.')), {
    kind: 'group_full',
  });
});

test('both sentinels are the ones the migration actually raises', () => {
  assert.match(MIGRATION, /raise exception 'circle_full: % of 12 seats taken'/);
  assert.match(MIGRATION, /errcode = 'check_violation'/);
  assert.match(MIGRATION, /hint\s+= 'This group is full\.'/);
});

test('a check violation that is not the cap is the name, because there is no third constraint', () => {
  // `circles.name` carries `check (char_length(name) between 1 and 60)`, and
  // `circle_members` carries no check constraint at all — so 23514 has exactly
  // three possible causes and this is the third.
  assert.match(MIGRATION, /check \(char_length\(name\) between 1 and 60\)/);
  assert.deepEqual(classifyCircleError(pg('23514', 'violates check constraint')), {
    kind: 'invalid_name',
  });
  assert.deepEqual(classifyCircleError(pg('23514', 'that wording is not allowed here')), {
    kind: 'blocked_text',
  });
  assert.match(MIGRATION, /create trigger circles_clean_text/);
});

// ---------------------------------------------------------------------------
// 2 · Blocked and no-longer-mutual are one answer, and must stay one
// ---------------------------------------------------------------------------

test('every 42501 the invite paths can raise collapses to a single classification', () => {
  // The insert policy refuses with no message of its own; the re-invite branch
  // raises its own sentence. Neither says which half of the condition failed,
  // and neither may.
  const refusals = [
    pg('42501', 'new row violates row-level security policy for table "circle_members"'),
    pg('42501', 'you can only invite a mutual friend'),
    // The same refusal a blocked pair produces. There is nothing on the wire
    // to tell it apart from the two above, and this is the assertion that
    // fails if somebody adds something.
    pg('42501', 'permission denied'),
  ];

  const answers = new Set(refusals.map((error) => classifyCircleError(error).kind));
  assert.deepEqual([...answers], ['not_mutual']);
});

test('the schema raises 42501 for both halves of the same condition', () => {
  // `blocked_between` and `not is_friend` sit in one `if`, raising one code.
  assert.match(
    MIGRATION,
    /if public\.blocked_between\(\(select auth\.uid\(\)\), old\.user_id\)\s*\n\s*or not public\.is_friend\(old\.user_id\) then/,
  );
  assert.match(MIGRATION, /raise exception 'you can only invite a mutual friend'\s*\n\s*using errcode = '42501'/);
  // And the INSERT policy states both in one `with check`.
  assert.match(MIGRATION, /not public\.blocked_between\(\(select auth\.uid\(\)\), user_id\)\s*\n\s*and public\.is_friend\(user_id\)/);
});

test('nothing in the classification even mentions a block', () => {
  // A branch that could name one is the regression this file exists to catch.
  const source = body(`${FEATURE_DIR}/errors.ts`);
  assert.doesNotMatch(source, /blocked_between|is_friend|'blocked'|"blocked"/);
});

// ---------------------------------------------------------------------------
// 3 · The terms gate, which is not about groups at all
// ---------------------------------------------------------------------------

test('the terms gate is read before the SQLSTATE, because it shares one', () => {
  // `assert_social_terms` raises 42501. Classified by code first, "agree to
  // the community terms" would be delivered as "no longer a mutual friend".
  assert.match(TERMS_MIGRATION, /raise exception 'social_terms_required' using errcode = '42501'/);
  assert.deepEqual(classifyCircleError(pg('42501', 'social_terms_required')), {
    kind: 'terms_required',
  });
  assert.equal(circleFailureNeedsTerms({ kind: 'terms_required' }), true);
  assert.equal(circleFailureNeedsTerms({ kind: 'not_mutual' }), false);
});

test('both new surfaces are behind the same one gate', () => {
  assert.match(MIGRATION, /create trigger circles_require_terms/);
  assert.match(MIGRATION, /create trigger circle_members_require_terms/);
  // And the client routes into the sheet that already exists, rather than a
  // second path beside it.
  assert.match(
    readFileSync('src/features/auth/use-social-terms.ts', 'utf8'),
    /const TERMS_REQUIRED = 'social_terms_required'/,
  );
});

// ---------------------------------------------------------------------------
// 4 · A stale view is not a failure
// ---------------------------------------------------------------------------

test('every transition refusal is a refetch, not a sentence', () => {
  for (const message of [
    'invalid transition',
    'the owner cannot leave their own group',
    'the owner may only remove or re-invite',
  ]) {
    assert.deepEqual(classifyCircleError(pg('22023', message)), { kind: 'stale' }, message);
  }
  assert.match(MIGRATION, /raise exception 'invalid transition' using errcode = '22023'/);
  assert.equal(circleFailureIsSilent({ kind: 'stale' }), true);
});

test('a duplicate membership row is the same stale view, seen from the insert side', () => {
  // Inviting somebody who already has a `removed` row: the verb should have
  // been ask-again, and the picker was drawn from data that has since moved.
  assert.deepEqual(classifyCircleError(pg('23505', 'duplicate key value')), { kind: 'stale' });
});

test('nothing else is silent', () => {
  const kinds: CircleFailure[] = [
    { kind: 'group_full' },
    { kind: 'not_mutual' },
    { kind: 'terms_required' },
    { kind: 'rate_limited' },
    { kind: 'blocked_text' },
    { kind: 'invalid_name' },
    { kind: 'unknown' },
  ];
  for (const failure of kinds) {
    assert.equal(circleFailureIsSilent(failure), false, failure.kind);
  }
});

// ---------------------------------------------------------------------------
// 5 · The rest of the surface
// ---------------------------------------------------------------------------

test('the invite rate limit is the existing one, and is classified', () => {
  assert.deepEqual(classifyCircleError(pg('54000', 'rate_limited: invites')), {
    kind: 'rate_limited',
  });
  assert.match(MIGRATION, /elsif tg_table_name = 'circle_members' then/);
  assert.match(MIGRATION, /if v_count >= 100 then/);
});

test('a write that moved a key or a role is a bug, not an eligibility answer', () => {
  assert.match(MIGRATION, /raise exception 'only state may change' using errcode = '42501'/);
  assert.deepEqual(classifyCircleError(pg('42501', 'only state may change')), { kind: 'unknown' });
});

test('anything unrecognisable classifies rather than throwing', () => {
  for (const value of [null, undefined, 'a string', 42, {}, new Error('offline')]) {
    assert.deepEqual(classifyCircleError(value), { kind: 'unknown' });
  }
});

// ---------------------------------------------------------------------------
// 6 · The events carry nothing
// ---------------------------------------------------------------------------

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test('no builder emits an id, a name or a count — of anything', () => {
  const payloads: Record<string, unknown>[] = [
    circleCreatedProps(),
    circleInviteSentProps(),
    circleInviteBlockedProps('group_full'),
    circleInviteBlockedProps('not_mutual'),
    circleInvitationAnsweredProps('accepted'),
    circleInvitationAnsweredProps('declined'),
    circleMemberReInvitedProps(),
    circleMembershipEndedProps('left'),
    circleMembershipEndedProps('removed'),
    circleRenamedProps(),
    circleDeletedProps(),
  ];

  for (const payload of payloads) {
    for (const [key, value] of Object.entries(payload)) {
      assert.doesNotMatch(key, /id$|_id|name|count|member|user|circle|group/i, `key ${key}`);
      // No numbers at all: a group's size is one of the most identifying
      // things about it, which is why this rule is stricter here than the one
      // Daily Social carries.
      assert.equal(typeof value, 'string', `${key} is not a bounded enum`);
      assert.doesNotMatch(String(value), UUID, `${key} carries an identifier`);
      assert.ok(String(value).length <= 20, `${key} is not short and bounded`);
    }
  }
});

test('the only property values are the three closed enums', () => {
  assert.deepEqual(circleInviteBlockedProps('group_full'), { reason: 'group_full' });
  assert.deepEqual(circleInvitationAnsweredProps('declined'), { answer: 'declined' });
  assert.deepEqual(circleMembershipEndedProps('removed'), { how: 'removed' });
  // The bare five carry nothing whatever.
  for (const empty of [
    circleCreatedProps(),
    circleInviteSentProps(),
    circleMemberReInvitedProps(),
    circleRenamedProps(),
    circleDeletedProps(),
  ]) {
    assert.deepEqual(empty, {});
  }
});

test('every event name is a member of the closed AppEvent union', () => {
  // A typo would otherwise be a second event that looks real and splits the
  // funnel. The union is where "eight" is enforced.
  const posthog = readFileSync('src/lib/posthog.tsx', 'utf8');
  for (const name of Object.values(CIRCLE_EVENTS)) {
    assert.match(posthog, new RegExp(`\\| '${name}'`), `${name} is not in AppEvent`);
  }
  assert.equal(new Set(Object.values(CIRCLE_EVENTS)).size, 8);
});

test('there is no event for opening a group or reading its roster', () => {
  const source = body(`${FEATURE_DIR}/analytics.ts`);
  assert.doesNotMatch(source, /circle_opened|circle_viewed|roster_viewed/);
});

// ---------------------------------------------------------------------------
// 7 · The four claims the read and write paths make
// ---------------------------------------------------------------------------

test('the member count comes from the RPC, never from counting rows', () => {
  // An invitee can read exactly one membership row — their own — so a client
  // count would report 1 for every group anybody was invited to.
  const source = body(`${FEATURE_DIR}/queries.ts`);
  assert.match(source, /rpc\('circle_member_count', \{ p_circle: circleId \}\)/);
  assert.doesNotMatch(source, /count: 'exact'|head: true|\.length,\s*$/m);
  assert.match(MIGRATION, /create function circle_member_count\(p_circle uuid\) returns integer/);
});

test('nothing deletes a membership row, and nothing could', () => {
  // There is no DELETE grant and no delete policy on `circle_members`.
  // Leaving is `left`, removal is `removed`, and the builder in `client.ts`
  // does not expose a verb that could say otherwise.
  assert.match(MIGRATION, /grant select, insert, update\s+on circle_members to authenticated;/);

  const client = body(`${FEATURE_DIR}/client.ts`);
  const membersBlock = client.slice(client.indexOf("from(relation: 'circle_members')"));
  assert.doesNotMatch(membersBlock.slice(0, membersBlock.indexOf('rpc(')), /delete/);

  const mutations = body(`${FEATURE_DIR}/mutations.ts`);
  assert.equal(mutations.match(/\.delete\(\)/g)?.length, 1, 'exactly one delete, on `circles`');
  assert.match(mutations, /from\('circles'\)\.delete\(\)/);
});

test('creating a group writes one row, and not the owner’s membership', () => {
  // `handle_new_circle` writes it as a definer; a hand-written owner row would
  // fail its own RLS policy, and correctly so.
  const mutations = body(`${FEATURE_DIR}/mutations.ts`);
  const create = mutations.slice(
    mutations.indexOf('export function useCreateCircle'),
    mutations.indexOf('export function useRenameCircle'),
  );
  assert.match(create, /from\('circles'\)/);
  assert.doesNotMatch(create, /circle_members/);
  assert.match(MIGRATION, /create trigger on_circle_created after insert on circles/);
});

test('invitations are written one at a time, which is what makes the cap real', () => {
  // A row-level BEFORE trigger cannot see the other rows of its own multi-row
  // INSERT. The migration says the client is what keeps that unreachable.
  const mutations = body(`${FEATURE_DIR}/mutations.ts`);
  assert.match(mutations, /for \(const userId of userIds\)/);
  assert.doesNotMatch(mutations, /\.insert\(\[/);
  assert.match(MIGRATION, /A row-level BEFORE trigger cannot see the other rows of its own/);

  // And the builder's own signature refuses an array.
  assert.match(body(`${FEATURE_DIR}/client.ts`), /insert\(values: Record<string, unknown>\)/);
});

test('every mutation snapshots, rolls back and invalidates', () => {
  const mutations = body(`${FEATURE_DIR}/mutations.ts`);
  const count = (pattern: RegExp) => mutations.match(pattern)?.length ?? 0;
  const verbs = count(/useMutation\(\{/g);
  assert.equal(verbs, 9, 'nine verbs');
  assert.equal(count(/onMutate:/g), verbs);
  assert.equal(count(/onError:/g), verbs);
  assert.equal(count(/onSettled:/g), verbs);
});

test('errors reach the classifier whole', () => {
  // `new Error(error.message)` would turn a full group into an unknown
  // failure at the moment the interface has something useful to say.
  const mutations = body(`${FEATURE_DIR}/mutations.ts`);
  assert.match(mutations, /if \(error\) throw error;/);
  assert.doesNotMatch(mutations, /new Error\(error\.message\)/);
});

// ---------------------------------------------------------------------------
// 8 · Identifiers say circle. This layer says nothing at all.
// ---------------------------------------------------------------------------

/** `a, b, c` — a PostgREST column list, which is identifiers and not a sentence. */
const COLUMN_LIST = /^[a-z_]+(, [a-z_]+)*$/;

test('no file in the data layer contains prose', () => {
  // Every string literal with a space in it, once column lists are set aside,
  // is a sentence somebody could read. There are exactly four in this feature
  // and all four are listed here: one is the sign-in guard every mutation in
  // the app carries, and three are sentinels MATCHED against messages the
  // database sends — not strings this layer emits.
  const allowed = new Set([
    'Not signed in.',
    'This group is full.',
    'not allowed here',
    'only state may change',
  ]);

  for (const file of FEATURE_FILES) {
    const literals = body(file).match(/'[^'\n]*'|"[^"\n]*"/g) ?? [];
    for (const literal of literals) {
      const text = literal.slice(1, -1);
      if (!text.includes(' ') || COLUMN_LIST.test(text)) continue;
      assert.ok(allowed.has(text), `${file} writes prose: ${literal}`);
    }
  }
});

test('the only sentence any of it constructs is the sign-in guard', () => {
  for (const file of FEATURE_FILES) {
    const constructed = body(file).match(/new Error\('[^']*'\)/g) ?? [];
    for (const call of constructed) {
      assert.equal(call, "new Error('Not signed in.')", `${file}`);
    }
  }
});

test('and it says "circle" only where an identifier is meant', () => {
  // The vocabulary contract, from this layer's side: `circle` in code, and no
  // customer-facing string here at all to get wrong. The copy module owns the
  // words, and owns saying "group".
  for (const file of FEATURE_FILES) {
    const literals = body(file).match(/'[^'\n]*'|"[^"\n]*"/g) ?? [];
    for (const literal of literals) {
      const text = literal.slice(1, -1);
      if (!/circle/i.test(text) || COLUMN_LIST.test(text)) continue;
      assert.doesNotMatch(text, / /, `${file}: "circle" in a readable string — ${literal}`);
    }
  }
});
