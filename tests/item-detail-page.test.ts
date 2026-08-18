/**
 * Item detail, as drawn and as wired. Redesign 15.
 *
 * The decisions are `tests/item-detail-spec.test.ts` and the payloads are
 * `tests/item-detail-privacy.test.ts`. What is left — and what this file holds
 * — is the PAGE: that the cost cell is genuinely omitted rather than blanked,
 * that a failed write preserves what the reader did, that the destructive
 * sheet locks, and that no backend moved.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROUTE_RAW = readFileSync('src/app/item/[id].tsx', 'utf8');
const STATS_RAW = readFileSync('src/components/item/item-stats.tsx', 'utf8');
const RAIL_RAW = readFileSync('src/components/item/wears-well-with.tsx', 'utf8');
const SHEET_RAW = readFileSync('src/components/item/delete-sheet.tsx', 'utf8');
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ROUTE = stripped(ROUTE_RAW);
const STATS = stripped(STATS_RAW);
const RAIL = stripped(RAIL_RAW);
const SHEET = stripped(SHEET_RAW);

// ---------------------------------------------------------------------------
// Route ownership
// ---------------------------------------------------------------------------

test('the route is still the owner, with no new navigator', () => {
  assert.match(ROUTE, /export default function ItemDetailScreen/);
  assert.doesNotMatch(ROUTE, /createStackNavigator|createNativeStackNavigator|<Stack\.Navigator/);
});

// ---------------------------------------------------------------------------
// The cost cell is omitted, not blanked
// ---------------------------------------------------------------------------

test('the cost cell is pushed only when there is something to say', () => {
  // `if (costPerWear !== null)` — a cell that is never constructed cannot be
  // drawn blank, dashed or zero.
  assert.match(STATS, /if \(costPerWear !== null\) \{/);
  assert.doesNotMatch(STATS, /costPerWear \?\? '—'|costPerWear \|\| 0|'--'/);
});

test('the band draws nothing at all when it knows nothing', () => {
  assert.match(STATS, /if \(cells\.length === 0\) return null;/);
});

test('the never-worn case shows the price and stops calling it a rate', () => {
  assert.match(STATS, /label: neverWorn \? 'Paid' : /);
  assert.match(ROUTE, /neverWorn\s*\n?\s*\?\s*formatPrice/);
});

test('the AX composition removes the same cells as the standard one', () => {
  // The same array feeds both, so an unknown figure is absent in both and the
  // two frames cannot disagree about what is known.
  assert.match(STATS, /if \(stacked\) \{[\s\S]{0,400}cells\.map/);
});

// ---------------------------------------------------------------------------
// Pairings
// ---------------------------------------------------------------------------

test('co-wear is preferred and colour is the fallback', () => {
  assert.match(ROUTE, /coWorn\.length\s*\n?\s*\?/);
  assert.match(ROUTE, /: peers\.map\(\(piece\) => \(\{ piece \}\)\)/);
});

test('the harmony fallback draws only from garments the owner owns', () => {
  // `harmonyPeers(item, closet)` — the closet is the owner's own query, so
  // nothing can enter the rail that is not already theirs.
  assert.match(ROUTE, /harmonyPeers\(item, /);
  // `harmonyPeers` is handed the owner's own closet and filters it — nothing
  // is fetched, generated or padded to fill the rail. Asserted against what
  // the rail SOURCE can be, rather than a loose keyword sweep: `placeholder`
  // appears on this screen as a TextInput's, which is not a pairing.
  assert.match(ROUTE, /const railSource: \{ piece: Item; count\?: number \}\[\]/);
  assert.doesNotMatch(ROUTE, /railSource[\s\S]{0,200}(catalog|fetch\(|generate)/i);
});

test('the rail renders the no-data state rather than vanishing', () => {
  assert.match(RAIL, /if \(pieces\.length === 0\) \{/);
  assert.match(RAIL, /NO_PAIRING_COPY\.title/);
  assert.doesNotMatch(RAIL, /if \(pieces\.length === 0\) return null;/);
});

test('the qualifier is drawn whenever the mode has one', () => {
  assert.match(RAIL, /RAIL_QUALIFIER\[mode\]/);
  assert.match(RAIL, /title=\{RAIL_HEADING\[mode\]\}/);
});

// ---------------------------------------------------------------------------
// Failures preserve what the reader did
// ---------------------------------------------------------------------------

test('a failed edit keeps the sheet open on the typed draft', () => {
  // `setSaveFailed(true)` and nothing else: the sheet is not closed and the
  // draft is not reset, so a failed save cannot charge the reader for the
  // app's error.
  const edit = ROUTE.slice(ROUTE.indexOf('const commitEdit'), ROUTE.indexOf('const commitTags'));
  assert.match(edit, /setSaveFailed\(true\)/);
  assert.doesNotMatch(edit, /onError[\s\S]{0,200}setEditing\(false\)/);
});

test('a failed lending write leaves the switch where it was', () => {
  // The switch renders `borrowable.data` — the server's value — so there is no
  // optimistic flip to roll back.
  assert.match(ROUTE, /value=\{borrowable\.data\}/);
  const lending = ROUTE.slice(ROUTE.indexOf('<BorrowableCard'));
  assert.doesNotMatch(lending.slice(0, 900), /setOptimistic|setLocal|useState/);
});

test('a lending failure never names another person or an account state', () => {
  const lending = ROUTE.slice(ROUTE.indexOf('<BorrowableCard'), ROUTE.indexOf('<WearsWellWith'));
  // The server's own message is deliberately not shown here, unlike the other
  // failures on this screen: this is the one place a backend string could name
  // a block, a mute or an account.
  assert.match(lending, /LENDING_FAILURE/);
  assert.doesNotMatch(lending, /err instanceof Error\s*\n?\s*\?\s*err\.message/);
});

test('a failed listing removal keeps the owner’s photograph', () => {
  const removal = ROUTE.slice(ROUTE.indexOf('const removeListing'));
  assert.match(removal.slice(0, 1400), /Your own photograph is untouched/);
  // And the server's text is never shown — it can quote the request back.
  assert.doesNotMatch(removal.slice(0, 1400), /setMaintenanceError\(\s*err/);
});

// ---------------------------------------------------------------------------
// Storage and delete
// ---------------------------------------------------------------------------

test('storage is offered inside the same sheet, and first', () => {
  const store = SHEET.indexOf('Move to storage');
  const del = SHEET.indexOf('Delete permanently');
  assert.ok(store > -1 && del > -1);
  assert.ok(store < del, 'the destructive action is offered before the reversible one');
});

test('every control locks while a destructive write is open', () => {
  // Both halves: a second tap starting a duplicate write, and a dismissal
  // leaving one in flight with nobody watching for its answer.
  const disables = SHEET.match(/disabled=\{busy\}/g) ?? [];
  assert.ok(disables.length >= 3, `only ${disables.length} controls lock`);
  // `busy` arrives as a prop from the screen holding the mutation, so the lock
  // and the write can never disagree about whether one is open.
  assert.match(SHEET, /busy\?: boolean;/);
  assert.match(SHEET, /busy = false,/);
  // The dismissal locks too — a sheet that could be closed mid-write would
  // leave a destructive transaction with nobody watching for its answer.
  assert.match(SHEET, /accessibilityLabel="Cancel"[\s\S]{0,200}disabled=\{busy\}/);
});

test('the sheet names what deleting costs and what it does not touch', () => {
  assert.match(SHEET, /\{storeConsequence\(wears\)\} \{deleteConsequence\(wears\)\}/);
});

test('a failed delete states that nothing was partly removed', () => {
  const del = ROUTE.slice(ROUTE.indexOf('const deleteForever'));
  assert.match(del.slice(0, 1600), /DELETE_FAILURE_COPY\.title, DELETE_FAILURE_COPY\.body/);
  // And it stays on the piece rather than navigating away from a piece that
  // is still there.
  assert.doesNotMatch(del.slice(0, 1600), /onError[\s\S]{0,300}router\.back\(\)/);
});

test('storage and delete both report whether they landed', () => {
  assert.match(ROUTE, /storedProps\(true\)/);
  assert.match(ROUTE, /storedProps\(false\)/);
  assert.match(ROUTE, /deletedProps\(true\)/);
  assert.match(ROUTE, /deletedProps\(false\)/);
});

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

test('the hero prefers listing, then the owner photograph', () => {
  assert.match(ROUTE, /resolve\(item\?\.listingPath, item\?\.cutoutPath, item\?\.thumbPath\)/);
});

test('one signing request covers the hero and the whole rail', () => {
  // Fewer round trips, and — the part that matters here — one place where a
  // signed URL exists at all.
  assert.equal((ROUTE.match(/useSignedUrls\(/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

test('no new package, permission, vendor or billing surface', () => {
  assert.doesNotMatch(ROUTE_RAW, /expo-location|expo-notifications|expo-contacts|Superwall|Placement|useGate/);
  assert.doesNotMatch(ROUTE_RAW, /requestPermission|Permissions\./);
});

test('nothing on this page is public or enters a social payload', () => {
  assert.doesNotMatch(ROUTE, /public_|share_to|publish|visibility: 'public'/);
});

test('ZERO BACKEND CHANGE — no new table, RPC, view, policy or grant', () => {
  // The one Supabase call on this screen is the existing edge function that
  // detaches a listing photograph; everything else goes through the existing
  // query and mutation layers under the owner's own RLS.
  const calls = ROUTE.match(/supabase\.[\w.]+\(/g) ?? [];
  assert.deepEqual(calls, ['supabase.functions.invoke('], `unexpected Supabase surface: ${calls.join(', ')}`);
  assert.doesNotMatch(ROUTE, /\.rpc\(/);
});
