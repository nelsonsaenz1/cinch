/**
 * The lifestyle profile's closed vocabularies and the gates they open.
 *
 * Three consumers hang off these mappings — the scorer's soft preference,
 * the stylist's day question, the brief's one sentence — and each is only as
 * honest as the vocabulary underneath. So the vocabulary is what these tests
 * hold: closure against the tagger's own occasion set, the once-ever offer
 * predicate, and the questionnaire actually changing shape.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALL_LIFESTYLE_DAY_OPTIONS,
  LIFE_STAGES,
  LIFESTYLE_OCCASIONS,
  MAX_DRESS_OCCASIONS,
  dayOptionsFor,
  engineOccasionsFor,
  lifestyleSummaryLine,
  occasionOrderFor,
  shouldOfferStyleProfile,
  type LifeStageKey,
} from '../src/features/profile/lifestyle';
import { PLANS } from '../src/features/billing/plans';
import { lifestyleOpeningLine } from '../src/features/stylist/opening';
import { OCCASIONS, buildSteps } from '../src/features/stylist/questionnaire';
import { occasionRule } from '../src/lib/styling';
import { occasion as taggerOccasion } from '../src/schemas/item';
import { garment, resetIds } from './helpers';

// ---------------------------------------------------------------------------
// Vocabulary closure
// ---------------------------------------------------------------------------

test('every engine tag a lifestyle occasion names is one the tagger can write', () => {
  // The soft preference matches ctx.lifestyleOccasions against garment
  // occasion tags. A tag the tagger never writes can never match, so a drift
  // here silently turns a lifestyle answer into a no-op.
  const canonical = new Set<string>(taggerOccasion.options);
  for (const o of LIFESTYLE_OCCASIONS) {
    assert.ok(o.engine.length > 0, `${o.key} reaches no engine tag`);
    for (const tag of o.engine) {
      assert.ok(canonical.has(tag), `${o.key} names unknown tag "${tag}"`);
    }
  }
});

test('every stage orders the FULL occasion list, nothing dropped or doubled', () => {
  const all = LIFESTYLE_OCCASIONS.map((o) => o.key).sort();
  for (const stage of [...LIFE_STAGES.map((s) => s.key), null]) {
    const order = occasionOrderFor(stage as LifeStageKey | null);
    assert.deepEqual([...order].sort(), all, String(stage));
  }
});

test('a student leads with class and going out; a professional with work', () => {
  assert.deepEqual(occasionOrderFor('college').slice(0, 2), ['class', 'going_out']);
  assert.equal(occasionOrderFor('early_career')[0], 'work');
  assert.equal(occasionOrderFor('established')[0], 'work');
});

test('engineOccasionsFor dedupes across the fan-out and keeps selection order', () => {
  // class → casual, weekend → casual, work → office: one casual, then office.
  assert.deepEqual(engineOccasionsFor(['class', 'weekend', 'work']), ['casual', 'office']);
  assert.deepEqual(engineOccasionsFor([]), []);
  // Unknown keys (a value that drifted out of the vocabulary) contribute
  // nothing rather than throwing — the column is permissive by design.
  assert.deepEqual(engineOccasionsFor(['scuba']), []);
});

// ---------------------------------------------------------------------------
// The day question
// ---------------------------------------------------------------------------

test('under two real occasions there is nothing to personalise', () => {
  assert.equal(dayOptionsFor([]), null);
  assert.equal(dayOptionsFor(['class']), null);
  assert.equal(dayOptionsFor(['scuba', 'class']), null);
});

test('the personalised day question is three lifestyle answers plus the catch-all', () => {
  const options = dayOptionsFor(['class', 'going_out', 'game_day', 'rush']);
  assert.ok(options);
  assert.equal(options.length, 4);
  assert.deepEqual(
    options.map((o) => o.key),
    ['class', 'going_out', 'game_day', 'day'],
  );
  // The catch-all is byte-identical to the stock questionnaire's own, so a
  // tapped "A normal day" composes the same ask either way.
  const stock = OCCASIONS.find((o) => o.key === 'day')!;
  const mine = options[3]!;
  assert.equal(mine.label, stock.label);
  assert.equal(mine.phrase, stock.phrase);
  assert.equal(mine.formality, stock.formality);
  assert.equal(mine.occasion, stock.occasion);
});

test('buildSteps offers the lifestyle options on the day path and never on the event path', () => {
  resetIds();
  const wardrobe = [garment('base_top', 'white'), garment('bottom', 'navy')];
  const selected = ['class', 'going_out', 'game_day'];

  const day = buildSteps('dressed', {
    wardrobe,
    weather: null,
    temperature: null,
    lifestyleOccasions: selected,
  });
  assert.deepEqual(
    day[0]!.options.map((o) => o.key),
    ['class', 'going_out', 'game_day', 'day'],
  );

  const event = buildSteps('event', {
    wardrobe,
    weather: null,
    temperature: null,
    lifestyleOccasions: selected,
  });
  assert.ok(event[0]!.options.some((o) => o.key === 'wedding'), 'a wedding stayed a wedding');

  const stock = buildSteps('dressed', { wardrobe, weather: null, temperature: null });
  assert.deepEqual(
    stock[0]!.options.map((o) => o.key),
    OCCASIONS.map((o) => o.key),
  );
});

test('every lifestyle day option is findable by composeAsk', () => {
  // `findOccasion` searches ALL_LIFESTYLE_DAY_OPTIONS; a key missing from it
  // would compose "Help me get dressed." for an answer the person tapped.
  const keys = new Set(ALL_LIFESTYLE_DAY_OPTIONS.map((o) => o.key));
  for (const o of LIFESTYLE_OCCASIONS) assert.ok(keys.has(o.key), o.key);
});

// ---------------------------------------------------------------------------
// The brief's sentence
// ---------------------------------------------------------------------------

test('the summary line reads as a fact and never lists past the cap', () => {
  assert.equal(
    lifestyleSummaryLine('college', ['class', 'going_out', 'game_day']),
    'are a student and mostly dress for class, going out and game day',
  );
  assert.equal(lifestyleSummaryLine(null, ['work']), 'mostly dress for work');
  assert.equal(lifestyleSummaryLine('established', []), null);
  assert.equal(lifestyleSummaryLine(null, []), null);

  const line = lifestyleSummaryLine(
    'college',
    LIFESTYLE_OCCASIONS.map((o) => o.key),
  )!;
  // MAX_DRESS_OCCASIONS labels at most — the server prints this verbatim.
  const commas = (line.match(/,/g) ?? []).length;
  assert.ok(commas <= MAX_DRESS_OCCASIONS - 2, line);
  assert.ok(line.length <= 240, 'over the server line ceiling');
});

// ---------------------------------------------------------------------------
// The once-ever offer
// ---------------------------------------------------------------------------

test('the offer is made exactly when nothing has been stamped or answered', () => {
  assert.equal(
    shouldOfferStyleProfile({ status: 'ready', promptedAt: null, lifeStage: null, occasions: [] }),
    true,
  );
  // Stamped by a Skip: never again.
  assert.equal(
    shouldOfferStyleProfile({ status: 'ready', promptedAt: '2026-08-20', lifeStage: null, occasions: [] }),
    false,
  );
  // Answers without a stamp (a half-landed write): treated as been-through.
  assert.equal(
    shouldOfferStyleProfile({ status: 'ready', promptedAt: null, lifeStage: 'college', occasions: [] }),
    false,
  );
  assert.equal(
    shouldOfferStyleProfile({ status: 'ready', promptedAt: null, lifeStage: null, occasions: ['work'] }),
    false,
  );
  // A read still in flight, or one that failed, never re-offers.
  assert.equal(shouldOfferStyleProfile({ status: 'loading' }), false);
  assert.equal(shouldOfferStyleProfile({ status: 'unavailable' }), false);
});

// ---------------------------------------------------------------------------
// The profile, visibly listened to
// ---------------------------------------------------------------------------

test('a strong occasion fit is SAID, not only scored', () => {
  resetIds();
  const officeCloset = [
    garment('base_top', 'white', { occasions: ['office'] }),
    garment('bottom', 'charcoal', { occasions: ['office'] }),
    garment('footwear', 'black', { occasions: ['office', 'casual'] }),
  ];
  // The explicit ask names the tag back.
  const asked = occasionRule(officeCloset, 'office');
  assert.equal(asked.note, 'dressed for office');
  // The standing profile names the profile.
  const standing = occasionRule(officeCloset, null, ['office']);
  assert.equal(standing.note, 'true to what you dress for');
  // And a weak fit says nothing — a note explaining a miss as a feature is
  // the palette rule's own refusal, held here too.
  const weak = occasionRule(officeCloset, 'gym');
  assert.equal(weak.note, undefined);
});

test('the stylist opening can ask the profile’s own question — day slots only', () => {
  assert.equal(
    lifestyleOpeningLine('morning', ['Class', 'Going out']),
    'Class today, or going out?',
  );
  assert.equal(lifestyleOpeningLine('morning', ['Class']), null);
  assert.equal(lifestyleOpeningLine('evening', ['Class', 'Going out']), null);
  assert.equal(lifestyleOpeningLine('night', ['Class', 'Going out']), null);
});

// ---------------------------------------------------------------------------
// The lifetime event cap — client copy pinned to the migration
// ---------------------------------------------------------------------------

test('PLANS.free.eventJoins agrees with event_join_limit_for_plan, both ways', () => {
  // The trigger is the boundary; this copy only explains it. A drifted copy
  // explains a boundary that does not exist, which is worse than silence.
  const migration = readFileSync(
    'supabase/migrations/20260826000000_event_join_lifetime_cap.sql',
    'utf8',
  );
  const m = migration.match(/when 'free' then (\d+) else null end/);
  assert.ok(m, 'the migration no longer states the free cap the expected way');
  assert.equal(PLANS.free.eventJoins, Number(m![1]));
  assert.equal(PLANS.standard.eventJoins, null);
  assert.equal(PLANS.pro.eventJoins, null);
  // And the ledger it counts is insert-once with no event FK — the two facts
  // that make "all-time" true across leaving and event deletion.
  assert.match(migration, /event_id uuid not null,\n/);
  assert.doesNotMatch(migration, /event_id uuid not null references/);
  assert.match(migration, /security definer/);
});
