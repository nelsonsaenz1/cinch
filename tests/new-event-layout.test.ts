/**
 * New Event — the properties that keep the composer's rows whole.
 *
 * Written to the same shape as `people-search-layout.test.ts`, and for a
 * sharper reason: this is the page with a documented CLIPPING history. The
 * launch-polish packet found field text cut at the descenders, and the brief
 * for redesign 02 says so in as many words — "this page has a clipping
 * history. Field text must survive descenders at AX3 — no fixed row heights;
 * minHeight + padding so rows grow."
 *
 * A screenshot verifies that for the words that happened to be on screen at
 * the size the simulator happened to be set to. These assertions verify it for
 * the data and the type sizes nobody has tried yet, which is the half a
 * photograph cannot cover — and they verify the OTHER half of the same
 * bargain, the one People Search was rebuilt to close: a flexible column that
 * can grow must also be able to shrink, or the fixed thing beside it is drawn
 * over somebody's venue.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canCreateEvent,
  CHECK_TILE,
  COPY,
  CTA_MIN_HEIGHT,
  dateRowValue,
  guestDiscs,
  guestSummary,
  newEventStacked,
  ROW_GAP,
  ROW_MIN_HEIGHT,
  ROW_RADIUS,
  venueRowValue,
} from '../src/features/events/new-event-spec.ts';

const RAW = readFileSync('src/components/events/new-event-body.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(RAW);

// ---------------------------------------------------------------------------
// The layout bargain
// ---------------------------------------------------------------------------

test('a text column that can grow is a text column that can shrink', () => {
  // `flex: 1` alone does not permit a text node to go narrower than its
  // content in every RN layout path; `minWidth: 0` is what makes the shrink
  // actually available. Every flexible column on this page states both.
  const flexColumns = CODE.match(/flex: (?:1|large \? undefined : 1)[^}]*}/g) ?? [];
  assert.ok(
    flexColumns.length >= 3,
    `expected the row value column, the guest summary and the notice — got ${flexColumns.length}`,
  );
  for (const column of flexColumns) {
    assert.match(column, /minWidth: 0/, `a flexible column without minWidth: 0 — ${column}`);
  }
});

test('the fixed parts of a row keep their points explicitly', () => {
  // The other half of the same bargain: if the check tile, the guest discs and
  // the notice's dot do not say they are fixed, the text column is not the one
  // that gives and the loser is drawn over.
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 4,
    'the check tile, the disc row, each disc and the notice dot each need it',
  );
});

test('at standard size a row value truncates; at the accessibility sizes it wraps', () => {
  // The governing contract, verbatim from the page it was written for: "In
  // every case composition changes and height is allowed. Nothing is capped,
  // truncated, ellipsised or scaled below its documented size."
  assert.ok(
    (CODE.match(/numberOfLines=\{large \? undefined : 1\}/g) ?? []).length >= 3,
    'the eyebrow, the value and the guest summary each stop truncating at large type',
  );
  assert.match(CODE, /flexDirection: large \|\| !answered \? 'column' : 'row'/, 'rows stack');
  assert.match(CODE, /quiet \|\| large \? null : <CheckTile \/>/, 'the mark stands down');
});

// ---------------------------------------------------------------------------
// The clipping history
// ---------------------------------------------------------------------------

test('no row on this page has a height', () => {
  // THE BUG THIS PAGE IS KNOWN FOR. A fixed `height` is a promise about how
  // tall a line of text is, and Dynamic Type does not let the app keep it:
  // at AX3 the box stops growing and the glyphs' descenders are cut by it.
  // Every box here states a FLOOR instead, and pays more padding below the
  // baseline than above it so `g`, `y`, `p` and `j` land inside the ground.
  assert.doesNotMatch(CODE, /\bheight: ROW_MIN_HEIGHT\b/, 'a row was given a height');
  assert.doesNotMatch(CODE, /\bheight: CTA_MIN_HEIGHT\b/, 'the CTA was given a height');
  assert.ok(
    (CODE.match(/minHeight: ROW_MIN_HEIGHT/g) ?? []).length >= 2,
    'every row states its floor',
  );
  assert.match(CODE, /minHeight: CTA_MIN_HEIGHT/);

  // A `height:` on anything that carries type at all. The guest disc and the
  // check tile are the sanctioned exceptions — both are marks with no text
  // that grows, and both are square by construction.
  const heights = CODE.match(/\bheight: [^,\n]+/g) ?? [];
  for (const line of heights) {
    assert.match(
      line,
      /GUEST_DISC|CHECK_TILE|\b9\b/,
      `a fixed height under something that carries type — ${line}`,
    );
  }
});

test('every row and every control clears the 44pt floor', () => {
  // 56 is the brief's own figure and it is comfortably past Apple's 44. The
  // hand-rolled Cancel is the one control that does not get its floor from
  // `PressableSurface`, so it has to say so.
  assert.ok(ROW_MIN_HEIGHT >= 44, 'a row row below the tap floor');
  assert.ok(CTA_MIN_HEIGHT >= 44, 'the CTA is below the tap floor');
  assert.match(CODE, /minHeight: MIN_TAP_TARGET/, 'the Cancel target is not floored');
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('no colour on this page is a literal', () => {
  // Every fill and every type colour comes from `useTheme()` or a derived
  // alpha helper. The artifact's hexes ARE the tokens' hexes, which is why
  // typing one would be invisible until the palette moved.
  assert.doesNotMatch(CODE, /#[0-9a-fA-F]{3,8}\b/, 'a hardcoded colour');
  assert.doesNotMatch(CODE, /rgba\(/, 'a hand-composited colour');
  // The artifact's amber, derived rather than eyedropped — the same move
  // People Search's OFFLINE pill makes.
  assert.match(CODE, /warningAlpha\(0\.22\)/);
  assert.doesNotMatch(CODE, /F5E4C8|7A5312|B98A2A/, 'a hex from the artifact reached the app');
});

test('clay never carries type on this page', () => {
  // `theme/contrast.ts` declares `accentWarm` `text: false` — 2.98:1 on canvas
  // and 2.71:1 on blush. The artifact draws its eyebrows in clay and this is
  // the one place the frames are overruled; the token stays as a FILL only,
  // which is the progress bar.
  assert.doesNotMatch(CODE, /color: theme\.accentWarm/, 'clay set as type');
  assert.match(CODE, /backgroundColor: theme\.accentWarm/, 'clay is still the progress fill');
});

test('the page spends one oxblood ground, and the marks are marks', () => {
  // The constitution's rule. The CTA is the ground; the check tile is a 20pt
  // square, which is what the artifact itself draws and what the brief means
  // by "small marks, not grounds".
  const grounds = CODE.match(/backgroundColor: enabled \? theme\.accent : theme\.sand/g) ?? [];
  assert.equal(grounds.length, 1, 'the CTA is the single accent ground');
  assert.ok(CHECK_TILE <= 24, 'the answered mark has grown into a ground');
});

// ---------------------------------------------------------------------------
// The decisions behind the drawing
// ---------------------------------------------------------------------------

test('an event may still float with no date at all', () => {
  // The brief's first Keep, and the one the accepted default frame could most
  // easily be misread as repealing: it shows a date answered because the
  // fixture has one, not because the composer requires one.
  assert.equal(canCreateEvent('Dinner at Contramar', false), true);
  assert.equal(canCreateEvent('   ', false), false, 'whitespace is not a name');
  assert.equal(canCreateEvent('', false), false);
  assert.equal(canCreateEvent('Dinner', true), false, 'no second press mid-flight');
  assert.equal(dateRowValue(null), null, 'a dateless event prints no date');
});

test('the composer becomes its large-type self at the app’s one threshold', () => {
  assert.equal(newEventStacked(1.0), false);
  assert.equal(newEventStacked(1.35), false, 'the standard range must not relayout');
  assert.equal(newEventStacked(1.5), true);
  assert.equal(newEventStacked(2.35), true, 'AX3 — the frame the artifact draws');
});

test('the guest row abbreviates faces and names separately', () => {
  const five = ['Priya Raghunathan', 'Marisol Delgado', 'Theo Okonkwo', 'Ines B', 'Joaquín P'];
  assert.deepEqual(guestDiscs(five), { initials: ['PR', 'MD', 'TO'], overflow: '+2' });
  assert.deepEqual(guestDiscs(['Priya Raghunathan']), { initials: ['PR'], overflow: null });
  assert.deepEqual(guestDiscs([]), { initials: [], overflow: null });

  // Given names only — a guest list is people the host already knows.
  assert.equal(guestSummary(five), 'Priya, Marisol +3 friends');
  assert.equal(guestSummary(five.slice(0, 3)), 'Priya, Marisol +1 friend');
  assert.equal(guestSummary(five.slice(0, 2)), 'Priya, Marisol');
  assert.equal(guestSummary([]), null, 'nobody is an unanswered row, not an empty one');
});

test('the venue row prints the address behind the name, and only when there is one', () => {
  assert.equal(venueRowValue('Contramar', 'Calle Durango 200'), 'Contramar, Calle Durango 200');
  assert.equal(venueRowValue('Contramar', null), 'Contramar');
  assert.equal(venueRowValue('  ', 'Calle Durango 200'), 'Calle Durango 200');
  assert.equal(venueRowValue('', null), null, 'an empty venue is an unanswered row');
});

test('the copy is the artifact’s, to the character', () => {
  assert.equal(COPY.prompt, 'What’s the occasion?');
  assert.equal(COPY.name, 'Name the event');
  assert.equal(COPY.optional, 'Optional');
  assert.equal(COPY.create, 'Create event');
  assert.equal(COPY.creating, 'Creating…');
  assert.equal(COPY.tryAgain, 'Try again');
  assert.equal(COPY.errorTitle, 'Couldn’t create the event');
  assert.equal(COPY.errorBody, 'Your draft is saved on this device.');
  assert.equal(COPY.guests, 'Who’s going');
  assert.equal(ROW_RADIUS, 16, 'the artifact’s row radius');
  assert.equal(ROW_GAP, 10, 'the artifact’s row gap');
});

test('the sheet does not reach for expo-haptics, and the commit is not on the tap', () => {
  // `lib/haptics` is the only door onto the taptic engine, and the success
  // notification belongs to the SERVER's answer — it fires in the route's
  // `onSuccess`, never in the button.
  assert.doesNotMatch(CODE, /expo-haptics/);
  const route = code(readFileSync('src/app/event/new.tsx', 'utf8'));
  assert.doesNotMatch(route, /expo-haptics/);
  assert.match(route, /onSuccess: async \(eventId\) => \{[\s\S]*?haptics\.success\(\)/);
});

test('the draft survives leaving, exactly as it did', () => {
  // The brief's third Keep. One `beforeRemove` guard for the text Cancel, the
  // dismiss gesture and any programmatic navigation; the store cleared only
  // after the insert is acknowledged.
  const route = code(readFileSync('src/app/event/new.tsx', 'utf8'));
  assert.match(route, /navigation\.addListener\('beforeRemove'/);
  assert.match(route, /event\.preventDefault\(\)/);
  assert.match(route, /<DiscardSheet/);
  assert.match(route, /EVENT_DRAFT_DEBOUNCE_MS/);
  // Cleared inside the success callback and nowhere earlier.
  assert.match(route, /onSuccess: async \(eventId\) => \{[\s\S]*?store\.clear\(userId\)/);
});

test('the create mutation’s contract is untouched by the guest picker', () => {
  // "Do not add new backend calls, tables, or fields." The invites ride the
  // EXISTING batch mutation, after the event exists — the create input is the
  // same seven keys it always was.
  const route = code(readFileSync('src/app/event/new.tsx', 'utf8'));
  assert.match(route, /useInviteMembers/);
  assert.match(route, /invite\.mutateAsync\(\{ eventId, userIds: guestIds \}\)/);
  const input = route.slice(route.indexOf('create.mutate('), route.indexOf('onSuccess:'));
  for (const key of ['title', 'startsAt', 'dressCode', 'note', 'venueName', 'venueAddress', 'venueMeta']) {
    assert.ok(input.includes(`${key}`), `the create input dropped ${key}`);
  }
  assert.doesNotMatch(input, /guest|invitee|userIds/, 'the guest list reached the create insert');
});

// ---------------------------------------------------------------------------
// The venue field and the keyboard
// ---------------------------------------------------------------------------
//
// The founder's item 10, reported from the composer: tap Where, start typing,
// and both the field and MapKit's suggestion list are behind the keyboard —
// you cannot see what you are typing or what it is offering.
//
// The cause is structural rather than a missing prop. `SheetShell` is a
// bottom-anchored `<Modal>` (`flex-1 justify-end`), so it sits ON the bottom
// edge of the screen and the keyboard comes up over it. Nothing inside the
// sheet could fix that: `automaticallyAdjustKeyboardInsets` insets a scroll
// view's content, and the problem is that the sheet's own frame never moved.
//
// So the fix is two things and both are pinned below: the shell lifts, and
// what is inside it scrolls. Each is asked of the file that owns it.

test('the place sheet lifts above the keyboard, and the pickers do not', () => {
  const shell = code(readFileSync('src/components/events/date-sheet.tsx', 'utf8'));
  const sheet = code(readFileSync('src/components/events/place-sheet.tsx', 'utf8'));

  // OPT-IN, not always-on. The date, time and discard sheets have no input in
  // them, and a picker that jumps when a keyboard opens elsewhere in the app
  // would be a new bug traded for the old one.
  assert.match(shell, /avoidKeyboard/, 'the shell cannot lift at all');
  assert.match(shell, /KeyboardAvoidingScreen/, 'the shell invented its own avoidance');
  assert.match(sheet, /avoidKeyboard/, 'the one sheet with a field in it does not lift');

  const pickers = code(readFileSync('src/components/events/time-sheet.tsx', 'utf8'));
  assert.doesNotMatch(pickers, /avoidKeyboard/, 'a sheet with no field in it lifts');
  const discard = code(readFileSync('src/components/events/discard-sheet.tsx', 'utf8'));
  assert.doesNotMatch(discard, /avoidKeyboard/, 'the confirmation lifts');
});

test('the lifted sheet drops the home-indicator inset it no longer needs', () => {
  // Lifting puts the sheet's bottom edge on the keyboard's top edge, where
  // there is no indicator to clear. Keeping the 34pt inset there leaves that
  // much dead paper between the last suggestion and the keys — which is
  // exactly the space the panel needs at the accessibility sizes.
  const shell = code(readFileSync('src/components/events/date-sheet.tsx', 'utf8'));
  assert.match(shell, /paddingBottom: keyboardUp \? 24 : Math\.max\(insets\.bottom, 24\)/);
  // `will`, not `did`: the padding has to change in the frames the keyboard is
  // animating in, not after it lands.
  assert.match(shell, /keyboardWillShow/);
  assert.match(shell, /keyboardWillHide/);
});

test('the venue results scroll, and one tap still picks a place', () => {
  const sheet = code(readFileSync('src/components/events/place-sheet.tsx', 'utf8'));
  assert.match(sheet, /<ScrollView/, 'the panel cannot scroll');
  assert.match(sheet, /maxHeight: PANEL_MAX_HEIGHT/, 'the panel has no ceiling');

  // THE ONE PROP THAT MAKES THE ROWS STILL WORK. Inside a scroll view the
  // first tap on a suggestion is otherwise swallowed dismissing the keyboard,
  // so choosing a place would take two taps and read as a dead row.
  assert.match(sheet, /keyboardShouldPersistTaps="handled"/);

  // And the two mechanisms never compound: the shell lifts OR a scroll view
  // insets itself, never both, or the sheet moves twice.
  assert.doesNotMatch(sheet, /automaticallyAdjustKeyboardInsets|KeyboardAwareScrollView/);
});
