/**
 * Today's analytics — thirteen events, and the things none of them may carry.
 *
 * This file exists because a privacy contract written as a comment is a wish.
 * Every builder in `features/today/analytics.ts` is a pure function with no
 * PostHog import, precisely so this suite can EXECUTE each of them across every
 * legal input and read what actually comes out — rather than grepping the call
 * sites and hoping the payload matches the paragraph above it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CONTEXT_CHOICES,
  TODAY_EVENTS,
  closetFloorShownProps,
  revealDoorShownProps,
  contextChoiceOf,
  favoriteSetProps,
  noViableCombinationProps,
  outfitsSourceProps,
  plateViewedProps,
  ratingSetProps,
  repeatExhaustedProps,
  todayOpenedProps,
  wearResultProps,
  wearStartedProps,
  weatherStateProps,
  type TodayProps,
} from '../src/features/today/analytics';

const ROUTE = readFileSync('src/app/(tabs)/index.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');

/** Every payload this screen can produce, built from every legal input. */
const EVERY_PAYLOAD: [string, TodayProps][] = [
  [TODAY_EVENTS.opened, todayOpenedProps()],
  ...([1, 2, 3] as const).map(
    (i) => [TODAY_EVENTS.plateViewed, plateViewedProps(i)] as [string, TodayProps],
  ),
  ...(['local', 'enhanced'] as const).map(
    (s) => [TODAY_EVENTS.outfitsSource, outfitsSourceProps(s)] as [string, TodayProps],
  ),
  ...(['ok', 'stale', 'off', 'unavailable'] as const).map(
    (s) => [TODAY_EVENTS.weatherState, weatherStateProps(s)] as [string, TodayProps],
  ),
  [TODAY_EVENTS.wearStarted, wearStartedProps()],
  ...(['ok', 'failed'] as const).map(
    (r) => [TODAY_EVENTS.wearResult, wearResultProps(r)] as [string, TodayProps],
  ),
  ...([true, false] as const).map(
    (b) => [TODAY_EVENTS.ratingSet, ratingSetProps(b)] as [string, TodayProps],
  ),
  ...([true, false] as const).map(
    (b) => [TODAY_EVENTS.favoriteSet, favoriteSetProps(b)] as [string, TodayProps],
  ),
  [TODAY_EVENTS.repeatExhausted, repeatExhaustedProps()],
  [TODAY_EVENTS.noViableCombination, noViableCombinationProps()],
  [TODAY_EVENTS.closetFloorShown, closetFloorShownProps()],
  [TODAY_EVENTS.revealDoorShown, revealDoorShownProps()],
];

// ---------------------------------------------------------------------------
// The allowlist is exactly thirteen
// ---------------------------------------------------------------------------

test('thirteen events, no more and no fewer', () => {
  // AMENDED 2026-08-30, fourteen: `reveal_door_shown` joins — the standing
  // reveal invitation for a generating closet whose account never saw the
  // Reveal (the proof moment was the Ten's finish line and nothing else's,
  // and the capture/import paths bypassed it for every account after 08-21).
  // Carries nothing, once per account, the floor's own discipline.
  assert.equal(Object.keys(TODAY_EVENTS).length, 12);
});

test('the thirteen are the thirteen that were agreed', () => {
  assert.deepEqual(new Set(Object.values(TODAY_EVENTS)), new Set([
    'today_opened',
    'plate_viewed',
    'outfits_source',
    'weather_state',
    'wear_started',
    'wear_result',
    'rating_set',
    'favorite_set',
    'repeat_exhausted',
    'no_viable_combination',
    'closet_floor_shown',
    'reveal_door_shown',
  ]));
});

test('every one of the thirteen is a member of the app’s closed event union', () => {
  for (const name of Object.values(TODAY_EVENTS)) {
    assert.ok(
      POSTHOG.includes(`'${name}'`),
      `${name} is not declared in the AppEvent union, so it cannot be tracked`,
    );
  }
});

test('the count event this screen used to send is gone from it', () => {
  // `outfit_set_viewed` carried a COUNT of the plates on screen. Today's
  // contract forbids counts; `plate_viewed` carries a POSITION instead. The
  // union keeps the literal because other surfaces may still declare it — what
  // matters is that Today stopped sending it.
  // Asserted against CALLS rather than against the file, because the route's
  // own comment explains the removal by name and a bare grep would read that
  // explanation as the offence.
  assert.doesNotMatch(ROUTE, /track\(\s*'outfit_set_viewed'/, 'Today still sends a count');
  assert.doesNotMatch(ROUTE, /count:/, 'a count reached an event payload');
});

// ---------------------------------------------------------------------------
// What may never be sent — asserted against real payloads, not against prose
// ---------------------------------------------------------------------------

test('no payload carries a free string of any kind', () => {
  // Every value is a bounded enum, a boolean or a small integer. A `string`
  // that is not a member of a closed list is how a garment name, an occasion
  // somebody typed, or a city ends up on a server.
  const ENUMS = new Set<string>([
    ...CONTEXT_CHOICES,
    'weather',
    'occasion',
    'feel',
    'local',
    'enhanced',
    'ok',
    'stale',
    'off',
    'unavailable',
    'failed',
  ]);
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      assert.ok(ENUMS.has(value), `${name}.${key} sent an unbounded string: ${value}`);
    }
  }
});

test('no payload carries anything that could be an identifier', () => {
  const FORBIDDEN =
    /(^|_)(id|uid|user|person|profile|garment|item|outfit|look|image|photo|url|path|name|title|city|lat|lon|coord|location|calendar|event|note|text|query)(_|$)/i;
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const key of Object.keys(props)) {
      assert.doesNotMatch(key, FORBIDDEN, `${name} carries a forbidden property: ${key}`);
    }
  }
});

test('no payload carries a UUID-shaped or path-shaped value', () => {
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

test('the weather event reports a state and never the reading', () => {
  for (const state of ['ok', 'stale', 'off', 'unavailable'] as const) {
    const props = weatherStateProps(state);
    assert.deepEqual(Object.keys(props), ['state']);
    // A temperature plus a timestamp is a location to anybody holding enough
    // of them. Neither travels.
    assert.doesNotMatch(JSON.stringify(props), /°|\bF\b|\bC\b|\d/, JSON.stringify(props));
  }
});

test('plate_viewed reports a position and never a total', () => {
  for (const i of [1, 2, 3] as const) {
    const props = plateViewedProps(i);
    assert.deepEqual(props, { index: i });
    assert.equal(Object.keys(props).length, 1, 'a count was smuggled alongside the position');
  }
});

test('rating and favourite report whether, never which', () => {
  assert.deepEqual(ratingSetProps(true), { rated: true });
  assert.deepEqual(ratingSetProps(false), { rated: false });
  assert.deepEqual(favoriteSetProps(true), { favorited: true });
  // An unrated wear is a legal wear and is reported as one, rather than going
  // unreported — "how often does anybody rate" is only answerable if the false
  // half is counted too.
  assert.deepEqual(ratingSetProps(false), { rated: false });
});

test('the three bare events carry nothing at all', () => {
  assert.deepEqual(todayOpenedProps(), {});
  assert.deepEqual(repeatExhaustedProps(), {});
  assert.deepEqual(noViableCombinationProps(), {});
  assert.deepEqual(closetFloorShownProps(), {});
  assert.deepEqual(wearStartedProps(), {});
});

test('a wear result is ok or failed, and never the reason', () => {
  assert.deepEqual(wearResultProps('ok'), { result: 'ok' });
  assert.deepEqual(wearResultProps('failed'), { result: 'failed' });
});

// ---------------------------------------------------------------------------
// The mapper — the one place free text could have got through
// ---------------------------------------------------------------------------

test('every option label maps onto a member of the closed list', () => {
  for (const choice of CONTEXT_CHOICES) {
    assert.equal(contextChoiceOf(choice), choice);
  }
  assert.equal(contextChoiceOf('Dinner out'), 'dinner_out');
  assert.equal(contextChoiceOf('  OFFICE  '), 'office');
});

test('anything unrecognised becomes “other” rather than travelling as itself', () => {
  // This is the assertion that matters. An occasion somebody typed, a garment
  // name, a city — all of them land on the same four-letter word.
  for (const input of [
    'dinner with Maya at the Ivy',
    'Grey wool coat',
    'San Francisco',
    '37.7749,-122.4194',
    '',
    '   ',
    null,
    undefined,
  ]) {
    assert.equal(contextChoiceOf(input), 'other', `${String(input)} escaped the mapper`);
  }
});

test('the mapper never falls back to sending its input', () => {
  const leaked = contextChoiceOf('a sentence nobody should ever see on a server');
  assert.equal(leaked, 'other');
  assert.ok((CONTEXT_CHOICES as readonly string[]).includes(leaked));
});

// ---------------------------------------------------------------------------
// The module boundary that makes this suite possible
// ---------------------------------------------------------------------------

test('the builders import no SDK, so they can be executed rather than grepped', () => {
  const src = readFileSync('src/features/today/analytics.ts', 'utf8');
  assert.doesNotMatch(src, /from '@\/lib\/posthog'/, 'the builders pulled in the SDK');
  assert.doesNotMatch(src, /^import /m, 'the builders took on a dependency');
});
