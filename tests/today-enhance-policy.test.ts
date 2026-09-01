/**
 * Workstream 4 — when Today is allowed to ask a model anything.
 *
 * The headline acceptance is a negative: an ordinary morning makes zero AI
 * calls. That is checked here as a property of the policy, and separately as a
 * property of the hook that gates on it — because a correct policy wired to
 * nothing is the failure this packet is most likely to ship.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  hasEventConflict,
  isComplexNote,
  isNearTie,
  shouldEnhanceWithAi,
} from '../src/features/styling/should-enhance.ts';
import {
  enhancementStatus,
  type EnhancementPhase,
} from '../src/features/styling/enhancement-status.ts';
import type { OutfitCandidate, StyleContext } from '../src/lib/styling/types.ts';

function candidate(score: number, id: string): OutfitCandidate {
  return {
    items: [{ id } as OutfitCandidate['items'][number]],
    features: {} as OutfitCandidate['features'],
    score,
    notes: {},
    harmonies: [],
  };
}

function event(formality: number, id = 'e1') {
  return { id, title: 't', startsAt: 540, endsAt: 600, formality, occasion: null, indoor: true };
}

/** A clear winner: the ordinary morning. */
const CLEAR = [candidate(0.9, 'a'), candidate(0.8, 'b'), candidate(0.7, 'c'), candidate(0.6, 'd')];

const PLAIN: Pick<StyleContext, 'note' | 'events' | 'targetOccasion'> = {
  note: null,
  events: [],
  targetOccasion: null,
};

// ---------------------------------------------------------------------------
// 1 · The acceptance case: an ordinary morning is silent
// ---------------------------------------------------------------------------

test('an ordinary morning asks nothing', () => {
  const decision = shouldEnhanceWithAi({ context: PLAIN, candidates: CLEAR, visible: 3 });
  assert.equal(decision.enhance, false);
  assert.equal(decision.reason, null);
});

test('one event at one formality is not a conflict', () => {
  const decision = shouldEnhanceWithAi({
    context: { ...PLAIN, events: [event(3)] },
    candidates: CLEAR,
    visible: 3,
  });
  assert.equal(decision.enhance, false);
});

test('a note the scorer already understood is not complex', () => {
  // "work" is in the occasion vocabulary; `targetOccasion` proves it was read.
  const decision = shouldEnhanceWithAi({
    context: { note: 'work', events: [], targetOccasion: 'work' },
    candidates: CLEAR,
    visible: 3,
  });
  assert.equal(decision.enhance, false, 'a recognised note bought a model call');
});

test('an empty shortlist asks nothing rather than asking about nothing', () => {
  assert.equal(
    shouldEnhanceWithAi({ context: PLAIN, candidates: [], visible: 3 }).enhance,
    false,
  );
});

// ---------------------------------------------------------------------------
// 2 · The three reasons that do take the branch
// ---------------------------------------------------------------------------

test('a complex free-text note takes the branch', () => {
  const decision = shouldEnhanceWithAi({
    context: { note: 'dinner then drinks', events: [], targetOccasion: 'dinner' },
    candidates: CLEAR,
    visible: 3,
  });
  assert.equal(decision.enhance, true);
  assert.equal(decision.reason, 'complex_note');

  // Two clauses is the tell, even when the occasion was recognised.
  assert.equal(isComplexNote('work, then a birthday dinner', 'work'), true);
  // Unrecognised and substantial.
  assert.equal(isComplexNote('something for my sisters engagement party', null), true);
  // Short and unrecognised is not enough to spend a call on.
  assert.equal(isComplexNote('brunch', null), false);
  assert.equal(isComplexNote('   ', null), false);
});

test('a multi-event formality conflict takes the branch', () => {
  const decision = shouldEnhanceWithAi({
    context: { ...PLAIN, events: [event(2, 'gym'), event(5, 'gala')] },
    candidates: CLEAR,
    visible: 3,
  });
  assert.equal(decision.enhance, true);
  assert.equal(decision.reason, 'event_conflict');

  // A 3 and a 4 are the same outfit; that is not a conflict.
  assert.equal(hasEventConflict([event(3), event(4)]), false);
  assert.equal(hasEventConflict([event(5)]), false);
  assert.equal(hasEventConflict([]), false);
});

test('a measured near-tie takes the branch', () => {
  const tied = [candidate(0.900, 'a'), candidate(0.898, 'b'), candidate(0.896, 'c'), candidate(0.894, 'd')];
  const decision = shouldEnhanceWithAi({ context: PLAIN, candidates: tied, visible: 3 });
  assert.equal(decision.enhance, true);
  assert.equal(decision.reason, 'near_tie');

  // MEASURED, not assumed: a clear winner over the same number of candidates
  // must not take the branch.
  assert.equal(isNearTie(CLEAR, 3), false);
  // A tie beyond the visible set plus one is not a question anybody is looking
  // at — the eleventh and twelfth candidates are off screen.
  const deepTie = [candidate(0.9, 'a'), candidate(0.7, 'b'), candidate(0.5, 'c'), candidate(0.5, 'd')];
  assert.equal(isNearTie(deepTie, 3), false);
  assert.equal(isNearTie([candidate(0.9, 'a')], 3), false);
});

test('the reason reported is the one the user would recognise', () => {
  // All three conditions at once. The note is what they typed.
  const tied = [candidate(0.9, 'a'), candidate(0.899, 'b')];
  const decision = shouldEnhanceWithAi({
    context: { note: 'lunch then a wedding', events: [event(2), event(5)], targetOccasion: null },
    candidates: tied,
    visible: 1,
  });
  assert.equal(decision.reason, 'complex_note');
});

// ---------------------------------------------------------------------------
// 3 · The policy is actually wired, and late output cannot move a card
// ---------------------------------------------------------------------------

function hookSource(): string {
  return readFileSync('src/features/styling/use-outfits.ts', 'utf8');
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the enhancement query is gated on the policy', () => {
  const src = stripComments(hookSource());
  assert.match(src, /shouldEnhanceWithAi\(/, 'the policy is not called');
  assert.match(
    src,
    /enabled:\s*enabled && shortlist\.length > 0 && decision\.enhance/,
    'the query can still fire without a reason',
  );
});

test('the visible list is built from the engine, never from the picks', () => {
  const src = stripComments(hookSource());
  // The merge maps over `base` — the engine's own ordering — and looks the
  // model's words up by id. The old shape built the list FROM the picks, in
  // the model's order, which is how a late response reordered cards.
  assert.match(src, /base\.map\(\(outfit\) =>/);
  assert.ok(
    !/for \(const pick of ai\.data\.picks\)/.test(src),
    'the merge iterates the model output again, so it can reorder the screen',
  );
  // A pick naming a candidate that is not visible must be discarded, not shown.
  assert.match(src, /const pick = words\.get\(candidateId\(outfit\.candidate\)\);/);
  assert.match(src, /if \(!pick\) return outfit;/);
});

test('a failed or empty enhancement leaves the same complete outfits', () => {
  const src = stripComments(hookSource());
  // Every branch that is not a successful enrichment returns `base`, which is
  // the engine's full list — never a partial one and never an empty one.
  for (const branch of [
    // Every pre-merge outcome — error, un-asked, unanswered, empty answer —
    // is one classifier call and one return, and that return is `base`: the
    // engine's full list, never a partial one and never an empty one. The
    // classification itself is `src/features/styling/enhancement-status.ts`,
    // asserted case by case in section 4; the timeout/outage split is pinned
    // in tests/openrouter-timeout-classification.test.ts.
    /const early = enhancementStatus\(\{/,
    /if \(early\) return \{ outfits: base, status: early \};/,
    /enriched\s*\?\s*\{ outfits: merged[\s\S]{0,80}\{ outfits: base/,
  ]) {
    assert.match(src, branch);
  }
  // And no retry: a failure here costs the user nothing, and retrying a
  // twenty-second call is worse than not.
  assert.match(src, /retry: false/);
});

test('a local-only morning is not reported as offline', () => {
  const src = stripComments(hookSource());
  assert.match(src, /status: 'local'/, 'the ordinary morning still claims to be offline');
});

// ---------------------------------------------------------------------------
// 4 · Issue 5 — a question in flight is not a network verdict
// ---------------------------------------------------------------------------
//
// After a successful wear the reaction controls flashed "unavailable without a
// connection" on a working connection. `disabled={outfits.status === 'offline'}`
// is the switch, and the merge was reaching `'offline'` by fall-through: a
// re-rank query that had simply not answered yet looked exactly like one that
// had failed. The wear is what changes the key — the worn garments leave the
// shortlist, the shortlist is IN the key, and a fresh key has no cache.

/** One instant of the re-rank query, healthy and answered, as a baseline. */
const ANSWERED: EnhancementPhase = {
  consentRequired: false,
  requested: true,
  errored: false,
  answered: true,
  usable: true,
  fetching: false,
  failed: 'offline',
};

test('an asked-but-unanswered enhancement is enhancing, not offline', () => {
  // The exact frame after a wear: new key, nothing cached, the fetch not yet
  // flagged in flight. No error has occurred and nothing has been reported.
  const status = enhancementStatus({
    ...ANSWERED,
    answered: false,
    usable: false,
    fetching: false,
  });
  assert.notEqual(status, 'offline', 'a query that has not answered yet reads as an outage');
  assert.equal(status, 'enhancing');
});

test('the post-wear sequence never passes through offline', () => {
  // Healthy → wear → key changes → fetch starts → answer lands. Every frame.
  const sequence: [string, EnhancementPhase][] = [
    ['settled on a good answer', ANSWERED],
    // Key changed. No data for it, and `isFetching` has not turned over yet.
    ['fresh key, not yet fetching', { ...ANSWERED, answered: false, usable: false }],
    // Fetch in flight against the new key.
    ['fresh key, fetching', { ...ANSWERED, answered: false, usable: false, fetching: true }],
    // Answer lands.
    ['answered again', ANSWERED],
  ];

  for (const [label, phase] of sequence) {
    const status = enhancementStatus(phase);
    assert.notEqual(status, 'offline', `${label} disabled the reaction controls`);
    assert.notEqual(status, 'timeout', `${label} claimed the model ran long`);
  }
});

test('offline is claimed, never fallen into', () => {
  // A transport error is the one unprompted outage signal.
  assert.equal(enhancementStatus({ ...ANSWERED, errored: true }), 'offline');
  // And a response that says so itself.
  assert.equal(enhancementStatus({ ...ANSWERED, usable: false, failed: 'offline' }), 'offline');
  // The timeout still reads as its own thing rather than as an outage.
  assert.equal(enhancementStatus({ ...ANSWERED, usable: false, failed: 'timeout' }), 'timeout');
  // A refetch over a stale empty answer is still work in progress.
  assert.equal(
    enhancementStatus({ ...ANSWERED, usable: false, fetching: true, failed: 'offline' }),
    'enhancing',
  );
  // Consent outranks everything: it is not a network condition.
  assert.equal(
    enhancementStatus({ ...ANSWERED, consentRequired: true, errored: true }),
    'consent_required',
  );
  // Nothing asked, nothing missing.
  assert.equal(enhancementStatus({ ...ANSWERED, requested: false, usable: false }), 'local');
  // A usable answer is the merge's business, not this function's.
  assert.equal(enhancementStatus(ANSWERED), null);
});

test('an enhancement that enriched nothing is not an outage either', () => {
  const src = stripComments(hookSource());
  // A response that landed, parsed and simply named no visible candidate leaves
  // the engine's own complete outfits on screen. That is `'local'` — the same
  // state as a morning that asked nothing — and reporting it as `'offline'`
  // greyed out the taste controls over a successful round trip.
  assert.match(src, /enriched\s*\?\s*\{ outfits: merged, status: 'ai'[\s\S]{0,80}status: 'local'/);
});

test('the merge routes its status through the classifier', () => {
  const src = stripComments(hookSource());
  assert.match(src, /enhancementStatus\(\{/, 'the merge still decides status inline');
  // The timeout/outage split is still made from the response the function sent.
  assert.match(src, /ai\.data\?\.reason === 'styling_timeout' \? 'timeout' : 'offline'/);
  // `answered` must be the presence of data, not a truthiness test on it.
  assert.match(src, /answered: ai\.data !== undefined/);
});
