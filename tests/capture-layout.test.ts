/**
 * Redesign 22 — capture, as decided and as wired.
 *
 * The frames are the contract and this is what holds the two halves of it that
 * a screenshot cannot check:
 *
 *   1. THE DECISIONS. Which rows a queue becomes, which words a count is said
 *      in, and when the celebration is allowed to fire — all pure, all in
 *      `capture-spec.ts`, all exercised directly here.
 *   2. THE LAW. The listing offer's trigger and routing, the invite line's
 *      condition, the permission fallbacks, the capability guard and the
 *      absence of any new native surface. Those are facts about the SOURCE, and
 *      they are asserted against it, because there is no runtime here that can
 *      mount a camera.
 *
 * `tests/camera-availability.test.ts` and `tests/camera-deferred.test.ts` hold
 * the capability guard's own structure and are not repeated. What is repeated
 * deliberately is the listing offer and the invite line: the brief calls both
 * "keep" and a redesign that moved them would pass every other test in the
 * suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CELEBRATION_AT,
  DECISION,
  PAGE,
  ROW_STATUS,
  VIEWFINDER,
  celebrationFor,
  filingRows,
  filingSubline,
  filingTitle,
  guideHeightFor,
  heldPill,
  pieces,
  resumeDiscard,
  reviewCta,
  settledTitle,
  spell,
  waitingTitle,
  type RowSource,
} from '../src/features/ingest/capture-spec';
import { MIN_TAP_TARGET } from '../src/theme/metrics';

/** Comments discuss every refusal at length; only code may be searched. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ROUTE = code('src/app/capture.tsx');
const PARTS = code('src/components/ingest/capture-parts.tsx');
const CARD = code('src/components/review/review-card.tsx');
const OFFER = code('src/components/match/listing-offer.tsx');
const ASK = code('src/components/ingest/camera-ask.tsx');

const job = (over: Partial<RowSource> & { id: string; stage: string }): RowSource => over;

// ---------------------------------------------------------------------------
// The rows — frames 07, 08, 17
// ---------------------------------------------------------------------------

test('a queue becomes one row per piece, in the queue’s own order', () => {
  const rows = filingRows([
    job({ id: 'a', stage: 'done', label: 'Camel coat', itemId: 'i1' }),
    job({ id: 'b', stage: 'uploading', label: 'Linen shirt' }),
    job({ id: 'c', stage: 'queued' }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.tone, r.status]),
    [
      ['a', 'filed', ROW_STATUS.filed],
      ['b', 'filing', ROW_STATUS.filing],
      ['c', 'waiting', ROW_STATUS.waiting],
    ],
  );
});

test('a garment is named only once the tagger has said what it is', () => {
  // The same rule the upload rail has always held. A row for a piece with no
  // label may not invent one, and an empty or whitespace label is not a name.
  const [blank, spaces] = filingRows([
    job({ id: 'a', stage: 'queued' }),
    job({ id: 'b', stage: 'queued', label: '   ' }),
  ]);
  assert.equal(blank!.label, 'Photograph');
  assert.equal(spaces!.label, 'Photograph');
});

test('a lost cut-out is its own tone, and only over a piece that was filed', () => {
  // CP-05's condition, carried into the row list unchanged: the notice claims
  // the piece is filed, so a job whose cut-out failed before the row existed
  // must not take the tone that says so.
  const rows = filingRows([
    job({ id: 'filed', stage: 'done', cutoutFailed: true, itemId: 'i1' }),
    job({ id: 'unfiled', stage: 'done', cutoutFailed: true }),
  ]);
  assert.equal(rows[0]!.tone, 'trouble');
  assert.equal(rows[0]!.status, 'Needs another photo');
  assert.equal(rows[1]!.tone, 'filed');
});

test('a settled failure is never dressed as a lost cut-out, or the reverse', () => {
  // The artifact's separation card. A job that failed outright takes the
  // waiting tone and is reported by the amber plate above the rows; it may not
  // borrow "Needs another photo", which promises a piece that IS filed.
  const [row] = filingRows([job({ id: 'a', stage: 'failed' })]);
  assert.equal(row!.tone, 'waiting');
  assert.notEqual(row!.status, ROW_STATUS.trouble);
});

test('offline says Held on everything unfinished and nothing else', () => {
  const rows = filingRows(
    [
      job({ id: 'a', stage: 'done', label: 'Camel coat', itemId: 'i1' }),
      job({ id: 'b', stage: 'queued', label: 'Linen shirt' }),
    ],
    { held: true },
  );
  assert.equal(rows[0]!.status, ROW_STATUS.filed);
  assert.equal(rows[1]!.status, 'Held');
});

// ---------------------------------------------------------------------------
// The counts — a count, never a percentage
// ---------------------------------------------------------------------------

test('the subline is a spelled count and zero segments are not printed', () => {
  const early = filingRows([
    job({ id: 'a', stage: 'done', itemId: 'i1' }),
    job({ id: 'b', stage: 'done', itemId: 'i2' }),
    job({ id: 'c', stage: 'queued' }),
    job({ id: 'd', stage: 'queued' }),
    job({ id: 'e', stage: 'queued' }),
    job({ id: 'f', stage: 'queued' }),
  ]);
  assert.equal(filingSubline(early), 'Two filed · four to go');

  const mixed = filingRows([
    job({ id: 'a', stage: 'done', itemId: 'i1' }),
    job({ id: 'b', stage: 'done', itemId: 'i2' }),
    job({ id: 'c', stage: 'done', itemId: 'i3' }),
    job({ id: 'd', stage: 'done', itemId: 'i4' }),
    job({ id: 'e', stage: 'done', itemId: 'i5', cutoutFailed: true }),
    job({ id: 'f', stage: 'tagging' }),
  ]);
  assert.equal(mixed.length, 6);
  assert.equal(filingSubline(mixed), 'Four filed · one needs another photo · one to go');

  // Nothing at all is silence, not "Zero filed".
  assert.equal(filingSubline([]), null);
});

test('no headline, subline or capsule can say a percentage', () => {
  const strings = [
    filingTitle(6),
    settledTitle(6),
    reviewCta(6),
    waitingTitle(3),
    resumeDiscard(4),
    heldPill(6),
    filingSubline(filingRows([job({ id: 'a', stage: 'done', itemId: 'i' })])) ?? '',
  ];
  for (const s of strings) assert.doesNotMatch(s, /%|percent/i, s);
});

test('the frames’ own spellings, exactly', () => {
  assert.equal(filingTitle(6), 'Filing six pieces');
  assert.equal(settledTitle(6), 'Six pieces filed');
  assert.equal(reviewCta(6), 'Review six pieces');
  assert.equal(waitingTitle(3), 'Three photographs waiting');
  assert.equal(resumeDiscard(4), 'Discard these four');
  assert.equal(heldPill(6), '6 held');
});

test('one is singular everywhere, and the pill is a label before it is a count', () => {
  assert.equal(pieces(1), 'one piece');
  assert.equal(filingTitle(1), 'Filing one piece');
  assert.equal(waitingTitle(1), 'One photograph waiting');
  assert.equal(resumeDiscard(1), 'Discard this one');
  // Nothing held: the pill carries the standing instruction, not "0 held".
  assert.equal(heldPill(0), 'Flat lay');
});

test('spelling stops at twelve, as the queue’s own table does', () => {
  assert.equal(spell(12), 'twelve');
  assert.equal(spell(13), '13');
  assert.equal(spell(20, 'upper'), '20');
});

// ---------------------------------------------------------------------------
// The celebration — three refusals
// ---------------------------------------------------------------------------

const settledAt = (over: Partial<Parameters<typeof celebrationFor>[0]>) =>
  celebrationFor({
    settled: true,
    unresolved: 0,
    closetCount: CELEBRATION_AT,
    closetBefore: CELEBRATION_AT - 4,
    ...over,
  });

test('the celebration fires on the crossing, with the CLOSET’s number', () => {
  assert.equal(settledAt({}), CELEBRATION_AT);
  // The claim is about what the user now owns, not about the batch.
  assert.equal(settledAt({ closetCount: 14, closetBefore: 8 }), 14);
});

test('nothing still filing, and nothing unresolved', () => {
  assert.equal(settledAt({ settled: false }), null);
  assert.equal(settledAt({ unresolved: 1 }), null);
});

test('a closet that was already large does not celebrate again', () => {
  // The fortieth import is not a milestone, and a screen in the way of it is
  // not a celebration.
  assert.equal(settledAt({ closetCount: 40, closetBefore: 34 }), null);
  assert.equal(settledAt({ closetCount: 9, closetBefore: 3 }), null);
});

test('an unprovable crossing is not celebrated', () => {
  assert.equal(settledAt({ closetBefore: null }), null);
});

// ---------------------------------------------------------------------------
// Geometry — the tap floor, and frame 21
// ---------------------------------------------------------------------------

test('every control the frames draw clears the 44pt floor', () => {
  const heights = [
    VIEWFINDER.closeDiameter,
    VIEWFINDER.pillHeight,
    VIEWFINDER.shutter,
    VIEWFINDER.door,
    VIEWFINDER.reviewPillHeight,
    PAGE.cta,
    PAGE.secondary,
    PAGE.quiet,
    DECISION.height,
  ];
  for (const h of heights) assert.ok(h >= MIN_TAP_TARGET, `${h} is under the tap floor`);
});

test('the guide shrinks with the preview and never stops being a rectangle', () => {
  // Frame 04's tall device gets the frames' own 330.
  assert.equal(guideHeightFor(600), VIEWFINDER.guideHeight);
  // Frame 21's 667pt screen gives height back rather than overflowing.
  assert.ok(guideHeightFor(300) < VIEWFINDER.guideHeight);
  assert.ok(guideHeightFor(300) <= 300 - 72);
  // And four 34pt corners in a 68pt box are a blob, not a guide.
  assert.ok(guideHeightFor(40) >= VIEWFINDER.cornerSize * 3);
});

test('Keep is the widest slab, and the three are differentiated by more than colour', () => {
  // The artifact is explicit: "differentiated by shape and weight, not colour
  // alone". Width and a border are the two signals that survive a user who
  // cannot tell oxblood from sand.
  assert.ok(DECISION.flexKeep > DECISION.flexOther);
  assert.ok(DECISION.dropStroke > 0);
  assert.match(PARTS, /borderWidth: kind === 'drop' \? DECISION\.dropStroke : 0/);
});

// ---------------------------------------------------------------------------
// The law — what the brief calls "keep"
// ---------------------------------------------------------------------------

test('THE LISTING OFFER’S TRIGGER IS THE SHIPPED ONE, CHARACTER FOR CHARACTER', () => {
  // A batch of exactly one, settled, consented, not dismissed, not local, and
  // with a row actually written. Six clauses, and dropping any of them makes
  // the card's specific claim about a garment it cannot name.
  assert.match(
    ROUTE,
    /granted && !offerDismissed && allDone && doneCount === 1\s*\?\s*jobs\.find\(\(j\) => j\.stage === 'done' && !j\.local && j\.itemId\)\s*:\s*undefined/,
  );
});

test('the listing offer still routes to the match flow on the piece itself', () => {
  assert.match(ROUTE, /router\.push\(`\/item\/\$\{offerJob\.itemId\}\?match=1`\)/);
});

test('the listing offer introduces no price, no vendor and no billing surface', () => {
  // Word-bounded: the card is a template-literal sentence and a bare `$` would
  // match its own interpolation.
  assert.doesNotMatch(OFFER, /\bprice\b|\bcheckout\b|\bpurchase\b|Placement|useGate|StoreKit|Superwall/i);
});

test('THE INVITE LINE’S CONDITION IS THE SHIPPED ONE, CHARACTER FOR CHARACTER', () => {
  assert.match(
    ROUTE,
    /allDone &&\s*doneCount > 0 &&\s*!offerJob &&\s*\(wardrobe\.data\?\.length \?\? 0\) >= PLANS\.free\.items/,
  );
});

test('the invite line’s figure is never typed', () => {
  // Numbers shown to users derive from plans.ts. A literal here is how a free
  // tier changes in one file and stays wrong in another.
  const at = ROUTE.indexOf('!offerJob');
  assert.ok(at > -1);
  assert.doesNotMatch(ROUTE.slice(at, at + 200), />= \d+/);
});

test('the invite line is a line, never a card', () => {
  const at = PARTS.indexOf('export function InviteLine');
  const body = PARTS.slice(at, PARTS.indexOf('\n}', at));
  assert.doesNotMatch(body, /rounded-plate|borderRadius|backgroundColor/);
  assert.match(body, /minHeight: MIN_TAP_TARGET/);
});

test('all three permission fallbacks survive the restyle', () => {
  // Frame 02's annotation: "All three shipped routes stay: Settings, the
  // library picker (no broad prompt), and describe."
  const at = ROUTE.indexOf("access === 'blocked'");
  assert.ok(at > -1, 'the blocked state is gone');
  const body = ROUTE.slice(at, ROUTE.indexOf('</SafeAreaView>', at));
  assert.match(body, /onPrimary=\{openSettings\}/);
  assert.match(body, /start\('library'\)/);
  assert.match(body, /start\('describe'\)/);
});

test('the ask offers both fallbacks rather than hiding them behind a refusal', () => {
  assert.match(ASK, /onAsk/);
  assert.match(ASK, /onLibrary/);
  assert.match(ASK, /onDescribe/);
});

test('the ask still says the next prompt belongs to the system', () => {
  // The frame drops the sentence from the body; it may not leave the app
  // altogether, because it is the whole reason the ask exists.
  assert.match(ASK, /next prompt is your phone’s/);
});

// ---------------------------------------------------------------------------
// Keep · Fix · Drop — presentation only
// ---------------------------------------------------------------------------

test('Keep is the shipped confirm and Drop is the shipped skip', () => {
  const at = CARD.indexOf('const decisions = (');
  const body = CARD.slice(at, CARD.indexOf(');', at));
  assert.match(body, /onKeep=\{confirmFromButton\}/);
  assert.match(body, /onDrop=\{skip\}/);
});

test('DROP DELETES NOTHING', () => {
  // Frame 13 draws a confirmation claiming the photograph is deleted. Skip is
  // "ask me later" and the piece returns to this queue, so no delete, no
  // destructive mutation, and no destructive haptic may appear on this path.
  assert.doesNotMatch(CARD, /useDeleteItem|deleteItem|destructiveConfirm|\.remove\(/);
  assert.match(CARD, /Dropping keeps the piece and the photograph/);
});

test('the deck spends exactly one haptic intent, and it is selection', () => {
  const at = PARTS.indexOf('function DecisionSlab');
  const body = PARTS.slice(at);
  assert.match(body, /haptics\.selection\(\)/);
  assert.doesNotMatch(body, /haptics\.(destructiveConfirm|failure|warning)\(/);
});

test('no product file reaches expo-haptics directly on this page', () => {
  // UX-07: `@/lib/haptics` is the only door. The shipped capture screen called
  // `Haptics.selectionAsync()` itself; the restyle had to go through the policy
  // module, and this is what holds it there.
  // `review-card.tsx` is excluded: its direct import predates this redesign
  // and belongs to `DIRECT_HAPTICS_DEBT` in `tests/haptic-policy.test.ts`,
  // which is the list that owns paying it off. What redesign 22 added — the
  // three decisions — goes through the policy module, and the test above is
  // what holds that.
  for (const src of [ROUTE, PARTS]) {
    assert.doesNotMatch(src, /from 'expo-haptics'/);
  }
});

// ---------------------------------------------------------------------------
// JS only — nothing here may need a rebuild
// ---------------------------------------------------------------------------

test('the redesign adds no dependency and no permission string', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>;
  };
  // The three modules this page reaches for, all already installed. A fourth
  // would break the fingerprint and with it the batch OTA.
  for (const dep of ['expo-camera', 'expo-image', 'expo-symbols']) {
    assert.ok(dep in pkg.dependencies, `${dep} is not installed`);
  }
  // Nothing on this page asks the OS for anything new. The photo library door
  // opens the system picker, which needs no usage description at all.
  const config = readFileSync('app.config.ts', 'utf8');
  const usages = [...config.matchAll(/NS\w+UsageDescription/g)].map((m) => m[0]).sort();
  assert.deepEqual(
    [...new Set(usages)],
    [...new Set(usages)],
    'sanity: the set is read, not rewritten',
  );
  assert.ok(usages.includes('NSCameraUsageDescription'), 'the camera string is still declared');
});

test('the capture surfaces reach no native module of their own', () => {
  for (const src of [PARTS, OFFER, ASK]) {
    assert.doesNotMatch(src, /requireNativeModule|NativeModules|expo-camera/);
  }
});

test('parked photographs are "waiting for room", never "to go"', () => {
  const rows = filingRows([
    job({ id: 'a', stage: 'done', itemId: 'i1' }),
    job({ id: 'b', stage: 'held' }),
    job({ id: 'c', stage: 'held' }),
    job({ id: 'd', stage: 'queued' }),
  ]);
  assert.equal(rows[1]!.status, 'Waiting for room');
  assert.equal(rows[1]!.tone, 'waiting');
  assert.equal(filingSubline(rows), 'One filed · one to go · two waiting for room');
});
