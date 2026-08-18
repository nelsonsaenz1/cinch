/**
 * The closet — what the screen decides before it draws. Redesign 14.
 *
 * Every function here is pure and imported directly. The contracts this file
 * exists to hold: the three tiers' ceilings come from `plans.ts`, the two
 * capacity walls are told apart because they have different remedies, Add
 * piece is never disabled, counts are query-aware, and a rail is absent rather
 * than empty.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, type Plan } from '../src/features/billing/plans';
import { categoryCounts, matchesSearch } from '../src/features/closet/closet-query';
import {
  CLOSET_COPY,
  FAB_BOTTOM,
  FAB_SIZE,
  GRID_COLUMNS,
  GRID_COLUMNS_AX,
  activeLine,
  addPieceDisabled,
  bulkFailureBody,
  capacityRemedy,
  capacityState,
  capacityTrack,
  ceilingsFor,
  composedTitle,
  filterKind,
  gridColumns,
  mastheadCounts,
  railsPresent,
  searchScopeLine,
  selectAllLabel,
  selectionNote,
  selectionSize,
  storedLine,
} from '../src/features/closet/closet-spec';

const PLAN_TIERS: Plan[] = ['free', 'standard', 'pro'];

// ---------------------------------------------------------------------------
// Ceilings come from the server's own table
// ---------------------------------------------------------------------------

test('all three tiers read their ceilings from plans.ts', () => {
  assert.deepEqual(ceilingsFor('free'), { active: 10, total: 30 });
  assert.deepEqual(ceilingsFor('standard'), { active: 150, total: 450 });
  assert.deepEqual(ceilingsFor('pro'), { active: 1000, total: 3000 });
  // Derived, never typed: a tier change moves the screen and the server
  // together rather than leaving one of them behind.
  for (const p of PLAN_TIERS) {
    assert.equal(ceilingsFor(p).active, PLANS[p].items);
    assert.equal(ceilingsFor(p).total, PLANS[p].storedItems);
  }
});

// ---------------------------------------------------------------------------
// Two walls, two remedies
// ---------------------------------------------------------------------------

test('room is room', () => {
  assert.equal(
    capacityState({ active: 84, activeLimit: 150, stored: 110, storedLimit: 450 }),
    'room',
  );
});

test('active full with storage to spare is its own state', () => {
  assert.equal(
    capacityState({ active: 150, activeLimit: 150, stored: 246, storedLimit: 450 }),
    'active_full',
  );
});

test('total full wins even when the active grid is also full', () => {
  // Storing is off the table either way, so the state that names the useful
  // remedy is the one that matters.
  assert.equal(
    capacityState({ active: 150, activeLimit: 150, stored: 450, storedLimit: 450 }),
    'total_full',
  );
  assert.equal(
    capacityState({ active: 10, activeLimit: 150, stored: 450, storedLimit: 450 }),
    'total_full',
  );
});

test('the two walls never share a remedy', () => {
  for (const p of PLAN_TIERS) {
    const active = capacityRemedy('active_full', p);
    const total = capacityRemedy('total_full', p);
    assert.notEqual(active.body, total.body, `${p}: the two walls read the same`);
  }
});

test('total full says outright that storing cannot help', () => {
  for (const p of PLAN_TIERS) {
    const r = capacityRemedy('total_full', p);
    assert.match(r.body!, /storing will not free a slot/i);
    assert.equal(r.door, 'plans');
    // Never the store door: sending somebody to a door that is bricked up is
    // worse than saying nothing.
    assert.notEqual(r.door, 'store');
  }
});

test('a paid plan at the active wall is sent to storing, not to a price', () => {
  for (const p of ['standard', 'pro'] as Plan[]) {
    const r = capacityRemedy('active_full', p);
    assert.equal(r.door, 'store');
    assert.match(r.body!, /frees an active slot/i);
  }
});

test('free at the active wall names storing FIRST, then the larger closet', () => {
  const r = capacityRemedy('active_full', 'free');
  assert.equal(r.door, 'plans');
  // Not upsell dressed as help: the sentence opens on the free remedy.
  assert.match(r.body!, /^Store a piece to free a slot/);
  assert.ok(r.body!.indexOf('Store a piece') < r.body!.indexOf('larger closet'));
});

test('room offers no remedy and no door', () => {
  for (const p of PLAN_TIERS) {
    const r = capacityRemedy('room', p);
    assert.equal(r.body, null);
    assert.equal(r.action, null);
    assert.equal(r.door, null);
  }
});

test('ADD PIECE IS NEVER DISABLED', () => {
  // The wall is met at the add attempt, truthfully, by the server. A control
  // greyed out before the attempt teaches somebody the app is broken rather
  // than that their closet is full.
  assert.equal(addPieceDisabled(), false);
});

// ---------------------------------------------------------------------------
// The band's arithmetic
// ---------------------------------------------------------------------------

test('the track shows active and stored as parts of one whole', () => {
  const t = capacityTrack({ active: 150, stored: 246, storedLimit: 450 });
  assert.ok(Math.abs(t.activeFraction - 150 / 450) < 1e-9);
  assert.ok(Math.abs(t.storedFraction - 96 / 450) < 1e-9);
  // The two never exceed the whole — a stored piece still counts toward the
  // total, and drawing them apart would suggest storing is free.
  assert.ok(t.activeFraction + t.storedFraction <= 1.0000001);
});

test('the track cannot overflow or go negative on bad input', () => {
  for (const input of [
    { active: 500, stored: 900, storedLimit: 450 },
    { active: -4, stored: -9, storedLimit: 450 },
    { active: 0, stored: 0, storedLimit: 0 },
  ]) {
    const t = capacityTrack(input);
    assert.ok(t.activeFraction >= 0 && t.activeFraction <= 1, JSON.stringify(t));
    assert.ok(t.storedFraction >= 0 && t.storedFraction <= 1, JSON.stringify(t));
    assert.ok(t.activeFraction + t.storedFraction <= 1.0000001, JSON.stringify(t));
  }
});

test('the band states both ceilings, not one', () => {
  assert.equal(activeLine(84, 150), '84 of 150 active');
  assert.equal(storedLine(26, 110, 450), '26 stored · 110 of 450');
});

test('the masthead says how many are put away, and says none rather than zero', () => {
  assert.equal(mastheadCounts(84, 26), '84 active · 26 stored');
  assert.equal(mastheadCounts(12, 0), '12 active · none stored');
});

// ---------------------------------------------------------------------------
// Rails: absent, never empty
// ---------------------------------------------------------------------------

test('every combination of rails has a name', () => {
  assert.equal(railsPresent(false, false), 'none');
  assert.equal(railsPresent(true, false), 'worn');
  assert.equal(railsPresent(false, true), 'outfits');
  assert.equal(railsPresent(true, true), 'both');
});

// ---------------------------------------------------------------------------
// Filters compose, and the counts describe the query
// ---------------------------------------------------------------------------

test('the filter kind is the composition, not the last thing touched', () => {
  assert.equal(filterKind('All', ''), null);
  assert.equal(filterKind('Tops', ''), 'category');
  assert.equal(filterKind('All', 'linen'), 'search');
  assert.equal(filterKind('Tops', 'linen'), 'both');
  // Whitespace is not a search.
  assert.equal(filterKind('All', '   '), null);
});

test('a composed title counts the composition, never the closet', () => {
  assert.equal(composedTitle('Dresses', 2, 14), '2 of 14 match');
  assert.equal(composedTitle('All', 7, 84), '7 matches');
  assert.equal(composedTitle('All', 1, 84), '1 match');
});

test('the chip counts are query-aware and hide only what is empty', () => {
  const item = (category: string, subcategory: string, colour: string, material?: string) =>
    ({
      category,
      subcategory,
      brand: null,
      material: material ?? null,
      colors: [{ name: colour }],
    }) as never;

  const closet = [
    item('top', 'linen shirt', 'white', 'linen'),
    item('top', 'crew knit', 'cream', 'wool'),
    item('footwear', 'ankle boots', 'black', 'leather'),
  ];

  const all = categoryCounts(closet, '');
  assert.deepEqual(
    all.map((c) => [c.category, c.count]),
    [
      ['All', 3],
      ['Tops', 2],
      ['Shoes', 1],
    ],
  );
  // Bottoms, Outerwear and Accessories are absent rather than shown at zero —
  // a chip promising an empty grid teaches people to stop reading the row.
  assert.ok(!all.some((c) => c.count === 0 && c.category !== 'All'));

  // Inside a search the counts describe the MATCHED set, not the closet.
  const searched = categoryCounts(closet, 'linen');
  assert.deepEqual(
    searched.map((c) => [c.category, c.count]),
    [
      ['All', 1],
      ['Tops', 1],
    ],
  );
});

test('All survives even when the closet is empty', () => {
  // Zero pieces is a fact the row must still be able to state.
  const counts = categoryCounts([], '');
  assert.deepEqual(counts, [{ category: 'All', count: 0 }]);
});

test('search matches material, not only the name', () => {
  const wool = { category: 'top', subcategory: 'crew knit', brand: null, material: 'wool', colors: [{ name: 'cream' }] } as never;
  assert.equal(matchesSearch(wool, 'wool'), true, 'material is not searched');
  assert.equal(matchesSearch(wool, 'cream'), true, 'colour is not searched');
  assert.equal(matchesSearch(wool, 'knit'), true, 'name is not searched');
  assert.equal(matchesSearch(wool, 'linen'), false);
});

test('the search scope line names what is being searched and where', () => {
  assert.equal(
    searchScopeLine('Dresses', 'linen'),
    'Searching dresses for “linen” — name, colour and material.',
  );
  assert.match(searchScopeLine('All', 'linen'), /^Searching your closet/);
});

// ---------------------------------------------------------------------------
// Selection: zero, one, many, all
// ---------------------------------------------------------------------------

test('an empty selection is not an action and is not reported', () => {
  assert.equal(selectionSize(0, 12), null);
  assert.equal(selectionSize(-1, 12), null);
});

test('one, many and all are told apart against what is ON SCREEN', () => {
  assert.equal(selectionSize(1, 12), 'one');
  assert.equal(selectionSize(3, 12), 'many');
  assert.equal(selectionSize(12, 12), 'all');
  // "All" is relative to the filtered set — nine of nine shown is all, even
  // though the closet holds eighty-four.
  assert.equal(selectionSize(9, 9), 'all');
});

test('one of one is all, not one', () => {
  assert.equal(selectionSize(1, 1), 'all');
});

test('the label flips only when everything shown is picked', () => {
  assert.equal(selectAllLabel(0, 12), 'Select all');
  assert.equal(selectAllLabel(11, 12), 'Select all');
  assert.equal(selectAllLabel(12, 12), 'Deselect all');
  // Nothing on screen cannot be "deselect all".
  assert.equal(selectAllLabel(0, 0), 'Select all');
});

test('selecting everything states the boundary outright', () => {
  // "Select all" inside a category filter is the one place somebody could
  // reasonably fear they had just selected everything they own.
  const note = selectionNote(9, 9);
  assert.match(note, /All 9 shown pieces are selected/);
  assert.match(note, /filtered set only/);
  assert.match(selectionNote(1, 1), /All 1 shown piece is selected/);
  // A partial selection gets the storing explanation instead.
  assert.match(selectionNote(3, 12), /frees an active slot/);
});

// ---------------------------------------------------------------------------
// Bulk failure
// ---------------------------------------------------------------------------

test('a total failure says nothing happened and the selection survives', () => {
  const body = bulkFailureBody('delete', 3, 3);
  assert.match(body, /Nothing was removed/);
  assert.match(body, /selection is still here/);
});

test('a partial failure names what SURVIVED, so a retry is answerable', () => {
  const body = bulkFailureBody('delete', 2, 3);
  assert.match(body, /2 of the 3 pieces are still on the server/);
  assert.match(body, /selection is still here/);
});

test('every bulk failure keeps the selection', () => {
  for (const action of ['recategorise', 'store', 'restore', 'delete'] as const) {
    for (const [remaining, total] of [
      [3, 3],
      [1, 3],
      [1, 1],
    ] as const) {
      assert.match(bulkFailureBody(action, remaining, total), /selection is still here/);
    }
  }
});

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

test('three columns normally, one at an accessibility size', () => {
  assert.equal(GRID_COLUMNS, 3);
  assert.equal(GRID_COLUMNS_AX, 1);
  assert.equal(gridColumns(false), 3);
  // A three-column grid at AX-XXXL is three crushed cards with clamped labels,
  // which is worse for the reader it is meant to help than a list would be.
  assert.equal(gridColumns(true), 1);
});

test('the add control clears the tab bar at every height', () => {
  assert.equal(FAB_SIZE, 60);
  assert.ok(FAB_SIZE >= 44, 'the add control is below the tap floor');
  // The native Liquid Glass tab bar cannot be dismissed from JS and draws over
  // anything at bottom: 0.
  assert.ok(FAB_BOTTOM >= 88, `${FAB_BOTTOM}pt is inside the tab bar`);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test('the delete confirmation says the camera roll is untouched', () => {
  // The old copy said the photographs are deleted and stopped there, which is
  // true of Cinch's copies and says nothing about the originals.
  assert.match(CLOSET_COPY.deleteBody, /camera roll stay where they are/);
  assert.match(CLOSET_COPY.deleteBody, /wear history/);
  // And storage is offered first, before the destructive action.
  assert.equal(CLOSET_COPY.deleteInstead, 'Store instead');
});

test('the empty closet uses the activation copy verbatim', () => {
  assert.equal(CLOSET_COPY.emptyTitle, 'Start with ten pieces');
});

test('a failed read never reads as an empty closet', () => {
  assert.match(CLOSET_COPY.errorBody, /Nothing has changed and nothing is lost/);
  assert.doesNotMatch(CLOSET_COPY.errorBody, /empty|no pieces/i);
});

test('offline says it is showing the last loaded state', () => {
  assert.match(CLOSET_COPY.offlineBody, /as it was last loaded/);
});

test('recategorising is described as private and browsing-only', () => {
  assert.match(CLOSET_COPY.moveNote, /private/);
  assert.match(CLOSET_COPY.moveNote, /how you browse/);
});

test('no copy on this screen quotes a price or a plan ceiling', () => {
  const words = Object.values(CLOSET_COPY).join(' ');
  assert.doesNotMatch(words, /\$|£|€|\/mo|per month/i, words);
  assert.doesNotMatch(words, /\b\d+ of \d+\b/, words);
});
