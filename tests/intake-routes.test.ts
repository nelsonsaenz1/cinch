/**
 * AC-C1 / TN-C1 / DS-C1–C3 — four equal doors, and a route that says what it is.
 *
 * Two of these assertions exist because of specific things that went wrong.
 *
 * THE DOORS DRIFTED. Add clothes offered four routes and The Ten offered two,
 * for months, because each screen wrote its own list. So the test that matters
 * is not "The Ten draws four doors" — it is that neither screen can write a
 * door of its own, which is what makes them stay equal.
 *
 * THE DEEP LINK WENT NOWHERE. `/add-clothes?door=describe` was pushed from
 * three surfaces and read by none, so every "Describe it instead" button on
 * every camera-failure screen dropped the reader on a menu.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addToFlowLabel,
  CATALOGUE_DISCLOSURE,
  CATALOGUE_ROUTE_NAME,
  INTAKE_FORBIDDEN_PHRASES,
  INTAKE_ROUTES,
} from '../src/features/ingest/intake-routes';

const read = (p: string) => readFileSync(p, 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Every surface that offers the four. */
const CHOOSERS = [
  'src/app/add-clothes.tsx',
  'src/components/onboarding/first-ten-doors.tsx',
  'src/dev-fixtures/dev-add-clothes.tsx',
];

// ---------------------------------------------------------------------------
// Four routes, one table, one order
// ---------------------------------------------------------------------------

test('the four routes are the four, in the fixed order', () => {
  // CX-01 moved the catalogue to the front. The order is still the contract —
  // it is simply a different one, and both surfaces read it from here.
  assert.deepEqual(
    INTAKE_ROUTES.map((r) => r.key),
    ['catalogue', 'camera', 'library', 'voice'],
  );
  assert.equal(INTAKE_ROUTES.length, 4);
  // Every route carries both subtitles: Add clothes files one piece, The Ten
  // is walking somebody to ten, and the same sentence cannot do both jobs.
  for (const r of INTAKE_ROUTES) {
    assert.ok(r.line.length > 0, `${r.key} has no Add clothes line`);
    assert.ok(r.tenLine.length > 0, `${r.key} has no Ten line`);
    assert.ok(r.accessibilityLabel.startsWith(r.name), `${r.key}'s label does not open with it`);
  }
});

test('no chooser writes a door of its own', () => {
  // The drift-proofing. A surface that retypes a name is a surface that will
  // still say "Describe it" after the next rename — which is exactly how The
  // Ten ended up two doors short of Add clothes.
  for (const f of CHOOSERS) {
    assert.match(code(f), /INTAKE_ROUTES/, `${f} does not read the shared table`);
  }
});

test('The Ten opens with all four, not with two', () => {
  const src = code('src/components/onboarding/first-ten-doors.tsx');
  /**
   * CX-01 splits the four into one recommendation and three alternatives, so
   * the old "map the whole table, never filter it" check no longer describes a
   * correct render. What still has to be true is that FOUR routes are offered
   * and none is dropped, so the partition is checked instead: the recommended
   * one is found by key, the rest is the complement of that same key, and
   * nothing slices by index.
   */
  assert.match(src, /INTAKE_ROUTES\.find\(\(r\) => r\.key === TEN_RECOMMENDED_KEY\)/);
  assert.match(src, /INTAKE_ROUTES\.filter\(\(r\) => r\.key !== TEN_RECOMMENDED_KEY\)/);
  assert.doesNotMatch(src, /INTAKE_ROUTES\.slice/);
  assert.doesNotMatch(src, /INTAKE_ROUTES\[\d\]/);
  // And every route reaches a real destination.
  const ten = code('src/app/the-ten.tsx');
  assert.match(ten, /onRoute=\{\(key\) =>/);
  for (const key of ['camera', 'voice', 'library']) {
    assert.match(ten, new RegExp(`'${key}'`), `The Ten does not handle ${key}`);
  }
});

test('the recommendation is made by edge and placement, never by dimming', () => {
  /**
   * CX-01 supersedes AC-C1's "no route is emphasised" — for THIS screen only,
   * and only in one direction. A first run is allowed a recommendation; it is
   * not allowed to win one by making the alternatives harder to read.
   *
   * So: the accent may appear (it is the plate's edge and its glyph), and the
   * three alternatives may not be faint, may not be shrunk below the tap
   * floor, and may not be dropped to a secondary ink.
   */
  const src = code('src/components/onboarding/first-ten-doors.tsx');
  assert.match(src, /borderColor: theme\.accent/, 'the recommendation has no accent edge');
  assert.doesNotMatch(src, /text-faint|theme\.faint/, 'an alternative was dimmed to faint');
  assert.match(src, /color: theme\.ink/, 'the alternatives are not drawn in full ink');
  assert.match(src, /Math\.max\(minHeight, MIN_TAP_TARGET\)/, 'a row may fall under 44pt');
});

test('Add clothes keeps four peers — the correction is The Ten’s alone', () => {
  // The reader who reaches Add clothes has a closet and a habit. Nothing there
  // recommends a route, and `DoorPlate` still draws all four.
  const src = code('src/app/add-clothes.tsx');
  assert.match(src, /INTAKE_ROUTES\.map/);
  assert.doesNotMatch(src, /TEN_RECOMMENDED_KEY/, 'the recommendation leaked into Add clothes');
});

// ---------------------------------------------------------------------------
// The catalogue route says what it is, and never what it is not
// ---------------------------------------------------------------------------

test('the catalogue route is named for what it fetches', () => {
  assert.equal(CATALOGUE_ROUTE_NAME, 'Find a product photo');
  // By key, not by index: the table's order is a contract that has now moved
  // once, and an index-based assertion re-breaks every time it does.
  assert.equal(
    INTAKE_ROUTES.find((r) => r.key === 'catalogue')?.name,
    CATALOGUE_ROUTE_NAME,
  );
  // The sheet it opens carries the same name, so the door and the screen behind
  // it are recognisably one thing.
  assert.match(code('src/components/ingest/garment-search-sheet.tsx'), /CATALOGUE_ROUTE_NAME/);
});

test('the disclosure travels with the control, on every surface that offers it', () => {
  assert.match(CATALOGUE_DISCLOSURE, /licensed shop catalogue/);
  assert.match(CATALOGUE_DISCLOSURE, /not a web search/);
  assert.match(CATALOGUE_DISCLOSURE, /nothing you type is sent to an AI model/);
  assert.match(
    code('src/app/add-clothes.tsx'),
    /CATALOGUE_DISCLOSURE/,
    'Add clothes offers the route without the disclosure',
  );
  /**
   * CX-01 deletes it from The Ten's chooser, and that loses nothing: the
   * DESTINATION states it in full, above the search field, at the moment
   * somebody is actually typing a brand into a licensed feed. That is where a
   * disclosure is actionable; on the chooser it was a claim quoted in advance
   * about a route the reader had not chosen yet.
   */
  const sheet = code('src/components/ingest/garment-search-sheet.tsx');
  assert.match(sheet, /licensed shop catalogue/);
  assert.match(sheet, /not a web search/);
  assert.match(sheet, /not sent to an AI model/);
});

test('no intake surface makes a web-search or AI claim about itself', () => {
  // The prohibited phrases would each be FALSE here, which is the point: the
  // search runs against a licensed product feed and fails closed, and the words
  // typed go to that feed as a query. A claim about where a photograph came
  // from has to be true before it is written.
  //
  // The disclosures themselves contain these phrases as DENIALS — "it is not a
  // web search", "nothing you type is sent to an AI model", "rather than
  // searching the open web". So the rule is checked per SENTENCE: a sentence
  // that names one of them must also negate it. A bare claim fails; a denial
  // passes; and a denial that later loses its "not" fails, which is the edit
  // this is really guarding against.
  const NEGATIONS = /\b(not|never|nothing|rather than|only)\b/i;

  // The COPY, not the modules — the forbidden list itself lives in one of those
  // files, and a test that flagged its own vocabulary would be unfixable.
  const copy: string[] = [
    CATALOGUE_DISCLOSURE,
    ...INTAKE_ROUTES.flatMap((r) => [
      r.name,
      r.tenName ?? r.name,
      r.line,
      r.tenLine,
      r.accessibilityLabel,
    ]),
    // Plus every rendered string on the catalogue screen itself.
    ...[...code('src/components/ingest/garment-search-sheet.tsx').matchAll(/>([^<>{}]{20,})</g)].map(
      (m) => m[1],
    ),
  ];

  for (const block of copy) {
    for (const sentence of block.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)) {
      for (const phrase of INTAKE_FORBIDDEN_PHRASES) {
        if (!sentence.toLowerCase().includes(phrase.toLowerCase())) continue;
        assert.match(sentence, NEGATIONS, `an intake surface claims "${phrase}": ${sentence}`);
      }
    }
  }
});

test('the results say the source, and the empty set says the rule', () => {
  const src = read('src/components/ingest/garment-search-sheet.tsx');
  // DS-C2: the count names WHICH listings, which is what separates this from a
  // shopping feed.
  assert.match(src, /licensed \$\{n === 1 \? 'listing' : 'listings'\}/);
  // The fail-closed rule, stated where somebody can read it — they cannot check
  // it for themselves.
  assert.match(src, /rather than searching the open web/);
  assert.match(src, /No licensed listing matches that/);
});

// ---------------------------------------------------------------------------
// DS-C3 — the way back into the flow the reader came from
// ---------------------------------------------------------------------------

test('the return action names the flow and carries the count', () => {
  assert.equal(
    addToFlowLabel({ origin: 'first-ten', used: 6, limit: 10 }),
    'Add to my first ten — 7 of 10',
  );
  assert.equal(addToFlowLabel({ origin: 'closet', used: 22, limit: 30 }), 'Add to my closet — 23 of 30');
  // A count that is not known is omitted, never guessed as a zero.
  assert.equal(addToFlowLabel({ origin: 'closet', used: null, limit: null }), 'Add to my closet');
  // At the ceiling the garment is HELD, not refused: the action becomes the
  // recovery rather than disappearing (the v3 rule).
  assert.equal(
    addToFlowLabel({ origin: 'closet', used: 30, limit: 30, full: true }),
    'Add — store a piece to make room',
  );
  // And it never exceeds the ceiling in its own arithmetic.
  assert.equal(addToFlowLabel({ origin: 'closet', used: 30, limit: 30 }), 'Add to my closet — 30 of 30');
});

test('the origin is threaded from The Ten all the way to the catalogue door', () => {
  // Three hops, and every one of them was a place the flow could be lost.
  //
  // The last hop moved. The catalogue door is `/find-photo` now, not a sheet
  // over the camera, so `from=ten` is carried into the route's own query string
  // instead of into a sheet prop. The chain is the same length and the same
  // fragility; only its destination changed.
  assert.match(code('src/app/the-ten.tsx'), /door=describe&from=ten/);
  assert.match(code('src/app/add-clothes.tsx'), /doorParams\.from === 'ten'/);
  assert.match(code('src/app/add-clothes.tsx'), /find-photo/);
  // And the destination reads it, so CPV2-08 can say "my first ten".
  assert.match(code('src/app/find-photo.tsx'), /params\.from === 'ten'/);
});

// ---------------------------------------------------------------------------
// The deep link that went nowhere
// ---------------------------------------------------------------------------

test('?door= actually opens a door now', () => {
  const src = code('src/app/add-clothes.tsx');
  assert.match(src, /useLocalSearchParams<\{ door\?: string; from\?: string \}>/);
  assert.match(src, /requestedDoor !== 'describe' && requestedDoor !== 'library'/);
  // THE LIBRARY DOOR STILL GOES THROUGH THE CONSENT GATE, because a photograph
  // really is about to be processed and a door reached by deep link must raise
  // the same sheet a tapped one does.
  assert.match(src, /openContentDoor\(`\/capture\?start=library/);
  // THE CATALOGUE DOOR NO LONGER DOES. Typed catalogue search is not AI
  // processing — Packet 1 moved `action: 'search'` above the server's consent
  // gate — so gating it would ask permission for something the destination does
  // not do, and would wall off the one intake route that works with AI
  // processing switched off. CPV2 §11 names the assumption directly.
  assert.match(src, /router\.push\(`\/find-photo/);
  // One-shot, so backing out of the destination leaves the reader on the
  // chooser rather than bouncing them straight back out of it.
  assert.match(src, /if \(handledDoor\.current\) return;/);
});

test('every surface that pushes ?door= pushes a value the chooser knows', () => {
  const KNOWN = new Set(['describe', 'library']);
  for (const f of [
    'src/app/the-ten.tsx',
    'src/app/camera-unavailable.tsx',
    'src/app/capture.tsx',
  ]) {
    for (const m of code(f).matchAll(/door=([a-z]+)/g)) {
      assert.ok(KNOWN.has(m[1]), `${f} pushes an unknown door "${m[1]}"`);
    }
  }
});

// ---------------------------------------------------------------------------
// TN-C1's one addition
// ---------------------------------------------------------------------------

test('The Ten\u2019s intro counts four routes and argues for none', () => {
  // It read "Both get to the same closet" and then weighed photographs against
  // speaking — written when this screen had two doors and left standing when it
  // grew to four, so it both miscounted them and recommended two of them.
  //
  // The replacement states the shared outcome and stops. "No route is
  // emphasised by colour, size or position" is undone by a sentence explaining
  // when to prefer one, whatever the plates look like.
  const { FIRST_TEN_DOORS } = require('../src/features/onboarding/ten-copy') as {
    FIRST_TEN_DOORS: { body: string; headline: string };
  };
  const body = FIRST_TEN_DOORS.body;
  assert.doesNotMatch(body, /\bBoth\b|\beither\b/i, 'the intro still counts two routes');
  assert.match(body, /same closet/, 'the intro no longer names the shared outcome');
  // No route named, so none can be recommended.
  for (const route of INTAKE_ROUTES) {
    assert.doesNotMatch(
      body,
      new RegExp(route.name, 'i'),
      `the intro singles out the ${route.key} route`,
    );
  }
  for (const word of ['photograph', 'speaking', 'quicker', 'faster', 'best', 'easiest']) {
    assert.ok(!body.toLowerCase().includes(word), `the intro argues for a route: "${word}"`);
  }
});

test('the chooser says one thing, and it is the reassurance', () => {
  /**
   * The mixing note is gone. CX-01 cut roughly seventy words off this screen —
   * a paragraph about doors, the note, the catalogue disclosure and a consent
   * footer — and what survives says the only thing a beginner needs before
   * tapping: whichever they pick, it ends up in the same place. Route-switching
   * is a fact about the app, not an instruction somebody needs at the moment
   * they are trying to add a jumper.
   */
  const { FIRST_TEN_DOORS } = require('../src/features/onboarding/ten-copy') as {
    FIRST_TEN_DOORS: { body: string };
  };
  assert.equal(FIRST_TEN_DOORS.body, 'Any route lands in the same closet.');
  const src = code('src/components/onboarding/first-ten-doors.tsx');
  assert.doesNotMatch(src, /TEN_MIXING_NOTE|CATALOGUE_DISCLOSURE|FIRST_TEN_DOORS\.footer/);
});
