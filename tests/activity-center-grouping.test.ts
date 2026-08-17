/**
 * Sections, collapse and the two-source merge — AC-02 and AC-08.
 *
 * The invariant this file exists for is the one that is easiest to break and
 * hardest to see: **ordering is strictly reverse-chronological**. Every
 * assertion below that walks a section's output is checking that property as
 * well as whatever it is nominally about, because a grouper that reorders is a
 * ranker, and §7 forbids ranking on this surface.
 *
 * The second invariant is that `New` means UNSEEN and not RECENT. Dating it
 * would make the heading change under a reader who did nothing, which is the
 * behaviour that makes an inbox feel like it is moving on its own.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ageInDays,
  buildSections,
  COLLAPSE_AFTER_DAYS,
  dateSpan,
  nameList,
  sectionOf,
} from '../src/features/activity-center/grouping';
import { hasNew, isEmpty, mergeLegacy } from '../src/features/activity-center/merge';
import { describeActivity } from '../src/features/activity-center/sentence';
import type { ActivityActor, ActivityEvent, ActivityEventType } from '../src/features/activity-center/types';
import { describeActivity as describeLegacy } from '../src/features/activity/sentence';
import { NO_SUBJECTS, type ActivityFeedRow } from '../src/features/activity/types';

const NOW = new Date(2026, 7, 17, 9, 41);
const DAY = 24 * 3_600_000;

const ago = (days: number, hours = 0) =>
  new Date(NOW.getTime() - days * DAY - hours * 3_600_000).toISOString();

function line(
  type: ActivityEventType,
  over: Partial<ActivityEvent> = {},
  actor: ActivityActor = { name: 'Maya', avatarUrl: null },
) {
  const event: ActivityEvent = {
    id: `e-${over.occurredAt ?? type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    actorId: 'u-1',
    subjectType: type === 'daily.reaction.received' ? 'outfit' : 'circle',
    subjectId: 's-1',
    circleId: 'c-1',
    payload: { circle_name: 'Sunday Roasts', reaction: 'sharp' },
    occurredAt: ago(0, 2),
    seenAt: NOW.toISOString(),
    revokedAt: null,
    ...over,
  };
  return describeActivity(event, actor, NOW);
}

/** Every stamp in a section, in the order the section hands them back. */
function stamps(data: readonly { kind: string }[]): string[] {
  return data.map((entry) => {
    const e = entry as
      | { kind: 'row'; line: ReturnType<typeof line> }
      | { kind: 'group'; lines: ReturnType<typeof line>[] }
      | { kind: 'legacy'; line: { row: { occurredAt: string } } };
    if (e.kind === 'row') return e.line.event.occurredAt;
    if (e.kind === 'group') return e.lines[0]!.event.occurredAt;
    return e.line.row.occurredAt;
  });
}

function assertDescending(values: readonly string[], label: string): void {
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i - 1]! >= values[i]!, `${label} is not reverse-chronological at ${i}`);
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

test('New means unseen, not recent', () => {
  // An hour old and already looked at: not New.
  const seen = line('circle.member.joined', { occurredAt: ago(0, 1), seenAt: NOW.toISOString() });
  assert.equal(sectionOf(seen, NOW), 'earlier');

  // Four days old and never looked at: New.
  const unseen = line('circle.member.joined', { occurredAt: ago(4), seenAt: null });
  assert.equal(sectionOf(unseen, NOW), 'new');
});

test('a revoked row is never New, however unseen', () => {
  const revoked = line('circle.invite.received', {
    occurredAt: ago(0, 1),
    seenAt: null,
    revokedAt: NOW.toISOString(),
  });
  assert.equal(sectionOf(revoked, NOW), 'earlier');
});

test('seen rows file by age across the three dated sections', () => {
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(0, 3) }), NOW), 'earlier');
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(1) }), NOW), 'earlier');
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(4) }), NOW), 'week');
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(20) }), NOW), 'month');
});

test('the collapse boundary and the month boundary are the same seven days', () => {
  assert.equal(COLLAPSE_AFTER_DAYS, 7);
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(6) }), NOW), 'week');
  assert.equal(sectionOf(line('circle.member.joined', { occurredAt: ago(7) }), NOW), 'month');
});

test('an empty section is never drawn', () => {
  const sections = buildSections([line('circle.member.joined', { occurredAt: ago(0, 1) })], NOW);
  assert.deepEqual(sections.map((s) => s.key), ['earlier']);
});

test('sections come back in reading order, newest first', () => {
  const sections = buildSections(
    [
      line('circle.member.joined', { occurredAt: ago(20), seenAt: null }),
      line('circle.member.joined', { occurredAt: ago(0, 1) }),
      line('circle.member.joined', { occurredAt: ago(4) }),
      line('circle.member.joined', { occurredAt: ago(20) }),
    ],
    NOW,
  );
  assert.deepEqual(sections.map((s) => s.key), ['new', 'earlier', 'week', 'month']);
});

test('ageInDays never goes negative on a clock that ran backwards', () => {
  assert.equal(ageInDays(new Date(NOW.getTime() + 5 * DAY).toISOString(), NOW), 0);
  assert.equal(ageInDays('not-a-date', NOW), 0);
});

// ---------------------------------------------------------------------------
// Collapse — AC-08
// ---------------------------------------------------------------------------

test('a run of arrivals older than a week collapses into one summary', () => {
  const sections = buildSections(
    [
      line('circle.member.joined', { occurredAt: ago(9) }, { name: 'Priya', avatarUrl: null }),
      line('circle.member.joined', { occurredAt: ago(10) }, { name: 'Len', avatarUrl: null }),
      line('circle.member.joined', { occurredAt: ago(11) }, { name: 'Ada', avatarUrl: null }),
    ],
    NOW,
  );
  const month = sections.find((s) => s.key === 'month')!;
  assert.equal(month.data.length, 1);
  const group = month.data[0]!;
  assert.equal(group.kind, 'group');
  if (group.kind !== 'group') return;
  assert.equal(group.title, '3 people joined your circles');
  assert.match(group.subtitle, /Priya, Len and Ada/);
  assert.equal(group.lines.length, 3);
});

test('reactions collapse with a "From" and arrivals do not — it is grammar', () => {
  const sections = buildSections(
    [
      line('daily.reaction.received', { occurredAt: ago(9) }, { name: 'Maya', avatarUrl: null }),
      line('daily.reaction.received', { occurredAt: ago(10) }, { name: 'Theo', avatarUrl: null }),
    ],
    NOW,
  );
  const group = sections.find((s) => s.key === 'month')!.data[0]!;
  assert.equal(group.kind, 'group');
  if (group.kind !== 'group') return;
  assert.equal(group.title, '2 reactions to your looks');
  assert.match(group.subtitle, /^From /);
});

test('one of a kind does not collapse — a summary of one says less than the row', () => {
  const sections = buildSections([line('circle.member.joined', { occurredAt: ago(9) })], NOW);
  assert.equal(sections.find((s) => s.key === 'month')!.data[0]!.kind, 'row');
});

test('invitations and departures never collapse, however old', () => {
  for (const type of ['circle.invite.received', 'circle.member.left', 'circle.self.left'] as const) {
    const sections = buildSections(
      [line(type, { occurredAt: ago(9) }), line(type, { occurredAt: ago(10) })],
      NOW,
    );
    for (const entry of sections.find((s) => s.key === 'month')!.data) {
      assert.equal(entry.kind, 'row', `${type} was collapsed`);
    }
  }
});

test('nothing collapses outside the oldest section', () => {
  const sections = buildSections(
    [
      line('circle.member.joined', { occurredAt: ago(3) }),
      line('circle.member.joined', { occurredAt: ago(4) }),
      line('circle.member.joined', { occurredAt: ago(5) }),
    ],
    NOW,
  );
  for (const entry of sections.find((s) => s.key === 'week')!.data) {
    assert.equal(entry.kind, 'row');
  }
});

test('a collapse cannot reach past an intervening row and reorder the page', () => {
  const sections = buildSections(
    [
      line('circle.member.joined', { occurredAt: ago(9) }),
      line('circle.self.left', { occurredAt: ago(10) }),
      line('circle.member.joined', { occurredAt: ago(11) }),
      line('circle.member.joined', { occurredAt: ago(12) }),
    ],
    NOW,
  );
  const month = sections.find((s) => s.key === 'month')!;
  assert.deepEqual(month.data.map((e) => e.kind), ['row', 'row', 'group']);
  assertDescending(stamps(month.data), 'collapsed month');
});

test('a revoked row is never absorbed into a summary', () => {
  const sections = buildSections(
    [
      line('daily.reaction.received', { occurredAt: ago(9), revokedAt: NOW.toISOString() }),
      line('daily.reaction.received', { occurredAt: ago(10) }),
      line('daily.reaction.received', { occurredAt: ago(11) }),
    ],
    NOW,
  );
  const month = sections.find((s) => s.key === 'month')!;
  assert.equal(month.data[0]!.kind, 'row');
  assert.equal(month.data[1]!.kind, 'group');
});

test('a collapsed group takes the position of its newest member', () => {
  const sections = buildSections(
    [
      line('circle.member.joined', { occurredAt: ago(9) }),
      line('circle.member.joined', { occurredAt: ago(10) }),
      line('circle.self.left', { occurredAt: ago(11) }),
    ],
    NOW,
  );
  assertDescending(stamps(sections.find((s) => s.key === 'month')!.data), 'month');
});

// ---------------------------------------------------------------------------
// The two summary strings
// ---------------------------------------------------------------------------

test('names list three then a remainder, and drop the nameless', () => {
  assert.equal(nameList(['Priya']), 'Priya');
  assert.equal(nameList(['Priya', 'Len']), 'Priya and Len');
  assert.equal(nameList(['Priya', 'Len', 'Ada']), 'Priya, Len and Ada');
  assert.equal(nameList(['Maya', 'Theo', 'Ada', 'Len', 'Bo']), 'Maya, Theo, Ada and 2 others');
  assert.equal(nameList([null, null]), '');
  // The same person twice is one person.
  assert.equal(nameList(['Maya', 'Maya', 'Theo']), 'Maya and Theo');
});

test('the date span is tight inside a month and spaced across one', () => {
  // Local-time constructors, not Z-suffixed strings: `dateSpan` renders in the
  // reader's own zone (a stamp that said "Aug 2" to somebody whose Aug 2 it was
  // not would be the wrong date), so a UTC midnight fixture is a different day
  // for every runner west of Greenwich. Same reason `date.test.ts` builds its
  // fixtures this way.
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

  assert.equal(dateSpan(at(2026, 7, 9), at(2026, 7, 2)), 'Aug 2–9');
  assert.equal(dateSpan(at(2026, 8, 3), at(2026, 7, 28)), 'Aug 28 – Sep 3');
  assert.equal(dateSpan(at(2026, 7, 2, 18), at(2026, 7, 2, 6)), 'Aug 2');
  assert.equal(dateSpan('nope', 'nope'), '');
});

// ---------------------------------------------------------------------------
// The merge — one inbox, two sources
// ---------------------------------------------------------------------------

function legacy(occurredAt: string) {
  const row: ActivityFeedRow = {
    kind: 'follow_in',
    subjectKey: `s-${occurredAt}`,
    actorId: 'u-9',
    occurredAt,
    itemId: null,
    outfitId: null,
    eventId: null,
    postId: null,
    tally: null,
  };
  return describeLegacy(row, NO_SUBJECTS, NOW);
}

test('legacy rows interleave by timestamp rather than landing in a block', () => {
  const sections = mergeLegacy(
    buildSections(
      [
        line('circle.member.joined', { occurredAt: ago(1) }),
        line('circle.member.joined', { occurredAt: ago(1, 4) }),
      ],
      NOW,
    ),
    [legacy(ago(1, 2))],
    NOW.toISOString(),
    NOW,
  );

  const earlier = sections.find((s) => s.key === 'earlier')!;
  assert.deepEqual(earlier.data.map((e) => e.kind), ['row', 'legacy', 'row']);
  assertDescending(stamps(earlier.data), 'merged earlier');
});

test('a legacy row after the surface-wide seen boundary is New', () => {
  const boundary = ago(2);
  const sections = mergeLegacy([], [legacy(ago(1))], boundary, NOW);
  assert.deepEqual(sections.map((s) => s.key), ['new']);
  assert.equal(hasNew(sections), true);
});

test('a legacy row before it files by age, exactly as an event does', () => {
  const boundary = ago(0, 1);
  const sections = mergeLegacy([], [legacy(ago(4))], boundary, NOW);
  assert.deepEqual(sections.map((s) => s.key), ['week']);
  assert.equal(hasNew(sections), false);
});

test('a boundary that was never written makes everything New', () => {
  const sections = mergeLegacy([], [legacy(ago(20))], null, NOW);
  assert.deepEqual(sections.map((s) => s.key), ['new']);
});

test('a section that exists only because of legacy rows is created', () => {
  const sections = mergeLegacy(
    buildSections([line('circle.member.joined', { occurredAt: ago(1) })], NOW),
    [legacy(ago(20))],
    NOW.toISOString(),
    NOW,
  );
  assert.deepEqual(sections.map((s) => s.key), ['earlier', 'month']);
});

test('both sources empty is the empty page, and neither alone is', () => {
  assert.equal(isEmpty(mergeLegacy([], [], NOW.toISOString(), NOW)), true);
  assert.equal(
    isEmpty(mergeLegacy([], [legacy(ago(1))], NOW.toISOString(), NOW)),
    false,
  );
  assert.equal(
    isEmpty(mergeLegacy(buildSections([line('circle.member.joined')], NOW), [], NOW.toISOString(), NOW)),
    false,
  );
});
