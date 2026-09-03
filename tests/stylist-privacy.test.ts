/**
 * The stylist's analytics — ten events, and the prompt that never leaves.
 * Redesign 16.
 *
 * Every builder in `features/stylist/stylist-analytics.ts` is a pure function
 * with no PostHog import, so this suite EXECUTES each of them across every
 * legal input and reads what actually comes out.
 *
 * The forbidden list is led by one thing. A stylist prompt is somebody
 * describing their own life in their own words — a funeral, an interview, a
 * first date — and it is the most sensitive string this app ever holds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHAT_ERROR_CAUSES,
  DOOR_INDICES,
  PLATE_COUNTS,
  STEP_NUMBERS,
  STYLIST_EVENTS,
  allowanceMarkShownProps,
  chatErrorProps,
  chatReplyOkProps,
  chatSentProps,
  doorTappedProps,
  openedProps,
  plateTappedProps,
  platesShownProps,
  questionnaireStepProps,
  type StylistProps,
} from '../src/features/stylist/stylist-analytics';

const ROUTE_RAW = readFileSync('src/app/(tabs)/stylist.tsx', 'utf8');
const CHAT_RAW = readFileSync('src/features/stylist/use-chat.ts', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ROUTE = stripped(ROUTE_RAW);
const CHAT = stripped(CHAT_RAW);

/** Every payload this screen can produce, from every legal input. */
const EVERY_PAYLOAD: [string, StylistProps][] = [
  [STYLIST_EVENTS.opened, openedProps()],
  ...DOOR_INDICES.map((i) => [STYLIST_EVENTS.doorTapped, doorTappedProps(i)] as [string, StylistProps]),
  ...STEP_NUMBERS.map(
    (n) => [STYLIST_EVENTS.questionnaireStep, questionnaireStepProps(n)] as [string, StylistProps],
  ),
  [STYLIST_EVENTS.chatSent, chatSentProps()],
  [STYLIST_EVENTS.chatReplyOk, chatReplyOkProps()],
  ...CHAT_ERROR_CAUSES.map(
    (c) => [STYLIST_EVENTS.chatError, chatErrorProps(c)] as [string, StylistProps],
  ),
  ...PLATE_COUNTS.map(
    (c) => [STYLIST_EVENTS.platesShown, platesShownProps(c)] as [string, StylistProps],
  ),
  [STYLIST_EVENTS.plateTapped, plateTappedProps()],
  ...[true, false].map(
    (b) => [STYLIST_EVENTS.allowanceMarkShown, allowanceMarkShownProps(b)] as [string, StylistProps],
  ),
];

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

test('ten events, no more', () => {
  assert.equal(Object.keys(STYLIST_EVENTS).length, 9);
  assert.deepEqual(new Set(Object.values(STYLIST_EVENTS)), new Set([
    'stylist_opened',
    'door_tapped',
    'questionnaire_step',
    'chat_sent',
    'chat_reply_ok',
    'chat_error',
    'plates_shown',
    'plate_tapped',
    'allowance_mark_shown',
  ]));
});

test('all ten are members of the app’s closed event union', () => {
  for (const name of Object.values(STYLIST_EVENTS)) {
    assert.ok(POSTHOG.includes(`'${name}'`), `${name} cannot be tracked`);
  }
});

test('the route sends only events from the allowlist', () => {
  const sent = [...ROUTE.matchAll(/track\(\s*STYLIST_EVENTS\.(\w+)/g)].map((m) => m[1]);
  const allowed = new Set(Object.keys(STYLIST_EVENTS));
  for (const s of sent) assert.ok(allowed.has(s!), `the route sends ${s}`);
  assert.ok(sent.length >= 6, `expected the call sites, found ${sent.length}`);
});

// ---------------------------------------------------------------------------
// THE PROMPT NEVER LEAVES
// ---------------------------------------------------------------------------

test('NO PAYLOAD CARRIES A STRING THAT IS NOT A BOUNDED ENUM', () => {
  const ENUMS = new Set<string>([...CHAT_ERROR_CAUSES]);
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      assert.ok(ENUMS.has(value), `${name}.${key} sent an unbounded string: ${value}`);
    }
  }
});

test('no track call anywhere on this screen touches the question or the reply', () => {
  for (const [name, src] of [
    ['route', ROUTE],
    ['use-chat', CHAT],
  ] as const) {
    const calls = src.match(/track\([\s\S]{0,180}?\)/g) ?? [];
    for (const c of calls) {
      // The event NAME and the builder's name are identifiers, not payload —
      // `chatReplyOk` is a name for the fact that a reply landed, and a sweep
      // that flagged it would be a gate nobody can satisfy. What must never
      // appear is the CONTENT, so the identifiers are stripped and only the
      // arguments are scanned.
      const args = c
        .replace(/STYLIST_EVENTS\.\w+/g, '')
        .replace(/\b\w+Props\b/g, '');
      assert.doesNotMatch(
        args,
        /\bdraft\b|\bquestion\b|\btext\b|message|prompt|transcript|reply|answer|brief|mood|entry/i,
        `${name}: ${c}`,
      );
    }
  }
});

test('no payload key could be an identifier, a name, a path or a price', () => {
  const FORBIDDEN =
    /(^|_)(id|uid|user|item|outfit|garment|piece|name|title|brand|price|cost|image|photo|url|path|text|prompt|message|transcript|history|friend|city|lat|lon|location)(_|$)/i;
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const key of Object.keys(props)) {
      assert.doesNotMatch(key, FORBIDDEN, `${name} carries a forbidden property: ${key}`);
    }
  }
});

test('no payload carries a uuid, a path or a url', () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const value of Object.values(props)) {
      if (typeof value !== 'string') continue;
      assert.doesNotMatch(value, UUID, `${name} sent a uuid`);
      assert.doesNotMatch(value, /[/.]/, `${name} sent something path-shaped: ${value}`);
      assert.doesNotMatch(value, /https?:/i, `${name} sent a url`);
    }
  }
});

test('sending and replying report only THAT they happened', () => {
  assert.deepEqual(chatSentProps(), {});
  assert.deepEqual(chatReplyOkProps(), {});
  assert.deepEqual(openedProps(), {});
  assert.deepEqual(plateTappedProps(), {});
});

test('a door reports its POSITION, never its label or its intent', () => {
  for (const i of DOOR_INDICES) assert.deepEqual(doorTappedProps(i), { index: i });
  const calls = ROUTE.match(/doorTappedProps\([^)]*\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /label|seed|entry|action/, c);
    assert.match(c, /doorIndex\(/, `the index was not derived: ${c}`);
  }
});

test('a chat error reports a bounded CAUSE, never the server’s message', () => {
  for (const c of CHAT_ERROR_CAUSES) assert.deepEqual(chatErrorProps(c), { cause: c });
  // Four causes for four different remedies.
  assert.equal(CHAT_ERROR_CAUSES.length, 4);
});

test('plates_shown describes the reply, and is bounded', () => {
  for (const c of PLATE_COUNTS) {
    assert.deepEqual(platesShownProps(c), { count: c });
    assert.ok(c <= 3, 'the count is not bounded');
  }
  // It is capped at the call site too, so it can never carry a wardrobe size.
  assert.match(ROUTE, /Math\.min\(3, m\.outfits\.length\)/);
});

test('the allowance mark reports WHETHER, never the number behind it', () => {
  for (const b of [true, false]) assert.deepEqual(allowanceMarkShownProps(b), { shown: b });
  const calls = ROUTE.match(/allowanceMarkShownProps\([^)]*\)/g) ?? [];
  for (const c of calls) assert.doesNotMatch(c, /remaining|used|limit/, c);
});

// ---------------------------------------------------------------------------
// The module boundary
// ---------------------------------------------------------------------------

test('the builders take on no dependency, so they can be executed', () => {
  const src = readFileSync('src/features/stylist/stylist-analytics.ts', 'utf8');
  assert.doesNotMatch(src, /^import /m, 'the builders took on a dependency');
});

test('the spec takes on nothing that would stop a test running it', () => {
  const src = readFileSync('src/features/stylist/stylist-spec.ts', 'utf8');
  const imports = src.match(/^import .*$/gm) ?? [];
  for (const i of imports) {
    assert.match(i, /questionnaire/, `the spec imports something heavy: ${i}`);
  }
});
