import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyZero,
  mayStampSeen,
  type SeenMoment,
  type ZeroReason,
} from '../src/features/onboarding/reveal-zero-core';
import { ZERO_REASONS, revealPhaseProps } from '../src/features/onboarding/reveal-analytics';

// ---------------------------------------------------------------------------
// Classification — every combination, behaviorally
// ---------------------------------------------------------------------------

test('a settled, fully-read closet that makes nothing is the only honest zero', () => {
  assert.equal(classifyZero({ queryFailed: false, untagged: 0, consented: true }), 'unpairable');
  assert.equal(classifyZero({ queryFailed: false, untagged: 0, consented: false }), 'unpairable');
});

test('pending pieces make an unread zero, split by whether tagging may run', () => {
  assert.equal(classifyZero({ queryFailed: false, untagged: 1, consented: true }), 'unread');
  assert.equal(classifyZero({ queryFailed: false, untagged: 13, consented: false }), 'no_consent');
});

test('a failed read outranks everything — the other facts are its wreckage', () => {
  for (const untagged of [0, 5]) {
    for (const consented of [true, false]) {
      assert.equal(classifyZero({ queryFailed: true, untagged, consented }), 'query_failed');
    }
  }
});

test('the 2026-08-31 production sessions classify as the honest zero', () => {
  // Both: settled data (0 untagged), consent v2, no query failure — shoeless
  // closets whose arithmetic honestly computes zero.
  assert.equal(classifyZero({ queryFailed: false, untagged: 0, consented: true }), 'unpairable');
});

test('the 2026-08-20 production session classifies as consent-blocked, not honest', () => {
  // 11 pieces at pending_tag, consent never granted.
  assert.equal(classifyZero({ queryFailed: false, untagged: 11, consented: false }), 'no_consent');
});

// ---------------------------------------------------------------------------
// The seen-stamp — delivery moments only
// ---------------------------------------------------------------------------

test('complete stamps, and only outside a zero', () => {
  assert.equal(mayStampSeen('complete', null), true);
  for (const reason of ZERO_REASONS) {
    assert.equal(mayStampSeen('complete', reason), false, reason);
  }
});

test('a zero exit stamps only from the honest zero', () => {
  const exits: SeenMoment[] = ['zero_repair', 'zero_open_today'];
  for (const moment of exits) {
    assert.equal(mayStampSeen(moment, 'unpairable'), true, moment);
    for (const reason of ['unread', 'no_consent', 'query_failed'] as ZeroReason[]) {
      assert.equal(mayStampSeen(moment, reason), false, `${moment} ${reason}`);
    }
    // A zero exit with no zero on screen is a call-site bug; refuse the stamp.
    assert.equal(mayStampSeen(moment, null), false, `${moment} null`);
  }
});

// ---------------------------------------------------------------------------
// The zero reason travels bounded, and only on the zero
// ---------------------------------------------------------------------------

test('zero_reason rides the zero phase alone, as a closed-vocabulary word', () => {
  for (const reason of ZERO_REASONS) {
    const props = revealPhaseProps('zero', reason);
    assert.deepEqual(props, { phase: 'zero', zero_reason: reason });
  }
  // Off the zero, the reason never travels — even when a caller passes one.
  assert.deepEqual(revealPhaseProps('complete', 'unpairable'), { phase: 'complete' });
  assert.deepEqual(revealPhaseProps('counting'), { phase: 'counting' });
  // A zero with no reason stays a bare phase rather than sending undefined.
  assert.deepEqual(revealPhaseProps('zero'), { phase: 'zero' });
});

test('no payload carries a count, an id, or free text', () => {
  for (const reason of ZERO_REASONS) {
    for (const value of Object.values(revealPhaseProps('zero', reason))) {
      assert.equal(typeof value, 'string');
      assert.doesNotMatch(String(value), /\d/);
    }
  }
});
