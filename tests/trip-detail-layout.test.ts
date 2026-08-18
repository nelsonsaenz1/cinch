/**
 * Trip Detail — the layout bargain, and the two laws under it.
 * Redesign 06.
 *
 * Written to the shape `trips-list-layout.test.ts`, `new-trip-layout.test.ts`
 * and `plan-week-layout.test.ts` set: the drawn body is asserted as TEXT,
 * because esbuild cannot parse React Native's Flow source and there is no
 * renderer in this runner; everything the page DECIDES before it draws lives in
 * `trip-detail-spec.ts` and is imported and exercised directly.
 *
 * This page has two things to get wrong that no other rebuilt page does, and
 * neither is a layout:
 *
 *   IT CAN DELETE SOMEBODY'S WARDROBE. The trip row holds `item_ids` and a memo
 *   full of them, and the plausible-looking "tidy up after yourself" delete
 *   walks those ids into the closet. The confirmation sheet PROMISES it does
 *   not. That promise is pinned below against the source of the mutation.
 *
 *   IT CAN INVENT A GARMENT. The plate is somebody's own wardrobe; a fallback
 *   that substituted a name, a stock photograph or a placeholder piece for an
 *   id that no longer resolves would be the app putting clothes in the reader's
 *   suitcase that they do not own.
 *
 * Both are asserted here rather than described in a comment, because both fail
 * silently and one of them is irreversible.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BAR_HEIGHT,
  CTA_MIN_HEIGHT,
  GRID_COLUMNS,
  GRID_COLUMNS_AX,
  MARK_SIZE,
  NOTE_MAX_LENGTH,
  TILE_ROW,
  TILE_ROW_AX,
  TRIP_DETAIL_COPY,
  emptyBody,
  groupCaption,
  groupLabel,
  isFullyPacked,
  noteChanged,
  normaliseNote,
  packEvent,
  packingProgress,
  pieceLabel,
  plateBand,
  plateGroups,
  plateItemIds,
  readChecked,
  toggleCheck,
  tripChecksKey,
  tripDayCount,
} from '../src/features/trips/trip-detail-spec';
import { MIN_TAP_TARGET } from '../src/theme/metrics';

const RAW = readFileSync('src/components/trips/trip-detail-body.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/trips/[id].tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/trips/trip-detail-spec.ts', 'utf8');
const CHECKS_RAW = readFileSync('src/features/trips/use-trip-checks.ts', 'utf8');
const FIXTURES_RAW = readFileSync('src/features/trips/trip-detail-fixtures.ts', 'utf8');
const USE_TRIPS_RAW = readFileSync('src/features/plan/use-trips.ts', 'utf8');
const LIST_ROUTE_RAW = readFileSync('src/app/trips/index.tsx', 'utf8');
const PACKING_TRIP_RAW = readFileSync('src/features/plan/packing-trip.tsx', 'utf8');

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
const CHECKS = code(CHECKS_RAW);
const FIXTURES = code(FIXTURES_RAW);
const USE_TRIPS = code(USE_TRIPS_RAW);
const LIST_ROUTE = code(LIST_ROUTE_RAW);
const PACKING_TRIP = code(PACKING_TRIP_RAW);

// ---------------------------------------------------------------------------
// LAW ONE — deleting a trip deletes a trip
// ---------------------------------------------------------------------------

/** The body of a named exported function, to the next top-level `export`. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} is gone`);
  const rest = source.slice(start + 1);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

test('the delete path names the trips table and nothing else', () => {
  const body = functionBody(USE_TRIPS, 'useDeleteTrip');

  // Every table this statement touches, by the only way this codebase reaches
  // one. If a future edit adds a sweep of `items`, `outfits` or anything else
  // to the delete, it lands in this list and this assertion fails.
  const tables = [...body.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(tables, ['trips'], `the delete reached beyond trips: ${tables.join(', ')}`);

  assert.match(body, /\.delete\(\)/, 'useDeleteTrip does not delete');
  // And it deletes ONE row, by id, not a filtered sweep.
  assert.match(body, /\.eq\('id', tripId\)/, 'the delete is not scoped to one row');

  // Nothing in the mutation reads the ids the trip carries — there is no path
  // from a trip's contents to a delete.
  assert.doesNotMatch(body, /item_ids|itemIds|memo/, 'the delete path reads the packed pieces');
});

test('the sheet promises what the mutation actually does', () => {
  // The copy is not decoration here: it is the claim the assertion above keeps.
  assert.match(
    TRIP_DETAIL_COPY.deleteBody,
    /garments stay in the closet/i,
    'the confirmation stopped promising the closet is safe',
  );
  assert.match(CODE, /TRIP_DETAIL_COPY\.deleteBody/, 'the sheet dropped the promise');
  assert.match(CODE, /function DeleteSheet/, 'the confirmation frame is not drawn');

  // The destructive haptic fires on the CONFIRM, never on the button that opens
  // the sheet — UX-07's own rule, and the only Heavy in the app.
  assert.match(ROUTE, /onConfirmDelete[\s\S]{0,300}haptics\.destructiveConfirm\(\)/, 'the confirm has no weight');
  assert.doesNotMatch(
    ROUTE,
    /onRequestDelete:[\s\S]{0,120}destructiveConfirm/,
    'opening the sheet fires the destructive haptic',
  );
});

test('the note mutation names the trips table and nothing else', () => {
  const body = functionBody(USE_TRIPS, 'useUpdateTripNote');
  const tables = [...body.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(tables, ['trips'], `the note write reached beyond trips: ${tables.join(', ')}`);

  // ONE column. A note save that also touched `memo`, `item_ids` or `saved_at`
  // would let typing a reminder quietly rewrite the packing plan beside it.
  const updated = body.match(/\.update\(\{([^}]*)\}\)/);
  assert.ok(updated, 'the note write does not update');
  const columns = [...updated[1]!.matchAll(/([a-z_]+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(columns, ['note'], `the note write set more than note: ${columns.join(', ')}`);
});

test('`.from(\'trips\')` stays in the one module allowed to hold it', () => {
  // The rule at the top of `use-trips.ts`, extended to this page's three new
  // files. A fifth surface reaching the table directly is the drift that rule
  // exists to prevent.
  for (const [name, source] of [
    ['the detail route', ROUTE],
    ['the drawn body', CODE],
    ['the local check store', CHECKS],
    ['the spec', SPEC],
  ] as const) {
    assert.doesNotMatch(source, /\.from\(\s*'trips'\s*\)/, `${name} reaches the table directly`);
  }
});

// ---------------------------------------------------------------------------
// LAW TWO — the pieces are the reader's own garments
// ---------------------------------------------------------------------------

test('the plate carries closet ids, never invented pieces', () => {
  // `plateGroups` yields ids and only ids — there is no name, no path and no
  // photograph anywhere in what it returns.
  const groups = plateGroups({
    days: [
      { dayIndex: 0, date: '2026-09-10', travelDay: true, tempC: 24, rows: [{ part: 'day', itemIds: ['a', 'b'] }] },
      { dayIndex: 1, date: '2026-09-11', travelDay: false, tempC: 22, rows: [{ part: 'day', itemIds: ['b', 'c'] }] },
    ],
  } as never);

  assert.deepEqual(groups.map((g) => g.itemIds), [['a', 'b'], ['b', 'c']]);
  for (const group of groups) {
    for (const id of group.itemIds) assert.equal(typeof id, 'string');
  }

  // A piece the closet cannot resolve draws with NO name rather than a
  // substitute. `pieceLabel` returning null is what the route turns into `''`.
  assert.equal(pieceLabel(null), null);
  assert.equal(pieceLabel({ subcategory: null, category: null }), null);
  assert.equal(pieceLabel({ subcategory: 'linen shirt', category: 'top' }), 'Linen shirt');
  // Falls back to the CATEGORY the user's own row carries, never to a literal.
  assert.equal(pieceLabel({ subcategory: null, category: 'loafers' }), 'Loafers');

  // And the route looks each id up in the closet rather than reading a name off
  // the memo — the memo has none, and adding one would be a second copy of the
  // wardrobe that goes stale the first time somebody renames a garment.
  assert.match(ROUTE, /byId\.get\(pieceId\)/, 'the plate stopped resolving against the closet');
  assert.match(ROUTE, /pieceLabel\(item\)\s*\?\?\s*''/, 'a missing garment gained a stand-in name');
});

test('a repeat piece is one act, counted once', () => {
  // The same garment on two days is ONE thing to pack. If `plateItemIds` ever
  // stopped deduplicating, the denominator would count a repeat twice and the
  // plate could never read "9 of 9".
  const groups = plateGroups({
    days: [
      { dayIndex: 0, date: '2026-09-10', travelDay: true, tempC: null, rows: [{ part: 'day', itemIds: ['shirt', 'shoes'] }] },
      { dayIndex: 1, date: '2026-09-11', travelDay: false, tempC: null, rows: [{ part: 'day', itemIds: ['shirt', 'dress'] }] },
    ],
  } as never);

  assert.deepEqual(plateItemIds(groups), ['shirt', 'shoes', 'dress']);
});

test('a day dressed twice does not show one garment twice', () => {
  // Deduplication WITHIN a day, across its parts — the same rule the planned
  // plate states, restated where this page draws it.
  const [day] = plateGroups({
    days: [
      {
        dayIndex: 0,
        date: '2026-09-10',
        travelDay: false,
        tempC: null,
        rows: [
          { part: 'day', itemIds: ['trousers', 'shirt'] },
          { part: 'evening', itemIds: ['trousers', 'jacket'] },
        ],
      },
    ],
  } as never);

  assert.deepEqual(day!.itemIds, ['trousers', 'shirt', 'jacket']);
});

test('a memo of any other shape produces no plate rather than a crash', () => {
  // `memo` is jsonb: it is whatever was written the day it was written, and a
  // shape assertion would be a crash on somebody's own trip.
  for (const memo of [null, 'nonsense', 42, [], {}, { days: 'no' }, { days: [null, 7] }] as never[]) {
    let groups: unknown;
    try {
      groups = plateGroups(memo);
    } catch (error) {
      assert.fail(`plateGroups threw on ${JSON.stringify(memo)}: ${String(error)}`);
    }
    assert.ok(Array.isArray(groups), `plateGroups returned a non-array for ${JSON.stringify(memo)}`);
  }

  // A row with `item_ids` and no memo days is EMPTY, not a plate assembled from
  // a flat list under day headings the pieces were never packed for.
  assert.deepEqual(plateGroups({ bag: [{ itemId: 'a' }] } as never), []);
  assert.doesNotMatch(SPEC, /item_ids|itemIds:\s*trip/, 'the plate gained a flat-list fallback');
});

// ---------------------------------------------------------------------------
// The check set
// ---------------------------------------------------------------------------

test('toggling a check is idempotent and cannot duplicate', () => {
  // Twice returns to where it started.
  assert.deepEqual(toggleCheck(['a', 'b'], 'c').sort(), ['a', 'b', 'c']);
  assert.deepEqual(toggleCheck(toggleCheck(['a', 'b'], 'c'), 'c'), ['a', 'b']);
  assert.deepEqual(toggleCheck(toggleCheck([], 'a'), 'a'), []);

  // Ticking an already-ticked piece removes it rather than adding a second
  // entry — the property that stops progress running past its own total.
  assert.deepEqual(toggleCheck(['a'], 'a'), []);
  const doubled = toggleCheck(['a', 'a'] as string[], 'b');
  assert.deepEqual(doubled, ['a', 'b'], 'a duplicate survived the toggle');

  // Sorted, so the same taps in a different order serialise identically.
  assert.deepEqual(toggleCheck(['c', 'a'], 'b'), ['a', 'b', 'c']);
});

test('a stored tick for a piece that left the bag is dropped at the read', () => {
  // Re-planning rewrites the memo. An id ticked against the old bag must not
  // be counted against the new one — from BOTH ends: the read filters, and the
  // progress arithmetic intersects.
  assert.deepEqual(readChecked(['a', 'gone', 'b'], ['a', 'b', 'c']), ['a', 'b']);
  assert.deepEqual(readChecked(['a', 'a'], ['a']), ['a']);
  assert.deepEqual(readChecked(null, ['a']), []);
  assert.deepEqual(readChecked('not an array', ['a']), []);
  assert.deepEqual(readChecked([1, {}, 'a'], ['a']), ['a']);
});

test('the storage key carries the user AND the trip', () => {
  const key = tripChecksKey('user-1', 'trip-9');

  assert.ok(key.includes('user-1'), 'the key does not carry the user — one phone, two people');
  assert.ok(key.includes('trip-9'), 'the key does not carry the trip — every trip shares one set of ticks');

  // Two users on one device, and two trips for one user, are four distinct keys.
  assert.notEqual(tripChecksKey('user-1', 'trip-9'), tripChecksKey('user-2', 'trip-9'));
  assert.notEqual(tripChecksKey('user-1', 'trip-9'), tripChecksKey('user-1', 'trip-8'));

  // Versioned, so a future shape change does not read an old one as current.
  assert.match(key, /\.v1\./, 'the key lost its version');
});

test('what is stored is ids, and nothing about the garment', () => {
  // The privacy property `recent-people.ts` relies on, applied to a wardrobe:
  // a piece the user deletes stops appearing, rather than living on in a blob.
  assert.match(CHECKS, /JSON\.stringify\(ids\)/, 'the store writes something other than the id list');
  assert.doesNotMatch(CHECKS, /platePath|cutoutPath|thumbPath|subcategory|name/, 'the store caches garment data');
});

// ---------------------------------------------------------------------------
// Progress, and the completion moment
// ---------------------------------------------------------------------------

test('progress is derived from the plate, not from the stored set', () => {
  assert.deepEqual(packingProgress(['a', 'b', 'c'], []), { packed: 0, total: 3, ratio: 0 });
  assert.deepEqual(packingProgress(['a', 'b', 'c'], ['a', 'b', 'c']), { packed: 3, total: 3, ratio: 1 });

  const partial = packingProgress(['a', 'b', 'c', 'd'], ['a', 'b']);
  assert.equal(partial.packed, 2);
  assert.equal(partial.total, 4);
  assert.equal(partial.ratio, 0.5);

  // The one that matters: a tick left over from a previous plan is NOT counted.
  // Without the intersection this reads "3 of 2", which is impossible.
  assert.deepEqual(packingProgress(['a', 'b'], ['a', 'b', 'stale']), {
    packed: 2,
    total: 2,
    ratio: 1,
  });

  // Nothing to pack is 0, never NaN — the empty plate's own case.
  assert.deepEqual(packingProgress([], []), { packed: 0, total: 0, ratio: 0 });
  assert.deepEqual(packingProgress([], ['ghost']), { packed: 0, total: 0, ratio: 0 });
});

test('completion needs a plate, not just an equality', () => {
  assert.equal(isFullyPacked({ packed: 3, total: 3, ratio: 1 }), true);
  assert.equal(isFullyPacked({ packed: 2, total: 3, ratio: 2 / 3 }), false);

  // The guard the empty frame turns on: "0 of 0" satisfies packed === total,
  // and without `total > 0` an unpacked trip would announce itself as fully
  // packed and buzz on arrival.
  assert.equal(isFullyPacked({ packed: 0, total: 0, ratio: 0 }), false);
  assert.equal(isFullyPacked(packingProgress([], [])), false);
});

test('the success haptic fires on the tick that completes, and on no other', () => {
  // The completing tick.
  assert.equal(packEvent(8, 9, 9), 'complete');
  // Every tick before it.
  assert.equal(packEvent(0, 1, 9), 'selection');
  assert.equal(packEvent(7, 8, 9), 'selection');
  // UNticking back down from complete is not a success.
  assert.equal(packEvent(9, 8, 9), 'selection');
  // And an empty plate cannot complete.
  assert.equal(packEvent(0, 0, 0), 'selection');

  // The route spends both intents through the policy module, never raw haptics.
  assert.match(ROUTE, /from '@\/lib\/haptics'/, 'the page reaches past the haptic policy');
  assert.doesNotMatch(ROUTE, /expo-haptics/, 'the page imports the taptic engine directly');
  assert.match(ROUTE, /haptics\.success\(\)/, 'completing the plate is silent');
  assert.match(ROUTE, /haptics\.selection\(\)/, 'ticking a piece is silent');
});

// ---------------------------------------------------------------------------
// The note — a column, and the cap that column carries
// ---------------------------------------------------------------------------

test('the note is capped where the column caps it', () => {
  // `trips.note` carries `check (char_length(note) <= 2000)`. Enforcing it in
  // the client is what stops a long paste coming back as a constraint violation
  // on the write carrying the user's own words.
  assert.equal(NOTE_MAX_LENGTH, 2000);
  const migration = readFileSync('supabase/migrations/20260822000000_trip_note.sql', 'utf8');
  assert.match(
    migration,
    new RegExp(`char_length\\(note\\)\\s*<=\\s*${NOTE_MAX_LENGTH}`),
    'the client cap and the column cap disagree',
  );

  assert.equal(normaliseNote('x'.repeat(2500)).length, 2000);
  // Trailing whitespace goes, so "  " and "" are one note.
  assert.equal(normaliseNote('packed the dress   '), 'packed the dress');
  assert.equal(normaliseNote('   '), '');
  // Leading whitespace stays — it is inside a sentence somebody wrote.
  assert.equal(normaliseNote('  packed'), '  packed');
});

test('blurring a field nobody typed in does not spend a write', () => {
  assert.equal(noteChanged('', ''), false);
  assert.equal(noteChanged('', null), false);
  assert.equal(noteChanged('  ', ''), false);
  assert.equal(noteChanged('gift in the carry-on', ''), true);
  assert.equal(noteChanged('gift in the carry-on', 'gift in the carry-on'), false);
  // The trailing space is not a change, because it is not what would be stored.
  assert.equal(noteChanged('gift ', 'gift'), false);

  assert.match(ROUTE, /noteChanged\(next, savedNote\)/, 'the note saves unconditionally');
});

test('the note goes to the row and the ticks stay on the device', () => {
  // The split this build ships. Both halves asserted, because either one
  // drifting to the other side is invisible until somebody reinstalls.
  assert.match(ROUTE, /useUpdateTripNote/, 'the note is not written to the row');
  assert.match(CHECKS, /AsyncStorage/, 'the ticks left the device');
  assert.doesNotMatch(CHECKS, /note/i, 'the note crept back into local storage');

  // And the offline frame's claim is only about the ticks, which is the only
  // half of the page that claim is true of.
  assert.match(TRIP_DETAIL_COPY.errorBody, /on this device/, 'the offline claim changed');
});

// ---------------------------------------------------------------------------
// The colophons and the honest captions
// ---------------------------------------------------------------------------

test('the day caption says only what the memo records', () => {
  const day = (travelDay: boolean, tempC: number | null) => ({
    key: '0', dayIndex: 0, date: '2026-09-10' as const, travelDay, tempC, itemIds: [],
  });

  assert.equal(groupCaption(day(true, 24), '75°'), 'travel day · 75°');
  assert.equal(groupCaption(day(true, null), null), 'travel day');
  assert.equal(groupCaption(day(false, 24), '75°'), '75°');
  // Nothing known is NO caption — never "Late flight, warm evening", which is
  // the artifact's line and a claim no column backs.
  assert.equal(groupCaption(day(false, null), null), null);
  assert.doesNotMatch(SPEC, /warm evening|Late flight|birthday/i, 'invented event copy reached the spec');
});

test('the weather mark states what the plan was built against', () => {
  const day = (tempC: number | null) => ({
    key: '0', dayIndex: 0, date: '2026-09-10' as const, travelDay: false, tempC, itemIds: [],
  });

  assert.deepEqual(plateBand([day(24), day(15), day(19)]), { lowC: 15, highC: 24 });
  assert.deepEqual(plateBand([day(20)]), { lowC: 20, highC: 20 });
  // No recorded temperature is NO chip, rather than an em dash where a number
  // should be — and rather than a fresh forecast the bag was never chosen for.
  assert.equal(plateBand([day(null), day(null)]), null);
  assert.equal(plateBand([]), null);
  assert.doesNotMatch(SPEC, /useForecast|forecastQuery/, 'the page refetches weather it should read off the row');
});

test('the empty line drops the clause it cannot back', () => {
  // The artifact reads "Six nights, cool evenings. Build the plan and it lands
  // here." An unpacked trip has no memo and therefore no temperature, so the
  // weather clause is dropped rather than invented.
  assert.equal(emptyBody(6), 'Six nights. Build the plan and it lands here.');
  assert.equal(emptyBody(1), 'One night. Build the plan and it lands here.');
  assert.equal(emptyBody(null), 'Build the plan and it lands here.');
  assert.equal(emptyBody(0), 'Build the plan and it lands here.');
  assert.doesNotMatch(SPEC, /cool evenings/, 'an invented weather clause reached the copy');
});

test('the day band reuses the plate’s own label', () => {
  const day = (dayIndex: number) => ({
    key: String(dayIndex),
    dayIndex,
    date: '2026-09-10' as const,
    travelDay: false,
    tempC: null,
    itemIds: [],
  });

  // Arrival and home at the ends, the date alone in between — `plateDayLabel`'s
  // rule, not a second copy of it here.
  assert.match(groupLabel(day(0), 5), /arrival$/);
  assert.match(groupLabel(day(4), 5), /home$/);
  assert.doesNotMatch(groupLabel(day(2), 5), /arrival|home/);
  // A day with no date makes no claim about which day it is.
  assert.equal(groupLabel({ ...day(0), date: null }, 5), '');

  assert.equal(tripDayCount('2026-09-10', '2026-09-14'), 5);
  assert.equal(tripDayCount(null, '2026-09-14'), 0);
  assert.equal(tripDayCount('2026-09-10', null), 0);
});

// ---------------------------------------------------------------------------
// The drawn composition
// ---------------------------------------------------------------------------

test('every accepted frame is drawn', () => {
  for (const fn of ['LoadingBody', 'ErrorBody', 'EmptyBody', 'PlateBody', 'DeleteSheet']) {
    assert.match(CODE, new RegExp(`function ${fn}`), `${fn} is not drawn`);
  }
  // The completion and keyboard frames are compositions of the plate rather
  // than bodies of their own, which is why they are asserted as branches.
  assert.match(CODE, /view\.complete \?/, 'the completion frame does not recompose');
  assert.match(CODE, /view\.noteFocused \? null : <ChromeRow/, 'the keyboard frame keeps its chrome');
});

test('all nine frames are posed, and every pose is inert', () => {
  for (const pose of [
    '01-default', '02-progress', '03-complete', '04-keyboard',
    '05-empty', '06-loading', '07-error', '08-delete', '09-ax',
  ]) {
    assert.ok(FIXTURES.includes(`'${pose}'`), `${pose} has no pose`);
  }

  // No callback in a pose can do anything, and no pose carries a photograph:
  // the frames must open without a session or a network.
  assert.doesNotMatch(FIXTURES, /router|supabase|useQuery|AsyncStorage/, 'a fixture reached for a real dependency');
  assert.doesNotMatch(FIXTURES, /uri:/, 'a fixture carries a photograph');

  // The counts are DERIVED, so a pose cannot disagree with the arithmetic the
  // page ships — which is exactly the drift a posed frame exists to catch.
  assert.match(FIXTURES, /packingProgress\(/, 'a pose types its own progress');
  assert.match(FIXTURES, /isFullyPacked\(/, 'a pose types its own completion');
});

test('the whole tile is the target, and it reports its state', () => {
  // The mark is 26pt. A 26pt hit area would be under the floor, so the TILE is
  // the pressable and every tile clears it by its own height.
  assert.ok(MARK_SIZE < MIN_TAP_TARGET, 'the mark grew into a target and the rule below went stale');
  assert.ok(TILE_ROW >= MIN_TAP_TARGET, `a tile at ${TILE_ROW} is under the ${MIN_TAP_TARGET}pt floor`);
  assert.ok(TILE_ROW_AX >= MIN_TAP_TARGET, 'the AX tile is under the floor');
  assert.ok(CTA_MIN_HEIGHT >= MIN_TAP_TARGET, 'the primary is under the floor');

  assert.match(CODE, /accessibilityRole="checkbox"/, 'a tile does not announce itself as checkable');
  assert.match(CODE, /accessibilityState=\{\{ checked: tile\.checked \}\}/, 'a tile does not report its state');
  assert.match(CODE, /TRIP_DETAIL_COPY\.(pack|unpack)\(tile\.name\)/, 'a tile has no spoken label');
});

test('large type recomposes rather than shrinking', () => {
  // Two columns, not three, with the name moved out of the tile.
  assert.equal(GRID_COLUMNS, 3);
  assert.equal(GRID_COLUMNS_AX, 2);
  assert.match(CODE, /large \? GRID_COLUMNS_AX : GRID_COLUMNS/, 'the grid does not drop a column');
  assert.match(CODE, /nameBelow=\{large\}/, 'the piece name stays an overlay at the largest size');

  // The bar becomes a sentence: an 8pt rule carries nothing at 1.5×.
  assert.ok(BAR_HEIGHT < MIN_TAP_TARGET);
  assert.match(CODE, /!large && !view\.noteFocused \? \(\s*<ProgressRow/, 'the bar survives into the AX frame');
  assert.match(CODE, /progressLine=\{large \? progressLine : null\}/, 'the AX frame has no progress sentence');
});

test('not one hex literal, and clay is never type', () => {
  // The rule the whole redesign holds: colour comes from the palette.
  assert.doesNotMatch(CODE, /#[0-9a-fA-F]{3,8}\b/, 'a hex literal reached the drawn body');
  assert.doesNotMatch(ROUTE, /#[0-9a-fA-F]{3,8}\b/, 'a hex literal reached the route');
  assert.doesNotMatch(SPEC, /#[0-9a-fA-F]{3,8}\b/, 'a hex literal reached the spec');

  // The artifact sets the dates line and the completion count in colours the
  // contrast record forbids as type. Both are translated, and the translation
  // is what is asserted: clay and positive appear only as FILLS.
  assert.doesNotMatch(CODE, /color: theme\.accentWarm/, 'clay is being used as type');
  assert.doesNotMatch(CODE, /color: theme\.positive/, 'the success green is being used as type');
  assert.match(CODE, /backgroundColor: complete \? theme\.positive : theme\.accentWarm/, 'the bar lost its fills');
});

// ---------------------------------------------------------------------------
// The doors — the shelf, and the completion plate
// ---------------------------------------------------------------------------

test('the shelf’s withheld chevron is armed', () => {
  // Redesign 04 shipped this page's cards inert because `trips/[id]` did not
  // exist. It does now, so the prop that withheld them is set — and this
  // assertion is what replaces the one that used to pin the withheld state.
  assert.doesNotMatch(LIST_ROUTE, /onOpenTrip: null/, 'the shelf still withholds the chevron');
  assert.match(LIST_ROUTE, /onOpenTrip: \(tripId: string\)/, 'the shelf does not open a trip');
  assert.match(LIST_ROUTE, /pathname: '\/trips\/\[id\]'/, 'the shelf routes somewhere other than the detail page');
});

test('"See this trip" lands on this trip', () => {
  // Redesign 05's deviation #4 retired: the primary used to land on the shelf
  // because this page did not resolve.
  assert.match(PACKING_TRIP, /onSeeThisTrip: \(\) =>[\s\S]{0,200}'\/trips\/\[id\]'/, 'the primary still dead-ends on the shelf');
  // The fallback survives: `useStartTrip` swallows its own failure, so a plate
  // can be real with no row behind it, and there is then no page to open.
  assert.match(PACKING_TRIP, /tripId\s*\?[\s\S]{0,260}:\s*router\.push\('\/trips'\)/, 'an unsaved trip pushes at a null id');
  // "All trips" is untouched — the second door still goes to the shelf.
  assert.match(PACKING_TRIP, /onAllTrips: \(\) => router\.push\('\/trips'\)/, 'the second door moved');
});

test('the detail route is a pushed page, not a sheet, and not a fixture', () => {
  const layout = code(readFileSync('src/app/_layout.tsx', 'utf8'));
  // Unregistered is the dialect for a default card push — every sheet in the
  // root stack names itself. `/trips/[id]` deliberately does not, exactly as
  // `/trips` does not.
  assert.doesNotMatch(layout, /name="trips\/\[id\]"/, 'the page was registered as something other than a push');
  assert.match(CODE, /function ChromeButton/, 'a pushed page with no way back');
  assert.match(CODE, /chevron\.left/, 'the back affordance lost its glyph');
  assert.doesNotMatch(ROUTE, /dev-fixtures/, 'a fixture reached the router');
});
