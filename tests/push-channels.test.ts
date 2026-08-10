import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The channel list exists in three places and is allowed to drift in none.
 *
 *   1. migration 20260810100300 — `notification_prefs`' boolean columns and
 *      `push_sends.channel`'s CHECK constraint. THE AUTHORITY: a channel the
 *      CHECK does not know cannot have a ledger row, so it cannot be sent.
 *   2. `src/features/push/channels.ts` — the preferences screen's copy.
 *   3. `supabase/functions/send-push/channels.ts` — the sender's dispatch.
 *
 * (2) and (3) cannot import each other: an edge function resolves `npm:`
 * specifiers and not the `@/*` aliases, and the app the reverse. So each is
 * pinned to (1) separately and the two tests meet in the middle at the schema.
 * This is the sender's half; `tests/notification-channels.test.ts` is the
 * client's. Rename a channel in the migration and both fail; rename it on one
 * side only and that side fails.
 *
 * Same intent as `plans.test.ts`, which does this for the tier numbers: the
 * point is a tripwire, not DRY.
 *
 * The migration is read as text rather than executed. There is no database in
 * this runner, and the thing being checked is a list of names, which a regular
 * expression can see perfectly well.
 */

import { CLAIM_FUNCTION, PUSH_CHANNELS } from '../supabase/functions/send-push/channels';

// Relative to the runner's cwd, which is the repository root, and NOT to this
// file: `run-tests.mjs` bundles each test into `node_modules/.cache/unit-tests`
// — a symlinked `node_modules` in a worktree, so anything derived from
// `import.meta` lands in a different checkout altogether.
const SCHEMA = 'supabase/migrations/20260810100300_push.sql';
const SENDERS = 'supabase/migrations/20260810110100_push_senders.sql';

/** The five names as `push_sends`' CHECK constraint spells them. */
function channelsInCheckConstraint(sql: string): string[] {
  const clause = /check\s*\(channel\s+in\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(clause, 'push_sends has lost its channel CHECK constraint');
  return [...clause[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

test('the sender ships exactly the channels the ledger will accept', () => {
  const check = channelsInCheckConstraint(readFileSync(SCHEMA, 'utf8'));

  assert.deepEqual(
    [...PUSH_CHANNELS].sort(),
    [...check].sort(),
    `sender has [${PUSH_CHANNELS}], push_sends accepts [${check}]`,
  );
});

test('every channel has a preference column of its own name', () => {
  const sql = readFileSync(SCHEMA, 'utf8');
  const table = /create table notification_prefs \(([\s\S]*?)\n\);/.exec(sql);
  assert.ok(table, 'notification_prefs is not where this test expects it');

  for (const channel of PUSH_CHANNELS) {
    assert.match(
      table[1],
      new RegExp(`\\n\\s*${channel}\\s+boolean`),
      `notification_prefs has no boolean column called ${channel}`,
    );
  }
});

test('season in review is still cut', () => {
  // Contract §3: atlas 34 is deferred, so the channel does not exist. If it is
  // ever built, this test is the place that says so out loud — a switch for a
  // feature that does not exist is the refusal this whole wave was careful
  // about.
  assert.ok(
    !(PUSH_CHANNELS as readonly string[]).includes('season_in_review'),
    'season_in_review is being sent, but atlas 34 is deferred',
  );
});

test('every channel is dispatched to a claim function that exists', () => {
  const sql = readFileSync(SENDERS, 'utf8');

  for (const channel of PUSH_CHANNELS) {
    const fn = CLAIM_FUNCTION[channel];
    assert.ok(fn, `${channel} has no claim function`);
    assert.match(
      sql,
      new RegExp(`create function ${fn}\\(\\)`),
      `${channel} dispatches to ${fn}(), which 20260810110100 does not define`,
    );
  }
});
