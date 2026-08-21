/**
 * Redesign 23 — Add clothes (the chooser), against its accepted artifact.
 *
 * `design-refs/redesign-2026-08/23-add-clothes-choice/`. The artifact is the
 * contract: spacing, colour, type, radii, order and copy. What a test can hold
 * of that is the half that is DATA — the measurements and the sentences, which
 * live in `features/ingest/add-clothes-spec.ts` precisely so they can be read
 * here — plus the structural refusals the frame states in prose and a screen
 * can quietly break.
 *
 * The three things this exists to catch, in order of how expensive they are:
 *
 *   1. A PEER BECOMING A FAVOURITE. The equal-doors rule is the one law the
 *      brief names twice, and it fails silently: a `tone`, a size, an order,
 *      and the screenshot still looks fine to whoever made the change.
 *   2. THE VOICE CONSENT LINE DRIFTING. It names the transcription service and
 *      it is legal copy. It has been trimmed once already and restored once
 *      already. It is asserted byte for byte, and this file also asserts the
 *      chooser does not grow a second copy of it.
 *   3. A DOOR GROUND THAT FAILS AA. The artifact's own door tints put `muted`
 *      at 4.47:1 under the door name. The ship uses `sand`, and the arithmetic
 *      for both is pinned here so the next person to "restore the frame's
 *      colour" meets the reason rather than rediscovering it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  AC,
  ART,
  CAMERA_BLOCKED_ACTION,
  CAMERA_BLOCKED_LINE,
  CAMERA_MODULE_ACTION,
  CAMERA_MODULE_LINE,
  LOCAL_MODE_ACTION,
  LOCAL_MODE_LINE,
  PEER_LINE,
  SHELF_FULL_ACTION,
  SHELF_FULL_TITLE,
  capacityColophon,
} from '../src/features/ingest/add-clothes-spec';
import { CATALOGUE_DISCLOSURE, INTAKE_ROUTES } from '../src/features/ingest/intake-routes';
import { WALKTHROUGH_INVITATION } from '../src/features/intake/walkthrough-copy';
import { light } from '../src/theme/palette';
import { AA_TEXT, contrastRatio } from '../src/theme/contrast';

const read = (p: string) => readFileSync(p, 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SCREEN = 'src/app/add-clothes.tsx';
const PLATE = 'src/components/ui/door-plate.tsx';
const ART_FILE = 'src/components/ingest/door-art.tsx';
const SPEC = 'src/features/ingest/add-clothes-spec.ts';

// ---------------------------------------------------------------------------
// 1 · The copy table, verbatim
// ---------------------------------------------------------------------------

test('every sentence matches the artifact’s copy table', () => {
  assert.equal(PEER_LINE, 'Four ways in. Any of them works.');
  assert.equal(
    CAMERA_BLOCKED_LINE,
    'Camera access is off for Cinch. Photo library, product search and voice still work.',
  );
  assert.equal(CAMERA_BLOCKED_ACTION, 'Open Settings');
  assert.equal(
    CAMERA_MODULE_LINE,
    'This build has no camera module. Updating Cinch will bring it back.',
  );
  assert.equal(CAMERA_MODULE_ACTION, 'How to update');
  assert.equal(
    LOCAL_MODE_LINE,
    'Photographs stay on this device. You’ll type the category, color and fabric yourself.',
  );
  assert.equal(LOCAL_MODE_ACTION, 'Change this');
  // The four door names and lines come from the shared intake table, which is
  // what stops this screen and The Ten from drifting apart. Checked against the
  // artifact here so a change to that table has to argue with the frame.
  const byKey = Object.fromEntries(INTAKE_ROUTES.map((r) => [r.key, r]));
  assert.equal(byKey.catalogue.name, 'Find a product photo');
  assert.equal(byKey.catalogue.line, 'Say or type a piece and Cinch finds licensed shop photos');
  assert.equal(byKey.camera.name, 'Camera');
  assert.equal(byKey.camera.line, 'Photograph a piece against any wall');
  assert.equal(byKey.library.name, 'Photo library');
  assert.equal(byKey.library.line, 'Pick pictures you already have — no permission needed');
  assert.equal(byKey.voice.name, 'Describe by voice');
  assert.equal(byKey.voice.line, 'Say it out loud instead of typing');
  assert.equal(
    CATALOGUE_DISCLOSURE,
    'Product search reads a licensed shop catalog only. It is not a web search, and nothing you type is sent to an AI model.',
  );
});

test('the colophon is a count and never a meter', () => {
  // "Real used and limit for active pieces, set as a quiet colophon. Never a
  // bar, a percentage, a streak or a countdown."
  assert.equal(capacityColophon(12, 30), '12 of 30 active pieces');
  assert.equal(capacityColophon(30, 30), '30 of 30 active pieces');
  const src = code(SCREEN);
  for (const forbidden of [/ProgressTrack/, /%/, /\bstreak\b/i, /remaining/]) {
    assert.ok(!forbidden.test(src), `the colophon grew a ${forbidden}`);
  }
  // Omitted, not guessed, while the query is unresolved.
  assert.match(src, /capacity\.loading \? null :/);
});

// ---------------------------------------------------------------------------
// 2 · The voice consent line — legal copy, and the reason this file is careful
// ---------------------------------------------------------------------------

test('the voice consent sentence is byte-identical and lives in exactly one place', () => {
  assert.equal(
    WALKTHROUGH_INVITATION.consent,
    'The recording goes to the service that turns speech into text, then to the model that reads the list.',
  );
  // The artifact draws that sentence on a handoff sheet over THIS screen. It
  // ships where it already ships — above the record action in the walkthrough —
  // and the chooser must not grow a second copy: two copies is how one of them
  // gets trimmed and nobody notices which.
  for (const file of [SCREEN, SPEC, 'src/dev-fixtures/ac-frames.tsx']) {
    assert.ok(
      !/turns speech into text/.test(read(file)),
      `${file} carries a second copy of the voice consent line`,
    );
  }
  // And the voice door still lands on the surface that does carry it.
  assert.match(code(SCREEN), /router\.push\('\/walkthrough'\)/);
});

// ---------------------------------------------------------------------------
// 3 · Equal doors
// ---------------------------------------------------------------------------

test('the four peers are drawn identically, and only the lead door is accented', () => {
  const src = code(SCREEN);
  // Five plates: the four peers plus The Ten. Exactly one carries a tone, and
  // it is the one immediately followed by The Ten's name.
  const plates = src.match(/<DoorPlate[\s\S]*?\/>/g) ?? [];
  assert.equal(plates.length, 5, `expected five plates, found ${plates.length}`);
  const accented = plates.filter((p) => /tone=/.test(p));
  assert.equal(accented.length, 1, 'more than one plate carries a tone');
  assert.match(accented[0]!, /tone="accent"/);
  assert.match(accented[0]!, /name="The Ten"/);

  // The four peers name no tone, no size, no width and nothing that could
  // promote one of them. `subdued` is allowed and is not promotion — it is the
  // camera door stepping BACK when its method is unavailable, and it never
  // disables anything (asserted below).
  for (const plate of plates.filter((p) => !/tone=/.test(p))) {
    for (const forbidden of [/tone=/, /width/i, /height/i, /RECOMMENDED/, /badge/i]) {
      assert.ok(!forbidden.test(plate), `a peer door names ${forbidden}`);
    }
  }
  // The order is the shared table's, and the table is the contract.
  assert.deepEqual(
    INTAKE_ROUTES.map((r) => r.key),
    ['catalogue', 'camera', 'library', 'voice'],
  );
  const positions = INTAKE_ROUTES.map((r) => src.indexOf(`ROUTE.${r.key}.name`));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    'the doors are drawn out of the table’s order',
  );
  assert.ok(positions.every((p) => p > -1), 'a door is not drawn from the table');
});

test('no door is ever disabled — not by capacity, not by permission', () => {
  // W-02: capacity is settled after the garment exists, never at the door, so
  // acquiring is never blocked here. And a blocked camera still opens a screen
  // — `/capture` or `/camera-unavailable` — rather than dead-ending.
  const src = code(SCREEN);
  for (const plate of src.match(/<DoorPlate[\s\S]*?\/>/g) ?? []) {
    assert.ok(!/disabled/.test(plate), 'a door is disabled');
    assert.ok(!/capacity\.full/.test(plate), 'a door is gated on capacity');
  }
  assert.ok(!/disabled/.test(code(PLATE)), 'the plate primitive grew a disabled state');
  // `subdued` is documented as visual only, on the primitive itself.
  assert.match(read(PLATE), /It does NOT disable anything/);
});

// ---------------------------------------------------------------------------
// 4 · Colour — the deviation, and its arithmetic
// ---------------------------------------------------------------------------

test('the door ground is `sand`, and the artifact’s own tints would fail AA', () => {
  // The method line under every door name is `muted` at 13px. It is not large
  // text and it does not get the 3:1 allowance.
  assert.ok(
    contrastRatio(light.muted, light.sand) >= AA_TEXT,
    'muted no longer clears AA on the door ground',
  );
  // The frame's four tints, in the order it draws them. The second one is the
  // failure, and it is why all four doors ship on one palette token instead.
  const DRAWN = ['#EFE7DC', '#E9E3D8', '#EDE6DA', '#F0E8DF'];
  const failing = DRAWN.filter((hex) => contrastRatio(light.muted, hex) < AA_TEXT);
  assert.deepEqual(failing, ['#E9E3D8'], 'the frame’s tints no longer behave as recorded');
  // And the plate spends the token rather than a literal.
  assert.match(code(PLATE), /theme\.sand/);
  assert.match(code(PLATE), /theme\.accent/);
});

test('the drawn tiles reconcile with the palette where they can', () => {
  assert.equal(ART.clay, light.accentWarm, 'the clay in the drawings drifted from accentWarm');
  assert.equal(ART.oxblood, light.accent, 'the oxblood in the drawings drifted from accent');
});

test('no hex is typed outside the spec', () => {
  // The wave's no-hex rule. Every colour on this page is either a palette token
  // or a named entry in `ART`, so a fill is always traceable to an argument.
  for (const file of [SCREEN, PLATE, ART_FILE, 'src/dev-fixtures/ac-frames.tsx']) {
    const hexes = code(file).match(/#[0-9A-Fa-f]{6}/g) ?? [];
    assert.deepEqual(hexes, [], `${file} types a hex: ${hexes.join(', ')}`);
  }
});

// ---------------------------------------------------------------------------
// 5 · Geometry
// ---------------------------------------------------------------------------

test('the measurements are the artifact’s', () => {
  assert.equal(AC.doorGap, 10);
  assert.equal(AC.leadBottom, 14);
  assert.equal(AC.peerLineBottom, 10);
  assert.equal(AC.disclosureRadius, 12);
  assert.equal(AC.disclosurePadV, 12);
  assert.equal(AC.disclosurePadH, 14);
  assert.equal(AC.colophonSize, 13);

  // The plate's own geometry lives with the plate. Read as literals rather than
  // exported, because nothing outside that file may set them.
  const plate = read(PLATE);
  for (const [name, value] of [
    ['PLATE_RADIUS', 16],
    ['PAD_V', 13],
    ['PAD_H', 15],
    ['TILE_W', 74],
    ['TILE_H', 78],
    ['TILE_RADIUS', 11],
    ['TILE_GAP', 14],
    ['CONDITION_INSET', 11],
    ['CONDITION_RADIUS', 11],
  ] as const) {
    assert.match(
      plate,
      new RegExp(`const ${name} = ${value};`),
      `${name} is no longer ${value}`,
    );
  }
});

test('every target clears the 44pt floor', () => {
  const plate = code(PLATE);
  // The whole plate is the target, and the condition's recovery has a floor of
  // its own because it sits under a sentence whose height moves with Dynamic
  // Type.
  assert.equal(plate.match(/minHeight: MIN_TAP_TARGET/g)?.length, 2);
  assert.match(code(SCREEN), /minHeight: MIN_TAP_TARGET/);
});

// ---------------------------------------------------------------------------
// 6 · Motion, and the accessibility settings the frame draws
// ---------------------------------------------------------------------------

test('the entry motion is guarded, and Reduce Motion gets the fade the frame draws', () => {
  const src = code(SCREEN);
  assert.match(src, /useReducedMotion/);
  assert.match(src, /reduced\s*\?\s*FadeIn/);
  assert.match(src, /FadeInDown/);
  // Composition, order and every target are identical either way: the guard
  // swaps the animation, never the tree.
  assert.ok(!/reduced \?[\s\S]{0,200}<DoorPlate/.test(src), 'Reduce Motion changes the layout');
});

test('the increased-contrast frame needs no theme system', () => {
  // The artifact's `dark-increased-contrast` export is pixel-for-pixel its
  // light default: "warm paper is retained — Cinch has no dark mode". So there
  // is nothing to build, and above all no second appearance to introduce.
  for (const file of [SCREEN, PLATE, ART_FILE, SPEC]) {
    assert.ok(!/dark:/.test(read(file)), `${file} reintroduces a dark variant`);
  }
});

// ---------------------------------------------------------------------------
// 7 · Nothing native, nothing new in the bundle
// ---------------------------------------------------------------------------

test('the page ships over the air — no package, no asset, no image request', () => {
  const art = read(ART_FILE);
  // The tiles are Views with a radius and a fill. No SVG library, no bundled
  // asset, and nothing that can fail to load — which is why the artifact's
  // private-image fallback state has no counterpart to build.
  assert.ok(!/react-native-svg|expo-image|require\(/.test(art), 'the drawings grew a dependency');
  assert.match(art, /from 'react-native'/);
  // And package.json is untouched by this packet. `react-native-svg` is already
  // installed for other screens, so its absence is not what proves anything —
  // the drawings not reaching for it is, which is the assertion above.
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  const before = new Set(Object.keys(pkg.dependencies));
  for (const added of ['expo-svg', 'lottie-react-native', 'react-native-vector-icons']) {
    assert.ok(!before.has(added), `${added} was added for this page`);
  }
});

// ---------------------------------------------------------------------------
// 8 · The fixtures
// ---------------------------------------------------------------------------

test('every drawn state has a fixture, and every fixture is in the index', () => {
  const fixtures = readdirSync('src/dev-fixtures')
    .filter((f) => f.startsWith('dev-ac-') && f.endsWith('.tsx'))
    .map((f) => f.slice(0, -'.tsx'.length))
    .sort();
  assert.equal(fixtures.length, 8, `redesign 23 fixtures: ${fixtures.join(', ')}`);
  const index = read('src/dev-fixtures/dev-screens.tsx');
  for (const f of fixtures) assert.ok(index.includes(`'/${f}'`), `${f} is not in the index`);
  // The poses draw the real primitives and read the real tables, so a fixture
  // cannot pose copy the screen does not ship.
  const frames = read('src/dev-fixtures/ac-frames.tsx');
  assert.match(frames, /from '@\/features\/ingest\/add-clothes-spec'/);
  assert.match(frames, /from '@\/features\/ingest\/intake-routes'/);
  assert.match(frames, /from '@\/components\/ui'/);
});

test('the shelf-full recovery survives the redesign', () => {
  // The artifact draws no notice at the cap at all, which would take `/storage`
  // — the only free remedy, and the only thing that names it — with it. The
  // sentences are the shipped ones and the route is still reached.
  assert.equal(SHELF_FULL_TITLE, 'The active shelf is full');
  assert.equal(SHELF_FULL_ACTION, 'See stored');
  assert.match(code(SCREEN), /router\.push\('\/storage'\)/);
});
