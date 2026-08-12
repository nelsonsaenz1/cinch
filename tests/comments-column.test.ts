/**
 * Audit 93 — the comment thread's stable reading column.
 *
 * "A two or three line comment has a stable reading column regardless of name
 * length or controls." The whole point of the measurement is that it does NOT
 * vary, which makes it exactly the kind of claim a test can hold and a
 * screenshot cannot: two frames that happen to look the same today prove
 * nothing about a `flex-1` creeping back in tomorrow.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  COMMENT_COLUMN,
  REPLY_COLUMN,
  REPLY_INDENT,
  commentColumn,
} from '../src/features/event-outfits/comment-geometry';
import {
  audienceScopeLine,
  closedThreadLine,
  commentCountLine,
} from '../src/features/event-outfits/comment-thread';

test('the reading column is exactly 261, and a reply is 26 in at 235', () => {
  assert.equal(COMMENT_COLUMN, 261);
  assert.equal(REPLY_INDENT, 26);
  assert.equal(REPLY_COLUMN, 235);
  // Written as arithmetic in the module, so the two can never drift.
  assert.equal(REPLY_COLUMN, COMMENT_COLUMN - REPLY_INDENT);
});

test('the column depends on nothing but whether the row is a reply', () => {
  // `commentColumn` takes ONE argument. That is the invariant: there is no
  // parameter for the name, the avatar, the overflow control or the type
  // scale, so no caller can make the reading measure a function of any of
  // them. If a future signature grows a second argument, this fails to compile
  // before it fails to read.
  assert.equal(commentColumn.length, 1);

  const top = commentColumn(false);
  const reply = commentColumn(true);
  assert.deepEqual(top, { width: 261, indent: 0 });
  assert.deepEqual(reply, { width: 235, indent: 26 });

  // Idempotent and side-effect free: the same question asked twice, after a
  // reply has been asked about in between, answers the same.
  assert.deepEqual(commentColumn(false), top);
});

test('one indent level, never two', () => {
  // A reply to a reply is still a reply — there is no third width and no way
  // to ask for one. `commentColumn(true)` is the only indented answer there is.
  const widths = new Set([commentColumn(false).width, commentColumn(true).width]);
  assert.equal(widths.size, 2);
});

test('the masthead scope names no headcount', () => {
  // Audit 92's privacy rule reaches the comment masthead too: a thread that
  // printed the roster size tells an invitee how many people were asked, which
  // is one subtraction from how many said no.
  assert.equal(audienceScopeLine, 'only the invited can read this');
  assert.ok(!/\d/.test(audienceScopeLine));
});

test('the comment count is omitted at zero, never printed as 0', () => {
  assert.equal(commentCountLine(0), null);
  assert.equal(commentCountLine(-1), null);
  assert.equal(commentCountLine(1), '1 comment');
  assert.equal(commentCountLine(7), '7 comments');
});

test('the closed notice asserts the server rule that now exists — D-1', () => {
  const withTime = closedThreadLine('8:00pm');
  const undated = closedThreadLine(null);

  // What it DOES say: the cause is the occasion's start (correction 25's
  // "closure names its cause as the occasion's start time rather than an
  // elapsed period"), and everything said stays readable.
  assert.ok(withTime.includes('8:00pm'));
  assert.ok(withTime.includes('stays readable'));
  assert.ok(undated.includes('has started'));

  // AND THE CLAIM IT WITHHELD FOR A WHOLE PACKET. "Nothing new can be added"
  // is a statement about the database, and until `20260812120000` it was false:
  // there was no `comments_closed` column, no `closes_at`, and no time
  // predicate on `event_comments`' insert policy. The founder ruled, the
  // trigger landed, and the sentence became printable.
  for (const line of [withTime, undated]) {
    assert.match(line, /nothing new can be added/i);
  }

  // The trigger it is now allowed to assert, and the code the client maps.
  const migration = readFileSync(
    'supabase/migrations/20260812120000_close_comments_and_lock_board.sql',
    'utf8',
  );
  assert.match(migration, /before insert on public\.event_comments/);
  assert.match(migration, /errcode = 'CL001'/);
});

test('D-1: an undated occasion is never closed', () => {
  // The founder's ruling, and the whole difference between the two candidate
  // implementations: `now() < coalesce(starts_at, 'infinity')` leaves an
  // occasion with no date open until an organizer sets one. An occasion nobody
  // has dated has no start to have passed, and refusing a comment on the
  // grounds of a deadline that does not exist would be inventing one.
  const migration = readFileSync(
    'supabase/migrations/20260812120000_close_comments_and_lock_board.sql',
    'utf8',
  );
  assert.match(migration, /coalesce\(e\.starts_at, 'infinity'::timestamptz\)/);
  assert.match(migration, /now\(\) < coalesce/);
});
