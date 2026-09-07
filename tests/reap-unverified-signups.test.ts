import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The reaper for accounts nobody ever entered (ledger A49, 2026-09-06).
 * `signInWithOtp` mints the auth row when a code is SENT; the row is kept
 * no longer than the code is good for. Pins the four conditions and the
 * schedule — every one of them is a reason a real account is never touched.
 */
const SQL = readFileSync('supabase/migrations/20260907000000_reap_unverified_signups.sql', 'utf8');

test('only OTP-minted, never-confirmed, never-signed-in, day-old, garment-less rows are reaped', () => {
  const body = SQL.slice(SQL.indexOf('delete from auth.users u'), SQL.indexOf('returning u.id'));
  assert.match(body, /raw_app_meta_data->>'provider' in \('email', 'phone'\)/);
  assert.match(body, /email_confirmed_at is null/);
  assert.match(body, /phone_confirmed_at is null/);
  assert.match(body, /last_sign_in_at is null/);
  assert.match(body, /created_at < now\(\) - interval '24 hours'/);
  assert.match(body, /not exists \(select 1 from public\.items i where i\.user_id = u\.id\)/);
  // Every condition is ANDed — nothing here is an OR.
  assert.doesNotMatch(body, /\bor\b/);
});

test('the function is definer-only, unschedulable by clients, and runs hourly', () => {
  assert.match(SQL, /security definer\s*set search_path = ''/);
  assert.match(SQL, /revoke all on function public\.reap_unverified_signups\(\) from public, anon, authenticated;/);
  assert.match(SQL, /cron\.schedule\('cinch-reap-unverified-signups', '43 \* \* \* \*'/);
});
