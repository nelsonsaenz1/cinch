/**
 * Trips — the list. The layout bargain, and the decisions under it.
 * Redesign 04.
 *
 * Written to the shape `plan-week-layout.test.ts` and
 * `event-detail-layout.test.ts` set: the drawn body is asserted as TEXT,
 * because esbuild cannot parse React Native's Flow source and there is no
 * renderer in this runner; everything the page DECIDES before it draws lives in
 * `trips-list-spec.ts` and is imported and exercised directly.
 *
 * This page has one thing to get wrong that neither of the other two does, and
 * it is not a layout: it is a NEW page over an OLD table, and the two ways to
 * ruin that are to reach for a column that is not there and to put a door in
 * front of somebody's own history. Both halves are pinned below.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CARD_TILES,
  CTA_MIN_HEIGHT,
  HERO_COLLAGE_ROW,
  HERO_COLLAGE_ROW_AX,
  HERO_TILES,
  TRIPS_COPY,
  bagItemIds,
  destinationLabel,
  laterLabel,
  nightCount,
  partitionTrips,
  pastDatesLine,
  sortPast,
  sortUpcoming,
  tripDatesLine,
} from '../src/features/trips/trips-list-spec';
import { CTA_SECONDARY_MIN_HEIGHT as PLATE_CTA_SECONDARY } from '../src/features/plan/new-trip-spec';

const RAW = readFileSync('src/components/trips/trips-list-body.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/trips/index.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/trips/trips-list-spec.ts', 'utf8');
const FIXTURES_RAW = readFileSync('src/features/trips/trips-list-fixtures.ts', 'utf8');
const PLAN_RAW = readFileSync('src/app/(tabs)/plan.tsx', 'utf8');
const MEMO_RAW = readFileSync('src/features/plan/packing-trip.tsx', 'utf8');
/** Redesign 05's completion plate — where the memo's foot controls moved. */
const PLATE_RAW = readFileSync('src/components/plan/packing-plate-body.tsx', 'utf8');
const USE_TRIPS_RAW = readFileSync('src/features/plan/use-trips.ts', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(RAW);
const ROUTE = code(ROUTE_RAW);
const SPEC = code(SPEC_RAW);
const FIXTURES = code(FIXTURES_RAW);
const PLAN = code(PLAN_RAW);
const MEMO = code(MEMO_RAW);
const PLATE = code(PLATE_RAW);
const USE_TRIPS = code(USE_TRIPS_RAW);

// ---------------------------------------------------------------------------
// The layout bargain
// ---------------------------------------------------------------------------

test('a column that can grow is a column that can shrink', () => {
  // `flex: 1` alone does not permit a child to go smaller than its content in
  // every RN layout path; the zero minimum on the flexed axis is what makes the
  // shrink actually available. Horizontal boxes state `minWidth: 0`; the
  // vertical ones — the scrolling middle and the collage's two rows — state
  // `minHeight: 0`, which is the same bargain about the axis they flex.
  const flexed = CODE.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(
    flexed.length >= 8,
    `expected the wells, the card bodies, the text columns and the scroll — got ${flexed.length}`,
  );
  for (const column of flexed) {
    assert.match(column, /min(Width|Height): 0/, `a flexible box without a zero minimum — ${column}`);
  }
});

test('the fixed parts of a row keep their points explicitly', () => {
  // The other half of the same bargain: if the fixed parts do not say they are
  // fixed, the text column is not the one that gives. The collage square, the
  // chevron, the badge, the back button and the offline dot each state it.
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 8,
    'a fixed part of a row can be squeezed by the text beside it',
  );
});

test('the serif truncates on the shelf at standard size and wraps at large type', () => {
  // The governing clause — "in every case composition changes and height is
  // allowed" — so the single line the shelf card draws is a STANDARD-SIZE
  // treatment and lifts entirely above the threshold. "Whistler with Marisol"
  // is in the poses precisely so this is on screen rather than asserted alone.
  assert.match(CODE, /numberOfLines=\{large \? undefined : 1\}/, 'the destination never stops truncating');
  assert.match(FIXTURES, /Whistler with Marisol/, 'the long destination left the poses');
});

test('at the accessibility sizes the shelf recomposes rather than shrinking', () => {
  // Four composition changes, each drawn in the accepted AX frame.
  assert.match(CODE, /large\s*\?\s*\{ gap: 12 \}/, 'the masthead stops sharing a row');
  assert.match(CODE, /alignSelf: large \? 'stretch' : 'auto'/, 'the plan pill does not go full width');
  assert.match(CODE, /if \(large\) \{/, 'the card collage does not become a band');
  assert.match(CODE, /variant=\{large \? 'callout' : 'eyebrow'\}/, 'the tracked caps do not become a plain line');

  // And the hero band gets SHORTER above the threshold, on purpose: the type
  // below it is what needs the height, which is the same trade the event
  // poster's plate makes.
  assert.ok(HERO_COLLAGE_ROW_AX < HERO_COLLAGE_ROW);
});

test('nothing on this page answers large type by shrinking text', () => {
  for (const [name, src] of [['body', CODE], ['spec', SPEC], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /maxFontSizeMultiplier|adjustsFontSize|allowFontScaling=\{false\}/, name);
  }
});

test('no fixed height sits under anything that carries type', () => {
  // Every literal height in the body has to belong to a picture box, a mark, a
  // glyph, a spacer or a skeleton — never to a label that grows with Dynamic
  // Type. The controls state `minHeight`, which grows.
  const heights = CODE.match(/\bheight: [^,\n}]+/g) ?? [];
  assert.ok(heights.length > 0);
  for (const line of heights) {
    assert.match(
      line,
      /COLLAGE_ROW|CARD_THUMB|PAST_THUMB|CACHED_THUMB|MIN_TAP_TARGET|BAND_DOT|CASE_|'100%'|\b(thumb|size)\b|\b(14|16|22|26)\b/,
      `a fixed height under something that carries type — ${line}`,
    );
  }
  // And every control's floor is a MINIMUM, so the label may push it taller.
  assert.ok((CODE.match(/minHeight: MIN_TAP_TARGET/g) ?? []).length >= 4, 'a control lost its growable floor');
});

test('every control on the shelf clears the 44pt floor', () => {
  assert.ok(CTA_MIN_HEIGHT >= 44, 'the pinned action is below the tap floor');
  // The back button, the plan pill, the cards and the past rows each state it.
  assert.ok((CODE.match(/MIN_TAP_TARGET/g) ?? []).length >= 5, 'a control on the shelf has no 44pt floor');
  // The two entry points are targets too, not bare text.
  assert.match(PLAN, /min-h-tap[\s\S]{0,200}TRIPS_COPY\.seeAll|TRIPS_COPY\.seeAll[\s\S]{0,200}min-h-tap/, 'Plan’s door to the list is under the floor');
  // The memo's door is no longer an underlined link with a `min-h-tap` class on
  // it. Redesign 05's completion frame promotes it to one of the plate's two
  // pinned controls — `NEW_TRIP_COPY.allTrips`, a tinted 52pt fill — so the
  // floor is now stated as geometry rather than as a utility class, and it is
  // stated in the file that draws it. The RULE is unchanged and is checked more
  // strictly than before: 52 > 44, asserted against the constant itself.
  assert.ok(PLATE_CTA_SECONDARY >= 44, 'the plate’s door to the list is under the tap floor');
  assert.match(PLATE, /NEW_TRIP_COPY\.allTrips/, 'the plate lost its door to the list');
});

test('waiting is drawn with skeletons, never a spinner', () => {
  assert.match(CODE, /<Skeleton/);
  assert.doesNotMatch(CODE, /ActivityIndicator|<Spinner/, 'a spinner reached the shelf');
  // The waiting frame holds the real geometry, so nothing jumps when rows land.
  assert.match(CODE, /height: HERO_COLLAGE_ROW/, 'the waiting hero invented its own height');
  assert.match(CODE, /CARD_THUMB \+ CARD_PAD \* 2/, 'the waiting card invented its own height');
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('no colour in the slice is a literal', () => {
  for (const [name, src] of [
    ['body', CODE],
    ['spec', SPEC],
    ['route', ROUTE],
    ['fixtures', FIXTURES],
  ] as const) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `a hardcoded colour in the ${name}`);
    assert.doesNotMatch(src, /rgba\(/, `a hand-composited colour in the ${name}`);
  }

  // The artifact's hexes ARE the tokens', which is exactly why typing one would
  // stay invisible until the palette moved.
  assert.doesNotMatch(CODE, /E3BFB1|DFD9CC|E4DED2|D8D1C2|EFEBE1|E3CFC4|B4AEA0/, 'an artifact hex');
  assert.doesNotMatch(CODE, /F5E4C8|EFD3A6|7A5312|4A3208|B98A2A/, 'an artifact amber reached the shelf');

  // The date line on the oxblood plate, the badge behind it and the offline
  // band are tokens at an alpha, not five new browns.
  assert.match(CODE, /canvasAlpha\(0\.7\)/, 'the hero’s date line');
  assert.match(CODE, /canvasAlpha\(0\.18\)/, 'the packed badge’s well');
  assert.match(CODE, /warningAlpha\(0\.22\)/, 'the offline band’s ground');
});

test('clay never carries type on this page', () => {
  // `accentWarm` is 2.98:1 and `theme/contrast.ts` declares it `text: false`.
  // The artifact paints every shelf card's date line in it; here they are
  // `muted` — the same quiet layer, one step down.
  assert.doesNotMatch(CODE, /color: theme\.accentWarm/, 'clay set as type');
  assert.match(CODE, /color: theme\.muted/, 'the shelf’s date line lost its legal colour');
});

test('the shelf spends one filled oxblood per state', () => {
  // The hero's PLATE is not a control and is not counted: it is the card's
  // ground and the artifact's whole idea is that the destination sits on it.
  // What the budget governs is how many things you can PRESS that are filled
  // with the accent, and the answer is one — the pinned foot, which is drawn
  // only on the two frames whose action is not the masthead pill.
  const grounds = CODE.match(/backgroundColor: theme\.accent\b/g) ?? [];
  assert.equal(grounds.length, 2, 'the accent budget moved');
  assert.match(CODE, /backgroundColor: theme\.accent,\s*\n?\s*paddingHorizontal: GUTTER/, 'the hero plate lost its ground');
  assert.match(CODE, /color: theme\.canvas/, 'and canvas is what goes on it');

  // The masthead pill and the pinned foot are never both drawn.
  assert.match(CODE, /!view\.loading && !view\.offline && !empty/, 'the pill can appear beside the foot');
  assert.match(CODE, /\{empty \? <FootAction/, 'the empty frame lost its one way forward');
  assert.match(CODE, /\{view\.offline \? <FootAction/, 'the offline frame lost its retry');
});

// ---------------------------------------------------------------------------
// The gesture, and what this page refuses to do
// ---------------------------------------------------------------------------

test('the page ticks at nothing — every press here is navigation', () => {
  for (const [name, src] of [['body', CODE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /expo-haptics/, `the ${name} reached past the policy`);
    // UX-07 reserves the vocabulary for what CHANGES. Opening a trip, planning
    // one, going back and retrying a read all change nothing on the other end.
    assert.doesNotMatch(src, /haptic=/, `the ${name} spends a tick on navigation`);
  }
});

test('looking at your own trips is never a paywall moment', () => {
  // Planning a NEW trip is the gate and it lives in `PackingTab`. A placement
  // on this page would be the app charging somebody to see what they already
  // paid to make.
  for (const [name, src] of [['body', CODE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /Placement|usePlan\b|useGate\b|PackingAccess|paywall/i, `a gate reached the ${name}`);
  }
});

test('the page reads the trips table it was given and adds nothing to it', () => {
  // One module owns `.from('trips')` — the new list hook was added THERE rather
  // than opening a second door onto the same table.
  assert.doesNotMatch(ROUTE, /from\('trips'\)|@\/lib\/supabase/, 'the route talks to the database directly');
  assert.match(USE_TRIPS, /export function useAllTrips/, 'the list hook left the one module that may read trips');
  assert.match(USE_TRIPS, /queryKey: \['trips', 'all'\]/, 'the list query lost its key');

  // Only columns the migration actually has. `status` and `destination` do not
  // exist — destination is four denormalised columns and "planned" is
  // `saved_at is not null`.
  const listHook = USE_TRIPS.slice(USE_TRIPS.indexOf('export function useAllTrips'));
  assert.doesNotMatch(listHook.slice(0, 900), /\.eq\('status'|'destination'/, 'a column that is not in the table');
  assert.match(ROUTE, /trip\.savedAt !== null/, 'the packed badge stopped meaning what saved_at means');
});

// ---------------------------------------------------------------------------
// Copy — verbatim, and nothing promising a count
// ---------------------------------------------------------------------------

test('the words are the artifact’s words', () => {
  assert.equal(TRIPS_COPY.title, 'Trips');
  assert.equal(TRIPS_COPY.plan, 'Plan a trip');
  assert.equal(TRIPS_COPY.nextUp, 'Next up');
  assert.equal(TRIPS_COPY.laterThisYear, 'Later this year');
  assert.equal(TRIPS_COPY.past, 'Where you’ve been');
  assert.equal(TRIPS_COPY.packed, 'Packed');
  assert.equal(TRIPS_COPY.emptyTitle, 'No trips packed yet');
  assert.equal(TRIPS_COPY.emptyBody, 'Plan one and it stays here with everything you packed.');
  assert.equal(TRIPS_COPY.offlineKicker, 'Offline');
  assert.equal(TRIPS_COPY.offlineTitle, 'Couldn’t refresh your trips');
  assert.equal(TRIPS_COPY.offlineBody, 'These are the ones saved on this device.');
  assert.equal(TRIPS_COPY.cached, 'Saved on this device');
  assert.equal(TRIPS_COPY.tryAgain, 'Try again');
  // The brief names the entry-point wording, and both surfaces say it once.
  assert.equal(TRIPS_COPY.seeAll, 'See all trips');
});

test('nothing on the shelf promises a count of pieces or outfits', () => {
  for (const [name, src] of [['body', CODE], ['spec', SPEC]] as const) {
    assert.doesNotMatch(src, /\b\d+ (pieces|outfits|looks)\b/i, `${name} counts something out loud`);
    assert.doesNotMatch(src, /pieceCount|lookCount/, `${name} draws a count the frames do not`);
  }
  // "Packed" is a fact, not a figure.
  assert.doesNotMatch(CODE, /TRIPS_COPY\.packed[\s\S]{0,60}\{[a-z]+Count/i, 'the badge grew a number');
});

// ---------------------------------------------------------------------------
// The partition and the two sorts
// ---------------------------------------------------------------------------

const TODAY = new Date(2026, 8, 17, 12, 0, 0, 0); // Thursday 17 September 2026

const trip = (id: string, startsOn: string | null, endsOn: string | null) => ({ id, startsOn, endsOn });

test('upcoming is ascending by start, past is descending by end', () => {
  const rows = [
    trip('past-old', '2026-03-01', '2026-03-04'),
    trip('soon', '2026-09-20', '2026-09-24'),
    trip('past-recent', '2026-05-10', '2026-05-15'),
    trip('later', '2026-11-02', '2026-11-08'),
  ];

  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.deepEqual(upcoming.map((t) => t.id), ['soon', 'later']);
  assert.deepEqual(past.map((t) => t.id), ['past-recent', 'past-old']);
});

test('a trip spanning today is the next trip, not a memory', () => {
  // The one arrangement that would betray the page's whole reason for existing:
  // filing the trip somebody is ON under "Where you've been".
  const rows = [trip('now', '2026-09-15', '2026-09-19'), trip('later', '2026-10-01', '2026-10-05')];
  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.deepEqual(upcoming.map((t) => t.id), ['now', 'later']);
  assert.equal(past.length, 0);
});

test('a trip that ends today is still upcoming; one that ended yesterday is not', () => {
  const rows = [trip('ends-today', '2026-09-14', '2026-09-17'), trip('ended', '2026-09-12', '2026-09-16')];
  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.deepEqual(upcoming.map((t) => t.id), ['ends-today']);
  assert.deepEqual(past.map((t) => t.id), ['ended']);
});

test('the hour of day cannot move a trip between sections', () => {
  const rows = [trip('ends-today', '2026-09-14', '2026-09-17')];
  for (const hour of [0, 6, 12, 18, 23]) {
    const at = new Date(2026, 8, 17, hour, 50, 0, 0);
    assert.equal(partitionTrips(rows, at).upcoming.length, 1, `moved at ${hour}:50`);
  }
});

test('a trip with no dates is an intention, and intentions sort last among the upcoming', () => {
  const rows = [trip('undated', null, null), trip('soon', '2026-09-20', '2026-09-24')];
  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.deepEqual(upcoming.map((t) => t.id), ['soon', 'undated']);
  assert.equal(past.length, 0, 'a trip with no dates was filed as a memory');
});

test('half a date is still a date, at both ends', () => {
  // The questionnaire can be abandoned mid-answer, and a row with only one end
  // filled must not fall through to "undated" and float to the bottom.
  const rows = [trip('start-only', '2026-09-20', null), trip('end-only', null, '2026-03-04')];
  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.deepEqual(upcoming.map((t) => t.id), ['start-only']);
  assert.deepEqual(past.map((t) => t.id), ['end-only']);
});

test('a malformed date is treated as no date rather than as 1970', () => {
  const rows = [trip('junk', 'not-a-date', ''), trip('soon', '2026-09-20', '2026-09-24')];
  const { upcoming, past } = partitionTrips(rows, TODAY);
  assert.equal(past.length, 0, 'a typo filed a trip under memories');
  assert.deepEqual(upcoming.map((t) => t.id), ['soon', 'junk']);
});

test('ties break on id, so the shelf does not reorder under the reader’s thumb', () => {
  const a = trip('aaa', '2026-09-20', '2026-09-24');
  const b = trip('bbb', '2026-09-20', '2026-09-24');
  assert.deepEqual(sortUpcoming([b, a]).map((t) => t.id), ['aaa', 'bbb']);
  assert.deepEqual(sortUpcoming([a, b]).map((t) => t.id), ['aaa', 'bbb']);

  const c = trip('ccc', '2026-03-01', '2026-03-04');
  const d = trip('ddd', '2026-03-01', '2026-03-04');
  assert.deepEqual(sortPast([d, c]).map((t) => t.id), ['ccc', 'ddd']);
  assert.deepEqual(sortPast([c, d]).map((t) => t.id), ['ccc', 'ddd']);
});

test('the sorts copy rather than reordering what they were handed', () => {
  const rows = [trip('b', '2026-11-02', '2026-11-08'), trip('a', '2026-09-20', '2026-09-24')];
  const before = rows.map((t) => t.id);
  sortUpcoming(rows);
  sortPast(rows);
  assert.deepEqual(rows.map((t) => t.id), before, 'a sort mutated the query’s own array');
});

test('the second eyebrow widens when the shelf leaves this year', () => {
  assert.equal(laterLabel([trip('a', '2026-11-02', '2026-11-08')], TODAY), 'Later this year');
  assert.equal(laterLabel([trip('a', '2027-02-02', '2027-02-08')], TODAY), 'Later on');
  // One trip out of the year is enough — the heading covers everything under it.
  assert.equal(
    laterLabel([trip('a', '2026-11-02', '2026-11-08'), trip('b', '2027-02-02', '2027-02-08')], TODAY),
    'Later on',
  );
  // An undated trip makes no claim about the year and must not be counted into
  // one; it forces the wider heading instead.
  assert.equal(laterLabel([trip('a', null, null)], TODAY), 'Later on');
  // Nothing under the heading at all is vacuously this year, and the heading is
  // not drawn in that case anyway.
  assert.equal(laterLabel([], TODAY), 'Later this year');
});

// ---------------------------------------------------------------------------
// The colophon
// ---------------------------------------------------------------------------

test('the dates read as the artifact sets them', () => {
  assert.equal(tripDatesLine('2026-09-10', '2026-09-14'), '10–14 Sep · 4 nights');
  assert.equal(tripDatesLine('2026-11-02', '2026-11-08'), '2–8 Nov · 6 nights');
  assert.equal(tripDatesLine('2026-12-18', '2026-12-22'), '18–22 Dec · 4 nights');
  // The month is said twice when it changes, once when it does not.
  assert.equal(tripDatesLine('2026-09-28', '2026-10-03'), '28 Sep – 3 Oct · 5 nights');
  // One night, singular, and a same-day trip claims no nights at all.
  assert.equal(tripDatesLine('2026-09-10', '2026-09-11'), '10–11 Sep · 1 night');
  assert.equal(tripDatesLine('2026-09-10', '2026-09-10'), '10–10 Sep');
  // Nothing to say rather than something invented.
  assert.equal(tripDatesLine(null, null), null);
  assert.equal(tripDatesLine('2026-09-10', null), null);
});

test('the past is remembered by its month', () => {
  assert.equal(pastDatesLine('2026-05-10', '2026-05-15'), 'May 2026 · 5 nights');
  assert.equal(pastDatesLine('2026-03-01', '2026-03-04'), 'March 2026 · 3 nights');
  // Only one end recorded: the month still lands, the nights do not.
  assert.equal(pastDatesLine('2026-03-01', null), 'March 2026');
  assert.equal(pastDatesLine(null, null), null);
});

test('nights are the inclusive days minus one', () => {
  assert.equal(nightCount('2026-09-10', '2026-09-14'), 4);
  assert.equal(nightCount('2026-09-10', '2026-09-10'), 0);
  assert.equal(nightCount(null, '2026-09-10'), null);
});

test('a date range crossing a DST boundary still counts its nights', () => {
  // The dates are parsed at LOCAL NOON for exactly this reason: a midnight
  // anchor loses or gains an hour across the change and rounds to the wrong
  // number of days.
  assert.equal(nightCount('2026-10-30', '2026-11-03'), 4);
  assert.equal(nightCount('2026-03-06', '2026-03-10'), 4);
});

// ---------------------------------------------------------------------------
// The collage
// ---------------------------------------------------------------------------

test('the collage prefers the packing engine’s own ordering', () => {
  const memo = { bag: [{ itemId: 'b' }, { itemId: 'c' }] };
  // `item_ids` is the flat set; `memo.bag` is most-worn first, which is the
  // order the trip was actually built in.
  assert.deepEqual(bagItemIds(memo, ['a', 'b', 'c'], 4), ['b', 'c', 'a']);
  assert.deepEqual(bagItemIds(null, ['a', 'b', 'c', 'd', 'e'], 4), ['a', 'b', 'c', 'd']);
});

test('a memo written any other day cannot crash the shelf', () => {
  // `memo` is jsonb — it is whatever was written the day it was written, and a
  // shape assertion here would be a crash on somebody's trips rather than a
  // missing photograph.
  for (const memo of [null, 'nonsense', 42, [], { bag: 'no' }, { bag: [null, 7, {}] }] as never[]) {
    assert.deepEqual(bagItemIds(memo, ['a'], 4), ['a'], `memo ${JSON.stringify(memo)}`);
  }
  assert.deepEqual(bagItemIds({ bag: [{ itemId: 'a' }, { itemId: 'a' }] } as never, ['a'], 4), ['a']);
});

test('the two collages ask for the counts the frames draw', () => {
  assert.equal(HERO_TILES, 3, 'the hero band is three across');
  assert.equal(CARD_TILES, 4, 'the shelf card’s square is two by two');
  assert.deepEqual(bagItemIds(null, ['a', 'b', 'c', 'd', 'e'], HERO_TILES), ['a', 'b', 'c']);
});

test('the serif sets the place and only the place', () => {
  // The artifact draws "Marfa, Texas", which is name plus admin1 for that row
  // and does not generalise: the geocoder returns admin1 "Ciudad de México"
  // beside name "Mexico City", and the hero would read the pair in 40pt serif.
  assert.equal(destinationLabel({ name: 'Mexico City' }), 'Mexico City');
  assert.equal(destinationLabel({ name: '  Lisbon ' }), 'Lisbon');
});

// ---------------------------------------------------------------------------
// The two entry points
// ---------------------------------------------------------------------------

test('both surfaces the brief names carry the door to the list', () => {
  // Plan's Packing mode header — and ONLY Packing: Events keeps its week range,
  // which is the trailing slot's original job.
  assert.match(PLAN, /mode === 'packing' \?[\s\S]{0,400}TRIPS_COPY\.seeAll/, 'Packing’s header lost its door');
  assert.match(PLAN, /router\.push\('\/trips'\)/, 'Plan does not route to the list');
  assert.match(PLAN, /weekRangeLabel/, 'the week range was removed rather than moved aside');

  // The post-planning success screen — now redesign 05's "Trip planned" plate.
  //
  // The artifact supersedes the COPY this used to pin. `TRIPS_COPY.seeAll`
  // ("See all trips") was the quiet link the memo carried; the accepted
  // completion frame gives the foot two named controls, "See this trip" and
  // "All trips", and the second one IS this door. What the rule protects — the
  // post-planning screen reaches the list, and Share is not displaced by it —
  // is asserted below against the new composition.
  assert.match(MEMO, /NEW_TRIP_COPY\.allTrips|onAllTrips/, 'the plate lost its door');
  assert.match(MEMO, /router\.push\('\/trips'\)/, 'the plate does not route to the list');
  assert.match(MEMO, /onShare/, 'Share was displaced by the addition');
  assert.match(PLATE, /onPress=\{view\.onShare\}|NEW_TRIP_COPY\.share/, 'Share left the plate');
});

test('the list route is a pushed page, not a sheet, and not a fixture', () => {
  const layout = code(readFileSync('src/app/_layout.tsx', 'utf8'));
  // Unregistered is the dialect for a default card push — every sheet in the
  // root stack names itself. `/trips` deliberately does not.
  assert.doesNotMatch(layout, /name="trips"/, 'the list was registered as something other than a push');
  // Which is why it draws its own back affordance where the artifact's frame
  // had a tab bar.
  assert.match(CODE, /function BackButton/, 'a pushed page with no way back');
  assert.match(CODE, /chevron\.left/, 'the back affordance lost its glyph');
  assert.doesNotMatch(ROUTE, /dev-fixtures/, 'a fixture reached the router');
});
