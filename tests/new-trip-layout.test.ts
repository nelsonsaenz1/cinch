/**
 * New Trip — the stepped card flow. The layout bargain, the step machine, and
 * the boundary this page must never move. Redesign 05.
 *
 * Written to the shape `trips-list-layout.test.ts`, `plan-week-layout.test.ts`
 * and `event-detail-layout.test.ts` set: the drawn bodies are asserted as TEXT,
 * because esbuild cannot parse React Native's Flow source and there is no
 * renderer in this runner; everything the flow DECIDES before it draws lives in
 * `new-trip-spec.ts` and is imported and exercised directly.
 *
 * This page has one thing to get wrong that none of the other three does, and
 * it is not a layout: it is the app's PAYWALL MOMENT. A gate that opened, a
 * placement that moved, or a server call issued before the entitlement was read
 * would each be a revenue defect that no screenshot comparison would catch. All
 * three are pinned below, first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ANSWER_CARD_MIN_HEIGHT,
  CHIP_MIN_HEIGHT,
  CHIP_MIN_HEIGHT_AX,
  CHROME_TARGET,
  CHROME_TARGET_AX,
  CTA_MIN_HEIGHT,
  CTA_MIN_HEIGHT_AX,
  CTA_SECONDARY_MIN_HEIGHT,
  DOT_CURRENT_WIDTH,
  FIELD_MIN_HEIGHT,
  NEW_TRIP_COPY,
  PLATE_TILES,
  answerRows,
  canLeaveStep,
  joinLabels,
  nights,
  plannedColophon,
  plateDayLabel,
  progressDots,
  stepIndex,
  tripDatesLine,
  weatherMark,
} from '../src/features/plan/new-trip-spec';
import { TRIP_QUESTIONS, TRIP_STEPS } from '../src/features/plan/trip';

const BODY_RAW = readFileSync('src/components/plan/new-trip-body.tsx', 'utf8');
const PLATE_RAW = readFileSync('src/components/plan/packing-plate-body.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/plan/new-trip-spec.ts', 'utf8');
const FIXTURES_RAW = readFileSync('src/features/plan/new-trip-fixtures.ts', 'utf8');
const ROUTE_RAW = readFileSync('src/features/plan/trip-questionnaire.tsx', 'utf8');
const TAB_RAW = readFileSync('src/features/plan/packing-tab.tsx', 'utf8');
const ACCESS_RAW = readFileSync('src/features/plan/use-packing-access.ts', 'utf8');
const PLACEMENTS_RAW = readFileSync('src/features/billing/placements.ts', 'utf8');
const MACHINE_RAW = readFileSync('src/features/plan/use-trip-questionnaire.ts', 'utf8');
const TRIP_RAW = readFileSync('src/features/plan/trip.ts', 'utf8');
const PACKING_TRIP_RAW = readFileSync('src/features/plan/packing-trip.tsx', 'utf8');
const BRIEF_RAW = readFileSync('src/features/plan/use-packing-brief.ts', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const BODY = code(BODY_RAW);
const PLATE = code(PLATE_RAW);
const SPEC = code(SPEC_RAW);
const FIXTURES = code(FIXTURES_RAW);
const ROUTE = code(ROUTE_RAW);
const TAB = code(TAB_RAW);
const ACCESS = code(ACCESS_RAW);
const PLACEMENTS = code(PLACEMENTS_RAW);
const MACHINE = code(MACHINE_RAW);
const TRIP = code(TRIP_RAW);
const PACKING_TRIP = code(PACKING_TRIP_RAW);
const BRIEF = code(BRIEF_RAW);

// ---------------------------------------------------------------------------
// The gate — this page guards revenue, so this block comes first
// ---------------------------------------------------------------------------

test('the access check is ordered BEFORE the questionnaire and before any server call', () => {
  // The whole boundary in one assertion: in `PackingTab`, the entitlement is
  // read, then the loading branch, then the locked branch, and only after all
  // three does `<TripQuestionnaire` appear. Anything that reordered these would
  // render a question — and therefore let a place search, a climate read and a
  // trip row happen — for an account that has not paid.
  const access = TAB.indexOf('usePackingAccess(active)');
  const loading = TAB.indexOf('if (access.loading)');
  const locked = TAB.indexOf('if (!access.allowed)');
  const questionnaire = TAB.indexOf('<TripQuestionnaire');
  const packing = TAB.indexOf('<PackingTrip');

  assert.ok(access > -1, 'the tab stopped reading the entitlement');
  assert.ok(loading > access, 'the loading branch runs before the entitlement is read');
  assert.ok(locked > loading, 'the locked branch moved above the loading branch');
  assert.ok(questionnaire > locked, 'the questionnaire is reachable before the gate decides');
  assert.ok(packing > locked, 'the packing plate is reachable before the gate decides');
});

test('the gate fails CLOSED, and reads the entitlement rather than the paywall', () => {
  // `allowed` is derived from the PLAN, never from whether a paywall appeared.
  // An unmatched placement proceeds silently and `PAYWALLS_ENABLED` is false in
  // every keyless build — either of those, used as the gate, is an open door.
  assert.match(ACCESS, /const allowed = plan === 'pro';/, 'the entitlement test changed');
  assert.doesNotMatch(
    ACCESS,
    /allowed[^\n]*=[^\n]*(present|gate\.|outcome|unlockState)/,
    'the gate now reads the paywall outcome instead of the entitlement',
  );
  // The session is folded into `loading` so a cold start never resolves to
  // `free` while the user id is still unknown.
  assert.match(ACCESS, /const loading = session\.loading \|\| planLoading;/, 'the loading fold changed');
});

test('the placement key and its firing moment are unchanged', () => {
  assert.match(PLACEMENTS, /PackingAccess: 'packing_access',/, 'the placement key moved');
  // Fired from `unlock()` and nowhere else — never from an effect. An automatic
  // presentation is a bet that a vendor's modal always dismisses itself, and
  // losing it costs the whole screen (see the header in `use-packing-access`).
  assert.match(ACCESS, /gate\.present\(Placement\.PackingAccess, onGranted\)/, 'the placement call changed');
  assert.equal(
    (ACCESS.match(/gate\.present\(/g) ?? []).length,
    1,
    'the paywall is presented from more than one place',
  );
  const unlock = ACCESS.indexOf('const unlock = useCallback');
  const present = ACCESS.indexOf('gate.present(');
  assert.ok(present > unlock, 'the placement escaped `unlock()`');
  assert.doesNotMatch(ACCESS, /useEffect\([^)]*\)[\s\S]{0,200}gate\.present/, 'the paywall is presented from an effect');
});

test('nothing in the rebuilt flow reads a plan, gates, or presents a paywall', () => {
  // The drawn surfaces, the spec and the route half are all downstream of the
  // gate. A membership read in any of them would be a second boundary that can
  // disagree with the first one.
  for (const [name, src] of [
    ['body', BODY],
    ['plate', PLATE],
    ['spec', SPEC],
    ['fixtures', FIXTURES],
    ['route', ROUTE],
  ] as const) {
    assert.doesNotMatch(src, /Placement\.|gate\.present|useGate\(/, `${name} presents a paywall`);
    assert.doesNotMatch(src, /usePackingAccess|usePlan\(/, `${name} reads the plan`);
  }
});

test('the packing-brief contract is untouched — same inputs, same shape, no new fields', () => {
  // `packing-brief` stopped being a network call before this wave: it is a
  // `useMemo` over the bag. "Unchanged contract" therefore means the hook's
  // arguments and its returned shape, which is what the screen reads.
  assert.match(BRIEF, /export function usePackingBrief\(\{\s*trip,\s*forecasts,\s*weatherSource,\s*packing,\s*requestedLooks,\s*\}/,
    'the brief hook changed its inputs');
  assert.match(BRIEF, /isPending: data === null/, 'the brief hook changed its shape');
  assert.match(BRIEF, /isError: false as const/, 'the brief hook grew a failure mode');
  assert.doesNotMatch(BRIEF, /fetch\(|supabase\.functions|invoke\(/, 'the brief hook reached a network');
  // And the caller still passes exactly those five.
  assert.match(PACKING_TRIP, /usePackingBrief\(\{\s*trip,\s*forecasts,\s*weatherSource,\s*packing,\s*requestedLooks,\s*\}\)/,
    'the brief call site grew or lost an argument');
});

// ---------------------------------------------------------------------------
// The step machine
// ---------------------------------------------------------------------------

test('three cards, in the frames’ order, each with its own question', () => {
  assert.deepEqual([...TRIP_STEPS], ['destination', 'dates', 'shape']);
  assert.equal(TRIP_QUESTIONS.destination, 'Where are you going?');
  assert.equal(TRIP_QUESTIONS.dates, 'When are you there?');
  assert.equal(TRIP_QUESTIONS.shape, 'What’s happening there?');
});

test('the four answers survive the three cards', () => {
  // `companions` lost its card and did NOT lose its answer: `trips.companions`
  // is `not null`, so a flow that stopped asking would write a row Postgres
  // refuses. It is asked inside `shape` — which is why `canLeaveStep` requires
  // it there, and why the third card draws a companions group.
  assert.match(TRIP, /export type Trip = \{[\s\S]*?companions: CompanionKey;/, 'the answer left the Trip');
  assert.match(ROUTE, /companions: COMPANIONS\.map\(/, 'the third card stopped asking who with');
  assert.match(BODY, /NEW_TRIP_COPY\.whoWith/, 'the companions group left the card');
  assert.ok(!canLeaveStep('shape', {
    destination: {}, companions: null, startsOn: '2026-09-10', endsOn: '2026-09-14',
    vibes: ['warm-city'], parts: ['daytime'],
  }), 'the last card finishes without a companion answer');
});

test('progress dots derive from the step index and nothing else', () => {
  assert.deepEqual(progressDots(0, 3), ['current', 'ahead', 'ahead']);
  assert.deepEqual(progressDots(1, 3), ['done', 'current', 'ahead']);
  assert.deepEqual(progressDots(2, 3), ['done', 'done', 'current']);

  // Three states, not two. The frames give the steps BEHIND the rose tint and
  // the ones AHEAD sand, which is the only thing left saying how much remains
  // now that the "2 of 4" line is gone.
  assert.equal(new Set(progressDots(1, 3)).size, 3, 'the dots collapsed to two states');

  // Defaults to the real step list, so a step added to `TRIP_STEPS` needs no
  // edit in the spec.
  assert.equal(progressDots(0).length, TRIP_STEPS.length);

  // Out-of-range indices clamp rather than producing a run with no current dot
  // — a half-answered run restored from the module slot must always draw one.
  assert.deepEqual(progressDots(-4, 3), ['current', 'ahead', 'ahead']);
  assert.deepEqual(progressDots(9, 3), ['done', 'done', 'current']);
  for (const i of [-4, 0, 1, 2, 9]) {
    assert.equal(progressDots(i, 3).filter((d) => d === 'current').length, 1);
  }

  // And the drawn header reads the derived array rather than recomputing it.
  assert.match(ROUTE, /progressDots\(q\.index, q\.total\)/, 'the route stopped deriving the dots');
  assert.doesNotMatch(BODY, /index ===|index </, 'the body decided the dots for itself');
});

test('stepIndex agrees with TRIP_STEPS, and never returns a negative', () => {
  TRIP_STEPS.forEach((step, i) => assert.equal(stepIndex(step), i));
  // A key from a stale held run is answered with the first card, not with -1,
  // which would index the dots array off its front.
  assert.equal(stepIndex('nowhere' as never), 0);
});

test('going forward and back preserves every answer', () => {
  // The machine is a hook, so the guarantee is asserted where it is written:
  // `back` rebuilds the run from `...run` and touches `index` ALONE. A `back`
  // that also reset a field would be three taps thrown away for glancing at
  // the previous question.
  assert.match(
    MACHINE,
    /const back = useCallback\(\(\) => \{\s*setRun\(\(run\) => \(\{ \.\.\.run, index: Math\.max\(0, run\.index - 1\) \}\)\);/,
    'back stopped preserving the draft',
  );
  // Same for the forward move: `next` advances the index and copies the draft.
  assert.match(
    MACHINE,
    /const next = useCallback\(\(from: TripStepKey\) => \{[\s\S]*?\{ \.\.\.run, index: Math\.min\(run\.index \+ 1, TRIP_STEPS\.length - 1\) \}/,
    'next stopped preserving the draft',
  );
  // Recording an answer no longer moves at all — the frames put a "Next" on the
  // foot, so a mis-tapped city is revisable rather than a committed advance.
  assert.match(
    MACHINE,
    /const set = useCallback\(\(answered: TripStepKey, patch: Partial<TripDraft>\) => \{[\s\S]*?\{ \.\.\.run, draft: \{ \.\.\.run\.draft, \.\.\.patch \} \}/,
    'answering a card advances it again',
  );
  // Every mutation still names the step it belongs to, so a double tap landing
  // in one frame is a no-op rather than a skipped question.
  for (const guard of [/TRIP_STEPS\[run\.index\] !== answered/, /TRIP_STEPS\[run\.index\] !== from/]) {
    assert.match(MACHINE, guard, 'a mutation stopped naming its step');
  }
  // And an abandoned run outlives the tab, which is what makes "your answers
  // are saved" true after a glance at Week.
  assert.match(MACHINE, /let heldRun: Run = FRESH;/, 'the held run was removed');
  assert.match(MACHINE, /heldRun = next;/, 'writes stopped reaching the held run');
});

test('a card cannot be left until it is answered', () => {
  const empty = {
    destination: null, companions: null, startsOn: null, endsOn: null, vibes: [], parts: [],
  };
  assert.equal(canLeaveStep('destination', empty), false);
  assert.equal(canLeaveStep('destination', { ...empty, destination: {} }), true);

  assert.equal(canLeaveStep('dates', { ...empty, startsOn: '2026-09-10' }), false, 'half a range left the card');
  assert.equal(canLeaveStep('dates', { ...empty, startsOn: '2026-09-10', endsOn: '2026-09-14' }), true);

  // `trips.parts` is constrained to one-to-four entries, so an empty multi-
  // select is a row the database refuses rather than a merely thin answer.
  const shape = { ...empty, companions: 'partner', vibes: ['warm-city'], parts: ['daytime'] };
  assert.equal(canLeaveStep('shape', shape), true);
  assert.equal(canLeaveStep('shape', { ...shape, parts: [] }), false);
  assert.equal(canLeaveStep('shape', { ...shape, vibes: [] }), false);

  // The foot reads exactly this, so the drawn button cannot disagree with it.
  assert.match(ROUTE, /const canAdvance = canLeaveStep\(q\.step, q\.draft\);/, 'the CTA stopped reading the guard');
  assert.match(ROUTE, /ctaEnabled: canAdvance/, 'the CTA is enabled by something else');
  assert.match(ROUTE, /if \(!canAdvance\) return;/, 'the CTA acts even when it is drawn disabled');
});

// ---------------------------------------------------------------------------
// The colophons — nothing here promises a count of anything
// ---------------------------------------------------------------------------

test('the flow counts nights, and never promises pieces or outfits', () => {
  assert.equal(nights('2026-09-10', '2026-09-14'), 4);
  assert.equal(nights('2026-09-10', '2026-09-10'), 0, 'a same-day trip invented a night');
  assert.equal(tripDatesLine('2026-09-10', '2026-09-14'), '10–14 Sep · 4 nights');
  assert.equal(tripDatesLine('2026-09-10', '2026-09-11'), '10–11 Sep · 1 night');
  // A same-day trip carries the range alone rather than "0 nights". The range
  // itself is `formatDateRange`'s, shared with the trips shelf's own
  // `tripDatesLine` — one month table for the app, so a day trip reads the same
  // way on both surfaces even where that reading is "10–10 Sep".
  assert.equal(tripDatesLine('2026-09-10', '2026-09-10'), '10–10 Sep');
  assert.doesNotMatch(tripDatesLine('2026-09-10', '2026-09-10'), /night/, 'a day trip invented a night');

  // The week-engine rule applies to packing too: no line in the flow's copy
  // names a number of pieces or outfits the search has not run yet.
  const copy = Object.values(NEW_TRIP_COPY).join(' ');
  assert.doesNotMatch(copy, /\b\d+\s*(pieces?|outfits?|looks?)\b/i, 'the copy promised a count');
  assert.doesNotMatch(
    copy,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(pieces?|outfits?|looks?)\b/i,
    'the copy promised a spelled-out count',
  );
});

test('the weather mark is real or absent — never a guessed number', () => {
  const f = (c: number) => `${Math.round(c)}°`;
  assert.equal(weatherMark(null, f), null, 'a missing band produced a mark');
  assert.equal(weatherMark({ lowC: 15, highC: 24 }, f), '24° / 15°');
  // The planned plate's tighter form is the same function, one argument apart.
  assert.equal(weatherMark({ lowC: 15, highC: 24 }, f, false), '24°/15°');
  assert.equal(plannedColophon('2026-09-10', '2026-09-14', '24°/15°'), '10–14 Sep · 4 nights · 24°/15°');
  // No band means the dates stand alone rather than an em dash where a
  // temperature should be.
  assert.equal(plannedColophon('2026-09-10', '2026-09-14', null), '10–14 Sep · 4 nights');
});

test('the plate’s day bands name arrival and home, and nothing they cannot know', () => {
  assert.match(plateDayLabel('2026-09-10', 0, 5), / · arrival$/);
  assert.match(plateDayLabel('2026-09-14', 4, 5), / · home$/);
  // A middle day carries the date alone. The artifact writes an EVENT title
  // there ("Sat 12 · the birthday") and this app has no binding from a trip day
  // to a calendar event, so the suffix is withheld rather than invented.
  assert.doesNotMatch(plateDayLabel('2026-09-12', 2, 5), / · /);
  // A one-day trip is not both an arrival and a departure.
  assert.doesNotMatch(plateDayLabel('2026-09-10', 0, 1), / · /);
});

test('the preserved answers are built from the draft, and drop what is missing', () => {
  const full = answerRows({
    destination: { name: 'Mexico City' },
    startsOn: '2026-09-10',
    endsOn: '2026-09-14',
    vibeLabels: ['Warm city', 'Long dinners'],
  });
  assert.deepEqual(full.map((r) => r.key), [
    NEW_TRIP_COPY.answerWhere,
    NEW_TRIP_COPY.answerWhen,
    NEW_TRIP_COPY.answerWhat,
  ]);
  assert.equal(full[1]!.value, '10–14 Sep · 4 nights');
  assert.equal(full[2]!.value, 'Warm city, long dinners');

  // A field the draft does not carry is DROPPED — the frame's promise is "your
  // answers are still here", and a placeholder row would make it a lie.
  assert.deepEqual(
    answerRows({ destination: null, startsOn: null, endsOn: null, vibeLabels: [] }),
    [],
  );
  assert.equal(
    answerRows({ destination: { name: 'Lisbon' }, startsOn: '2026-09-10', endsOn: null, vibeLabels: [] }).length,
    1,
    'half a date range produced a When row',
  );
  assert.equal(joinLabels(['Dinners out', 'A birthday']), 'Dinners out, a birthday');
});

// ---------------------------------------------------------------------------
// The drawn surfaces
// ---------------------------------------------------------------------------

test('every control in the flow clears the 44pt floor', () => {
  for (const [name, value] of [
    ['the pinned CTA', CTA_MIN_HEIGHT],
    ['the pinned CTA at the accessibility sizes', CTA_MIN_HEIGHT_AX],
    ['the secondary CTA', CTA_SECONDARY_MIN_HEIGHT],
    ['a chip', CHIP_MIN_HEIGHT],
    ['a chip at the accessibility sizes', CHIP_MIN_HEIGHT_AX],
    ['the destination field', FIELD_MIN_HEIGHT],
    ['the back target', CHROME_TARGET],
    ['the back target at the accessibility sizes', CHROME_TARGET_AX],
    ['an answer card', ANSWER_CARD_MIN_HEIGHT],
  ] as const) {
    assert.ok(value >= 44, `${name} is below the tap floor (${value})`);
  }
  // The chips buy their target with real geometry, not `hitSlop` — a wrapped
  // grid with overlapping slop is a grid that lies about what was tapped.
  assert.match(BODY, /minHeight: large \? CHIP_MIN_HEIGHT_AX : CHIP_MIN_HEIGHT/, 'the chip lost its floor');
  assert.doesNotMatch(BODY, /function Chip\([\s\S]{0,900}hitSlop/, 'the chip bought its target with slop');
  // Match rows and the quiet links state the shared constant.
  assert.match(BODY, /MIN_TAP_TARGET/, 'a row in the flow has no 44pt floor');
  assert.match(PLATE, /MIN_TAP_TARGET/, 'a control on the plate has no 44pt floor');
});

test('selection survives greyscale and reaches VoiceOver', () => {
  // §1 repealed the one-oxblood-per-screen law and the frames fill the chosen
  // chips. The old objection is still answered: `accent` on `tray` is a large
  // luminance step, and the state is announced regardless of any of that.
  assert.match(BODY, /accessibilityState=\{\{ selected: chip\.selected \}\}/, 'a chip stopped announcing its state');
  assert.match(BODY, /chip\.selected \? theme\.accent : base/, 'the selected fill changed');
  // The dots do not rely on colour alone either — the current one is wider.
  assert.ok(DOT_CURRENT_WIDTH > 8, 'the current dot is only a colour');
  assert.match(BODY, /accessibilityRole="progressbar"/, 'the dots say nothing to VoiceOver');
});

test('the accessibility sizes recompose rather than shrink', () => {
  // The AX frame's four changes: the chips stack full-width, the question grows
  // to the display step, the place card folds its mark into the type block, and
  // the foot takes a border because the last chip now sits under the button.
  assert.match(BODY, /flexDirection: large \? 'column' : 'row'/, 'the chips stopped stacking');
  assert.match(BODY, /variant=\{hero \|\| large \? 'display' : 'title'\}/, 'the question stopped growing');
  assert.match(BODY, /\{!large && card\.mark \? \(/, 'the mark stayed a pill at the accessibility sizes');
  assert.match(BODY, /borderTopWidth: large \? 1 : 0/, 'the foot lost its separation');
  // And the scroll view keeps its flex floor, or the pinned foot is clipped
  // with nothing to scroll — the hazard the event poster and the shelf record.
  assert.match(BODY, /style=\{\{ flex: 1, minHeight: 0 \}\}/, 'the scroll view lost its flex floor');
});

test('the plate grids the pieces by day, three across, and degrades in place', () => {
  assert.equal(PLATE_TILES, 3);
  // The row is three equal columns whatever the day holds: a row that changed
  // shape with the count would make two days of one trip look like two designs.
  assert.match(PLATE, /Array\.from\(\{ length: PLATE_TILES \}\)/, 'the grid changed shape with the count');
  assert.match(PLATE, /fallback=\{<View \/>\}/, 'a missing photograph collapses the well');
  // The pieces are photographs, not names — the directive's "gridded, not
  // listed" is the whole point of the plate.
  assert.match(PLATE, /<GarmentImage/, 'the plate stopped drawing garments');
  assert.doesNotMatch(PLATE, /lookGarmentNames|garmentLabel/, 'the plate went back to listing names');
  // A day wears the same trousers twice as often as not, and three wells
  // showing one garment twice is a grid that misreports the day.
  assert.match(PACKING_TRIP, /seen\.has\(garment\.id\)/, 'the day grid stopped de-duplicating');
});

test('waiting is drawn as the shapes that are coming, never a spinner', () => {
  assert.match(PLATE, /<Skeleton/);
  assert.doesNotMatch(PLATE, /ActivityIndicator|<Spinner/, 'a spinner reached the plate');
  assert.match(PLATE, /height: PLATE_ROW_LOADING/, 'the waiting grid invented its own height');
  // The progress is arithmetic over reads that actually finished — it is not a
  // timer and it never fakes forward motion.
  assert.match(
    PACKING_TRIP,
    /\[forecastStepDone, closetStepDone, looksStepDone, memoStepDone\]\.filter\(Boolean\)\.length/,
    'the progress stopped counting real reads',
  );
  assert.doesNotMatch(PACKING_TRIP, /setInterval|setTimeout[\s\S]{0,80}progress/, 'the progress became a timer');
});

test('a failed read is a state with a way out, not a hang', () => {
  // `packing` needs `forecasts`, `forecasts` needs a query, and a query can
  // error — which used to leave the research lines ticking for ever.
  assert.match(PACKING_TRIP, /const researchFailed = !packing && \(weatherFailed \|\| wardrobeQuery\.isError\)/,
    'the failed read stopped being named');
  assert.match(PACKING_TRIP, /const researching = !researchFailed &&/, 'waiting swallowed the failure again');
  // Ordered before the waiting branch, or the failure is unreachable.
  const failed = PACKING_TRIP.indexOf('if (researchFailed)');
  const waiting = PACKING_TRIP.indexOf('if (researching)');
  assert.ok(failed > -1 && waiting > failed, 'the failure branch is unreachable behind waiting');
  // Both ways out are real.
  assert.match(PLATE, /NEW_TRIP_COPY\.tryAgain/, 'the failure lost its retry');
  assert.match(PLATE, /NEW_TRIP_COPY\.saveAndFinishLater/, 'the failure lost its second way out');
  assert.match(PACKING_TRIP, /onSaveAndFinishLater: onStartAgain/, 'finishing later stopped behaving as abandoning does');
});

test('"Trip planned" is a fact by the time it is drawn', () => {
  // The claim and the write happen together. A completion moment that asserts
  // something the database does not know is a lie the trips shelf then exposes:
  // no `saved_at`, no "Packed" badge, nothing for "Open last list" to open.
  assert.match(PACKING_TRIP, /haptics\.success\(\);/, 'the completion lost its haptic');
  assert.match(PACKING_TRIP, /void handleSaveToPlan\(\);/, 'the completion stopped saving');
  assert.match(PACKING_TRIP, /if \(!planned \|\| plannedRef\.current\) return;/, 'the completion can fire twice');
  // Success, not commit: the user did not just tap anything, and this is an
  // operation they were waiting on.
  assert.doesNotMatch(PACKING_TRIP, /haptics\.commit\(\)/, 'the completion used the wrong intent');
  // Two clear paths out, both reaching a route that resolves.
  assert.match(PLATE, /NEW_TRIP_COPY\.seeThisTrip/);
  assert.match(PLATE, /NEW_TRIP_COPY\.allTrips/);
  assert.match(PACKING_TRIP, /onSeeThisTrip: \(\) => router\.push\('\/trips'\)/, 'the primary path dead-ends');
  assert.match(PACKING_TRIP, /onAllTrips: \(\) => router\.push\('\/trips'\)/, 'the second path dead-ends');
});

test('haptics come from the one door, and only where something committed', () => {
  for (const [name, src] of [['body', BODY], ['plate', PLATE], ['packing-trip', PACKING_TRIP]] as const) {
    assert.doesNotMatch(src, /expo-haptics/, `${name} reached past the haptic policy`);
  }
  // Selection on the chips and the match rows; commit on the foot; success on
  // the completion. Nothing on scroll and nothing decorative.
  assert.match(BODY, /haptic="selection"/, 'the chips lost their tick');
  assert.match(BODY, /haptic="commit"/, 'the foot lost its tick');
  // The presentational plate does not buzz: it would buzz again for every dev
  // fixture that poses it.
  assert.doesNotMatch(PLATE, /haptics\./, 'the drawn plate fires a haptic of its own');
});

// ---------------------------------------------------------------------------
// Colour, and the seam that makes the frames openable
// ---------------------------------------------------------------------------

test('no colour in the slice is a literal', () => {
  for (const [name, src] of [
    ['body', BODY],
    ['plate', PLATE],
    ['spec', SPEC],
    ['fixtures', FIXTURES],
    ['route', ROUTE],
  ] as const) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `a hardcoded colour in the ${name}`);
    assert.doesNotMatch(src, /rgba\(/, `a hand-composited colour in the ${name}`);
  }
  // Clay is 2.98:1 and `theme/contrast.ts` declares it `text: false`, so the
  // artifact's #B08A76 lines are `muted`. Clay appears exactly once as what it
  // is — a FILL, on the building plate's progress.
  assert.doesNotMatch(BODY, /accentWarm/, 'clay became type in the flow');
  assert.match(PLATE, /backgroundColor: theme\.accentWarm/, 'the progress fill left clay');
  // The two status bands are the palette at an alpha with ink on them, the same
  // construction the trips shelf's offline band uses.
  assert.match(PLATE, /warningAlpha\(/, 'the failure band stopped deriving its amber');
  assert.match(PLATE, /positiveAlpha\(/, 'the completion badge stopped deriving its green');
  assert.match(PLATE, /color: theme\.ink/, 'a band label left ink');
});

test('every accepted frame is openable without a session', () => {
  // A state nobody can open is a state nobody checks — the reason every rebuilt
  // page in this repo splits its body from its queries.
  assert.doesNotMatch(BODY, /useQuery|supabase|fetch\(/, 'the body reached for data');
  assert.doesNotMatch(PLATE, /useQuery|supabase|fetch\(/, 'the plate reached for data');
  assert.doesNotMatch(FIXTURES, /useQuery|supabase|fetch\(/, 'a fixture reached for data');

  const index = readFileSync('src/dev-fixtures/dev-screens.tsx', 'utf8');
  for (const route of [
    'dev-nt-01-empty',
    'dev-nt-02-keyboard',
    'dev-nt-03-default',
    'dev-nt-04-loading',
    'dev-nt-05-error',
    'dev-nt-06-planned',
    'dev-nt-07-ax',
  ]) {
    assert.ok(index.includes(`'/${route}'`), `${route} is not reachable from the fixture index`);
  }

  // There is no paywall pose, and there must not be one: that sheet is
  // Superwall's document, configured in the dashboard, and a redrawn copy of it
  // in this repo would be a second set of prices nobody can trace to StoreKit.
  assert.doesNotMatch(FIXTURES, /Yearly|Monthly|free trial|\$\d/, 'a price reached a fixture');
  assert.doesNotMatch(BODY, /\$\d|free trial/, 'a price reached the flow');
});
