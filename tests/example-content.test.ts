/**
 * TE-01/02, PL-C1/C2/C3, PR-C1 — the rules example content lives under.
 *
 * Every one of these is a claim that a screenshot cannot check. An example that
 * takes a touch looks identical to one that does not; an example that fires an
 * analytics event as an outfit looks identical to one that does not; an example
 * whose caption claims a garment on it is the reader's looks CORRECT, which is
 * worse. So the enforcement is on the frame component and on the copy, which is
 * where the rules actually live.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EXAMPLE_BADGE,
  EXAMPLE_SUMMARY,
  GARMENT_KEYS,
  GATE_FORBIDDEN,
  PL_C1,
  PL_C2,
  PL_C3,
  PL_C3_GATE,
  PR_C1,
  PROFILE_FORBIDDEN,
  TE_01,
  TE_02,
  TE_02_CAPTION,
  coachingDestination,
  type GarmentKey,
} from '../src/features/examples/example-copy';

const read = (p: string) => readFileSync(p, 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const FRAME = 'src/components/examples/example-card.tsx';

// ---------------------------------------------------------------------------
// The inert rules — enforced once, in the frame
// ---------------------------------------------------------------------------

test('an example takes no touch at all', () => {
  // `pointerEvents="none"`, not a disabled handler: a disabled Pressable still
  // takes the touch and still lights a press state before deciding to do
  // nothing, which is exactly the "it responded, so it must be real" reading.
  const src = code(FRAME);
  assert.match(src, /pointerEvents="none"/);
  assert.doesNotMatch(src, /onPress|Pressable|TouchableOpacity/, 'the frame has a press target');
});

test('an example exposes exactly one accessibility summary', () => {
  const src = code(FRAME);
  assert.match(src, /accessible\b/);
  assert.match(src, /accessibilityLabel=\{EXAMPLE_SUMMARY\[id\]\}/);
  // Descendants hidden BOTH ways — iOS honours one attribute and Android the
  // other, and this app has shipped iOS-only long enough for the second to be
  // easy to forget.
  assert.match(src, /accessibilityElementsHidden/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/);
});

test('an example never animates as a placeholder', () => {
  // "An example is finished content, not a loading state." A shimmer is the
  // universal sign for the opposite, and `transition={0}` on the photographs is
  // the same refusal — expo-image's default fade reads as loading on a card
  // whose whole job is to look finished.
  const src = code(FRAME);
  assert.doesNotMatch(src, /Skeleton|shimmer|pulse|withRepeat|Animated\./i);
  assert.match(src, /transition=\{0\}/);
});

test('an example writes nothing, queries nothing and spends no quota', () => {
  const src = code(FRAME);
  for (const forbidden of [/supabase/i, /useMutation/, /useQuery/, /fetch\(/, /AsyncStorage/]) {
    assert.doesNotMatch(src, forbidden, `the frame reaches for ${forbidden}`);
  }
});

test('the visible label is inside the card, so it survives a screenshot', () => {
  const src = code(FRAME);
  // Drawn, not only announced. The badge row sits above the content and inside
  // the bordered card — a caption below a cropped screenshot is a disclosure
  // that does not travel.
  assert.match(src, /\{EXAMPLE_BADGE\}/);
  assert.equal(EXAMPLE_BADGE, 'Example');
});

test('every example section has a summary, and every summary disowns the content', () => {
  const ids = Object.keys(EXAMPLE_SUMMARY);
  assert.deepEqual(ids.sort(), ['PL-C1', 'PL-C2', 'PL-C3', 'PR-C1', 'TE-01', 'TE-02']);
  for (const [id, summary] of Object.entries(EXAMPLE_SUMMARY)) {
    assert.match(summary, /^Example/, `${id} does not open by saying it is an example`);
    assert.match(
      summary,
      /Not your (closet|plan|events|trip)\.$|not a real person\./,
      `${id} never says whose it is not`,
    );
  }
});

// ---------------------------------------------------------------------------
// The compositions are real photographs, and the ones we own
// ---------------------------------------------------------------------------

test('every piece named by an example is one of the eleven owned photographs', () => {
  const named: GarmentKey[] = [
    ...TE_01.pieces,
    ...TE_02.pieces,
    ...PL_C1.days.flatMap((d) => [...d.pieces]),
    ...PL_C2.events.flatMap((e) => [...e.pieces]),
    ...PL_C3.days.flatMap((d) => [...d.pieces]),
    ...PL_C3.piecesToTake,
    ...PR_C1.wardrobe,
  ];
  const unknown = named.filter((k) => !GARMENT_KEYS.includes(k));
  assert.deepEqual(unknown, [], 'an example names a photograph that does not exist');
  // And the map is complete, so a key can never resolve to undefined at render.
  const assets = read('src/features/examples/garment-assets.ts');
  for (const key of GARMENT_KEYS) assert.match(assets, new RegExp(`'${key}'`), `${key} unmapped`);
});

test('the assets are bundled, never fetched', () => {
  // "Ship the fixtures as a bundled asset group, not a network fetch — examples
  // must render offline and on first launch." Both are exactly when they are
  // needed: an empty Today is the first screen a new account sees.
  const src = code('src/features/examples/garment-assets.ts');
  assert.match(src, /require\('@\/assets\/garments\//);
  assert.doesNotMatch(src, /https?:/);
});

// ---------------------------------------------------------------------------
// No example is derived from, or claims, the reader's own closet
// ---------------------------------------------------------------------------

test('no example claims a piece on it belongs to the reader', () => {
  // The atlas draws "Two of these pieces are yours; the rest are illustration"
  // over a frame that borrowed the reader's photographs. Nothing does that now,
  // so no caption, name or reasoning line may imply otherwise — this is the
  // copy half of the no-user-data rule, and the copy is where it would break
  // first, because the pictures would still look plausible.
  //
  // The pattern is deliberately about the PRESENT TENSE of what is on the card.
  // "Yours will be built from the pieces you have" is a promise about a closet
  // that does not exist yet and is exactly right; "two of these pieces are
  // yours" is a statement about the photographs in front of the reader and is
  // exactly what may not ship.
  const claims = /\b(these|of these|two of|one of)[^.]*\b(are|is) yours\b|\byour (blouse|skirt|boots|bag|coat)\b/i;
  for (const line of [
    TE_02_CAPTION,
    TE_02.name,
    TE_02.reasoning,
    EXAMPLE_SUMMARY['TE-02'],
    TE_01.reasoning,
  ]) {
    assert.doesNotMatch(line, claims, `an example claims ownership: ${line}`);
  }
  assert.match(TE_02_CAPTION, /An example, not your closet/);
  // The summary departs from the drawn string on purpose — "built around your
  // pieces" describes a card that no longer exists, and a summary is the only
  // description a VoiceOver reader gets.
  assert.doesNotMatch(EXAMPLE_SUMMARY['TE-02'], /built around your pieces/);
});

test('the Today floor opens its sentences with a capital letter', () => {
  // A lowercase "ten pieces are enough to begin." shipped once, because the
  // number is `numberWord(PLANS.free.items)` — spelled out so it moves with the
  // free tier — and `numberWord` returns lowercase for the mid-sentence call
  // sites that outnumber this one. A literal "Ten" would fix the sentence and
  // break the tier link, so the fix is `capitalise` and this is what holds it.
  // (The Ten's own masthead no longer needs it: "Add ten pieces from your
  // closet" puts the number mid-sentence where `numberWord` is already right.)
  const src = code('src/components/today/closet-floor.tsx');
  const interpolatedStarts = [...src.matchAll(/`\$\{([^}]+)\}[^`]*`/g)].map((m) => m[1]);
  for (const expr of interpolatedStarts) {
    // Any template that OPENS on an interpolation and then runs into prose has
    // to capitalise it. `${numberWord(items.length)} pieces in.` is the same
    // shape and the same requirement.
    assert.match(
      expr,
      /capitalise\(|toUpperCase/,
      `a sentence opens on an uncapitalised value: \${${expr}}`,
    );
  }
});

test('an example is never derived from closet data', () => {
  // The rule, enforced where it can actually be broken. The frame takes no
  // photograph in, and the Today floor — which HAS the reader's resolved images
  // right there for the row below — does not hand one over.
  const frame = code('src/components/examples/example-card.tsx');
  assert.doesNotMatch(frame, /ownUris|uri\s*\?\?|resolveImage/, 'the frame accepts a closet image');
  assert.match(frame, /source=\{GARMENT_ASSETS\[key\]\}/, 'the frame does not draw the fixture');

  const floor = code('src/components/today/closet-floor.tsx');
  const card = floor.slice(floor.indexOf('<ExampleCard'), floor.indexOf('</ExampleCard>'));
  assert.doesNotMatch(card, /resolveImage|items\b/, 'the example subtree reads the closet');

  // And the example is ABOVE the prose — the acceptance check is that it is in
  // the first viewport at 393 pt.
  const example = floor.indexOf('<ExampleCard');
  const headline = floor.indexOf('{headline}');
  assert.ok(example > -1 && example < headline, 'the example is not above the copy');
});

// ---------------------------------------------------------------------------
// The packing gate names a tier and nothing else
// ---------------------------------------------------------------------------

test('the packing gate carries no price, period, trial or renewal', () => {
  const gate = `${PL_C3_GATE.line} ${PL_C3_GATE.action}`;
  for (const forbidden of GATE_FORBIDDEN) {
    assert.ok(!gate.toLowerCase().includes(forbidden.toLowerCase()), `gate says "${forbidden}"`);
  }
  assert.match(gate, /Pro/);
  // And the screen itself no longer reads the price hints — those resolve from
  // StoreKit on the membership sheet the button opens (D-5).
  const src = code('src/features/plan/packing-tab.tsx');
  assert.doesNotMatch(src, /monthlyPriceHint|annualPriceHint/);
  // The payoff comes before the gate, in that order.
  const example = src.indexOf('<ExampleTrip');
  const line = src.indexOf('PL_C3_GATE.line');
  assert.ok(example > -1 && example < line, 'the gate is drawn above the example it gates');
});

// ---------------------------------------------------------------------------
// The profile coaching card
// ---------------------------------------------------------------------------

test('the coaching card never claims a public profile', () => {
  const all = `${PR_C1.headline} ${PR_C1.body} ${PR_C1.accept} ${PR_C1.dismiss}`.toLowerCase();
  for (const forbidden of PROFILE_FORBIDDEN) {
    assert.ok(!all.includes(forbidden), `the coaching card says "${forbidden}"`);
  }
  // It says the true version instead.
  assert.match(PR_C1.body, /Only people you have accepted/);
  assert.match(PR_C1.body, /no public page/);
  assert.match(
    `${PR_C1.headline} ${PR_C1.body}`,
    /people you have accepted can see/,
    'the preview never says who can see it',
  );
});

test('the coaching CTA routes to the smallest honest next step', () => {
  assert.equal(coachingDestination({ handle: '', avatarUrl: null }), 'edit-profile');
  assert.equal(coachingDestination({ handle: 'raewhit', avatarUrl: null }), 'edit-profile');
  assert.equal(coachingDestination({ handle: '  ', avatarUrl: 'x' }), 'edit-profile');
  assert.equal(coachingDestination({ handle: 'raewhit', avatarUrl: 'x' }), 'add-clothes');
  // Never a share sheet — there is nothing public to share to.
  const src = code('src/components/profile/profile-coaching-card.tsx');
  assert.doesNotMatch(src, /Share|share sheet|Linking\.openURL/);
});

test('the coaching card is shown once and once means once', () => {
  const src = code('src/features/profile/use-profile-coaching.ts');
  // Persisted, so a dismissal survives the app being closed.
  assert.match(src, /AsyncStorage/);
  // Starts HIDDEN and is only revealed by a read that came back empty: a card
  // that flashes in late is a card shown to somebody who already dismissed it.
  assert.match(src, /useState\(false\)/);
  assert.match(src, /if \(alive && !seen\) setShow\(true\)/);
});

test('Closet owns a separate one-time profile invitation', () => {
  const screen = code('src/app/(tabs)/closet.tsx');
  const sheet = code('src/components/closet/closet-inspiration-sheet.tsx');
  const hook = code('src/features/closet/use-closet-inspiration.ts');

  assert.match(screen, /<ClosetInspirationSheet/);
  assert.match(sheet, /<ProfileCoachingCard/);
  assert.match(sheet, /destination="edit-profile"/);
  assert.match(hook, /AsyncStorage/);
  assert.match(hook, /cinch\.closet\.inspiration\.seen\.v1/);
  assert.doesNotMatch(hook, /cinch\.profile\.coaching\.seen\.v1/);
});

test('a subscribed first trip sees the example below destination search', () => {
  // Redesign 05 split the questionnaire into a route half (`trip-questionnaire.tsx`,
  // the queries) and a drawn half, and renamed `DestinationStep` to
  // `DestinationCard`. The RULE this pins is untouched — PL-C3's payoff sits
  // below the destination search on the first card — so the assertion follows
  // the composition to where it now lives rather than being deleted with the
  // component name it happened to be written against.
  const src = code('src/components/plan/new-trip-body.tsx');
  const destination = src.indexOf('<DestinationCard');
  const example = src.indexOf('<ExampleTrip');
  assert.ok(destination > -1 && example > destination, 'the trip example is not below destination search');
});

test('the removed Today promise stays off the page', () => {
  const floor = code('src/components/today/closet-floor.tsx');
  const copy = code('src/features/examples/example-copy.ts');
  assert.doesNotMatch(floor, /This is what Cinch gives you back every morning/);
  assert.doesNotMatch(copy, /This is what Cinch gives you back every morning/);
});

test('the fictional people are monograms, and no face is fabricated', () => {
  const src = code('src/components/examples/example-card.tsx');
  assert.match(src, /ExampleMonogram/);
  // The three palette darks, and nothing that could load a portrait.
  assert.match(src, /#1C1A16.*#6E2B2B.*#4A463E/s);
  assert.equal(PR_C1.monogram.length, 1);
  for (const e of PL_C2.events) for (const m of e.monograms) assert.equal(m.length, 1);
});

// ---------------------------------------------------------------------------
// Dates: fixed everywhere but the one place the atlas makes an exception
// ---------------------------------------------------------------------------

test('only the Plan week follows a real clock', () => {
  // PL-C1's weekday labels track the selected week so the example cannot
  // contradict the strip above it — an offset, never a date.
  for (const day of PL_C1.days) assert.equal(typeof day.weekdayIndex, 'number');
  const week = code('src/components/plan/plan-examples.tsx');
  assert.match(week, /weekStart: Date/);

  // Everything else is a fixed fictional string. PL-C3 especially: a relative
  // date there would eventually render as a trip that ended last week.
  assert.equal(PL_C3.dates, '12–16 Oct');
  for (const e of PL_C2.events) assert.match(e.date, /^(Sat|Thu) \d+ [A-Z]/);
  assert.doesNotMatch(week, /new Date\(\)|Date\.now/);
});
