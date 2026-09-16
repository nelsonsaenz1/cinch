import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Founder ruling 12.15 (2026-09-16): the closet ceiling is hard. Both limit
 * triggers take a per-person transaction advisory lock BEFORE they count, so
 * two inserts at the same instant cannot both read the same count and both
 * pass. The sentinels the client classifies on are unchanged.
 */
const M = readFileSync('supabase/migrations/20260916000000_item_limit_serialised.sql', 'utf8');

test('both limit triggers lock per person before counting', () => {
  const locks = M.match(/perform pg_advisory_xact_lock\(hashtext\('items_limit:' \|\| new\.user_id::text\)\);/g) ?? [];
  assert.equal(locks.length, 2);
  const insertFn = M.indexOf('create or replace function public.enforce_item_limit()');
  const restoreFn = M.indexOf('create or replace function public.enforce_item_limit_on_restore()');
  assert.ok(insertFn !== -1 && restoreFn !== -1 && insertFn < restoreFn);
  // The lock precedes the count in each body.
  for (const start of [insertFn, restoreFn]) {
    const body = M.slice(start, M.indexOf('$$;', start));
    assert.ok(body.indexOf('pg_advisory_xact_lock') < body.indexOf('select count(*)'), 'lock, then count');
  }
});

test('the sentinels the client keys on are unchanged', () => {
  assert.match(M, /raise exception 'closet_limit_reached: % of % garments'/);
  assert.match(M, /raise exception 'storage_limit_reached: % of % stored'/);
  assert.match(M, /errcode = 'check_violation'/);
  // Every row counts, `pending_upload` included — the retry road reuses rows.
  assert.match(M, /select count\(\*\) filter \(where not is_archived\), count\(\*\)/);
});
