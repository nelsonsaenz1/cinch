/**
 * Wave 3 · Group 5 — Activity's retention window and its dismissal wording.
 *
 * Atlas: `docs/design/wave-3-final/Wave 3 - Design · Gap Feed and Social.dc.html`,
 * frames AV-01 and AV-02 (audit 90, 91 · correction 22).
 *
 * Two claims are asserted here, and both are claims about SHIPPING TRUTH rather
 * than about a layout:
 *
 *   1. the page's copy states the window `activity_feed()` actually enforces —
 *      the migration is read from disk here, so a later `interval '7 days'`
 *      breaks this test rather than quietly making the page lie;
 *   2. no dismissal wording anywhere implies a rejection, because the write is
 *      an `activity_dismissals` insert and nothing reaches the other person.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  EMPTY_BODY,
  LOAD_ERROR_BODY,
  RETENTION_DAYS,
  RETENTION_LINE,
  RETENTION_SUBTITLE,
} from '../src/features/activity/retention';
import { answerCopy, isUndoable } from '../src/features/activity/sentence';

const MIGRATION = 'supabase/migrations/20260810100100_activity_feed.sql';

// ---------------------------------------------------------------------------
// Correction 22 · the window
// ---------------------------------------------------------------------------

test('the retention copy states the window the SQL actually enforces', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  // The bound lives in `activity_feed()` — one CTE every branch of the union
  // reads — so this is the only number that can be true on the page.
  const bound = /now\(\)\s*-\s*interval\s*'(\d+) days'/.exec(sql);
  assert.ok(bound, 'activity_feed() no longer declares an interval window');
  assert.equal(Number(bound[1]), RETENTION_DAYS);
  assert.equal(RETENTION_DAYS, 30);

  // And the copy prints that number rather than a different one.
  assert.match(RETENTION_SUBTITLE, /\b30 days\b/);
  assert.match(RETENTION_LINE, /\b30 days\b/);
  assert.match(EMPTY_BODY, /\b30 days\b/);
  for (const line of [RETENTION_SUBTITLE, RETENTION_LINE, EMPTY_BODY]) {
    assert.ok(!/seven days|\b7 days\b/i.test(line), line);
  }
});

test('the retention line names where an aged-out item still lives', () => {
  // The correction that matters most: "older items are not stored" implied the
  // underlying request had been deleted, which is untrue — `activity_feed()` is
  // a WINDOW over rows in five other tables and deletes nothing.
  assert.match(RETENTION_LINE, /still lives on the request, occasion or comment it belongs to/);
  assert.ok(!/not stored|deleted|lost|gone/i.test(RETENTION_LINE), RETENTION_LINE);
});

test('nothing on this page ties retention, or anything else, to being unread', () => {
  // Unread state has no effect on retention: the window is `occurred_at`, and
  // `activity_seen_at` appears nowhere in the feed's SQL. The load error used
  // to promise that nothing expires while unread — a promise the window does
  // not make.
  for (const line of [RETENTION_LINE, LOAD_ERROR_BODY, EMPTY_BODY]) {
    assert.ok(!/unread|unseen|until you (read|look)/i.test(line), line);
  }
  assert.match(LOAD_ERROR_BODY, /still waiting on the request or occasion it belongs to/);

  const sql = readFileSync(MIGRATION, 'utf8');
  const feed = sql.slice(sql.indexOf('create function activity_feed()'));
  assert.ok(!feed.includes('activity_seen_at'), 'the feed must not read the seen marker');
});

// ---------------------------------------------------------------------------
// AV-02 · the dismissal says what it did NOT do
// ---------------------------------------------------------------------------

const REJECTION = /\b(declin\w*|reject\w*|remove[d]?|refus\w*|turned down)\b/i;

test('a dismissal never implies a rejection, anywhere in its wording', () => {
  const aside = answerCopy('not-now', 'Marguerite');
  assert.ok(aside);

  // Set aside — not removed, not declined. The word "removed" was the earlier
  // receipt's, and it is a word for a thing thrown away.
  assert.equal(aside.done, 'Request from Marguerite set aside');
  assert.ok(!REJECTION.test(aside.done), aside.done);
  assert.ok(!REJECTION.test(aside.pending), aside.pending);
  assert.ok(!REJECTION.test(aside.failed), aside.failed);

  // The three facts the row must carry.
  assert.match(aside.doneDetail ?? '', /Still waiting in Friends/);
  assert.match(aside.doneDetail ?? '', /Marguerite was not told/);
  assert.ok(!REJECTION.test(aside.doneDetail ?? ''), aside.doneDetail);
});

test('the undo is offered only where a real reversal exists', () => {
  // `activity_dismissals` carries an owner DELETE policy and grant, so the
  // dismissal can be taken back. Every other answer here reaches another
  // person, and un-telling somebody is not a thing this app can do.
  assert.equal(isUndoable('not-now'), true);
  for (const id of ['add-back', 'lend', 'not-this-time', 'open-event'] as const) {
    assert.equal(isUndoable(id), false, id);
  }

  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /activity_dismissals: owner can delete/);
  assert.match(sql, /grant select, insert, delete on table activity_dismissals/);
});

test('an answer that DID reach someone says so, and one that did not says that', () => {
  // The two buttons look alike and are not alike. "Not this time" writes
  // `borrow_requests.status = 'declined'` and the requester is waiting on it;
  // "Not now" writes a dismissal nobody can read.
  assert.match(answerCopy('lend', 'Ana')?.done ?? '', /Ana has been told/);
  assert.match(answerCopy('not-this-time', 'Ana')?.done ?? '', /Ana has been told/);
  assert.match(answerCopy('not-now', 'Ana')?.doneDetail ?? '', /Ana was not told/);
});

test('every failure names what did not happen, and whether she was told', () => {
  // AV-02: "Lending did not go through. Ana has not been told anything."
  assert.equal(
    answerCopy('lend', 'Ana')?.failed,
    'Lending did not go through. Ana has not been told anything.',
  );
  for (const id of ['add-back', 'not-now', 'lend', 'not-this-time'] as const) {
    const failed = answerCopy(id, 'Ana')?.failed ?? '';
    assert.match(failed, /did not go through/, id);
    assert.match(failed, /(has not been told|was not told)/, id);
  }
});

test('a pending answer is a present participle, never a bare "loading"', () => {
  for (const id of ['add-back', 'not-now', 'lend', 'not-this-time'] as const) {
    const pending = answerCopy(id, 'Ana')?.pending ?? '';
    // Present participle + the atlas's ellipsis. A spinner has no words at all,
    // which is why this page does not use one.
    assert.match(pending, /^[A-Z][a-z]+ing\b.*…$/, `${id}: ${pending}`);
    assert.ok(!/loading|please wait/i.test(pending), pending);
  }
});
