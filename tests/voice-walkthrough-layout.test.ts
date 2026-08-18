/**
 * Redesign 24 — the voice walkthrough, as assertions.
 *
 * Two kinds of test in here, and the split is deliberate.
 *
 * The FIRST kind reads `walkthrough-spec.ts`, which is pure data, and pins the
 * numbers the approved artifact states in its own "Tokens & measurements" line.
 * Those are cheap and exact.
 *
 * The SECOND kind reads source text. That is normally a bad way to test a UI,
 * and it is the right way here for one reason: the properties this group has to
 * hold are properties of what the FILES SAY, not of a rendered tree. "The legal
 * sentence appears exactly once in the product, unmodified" cannot be checked
 * by rendering one screen — it is a statement about every screen at once, and
 * the failure it guards against is somebody adding a helpful second copy of it
 * three screens away. Same for "no failure branch offers Try again unless the
 * recording can actually be resent" and "the microphone is never requested on
 * mount". `run-tests.mjs` has no React renderer by design; these are the
 * assertions that survive that, and they are the ones that were going to be
 * checked by hand and then not checked at all.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

import {
  barTone,
  CARD,
  CHIP,
  CONTROL,
  recordingStateLabel,
  recordingSupportLine,
  TYPE,
  WAVEFORM,
  WAVEFORM_PITCH,
} from '../src/features/intake/walkthrough-spec';
import { WALKTHROUGH_INVITATION, failureCopy } from '../src/features/intake/walkthrough-copy';

const read = (p: string) => readFileSync(p, 'utf8');

/** Source with comments stripped, so a sentence quoted in a note is not a hit. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every source file that could plausibly draw one of these screens. */
function allSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
    }
  };
  walk('src');
  return out;
}

// ---------------------------------------------------------------------------
// 1 · The legal sentence
// ---------------------------------------------------------------------------

/**
 * THE ONE TEST THIS FILE EXISTS FOR.
 *
 * The consent sentence is the walkthrough's only disclosure that audio leaves
 * the device, and it names the two hops it takes. Every failure mode it has is
 * a failure of TEXT: a trim ("...to the service that turns speech into text."),
 * a split across two `<Text>` nodes for line-break control, a paraphrase in a
 * fixture that then gets screenshotted as the real thing, or a well-meaning
 * second copy on the chooser so people "see it earlier".
 *
 * So: the exact bytes, and exactly one place that has them.
 */
const CONSENT =
  'The recording goes to the service that turns speech into text, then to the model that reads the list.';

test('the consent sentence is byte-identical to the approved copy', () => {
  assert.equal(WALKTHROUGH_INVITATION.consent, CONSENT);
  // Stated as its own assertions too, so a failure names WHICH half broke
  // rather than printing two hundred characters and leaving it to the eye.
  assert.ok(WALKTHROUGH_INVITATION.consent.includes('turns speech into text'));
  assert.ok(WALKTHROUGH_INVITATION.consent.includes('the model that reads the list'));
  assert.ok(WALKTHROUGH_INVITATION.consent.endsWith('.'));
});

test('the consent sentence exists in exactly one source file', () => {
  const holders = allSources().filter((f) => read(f).includes(CONSENT));
  assert.deepEqual(
    holders,
    ['src/features/intake/walkthrough-copy.ts'],
    `the consent line must live in walkthrough-copy.ts and nowhere else; found in ${holders.join(', ')}`,
  );
});

test('no vendor is named anywhere near the disclosure', () => {
  // The transcription service is a configurable Whisper-class endpoint behind
  // the server. Naming one in copy would be false the moment it is swapped,
  // which is exactly why the sentence says "the service that turns speech into
  // text" rather than a brand.
  for (const vendor of ['Whisper', 'OpenAI', 'Deepgram', 'AssemblyAI', 'Google Speech']) {
    assert.ok(
      !WALKTHROUGH_INVITATION.consent.includes(vendor),
      `${vendor} is named in the consent line`,
    );
  }
});

test('the consent line renders as one node, and as its own VoiceOver stop', () => {
  const parts = code('src/components/intake/walkthrough-parts.tsx');
  // `accessible` on the wrapper is what makes it a stop rather than something
  // swept past on the way to Start recording — the `legal-sentence-focus` frame.
  assert.match(parts, /export function ConsentLine/);
  assert.match(parts, /accessible\s+accessibilityRole="text"/);
  // One `{text}` child. A split into two Texts is how a "line break tweak"
  // silently becomes two sentences that no longer read as one.
  const body = parts.slice(parts.indexOf('export function ConsentLine'));
  assert.equal((body.match(/\{text\}/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// 2 · Permission timing
// ---------------------------------------------------------------------------

test('the microphone is requested at the action and never on mount', () => {
  const route = code('src/app/walkthrough/index.tsx');
  // The request lives inside `begin`, which is what Start recording calls.
  const begin = route.slice(route.indexOf('function begin'), route.indexOf('const finish'));
  assert.match(begin, /requestPermission\(\)/);
  // And nowhere else in the file — above all, not in a `useEffect`.
  assert.equal((route.match(/requestPermission\(\)/g) ?? []).length, 1);
  for (const surface of ['src/app/add-clothes.tsx', 'src/components/onboarding/first-ten-doors.tsx']) {
    assert.ok(
      !code(surface).includes('requestPermission'),
      `${surface} asks for the microphone before the reader has chosen to speak`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3 · The failure taxonomy
// ---------------------------------------------------------------------------

const CAUSES = ['denied', 'silent', 'unparsed', 'offline', 'signed_out'] as const;

test('five causes, five distinct screens — never one generic failure', () => {
  const headlines = CAUSES.map((c) => failureCopy(c).headline);
  assert.equal(new Set(headlines).size, CAUSES.length);
  const primaries = CAUSES.map((c) => failureCopy(c).primary);
  // `silent` and `unparsed` both ask for another take, so the primaries are not
  // all distinct. What must be distinct is the pair — the fact and the ask.
  assert.equal(new Set(headlines.map((h, i) => `${h}|${primaries[i]}`)).size, CAUSES.length);
});

test('Try again appears on the offline branch and on no other', () => {
  for (const cause of CAUSES) {
    const copy = failureCopy(cause);
    const offersRetry = copy.primary === 'Try again' || copy.secondaries.includes('Try again');
    assert.equal(
      offersRetry,
      cause === 'offline',
      `${cause} ${offersRetry ? 'offers' : 'does not offer'} Try again`,
    );
  }
});

test('the branches that cannot be retried say so and ask for a new take', () => {
  // The failure this guards: somebody "helpfully" adding Try again to `silent`.
  // The same audio would fail the same way, and the second attempt would spend
  // the reader's patience proving it.
  assert.equal(failureCopy('silent').primary, 'Record again');
  assert.equal(failureCopy('unparsed').primary, 'Record again');
});

test('the denied branch says nothing was recorded, and keeps the other door open', () => {
  const copy = failureCopy('denied');
  assert.match(copy.body, /Nothing was recorded/);
  assert.ok([copy.primary, ...copy.secondaries].includes('Photograph them instead'));
});

test('no failure copy leaks a status code, a vendor or a raw error', () => {
  for (const cause of CAUSES) {
    const copy = failureCopy(cause);
    const all = [copy.headline, copy.body, copy.primary, ...copy.secondaries].join(' ');
    assert.ok(!/\b[45]\d{2}\b/.test(all), `${cause} prints an HTTP status`);
    assert.ok(!/error|exception|null|undefined/i.test(all), `${cause} leaks machine text`);
  }
});

// ---------------------------------------------------------------------------
// 4 · The waveform
// ---------------------------------------------------------------------------

test('the waveform is the artifact’s geometry', () => {
  assert.equal(WAVEFORM.height, 76);
  assert.equal(WAVEFORM.barWidth, 4);
  assert.equal(WAVEFORM.gap, 3);
  assert.equal(WAVEFORM_PITCH, 7);
  assert.equal(WAVEFORM.count, 48);
  // A bar never vanishes: a flat line reads as broken rather than as quiet.
  assert.ok(WAVEFORM.minHeight > 0);
});

test('bar colour is a function of position, never of amplitude', () => {
  // THE POINT OF THIS TEST. A hue that moved with loudness would be the
  // waveform encoding content, which is the one claim it must never make.
  // `barTone` takes an index and nothing else — there is no sample to pass it.
  assert.equal(barTone.length, 1);
  assert.equal(barTone(0), 'accent');
  assert.equal(barTone(1), 'accentWarm');
  assert.equal(barTone(2), 'accent');
  // Both are existing palette tokens; the design introduces no ninth colour.
  for (let i = 0; i < 48; i += 1) {
    assert.ok(['accent', 'accentWarm'].includes(barTone(i)));
  }
});

test('the meter stays decorative — the label and the timer carry the state', () => {
  const meter = code('src/components/intake/LevelMeter.tsx');
  assert.match(meter, /accessibilityElementsHidden/);
  assert.match(meter, /importantForAccessibility="no-hide-descendants"/);
  // And the two things that DO carry it are on the page.
  const route = code('src/app/walkthrough/index.tsx');
  assert.match(route, /recordingStateLabel\(recorder\.isPaused\)/);
  assert.match(route, /clock\(recorder\.elapsedMs\)/);
});

test('the recording frame says which state it is in, in words', () => {
  assert.equal(recordingStateLabel(false), 'Recording');
  assert.equal(recordingStateLabel(true), 'Paused');
  // And the supporting line states the paused arithmetic, which is true of the
  // recorder as it ships: `use-recorder` accumulates elapsed across pauses
  // precisely so `startedAt` cannot count the gap.
  assert.match(recordingSupportLine(true), /not counted/);
  assert.ok(!/heard|hearing|understood/i.test(recordingSupportLine(false)));
});

// ---------------------------------------------------------------------------
// 5 · Boxes and targets
// ---------------------------------------------------------------------------

test('cards, chips and controls carry the artifact’s measurements', () => {
  assert.equal(CARD.radius, 18);
  assert.equal(CARD.plate, 212);
  assert.equal(CHIP.radius, 12);
  assert.equal(CHIP.paddingVertical, 11);
  assert.equal(CHIP.paddingHorizontal, 18);
  assert.equal(CONTROL.primaryHeight, 56);
  assert.equal(CONTROL.secondaryHeight, 52);
  assert.equal(CONTROL.radius, 14);
});

test('every control height clears 44pt, and the AX floor clears 56', () => {
  assert.ok(CONTROL.secondaryHeight >= 44);
  assert.ok(CONTROL.primaryHeight >= 44);
  assert.ok(CONTROL.ax >= 56);
  // A chip is 11pt of padding around a ~22pt line box — over the floor without
  // relying on hitSlop to get there.
  assert.ok(CHIP.paddingVertical * 2 + 22 >= 44);
});

test('the serif scale is the one the artifact states', () => {
  assert.equal(TYPE.headline, 38);
  assert.equal(TYPE.timer, 58);
  assert.equal(TYPE.utterance, 17);
  // Examples are a RANGE because Dynamic Type moves them; the floor is the
  // reading size and nothing clamps the ceiling.
  assert.ok(TYPE.exampleMin < TYPE.exampleMax);
  assert.equal(TYPE.exampleMin, 25);
});

// ---------------------------------------------------------------------------
// 6 · What the frames must not have become
// ---------------------------------------------------------------------------

test('no progress bar, percentage or spinner on the reading state', () => {
  // The constitution's refusal — "progress is a count, never a bar or a
  // percentage" — plus this screen's own: the queue cannot promise a rate, so
  // a spinner would be a claim that something is being measured.
  const reading = code('src/components/intake/ReadingBack.tsx');
  for (const banned of ['ProgressTrack', 'ActivityIndicator', 'Spinner', '%']) {
    assert.ok(!reading.includes(banned), `ReadingBack draws ${banned}`);
  }
});

test('the spoken examples stay prose and never become chips', () => {
  const parts = code('src/components/intake/walkthrough-parts.tsx');
  const block = parts.slice(
    parts.indexOf('export function SpokenExamples'),
    parts.indexOf('export function ConsentLine'),
  );
  assert.match(block, /italic/);
  assert.ok(!/Chip/.test(block), 'the examples are drawn as chips');
  // Imperfect human phrasing, in quotation marks, because nobody speaks in
  // taxonomy — and three of them, per the frame.
  assert.equal(WALKTHROUGH_INVITATION.examples.length, 3);
  for (const example of WALKTHROUGH_INVITATION.examples) {
    assert.match(example, /^[“"].*[”"]$/);
  }
});

test('Drop is never drawn as a destructive control', () => {
  // Drop rejects a draft from THIS IMPORT and Undo brings it back; nothing in
  // this flow deletes a recording, a transcript or a word. A `critical` variant
  // would say otherwise, and it would say it in red.
  for (const f of [
    'src/components/intake/GarmentCard.tsx',
    'src/components/intake/CountStepper.tsx',
  ]) {
    const src = code(f);
    const dropButton = src.slice(src.indexOf('title="Drop"'));
    assert.ok(
      !dropButton.slice(0, 400).includes('critical'),
      `${f} draws Drop as a destructive action`,
    );
  }
});

test('the drop band names what survives, and offers Undo', () => {
  const card = read('src/components/intake/GarmentCard.tsx');
  assert.match(card, /Your recording and the words you said are untouched/);
  assert.match(card, /label: 'Undo'/);
});

test('the walkthrough’s named exit discards nothing', () => {
  const route = code('src/app/walkthrough/index.tsx');
  const leave = route.slice(route.indexOf('const leaveForLater'), route.indexOf('if (phase ==='));
  // Navigation only. No stop, no delete, no cancel of an in-flight request —
  // the session is resumable and the recording stays on the phone.
  assert.ok(!/stop\(|delete|remove|cancel|abort/i.test(leave), 'the exit does more than navigate');
  assert.match(leave, /router\.back\(\)/);
});

test('the listening phase draws no exit at all', () => {
  // The one place redesign 24's chrome is deliberately not built. A Cancel here
  // would have to answer "and the audio?" and neither answer is a chrome
  // change. Recorded as a test so the omission reads as a decision.
  const route = code('src/app/walkthrough/index.tsx');
  const listening = route.slice(
    route.indexOf("if (phase === 'listening')"),
    route.indexOf("if (phase === 'reading')"),
  );
  assert.match(listening, /<WalkthroughChrome\s+state=/);
  assert.ok(!listening.includes('exit={'), 'the recording frame offers an exit');
});
