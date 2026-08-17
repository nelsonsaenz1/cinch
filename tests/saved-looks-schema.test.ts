/**
 * The saved-looks schema, pinned against the file that carries it.
 *
 * The `database` CI job is the only thing in this repository that OBSERVES RLS,
 * and it needs a running Postgres. This suite does not have one — so what it can
 * do, and does, is hold the migration to the shape the design record requires
 * before anybody gets that far: the four owner policies, the access check on the
 * insert, the absence of every foreign key that would make a save a copy, and
 * the one structural decision this packet makes.
 *
 * ── THE DECISION BEING PINNED ──────────────────────────────────────────────
 *
 * **A collection is a `board`.** The atlas's `collection` — private,
 * owner-scoped, a name, and deleting one keeps its members — is `boards`
 * (20260810100000 §1) in every particular. A parallel table would be a second
 * name for one idea, and its cost is not abstract: a look you kept of your own
 * would sit on a "board" while a look you kept of a friend's would sit in a
 * "collection", two words for one shelf, two taps apart.
 *
 * So the assertions below check both halves — that `saved_looks.collection_id`
 * points at `boards`, and that no `collections` table was created anywhere.
 *
 * ── AND THE ONE THE HANDOFF ASKS FOR BY NAME ───────────────────────────────
 *
 * §11: "Snapshot never contains garment rows (schema assertion: no FK from
 * `saved_look` to garments)." That is asserted here against the source and again
 * in 22_saved_looks.sql against the live catalogue, which are two different
 * failures — a column added later without a migration review, and a column added
 * with one.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const PATH = 'supabase/migrations/20260821000000_saved_looks.sql';
const MIGRATION = readFileSync(PATH, 'utf8');
const PGTAP = readFileSync('supabase/tests/22_saved_looks.sql', 'utf8');
const BOARDS = readFileSync('supabase/migrations/20260810100000_wear_diary_and_boards.sql', 'utf8');

/** The statement body, with `--` comments stripped so prose cannot satisfy a check. */
const SQL = MIGRATION.replace(/^\s*--.*$/gm, '');

// ---------------------------------------------------------------------------
// 1 · Row level security, and the four policies
// ---------------------------------------------------------------------------

test('RLS is enabled on the one new table', () => {
  assert.match(SQL, /alter table saved_looks enable row level security/);
});

test('there are exactly four owner-scoped policies, one per command', () => {
  const policies = [...SQL.matchAll(/create policy "saved_looks: [^"]+" on saved_looks\s+for (\w+)/g)];
  assert.deepEqual(
    policies.map((match) => match[1]).sort(),
    ['delete', 'insert', 'select', 'update'],
  );
});

test('every policy names `authenticated`, and none of them names anon', () => {
  const policies = [...SQL.matchAll(/create policy[\s\S]*?;/g)].map((m) => m[0]);
  assert.ok(policies.length >= 4);
  for (const policy of policies) {
    assert.match(policy, /to authenticated/);
  }
  assert.ok(!/to anon/.test(SQL), 'a policy admits anon — the house rule is that none ever does');
});

test('the principal is `auth.uid()` in the subselect form, everywhere', () => {
  const bare = [...SQL.matchAll(/auth\.uid\(\)/g)].length;
  const wrapped = [...SQL.matchAll(/\(select auth\.uid\(\)\)/g)].length;
  assert.equal(bare, wrapped, 'a policy uses a bare auth.uid(), which re-plans per row');
});

test('the insert is the one policy that does real work — it checks source access', () => {
  const insert = /create policy "saved_looks: owner can insert[^"]*" on saved_looks[\s\S]*?;/.exec(SQL);
  assert.ok(insert, 'the insert policy is missing');
  assert.match(insert[0], /can_save_source\(source_type, source_id\)/);
});

// ---------------------------------------------------------------------------
// 2 · A save is a pointer, never a copy
// ---------------------------------------------------------------------------

test('there is no foreign key from a save to any garment or outfit relation', () => {
  // The three that would make a save a copy, or make a source deletion reach
  // into somebody's private note.
  for (const relation of ['items', 'outfit_items', 'outfits']) {
    assert.ok(
      !new RegExp(`references\\s+${relation}\\s*\\(`).test(SQL),
      `saved_looks references ${relation} — §3 forbids garment rows from being copied in`,
    );
  }
});

test('`source_id` is a bare uuid, deliberately not a foreign key', () => {
  assert.match(SQL, /source_id\s+uuid not null,/);
});

test('the snapshot holds display fields only, and every text column is bounded', () => {
  const table = /create table saved_looks \([\s\S]*?\n\);/.exec(SQL);
  assert.ok(table, 'the table is missing');
  const columns = table[0];

  // Every `text` column carries a length check. An unbounded string that
  // outlives the thing it describes is a string nobody goes back and checks.
  const textColumns = [...columns.matchAll(/^\s{2}(\w+)\s+text\b/gm)].map((m) => m[1]);
  assert.deepEqual(textColumns.sort(), [
    'note',
    'snap_image_url',
    'snap_source_label',
    'snap_source_visibility',
    'snap_title',
  ]);
  for (const column of textColumns) {
    assert.ok(
      new RegExp(`${column}[\\s\\S]{0,200}?char_length`).test(columns),
      `${column} has no length check`,
    );
  }

  // And nothing garment-shaped snuck in.
  for (const forbidden of ['item_id', 'size', 'brand', 'price', 'garment']) {
    assert.ok(!columns.includes(forbidden), `saved_looks carries a ${forbidden} column`);
  }
});

test('one save per source per person — the duplicate state is the database’s answer', () => {
  assert.match(SQL, /unique \(owner_id, source_type, source_id\)/);
});

// ---------------------------------------------------------------------------
// 3 · Availability is computed, never stored
// ---------------------------------------------------------------------------

test('there is no availability column — only a view expression', () => {
  const table = /create table saved_looks \([\s\S]*?\n\);/.exec(SQL)![0];
  assert.ok(
    !/availability/.test(table),
    'availability is stored, which caches somebody else’s privacy decision',
  );
  assert.match(SQL, /case[\s\S]*?can_save_source\(s\.source_type, s\.source_id\)[\s\S]*?as availability/);
});

test('the view is security_invoker, so the caller’s own RLS still applies', () => {
  assert.match(SQL, /create view saved_looks_resolved\s+with \(security_invoker = true\)/);
});

test('`can_save_source` reuses the three predicates that already existed', () => {
  const fn = /create function can_save_source[\s\S]*?\$\$;/.exec(SQL);
  assert.ok(fn, 'can_save_source is missing');
  // Own outfit: the owner-only policy, written out.
  assert.match(fn[0], /public\.outfits o[\s\S]*?o\.user_id = \(select auth\.uid\(\)\)/);
  // Daily look: membership of the Daily Social view, which already encodes
  // opted-in, after the boundary, inside seven days, not hidden, mutual.
  assert.match(fn[0], /public\.friend_worn_outfits/);
  // Event look: the post's own select predicate, not the looser can_see_event.
  assert.match(fn[0], /public\.is_event_member\(p\.event_id\)/);
  assert.ok(
    !/can_see_event/.test(fn[0]),
    'can_see_event admits an invitee who has not joined — looser than the post policy it stands in for',
  );
  assert.match(fn[0], /security definer set search_path = ''/);
});

test('the snapshot and the source pointer are frozen for the life of the row', () => {
  const trigger = /create function assert_saved_look_immutable[\s\S]*?\$\$;/.exec(SQL);
  assert.ok(trigger, 'the immutability trigger is missing');
  for (const column of [
    'source_type',
    'source_id',
    'snap_title',
    'snap_image_url',
    'snap_source_label',
    'snap_source_visibility',
    'snap_saved_at',
  ]) {
    assert.ok(trigger[0].includes(column), `${column} may be rewritten after the access check`);
  }
  // And the two that may move are absent from the frozen list.
  assert.ok(!/new\.note\b/.test(trigger[0]));
  assert.ok(!/new\.collection_id\b/.test(trigger[0]));
});

// ---------------------------------------------------------------------------
// 4 · Collections are boards
// ---------------------------------------------------------------------------

test('a collection is a board — the pointer references `boards`, with set null', () => {
  assert.match(SQL, /collection_id\s+uuid references boards \(id\) on delete set null/);
});

test('no parallel `collections` table was created anywhere in the tree', () => {
  for (const file of readdirSync('supabase/migrations')) {
    const source = readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/^\s*--.*$/gm, '');
    assert.ok(
      !/create table (public\.)?collections\b/.test(source),
      `${file} creates a second table for the shelf that boards already is`,
    );
  }
});

test('the schema’s 60-character name ceiling was NOT narrowed to the atlas’s 40', () => {
  // Boards with 41-60 character names exist. A tightened check would refuse to
  // load somebody's own data in order to make a newer sentence true, so the 40
  // lives at the field instead — `COLLECTION_NAME_MAX`.
  assert.match(BOARDS, /char_length\(btrim\(name\)\) between 1 and 60/);
  assert.ok(
    !/alter table boards[\s\S]*?char_length/.test(SQL),
    'this migration narrows boards.name, which would refuse existing rows',
  );
  const types = readFileSync('src/features/saved-looks/types.ts', 'utf8');
  assert.match(types, /COLLECTION_NAME_MAX = 40/);
});

// ---------------------------------------------------------------------------
// 5 · Grants, and the pgTAP file that has to exist beside all of this
// ---------------------------------------------------------------------------

test('grants are explicit, and anon is revoked rather than merely unmentioned', () => {
  assert.match(SQL, /revoke all on saved_looks\s+from public, anon/);
  assert.match(SQL, /grant select, insert, update, delete on saved_looks\s+to authenticated/);
  // The view is read-only: it has an expression column, so it is not
  // auto-updatable, and every write in this feature goes at the table.
  assert.match(SQL, /grant select\s+on saved_looks_resolved to authenticated/);
  assert.ok(!/grant[^\n]*saved_looks_resolved[^\n]*(insert|update|delete)/.test(SQL));
});

test('the function is revoked from public, anon and authenticated before it is granted', () => {
  const revoke = SQL.indexOf('revoke execute on function can_save_source');
  const grant = SQL.indexOf('grant  execute on function can_save_source');
  assert.ok(revoke > -1 && grant > revoke, 'the revoke must precede the deliberate grant');
  assert.match(SQL, /revoke execute on function can_save_source\(saved_look_source, uuid\)\s*\n?\s*from public, anon, authenticated;/);
});

test('the pgTAP file asserts the promises this one cannot', () => {
  // Privacy, the recheck, and the structural claim — the three the CI database
  // job is the only place to observe.
  assert.match(PGTAP, /select plan\(\d+\)/);
  assert.match(PGTAP, /a stranger reads no save at all/);
  assert.match(PGTAP, /not even the source owner learns that their look was kept/);
  assert.match(PGTAP, /a revoked source reads unavailable on the very next read/);
  assert.match(PGTAP, /the owner's own note survives it|the owner''s own note survives it/);
  assert.match(PGTAP, /a save cannot be re-pointed at another source/);
  assert.match(PGTAP, /deleting a collection detaches its looks and deletes none of them/);
});

test('the plan number matches the assertions actually written', () => {
  const planned = Number(/select plan\((\d+)\)/.exec(PGTAP)![1]);
  // Each assertion is numbered in its own description — "1 · …" through "N · …".
  const numbered = new Set(
    [...PGTAP.matchAll(/'(\d+) · /g)].map((match) => Number(match[1])),
  );
  assert.equal(numbered.size, planned, `plan(${planned}) but ${numbered.size} numbered assertions`);
});
