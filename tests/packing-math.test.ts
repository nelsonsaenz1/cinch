/**
 * Every number the two packing atlases print, as a test.
 *
 * Each row names the screen that quotes it, so a failure says which sentence in
 * the design just became false rather than which function changed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isTravelDay,
  lookSchedule,
  looksFor,
  looksForPart,
  looksSentence,
  repeatLabel,
} from '../src/features/plan/packing-math';
import {
  DAY_PARTS,
  VIBES,
  addDays,
  daysBetween,
  describeDates,
  formatDateRange,
  fromIsoDate,
  toIsoDate,
  type DayPartKey,
} from '../src/features/plan/trip';

// ---------------------------------------------------------------------------
// The look count — K-03's running total and K-05's promise
// ---------------------------------------------------------------------------

test('K-03: two day parts across four days is eight looks', () => {
  assert.equal(looksFor(4, ['daytime', 'evening']), 8);
});

test('K-05 promises the same eight looks K-03 counted', () => {
  const parts: DayPartKey[] = ['daytime', 'evening'];
  const schedule = lookSchedule('2026-09-12', 4, parts);
  assert.equal(schedule.length, looksFor(4, parts));
});

test('travel days are two, however long the trip is', () => {
  for (const days of [2, 3, 4, 7, 14]) {
    assert.equal(looksForPart(days, 'travel'), 2, `${days}-day trip`);
  }
  // A day trip travels once — out and back are the same day.
  assert.equal(looksForPart(1, 'travel'), 1);
});

test('every other part is one look per day', () => {
  for (const part of ['daytime', 'evening', 'gym'] as const) {
    assert.equal(looksForPart(6, part), 6, part);
  }
});

test('adding travel to four days adds two looks, not four', () => {
  const without = looksFor(4, ['daytime', 'evening']);
  const with_ = looksFor(4, ['daytime', 'evening', 'travel']);
  assert.equal(with_ - without, 2);
});

// ---------------------------------------------------------------------------
// The schedule
// ---------------------------------------------------------------------------

test('the schedule is day-major and starts on the first day', () => {
  const looks = lookSchedule('2026-09-12', 4, ['daytime', 'evening']);
  assert.equal(looks[0]!.date, '2026-09-12');
  assert.equal(looks[0]!.dayIndex, 0);
  assert.equal(looks[1]!.dayIndex, 0, 'both of day one come before day two');
  assert.equal(looks[2]!.dayIndex, 1);
  assert.equal(looks.at(-1)!.date, '2026-09-15');
});

test('a travel look lands only on the first and last day', () => {
  const looks = lookSchedule('2026-09-12', 4, ['daytime', 'travel']);
  const travelDays = looks.filter((l) => l.part === 'travel').map((l) => l.dayIndex);
  assert.deepEqual(travelDays, [0, 3]);
});

test('a look is worn in the order the day happens, not the order it was asked', () => {
  // DAY_PARTS is chip order — Daytime, Evening, Gym, Travel days. A day runs
  // the other way round.
  const looks = lookSchedule('2026-09-12', 2, ['evening', 'daytime', 'gym', 'travel']);
  const firstDay = looks.filter((l) => l.dayIndex === 0).map((l) => l.part);
  assert.deepEqual(firstDay, ['travel', 'gym', 'daytime', 'evening']);
});

test('the first and last day are travel days whether or not travel was tapped', () => {
  assert.ok(isTravelDay(0, 4));
  assert.ok(isTravelDay(3, 4));
  assert.ok(!isTravelDay(1, 4));
  assert.ok(!isTravelDay(2, 4));
});

test('an unasked-for part never produces a look', () => {
  const looks = lookSchedule('2026-09-12', 3, ['daytime']);
  assert.ok(looks.every((l) => l.part === 'daytime'));
  assert.equal(looks.length, 3);
});

// ---------------------------------------------------------------------------
// Dates — K-03's "12–15 Sept · 4 days"
// ---------------------------------------------------------------------------

test('K-03: 12–15 September is four days', () => {
  assert.equal(daysBetween('2026-09-12', '2026-09-15'), 4);

  // The atlas prints "12–15 Sept · 4 days". The month abbreviation belongs to
  // the device — en-US says "Sep", en-GB "Sept", fr "sept." — so what is
  // asserted is the shape the atlas specifies, with the month left to the
  // locale. Pinning the English string here would be a test that fails on a
  // French phone and passes on a broken one.
  const line = describeDates('2026-09-12', '2026-09-15');
  assert.ok(line.startsWith('12–15 '), line);
  assert.ok(line.endsWith(' · 4 days'), line);
  assert.match(line, /^12–15 \S+ · 4 days$/, line);
});

test('a single day is one day, not zero', () => {
  assert.equal(daysBetween('2026-09-12', '2026-09-12'), 1);
  assert.ok(describeDates('2026-09-12', '2026-09-12').endsWith('1 day'));
});

test('a range spanning two months says both', () => {
  const s = formatDateRange('2026-08-30', '2026-09-02');
  assert.ok(s.includes('30'), s);
  assert.ok(s.includes('2'), s);
  // Two month names, because "30–2 Sept" would be a lie about the 30th.
  assert.notEqual(s.split(' ').length, 3, s);
});

test('dates survive a timezone that would push them onto another day', () => {
  // Parsed at local noon on purpose: midnight-local re-read in a zone behind
  // yours is the previous date, which would forecast the wrong days.
  for (const iso of ['2026-01-01', '2026-06-15', '2026-12-31']) {
    assert.equal(toIsoDate(fromIsoDate(iso)), iso);
  }
});

test('addDays crosses month and year ends', () => {
  assert.equal(addDays('2026-09-12', 3), '2026-09-15');
  assert.equal(addDays('2026-08-30', 3), '2026-09-02');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-09-12', 0), '2026-09-12');
});

test('daysBetween and lookSchedule agree about how long a trip is', () => {
  const days = daysBetween('2026-08-30', '2026-09-02');
  const looks = lookSchedule('2026-08-30', days, ['daytime']);
  assert.equal(looks.length, days);
  assert.equal(looks.at(-1)!.date, '2026-09-02');
});

// ---------------------------------------------------------------------------
// The sentence under the chips
// ---------------------------------------------------------------------------

test('K-03 prints its arithmetic exactly as the atlas writes it', () => {
  assert.equal(
    looksSentence(4, ['daytime', 'evening']),
    'Two day parts across four days is eight looks.',
  );
});

test('the sentence agrees with the number it describes', () => {
  for (const days of [1, 2, 5, 9]) {
    for (const parts of [['daytime'], ['daytime', 'evening'], ['daytime', 'evening', 'travel']] as const) {
      const n = looksFor(days, parts);
      assert.ok(
        looksSentence(days, parts).includes(` is ${n === 1 ? 'one' : wordish(n)} look`),
        `${days} days × ${parts.length} parts → ${n}: ${looksSentence(days, parts)}`,
      );
    }
  }
});

/** The same spelling table the sentence uses, so the test reads the claim. */
function wordish(n: number): string {
  return (
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
     'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
     'nineteen', 'twenty'][n] ?? String(n)
  );
}

test('one of anything is singular', () => {
  assert.equal(looksSentence(1, ['daytime']), 'One day part across one day is one look.');
});

// ---------------------------------------------------------------------------
// The bag
// ---------------------------------------------------------------------------

test('K-05: repeat counts read ×3 and ×4, and the worn piece has no count', () => {
  assert.equal(repeatLabel(3, false), '×3');
  assert.equal(repeatLabel(4, false), '×4');
  assert.equal(repeatLabel(1, true), 'worn');
});

// ---------------------------------------------------------------------------
// The vocabularies the atlas draws
// ---------------------------------------------------------------------------

test('the chips are the six vibes and four day parts the atlas draws', () => {
  assert.deepEqual(
    VIBES.map((v) => v.label),
    ['Warm city', 'Work', 'Long dinners', 'Beach', 'Wedding', 'A lot of walking'],
  );
  assert.deepEqual(
    DAY_PARTS.map((p) => p.label),
    ['Daytime', 'Evening', 'Gym', 'Travel days'],
  );
});

test('the memo labels a day part differently from its chip', () => {
  // "Evening" is what you choose; "Night" is what the memo row is called.
  const evening = DAY_PARTS.find((p) => p.key === 'evening')!;
  assert.equal(evening.label, 'Evening');
  assert.equal(evening.title, 'Night');
});
