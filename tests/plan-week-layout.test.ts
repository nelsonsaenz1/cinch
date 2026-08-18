/**
 * Plan — the week. The layout bargain, and the week arithmetic under it.
 *
 * Written to the shape `people-search-layout.test.ts` and
 * `new-event-layout.test.ts` set: the drawn body is asserted as TEXT, because
 * esbuild cannot parse React Native's Flow source and there is no renderer in
 * this runner; everything the page DECIDES before it draws lives in
 * `plan-week-spec.ts` and is imported and exercised directly.
 *
 * This page has more to get wrong than either of those two, and the extra risk
 * is calendar arithmetic. A strip that swipes freely into the past and the
 * future is seven date computations per frame, and the ways they fail are
 * exactly the ways a screenshot cannot show you: a week that skips a day across
 * a daylight-saving boundary, a month label that reads "September" over a week
 * with six October days in it, a New Year's week that renders the right numbers
 * under the wrong year. So the pure half is pinned hard, including the two
 * boundaries nobody exercises by hand.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AX_VISIBLE_CHIPS,
  CTA_MIN_HEIGHT,
  DOW_INITIALS,
  WEEK_COPY,
  WEEK_LENGTH,
  addDays,
  chipState,
  chipTemp,
  dayAnchor,
  dayHeading,
  dayHeadingAx,
  dowInitial,
  isSameDay,
  monthGrid,
  monthLabel,
  monthTitle,
  occasionLine,
  primaryAction,
  shiftMonths,
  shiftWeeks,
  startOfMonth,
  startOfWeek,
  visibleChipCount,
  visibleDays,
  weatherNudge,
  weekDates,
  weekMonthAnchor,
} from '../src/features/plan/plan-week-spec';

const RAW = readFileSync('src/components/plan/plan-week-body.tsx', 'utf8');
const SHEET_RAW = readFileSync('src/components/plan/plan-month-sheet.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/(tabs)/plan.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(RAW);
const SHEET = code(SHEET_RAW);
const ROUTE = code(ROUTE_RAW);

// ---------------------------------------------------------------------------
// The layout bargain
// ---------------------------------------------------------------------------

test('a column that can grow is a column that can shrink', () => {
  // `flex: 1` alone does not permit a child to go smaller than its content in
  // every RN layout path; the zero minimum on the flexed axis is what makes the
  // shrink actually available. Horizontal columns state `minWidth: 0`; the one
  // vertical region on the page states `minHeight: 0`, which is the same
  // bargain about the axis it actually flexes.
  const flexed = CODE.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(flexed.length >= 5, `expected the chip, the plate wells, the CTA and the text columns — got ${flexed.length}`);
  for (const column of flexed) {
    assert.match(column, /min(Width|Height): 0/, `a flexible box without a zero minimum — ${column}`);
  }

  // The plate's wide column is `flex: 2` and needs the same promise.
  assert.match(CODE, /flex: 2, minWidth: 0/, 'the plate’s wide well can overflow its row');
});

test('the fixed parts of a row keep their points explicitly', () => {
  // The other half of the same bargain: if the fixed parts do not say they are
  // fixed, the text column is not the one that gives.
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 6,
    'the month pill, its chevron, the chip well, the dots and the plate each need it',
  );
  assert.match(SHEET, /flexShrink: 0/, 'the sheet’s nav buttons must not be squeezed by the title');
});

test('at standard size the day heading truncates; at large type it wraps', () => {
  // Composition changes rather than truncating, which is the governing clause:
  // "In every case composition changes and height is allowed. Nothing is
  // capped, truncated, ellipsised or scaled below its documented size."
  assert.match(CODE, /numberOfLines=\{large \? undefined : 1\}/, 'the heading never stops truncating');
  assert.ok(
    (CODE.match(/numberOfLines=\{large \? undefined : 1\}/g) ?? []).length >= 2,
    'the heading and the occasion title each stop truncating at large type',
  );
});

test('at the accessibility sizes the page recomposes rather than shrinking', () => {
  assert.match(CODE, /flexDirection: large \? 'column' : 'row'/, 'the masthead stacks');
  assert.match(CODE, /large \? dayHeadingAx\(/, 'the weather folds into the heading');
  assert.match(CODE, /large \? dowShort\(day\.date\) : dowInitial\(day\.date\)/, 'weekdays spell out');
  assert.match(CODE, /large \? null : <Action/, 'the secondary action stands down');

  // Three chips instead of seven — a window onto the week, not a smaller week.
  assert.equal(visibleChipCount(false), WEEK_LENGTH);
  assert.equal(visibleChipCount(true), AX_VISIBLE_CHIPS);
  assert.ok(AX_VISIBLE_CHIPS < WEEK_LENGTH);
});

test('no fixed height sits under anything that carries type', () => {
  // The clipping rule new-event was rebuilt around. Every literal height here
  // has to belong to a picture box, a mark, a glyph or a skeleton — never to a
  // label that grows with Dynamic Type.
  const heights = CODE.match(/\bheight: [^,\n]+/g) ?? [];
  assert.ok(heights.length > 0);
  for (const line of heights) {
    assert.match(
      line,
      /'100%'|CHIP_THUMB_HEIGHT|DOT|PLATE_ROW|\brow\b|\bh\b|large \? 15 : 12|\b(8|13|15)\b/,
      `a fixed height under something that carries type — ${line}`,
    );
  }

  // The actions state a FLOOR and grow past it.
  assert.match(CODE, /minHeight: tone === 'accent' \? CTA_MIN_HEIGHT/);
  assert.doesNotMatch(CODE, /\bheight: CTA_MIN_HEIGHT\b/, 'the CTA was given a height');
});

test('every control on the page clears the 44pt floor', () => {
  assert.ok(CTA_MIN_HEIGHT >= 44, 'the primary action is below the tap floor');

  // The day chip is the target, and it says so even though seven across a
  // 393pt device already clears it — a narrower device must not drop under.
  assert.match(CODE, /minHeight: MIN_TAP_TARGET/, 'a chip or the month pill has no floor');
  assert.ok(
    (CODE.match(/MIN_TAP_TARGET/g) ?? []).length >= 3,
    'the chip, the month pill and the occasion card each state the floor',
  );
  assert.match(SHEET, /width: MIN_TAP_TARGET,\s*height: MIN_TAP_TARGET/, 'the month nav buttons');
});

test('waiting is drawn with skeletons, never a spinner', () => {
  assert.match(CODE, /<Skeleton/);
  assert.doesNotMatch(CODE, /ActivityIndicator|<Spinner/, 'a spinner reached the week');
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('no colour in the slice is a literal', () => {
  for (const [name, src] of [['body', CODE], ['sheet', SHEET]] as const) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `a hardcoded colour in the ${name}`);
    assert.doesNotMatch(src, /rgba\(/, `a hand-composited colour in the ${name}`);
  }

  // The artifact's chip hexes ARE the tokens', which is exactly why typing one
  // would stay invisible until the palette moved.
  assert.doesNotMatch(CODE, /8C4A45|E3BFB1|F0DED5|EFEBE1|DFD9CC/, 'an artifact hex reached the app');
  assert.doesNotMatch(CODE, /F5E4C8|7A5312|B98A2A|4A3208/, 'an artifact amber reached the app');

  // The selected chip's lighter well and its weekday letter are canvas at an
  // alpha over the oxblood ground, not two new browns.
  assert.match(CODE, /canvasAlpha\(0\.18\)/, 'the selected chip’s well');
  assert.match(CODE, /canvasAlpha\(0\.7\)/, 'the selected chip’s weekday');
  assert.match(CODE, /warningAlpha\(0\.22\)/, 'the offline band’s ground');
});

test('clay never carries type on this page', () => {
  // `accentWarm` is 2.98:1 and `theme/contrast.ts` declares it `text: false`.
  // The artifact paints the AX frame's "8:30 pm" in it; that line is `muted`.
  for (const src of [CODE, SHEET]) {
    assert.doesNotMatch(src, /color: theme\.accentWarm/, 'clay set as type');
    assert.match(src, /backgroundColor: theme\.accentWarm/, 'clay is still the event dot');
  }
});

test('the page spends one oxblood ground per state', () => {
  // The constitution's accent budget. The primary action is the single filled
  // oxblood; the secondary is blush on a planned day and sand on the failure,
  // where blush beside blush would read as two primaries.
  const grounds = CODE.match(/tone === 'accent' \? theme\.accent/g) ?? [];
  assert.equal(grounds.length, 1, 'exactly one filled oxblood ground on the page');
  assert.match(CODE, /tone === 'accent' \? theme\.canvas/, 'and canvas is what goes on it');
  assert.match(CODE, /tone="sand"/, 'the error’s escape is not a second blush');
});

// ---------------------------------------------------------------------------
// The gesture
// ---------------------------------------------------------------------------

test('the haptic tick is spent on the week change and nowhere else', () => {
  assert.doesNotMatch(CODE, /expo-haptics/, 'the body reached past the policy');
  assert.doesNotMatch(ROUTE, /expo-haptics/, 'the route reached past the policy');
  assert.match(CODE, /from '@\/lib\/haptics'/);

  // `selection()` grade — the intent iOS reserves for a value changing under
  // the finger. Every call in the body is inside the week-change path.
  const ticks = CODE.match(/haptics\.\w+\(\)/g) ?? [];
  assert.ok(ticks.length >= 1);
  for (const tick of ticks) {
    assert.equal(tick, 'haptics.selection()', `the strip spent a non-selection haptic — ${tick}`);
  }

  // Selecting a DAY inside the week is a tap with a visible result and gets
  // none: the chip's own press handler must not fire one.
  assert.doesNotMatch(
    CODE,
    /onPress=\{\(\) => \{?\s*haptics\.selection\(\);\s*view\.onSelectDay/,
    'a day tap spends a tick',
  );
});

test('the swipe is reachable without the swipe', () => {
  // The gesture has no visible affordance, so VoiceOver gets the same two
  // moves as an explicit adjustable control.
  assert.match(CODE, /accessibilityRole="adjustable"/);
  assert.match(CODE, /name: 'increment'/);
  assert.match(CODE, /name: 'decrement'/);
  assert.equal(WEEK_COPY.nextWeek, 'Next week');
  assert.equal(WEEK_COPY.prevWeek, 'Previous week');
});

test('the strip and the month sheet read one window, so they cannot disagree', () => {
  // Twenty-one days in ONE set of queries, and the sheet's two key sets are
  // derived from the same array the chips are drawn from.
  assert.match(ROUTE, /const WINDOW_DAYS = WEEK_LENGTH \* 3/);
  assert.match(ROUTE, /usePlannedWeek\(windowStart, WINDOW_DAYS\)/, 'the window is not one query');
  assert.match(ROUTE, /plannedKeys: new Set\(\s*windowDays\.filter/);
  assert.match(ROUTE, /eventKeys: new Set\(\s*windowDays\.filter/);
});

// ---------------------------------------------------------------------------
// The week arithmetic
// ---------------------------------------------------------------------------

/** Local noon on a given calendar day — the anchor the whole spec works in. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0, 0);

test('the week opens on Monday, whatever day it is asked about', () => {
  // Tuesday 8 September 2026 → Monday the 7th, and every other day of that
  // week gives the same answer. Sunday is the SEVENTH day, not the first.
  for (const d of [7, 8, 9, 10, 11, 12, 13]) {
    assert.equal(
      startOfWeek(at(2026, 9, d)).getTime(),
      at(2026, 9, 7).getTime(),
      `${d} September resolved to the wrong Monday`,
    );
  }
  assert.equal(startOfWeek(at(2026, 9, 14)).getTime(), at(2026, 9, 14).getTime(), 'the next Monday');
});

test('the seven chips are the seven days, in order', () => {
  const days = weekDates(at(2026, 9, 7));
  assert.equal(days.length, WEEK_LENGTH);
  assert.deepEqual(days.map((d) => d.getDate()), [7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(days.map(dowInitial), [...DOW_INITIALS]);
});

test('weeks shuffle freely in both directions, and the two are exact inverses', () => {
  const monday = at(2026, 9, 7);
  assert.equal(shiftWeeks(monday, 1).getTime(), at(2026, 9, 14).getTime());
  assert.equal(shiftWeeks(monday, -1).getTime(), at(2026, 8, 31).getTime());

  // Fifty-two weeks out and back lands where it started — no drift, which is
  // the property a hand-rolled `setDate(+7)` on a midnight anchor loses.
  let cursor = monday;
  for (let i = 0; i < 52; i++) cursor = shiftWeeks(cursor, 1);
  for (let i = 0; i < 52; i++) cursor = shiftWeeks(cursor, -1);
  assert.equal(cursor.getTime(), monday.getTime());
});

test('day arithmetic survives a daylight-saving boundary', () => {
  // The US spring-forward Sunday, 8 March 2026. A Date pinned to midnight and
  // advanced a day lands on 23:00 the SAME day in some zones; the noon anchor
  // has twelve hours of headroom in each direction.
  const before = at(2026, 3, 7);
  const after = addDays(before, 1);
  assert.equal(after.getDate(), 8, 'a day was lost going forward across DST');
  assert.equal(addDays(after, -1).getDate(), 7, 'a day was lost coming back');
  assert.equal(after.getHours(), 12, 'the anchor drifted off noon');

  // And the autumn boundary, 1 November 2026.
  assert.equal(addDays(at(2026, 10, 31), 1).getDate(), 1);
  assert.equal(addDays(at(2026, 11, 1), -1).getDate(), 31);

  // A whole week stepped one day at a time hits seven distinct dates.
  const stepped = Array.from({ length: 7 }, (_, i) => addDays(at(2026, 3, 5), i).getDate());
  assert.deepEqual(stepped, [5, 6, 7, 8, 9, 10, 11]);
});

test('a week that crosses New Year keeps both its dates and its year', () => {
  // Thursday 1 January 2026 sits in the week that opens Monday 29 December.
  const monday = startOfWeek(at(2026, 1, 1));
  assert.equal(monday.getFullYear(), 2025);
  assert.equal(monday.getMonth(), 11);
  assert.equal(monday.getDate(), 29);

  const days = weekDates(monday);
  assert.deepEqual(days.map((d) => d.getDate()), [29, 30, 31, 1, 2, 3, 4]);
  assert.deepEqual(days.map((d) => d.getFullYear()), [2025, 2025, 2025, 2026, 2026, 2026, 2026]);

  // The label follows the Thursday, so this week reads as January — the month
  // four of its seven days belong to.
  assert.equal(weekMonthAnchor(monday).getMonth(), 0);
  assert.equal(weekMonthAnchor(monday).getFullYear(), 2026);
});

test('the month label is the month that owns the week, not the month it starts in', () => {
  // Monday 28 September 2026: three days in September, four in October — so
  // the label reads October, over a week that STARTS in September.
  assert.equal(weekMonthAnchor(at(2026, 9, 28)).getMonth(), 9, 'October owns it');
  // Monday 27 September 2027: four in September, three in October.
  assert.equal(weekMonthAnchor(at(2027, 9, 27)).getMonth(), 8, 'September owns it');
  // The anchor is always the week's fourth day, whichever month that lands in.
  for (const monday of [at(2026, 9, 28), at(2027, 9, 27), at(2026, 1, 1)]) {
    assert.equal(
      weekMonthAnchor(monday).getTime(),
      weekDates(startOfWeek(monday))[3]!.getTime(),
      'the label stopped following the Thursday',
    );
  }

  // Said as a name, and with the year only where the year is the question.
  assert.equal(monthLabel(at(2026, 9, 7)), 'September');
  assert.equal(monthTitle(at(2026, 9, 1)), 'September 2026');
});

test('the month grid leads with blanks so the first lands on its own weekday', () => {
  // September 2026 opens on a Tuesday, so one blank precedes the 1st.
  const september = monthGrid(at(2026, 9, 1));
  assert.equal(september[0], null);
  assert.equal(september[1]?.getDate(), 1);
  assert.equal(september.filter(Boolean).length, 30);

  // February 2026 opens on a Sunday — six blanks, the widest lead there is.
  const february = monthGrid(at(2026, 2, 10));
  assert.equal(february.filter((c) => c === null).length, 6);
  assert.equal(february.filter(Boolean).length, 28);

  // A leap February has 29, and the grid must not be told the length twice.
  assert.equal(monthGrid(at(2024, 2, 1)).filter(Boolean).length, 29);

  // No trailing padding — the frame's last row stops at the 30th.
  assert.ok(september.at(-1) !== null);
  assert.equal(september.at(-1)?.getDate(), 30);
});

test('stepping months never overflows the way setMonth does', () => {
  // `setMonth(1)` on the 31st of January gives the 3rd of March. Landing on
  // the first before stepping makes that unreachable.
  assert.equal(shiftMonths(at(2026, 1, 31), 1).getMonth(), 1, 'January + 1 must be February');
  assert.equal(shiftMonths(at(2026, 1, 31), 1).getDate(), 1);

  // Across the year boundary, in both directions.
  const jan = shiftMonths(at(2025, 12, 15), 1);
  assert.equal(jan.getFullYear(), 2026);
  assert.equal(jan.getMonth(), 0);
  const dec = shiftMonths(at(2026, 1, 15), -1);
  assert.equal(dec.getFullYear(), 2025);
  assert.equal(dec.getMonth(), 11);

  assert.equal(startOfMonth(at(2026, 9, 26)).getDate(), 1);
});

test('two instants on one calendar day are the same day, whatever the clock says', () => {
  assert.equal(isSameDay(new Date(2026, 8, 12, 0, 1), new Date(2026, 8, 12, 23, 59)), true);
  assert.equal(isSameDay(new Date(2026, 8, 12, 23, 59), new Date(2026, 8, 13, 0, 1)), false);
  // Same day-of-month, different year.
  assert.equal(isSameDay(at(2026, 9, 12), at(2025, 9, 12)), false);

  assert.equal(dayAnchor(new Date(2026, 8, 12, 3, 4, 5)).getHours(), 12);
});

// ---------------------------------------------------------------------------
// What a chip is
// ---------------------------------------------------------------------------

test('selection wins over today, and today over a plan', () => {
  const today = at(2026, 9, 8);
  const selected = at(2026, 9, 12);
  const state = (date: Date, planned = false) => chipState({ date, selected, today, planned });

  assert.equal(state(at(2026, 9, 12)), 'selected');
  assert.equal(state(at(2026, 9, 12), true), 'selected', 'a planned selection is still the fill');
  assert.equal(state(at(2026, 9, 8)), 'today');
  assert.equal(state(at(2026, 9, 8), true), 'today', 'today keeps its ring over a plan');
  assert.equal(state(at(2026, 9, 10), true), 'planned');
  assert.equal(state(at(2026, 9, 10)), 'plain');
});

test('the accessibility strip is a window on the week, centred and clamped', () => {
  const week = weekDates(at(2026, 9, 7));

  // Seven at standard size, untouched.
  assert.deepEqual(visibleDays(week, 5, false), week);

  // Centred on the selection.
  assert.deepEqual(visibleDays(week, 3, true).map((d) => d.getDate()), [9, 10, 11]);
  // Clamped at the start rather than running off it.
  assert.deepEqual(visibleDays(week, 0, true).map((d) => d.getDate()), [7, 8, 9]);
  // And at the end.
  assert.deepEqual(visibleDays(week, 6, true).map((d) => d.getDate()), [11, 12, 13]);

  // Always exactly three, so the strip never changes width mid-week.
  for (let i = 0; i < WEEK_LENGTH; i++) {
    assert.equal(visibleDays(week, i, true).length, AX_VISIBLE_CHIPS);
  }
});

// ---------------------------------------------------------------------------
// What the page will and will not say
// ---------------------------------------------------------------------------

const w = (over: Partial<Parameters<typeof weatherNudge>[0] & object> = {}) => ({
  feelsLikeC: 16,
  highC: 19,
  lowC: 13,
  precipitationChance: 0,
  windKph: 6,
  swing: false,
  ...over,
});

test('weather is a mark, and it is absent rather than estimated', () => {
  // Open-Meteo forecasts sixteen days ahead and nothing behind, so a week
  // swiped into the past has no reading at all. Null, never a dash and never
  // the nearest day that did have one.
  assert.equal(chipTemp(null), null);
  assert.equal(chipTemp(w({ feelsLikeC: 16 })), '61°');

  // The heading's line pairs the figure with the REASON, from the existing
  // vocabulary rather than a third one.
  assert.equal(dayHeadingAx(at(2026, 9, 12), null), 'Saturday 12');
  assert.match(dayHeadingAx(at(2026, 9, 12), w()), /^Saturday 12 · \d+°$/);
  assert.equal(dayHeading(at(2026, 9, 12)), 'Saturday 12');
});

test('the empty day only says something the forecast actually holds', () => {
  assert.equal(weatherNudge(null), null, 'no forecast, no sentence');
  assert.equal(weatherNudge(w()), null, 'a mild dry day has nothing to say');
  assert.match(weatherNudge(w({ precipitationChance: 0.6 })) ?? '', /Showers/);
  assert.match(weatherNudge(w({ windKph: 30 })) ?? '', /Windy/);
  assert.match(weatherNudge(w({ swing: true })) ?? '', /take off/);

  // And none of them promises a number of anything.
  for (const c of [0.6, 0]) {
    const line = weatherNudge(w({ precipitationChance: c, feelsLikeC: 30 }));
    if (line) assert.doesNotMatch(line, /\d/, `a nudge printed a figure — ${line}`);
  }
});

test('the occasion line counts people who joined, and drops when nobody has', () => {
  const at830 = new Date(2026, 8, 12, 20, 30);
  assert.equal(occasionLine(at830, 4), '8:30 pm · 4 friends going');
  assert.equal(occasionLine(at830, 1), '8:30 pm · 1 friend going');
  assert.equal(occasionLine(at830, 0), '8:30 pm', 'zero is quiet, never “0 friends going”');
  assert.equal(occasionLine(null, 4), '4 friends going', 'a dateless occasion prints no time');
  assert.equal(occasionLine(null, 0), null);
});

test('a day ahead can only be kept; a day behind can be worn', () => {
  // The one knowing departure from the frame, and the reason is data integrity:
  // `useWearOutfit` increments `wear_count` and stamps `last_worn_at`, which
  // feeds cost-per-wear and the freshness rule. Logging one four days early
  // corrupts both.
  const today = at(2026, 9, 8);
  assert.deepEqual(primaryAction(at(2026, 9, 12), today), { label: 'Keep this plan', kind: 'keep' });
  assert.deepEqual(primaryAction(at(2026, 9, 8), today), { label: 'Log this wear', kind: 'wear' });
  assert.deepEqual(primaryAction(at(2026, 9, 1), today), { label: 'Log this wear', kind: 'wear' });

  // The hour of day must not decide it — the whole of today is today.
  assert.equal(primaryAction(new Date(2026, 8, 8, 23, 59), today).kind, 'wear');
  assert.equal(primaryAction(new Date(2026, 8, 9, 0, 1), today).kind, 'keep');
});

test('the copy is the artifact’s, to the character', () => {
  assert.equal(WEEK_COPY.title, 'Plan');
  assert.equal(WEEK_COPY.logWear, 'Log this wear');
  assert.equal(WEEK_COPY.swapPlate, 'Swap the plate');
  assert.equal(WEEK_COPY.errorKicker, 'OFFLINE');
  assert.equal(WEEK_COPY.errorTitle, 'The plate didn’t load');
  assert.equal(WEEK_COPY.errorRetry, 'Try again');
  assert.equal(WEEK_COPY.errorEscape, 'Open the closet');
  assert.equal(WEEK_COPY.legendPlanned, 'Planned');
  assert.equal(WEEK_COPY.legendEvent, 'Event');
  assert.equal(WEEK_COPY.legendToday, 'Today');

  assert.equal(WEEK_COPY.emptyTitle('Tuesday'), 'Nothing planned for Tuesday');
  assert.equal(WEEK_COPY.emptyAction('Tuesday'), 'Plan Tuesday');
  assert.equal(WEEK_COPY.jump('26 September'), 'Jump to 26 September');
});

test('nothing in the slice promises a count of outfits', () => {
  // The week engine's standing contract, and the one the old masthead broke.
  // Comments describe the intent — the spec's header RECOUNTS the retired
  // "No piece worn more than twice" as the mistake it is refusing to repeat,
  // and a scanner that could not tell prose from product would forbid the
  // explanation along with the claim.
  const SPEC = code(readFileSync('src/features/plan/plan-week-spec.ts', 'utf8'));
  for (const src of [CODE, SHEET, SPEC]) {
    assert.doesNotMatch(src, /no piece worn more than twice/i);
    assert.doesNotMatch(src, /\b(seven|five|three|\d+) (outfits|looks)\b/i, 'a count was promised');
  }
});
