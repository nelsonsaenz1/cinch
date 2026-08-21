/**
 * TM-01/TM-02 — the context line sheds a clause rather than wrapping.
 *
 * Moving the masthead's four control chips onto this row is what gave the
 * greeting the full gutter beneath them, and it cost this line about 170 pt of
 * measure. At 402 pt the full label wrapped to two lines beside the controls,
 * which is two lines of tracked uppercase under a serif greeting — not the
 * masthead the atlas draws, and a defect a screenshot review caught rather than
 * a test, because the string itself was correct.
 *
 * What is testable is the LADDER: which clause goes first, which never goes,
 * and that every rung is a finished sentence rather than a truncation. The
 * measurement that picks a rung is `onTextLayout` on the device, which no unit
 * test can stand in for — so this pins the thing that would be wrong if
 * somebody reordered the ladder, and the fixture is what pins the rest.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contextLabel, contextLines, contextRungs, feelsClause } from '../src/components/today/context-label';

const PLACE = 'Fri 7 Aug · Denver';
const WEATHER = feelsClause('72°', 'F', 'clear');

test('the ladder sheds the conditions word first, then the place', () => {
  assert.deepEqual(contextRungs(PLACE, WEATHER), [
    'Fri 7 Aug · Denver · Feels 72°F, clear',
    'Fri 7 Aug · Denver · Feels 72°F',
    'Fri 7 Aug · Feels 72°F',
  ]);
});

test('the date and the temperature are on every rung', () => {
  // The temperature is stated exactly once per screen (audit 57) and this is
  // that once — shedding it here would take the fact off the screen rather
  // than shorten a line. The place is the one thing a reader can work out by
  // looking out of the window.
  for (const rung of contextRungs(PLACE, WEATHER)) {
    assert.match(rung, /Fri 7 Aug/, `a rung drops the date: ${rung}`);
    assert.match(rung, /Feels 72°F/, `a rung drops the temperature: ${rung}`);
  }
});

test('every rung is strictly shorter than the one before it', () => {
  // Otherwise the step-down spends a frame going nowhere and the line stays
  // wrapped — which looks exactly like the bug it is meant to fix.
  const rungs = contextRungs(PLACE, WEATHER);
  for (let i = 1; i < rungs.length; i += 1) {
    assert.ok(rungs[i].length < rungs[i - 1].length, `rung ${i} is not shorter`);
  }
});

test('nothing is ever truncated', () => {
  // An ellipsised "FEELS 72°F, CLE…" is a line that looks broken. Shedding a
  // clause leaves a sentence; cutting one leaves a mistake.
  for (const rung of contextRungs(PLACE, WEATHER)) {
    assert.doesNotMatch(rung, /…|\.\.\./, `a rung truncates: ${rung}`);
    assert.doesNotMatch(rung, /·\s*$/, `a rung ends on a separator: ${rung}`);
  }
});

test('an unknown temperature leaves one rung, not three empty ones', () => {
  // T-09, offline: the label is the place alone and the notice beneath says the
  // weather is the part that may be wrong. There is no clause left to shed, so
  // there is nothing for the step-down to do.
  assert.deepEqual(contextRungs(PLACE, null), [PLACE]);
});

test('a label with no conditions word collapses its duplicate rungs', () => {
  // `describeWeather` returns no phrase for a plain forecast, so rung 0 and
  // rung 1 would be the same string — and a ladder with a rung that changes
  // nothing would report "still wrapped" forever without shortening anything.
  const bare = feelsClause('72°', 'F', null);
  assert.deepEqual(contextRungs(PLACE, bare), [
    'Fri 7 Aug · Denver · Feels 72°F',
    'Fri 7 Aug · Feels 72°F',
  ]);
});

test('the largest type still breaks over two lines rather than shedding', () => {
  // The two behaviours are answers to different problems and must not merge.
  // At AX the line has the full width and simply needs more of it, so nothing
  // is dropped and nothing is ellipsised — only the arrangement changes.
  assert.deepEqual(contextLines(PLACE, WEATHER), [PLACE, WEATHER]);
  assert.equal(contextLabel(PLACE, WEATHER), contextRungs(PLACE, WEATHER)[0]);
});

test('the swing day’s range clause composes here — and only here (packet T)', () => {
  // `describeWeather` on a swing day returns "64°–83° today". The eyebrow is
  // the ONE place that phrase may appear on Today: the outfit card's mark is
  // the temperature alone plus a condition symbol (`resolveWeather` refuses
  // the phrase by construction — pinned in today-spec.test.ts).
  const swing = feelsClause('82°', 'F', '64°–83° today');
  assert.equal(swing, 'Feels 82°F, 64°–83° today');
  assert.equal(
    contextLabel(PLACE, swing),
    'Fri 7 Aug · Denver · Feels 82°F, 64°–83° today',
  );
});

test('the ladder still never drops the temperature when the range clause sheds', () => {
  // The range rides the CONDITIONS clause, which is rung 1's casualty — the
  // "Feels 82°F" head survives on every rung, exactly the audit-57 promise.
  const swing = feelsClause('82°', 'F', '64°–83° today');
  const rungs = contextRungs(PLACE, swing);
  assert.equal(rungs[0], 'Fri 7 Aug · Denver · Feels 82°F, 64°–83° today');
  for (const rung of rungs) {
    assert.match(rung, /Feels 82°F/, `a rung drops the temperature: ${rung}`);
  }
  // Sheds cleanly: the comma is `feelsClause`'s own join, so losing the
  // clause never leaves half a range behind.
  assert.equal(rungs[1], 'Fri 7 Aug · Denver · Feels 82°F');
  assert.doesNotMatch(rungs[1], /–|today/);
});
