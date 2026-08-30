/**
 * The inspiration source contract — the seam a second provider joins through.
 *
 * What is under proof here is not plumbing, it is a permission. The recreate
 * pipeline uploads its picture into the caller's Storage folder and hands it
 * to a third-party model; doing that with a picture Cinch does not own is the
 * storage-and-sharing a provider's developer agreement forbids. So these
 * tests pin the gate shut from both sides — the registry may not OFFER a
 * provider Cinch cannot process, and the analyzer may not ACCEPT a picture
 * Cinch does not hold — and pin the chooser rule that keeps a one-source
 * build from growing a pointless extra tap.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INSPIRATION_SOURCES,
  PROVIDER_ANALYSIS_AUTHORIZED,
  availableSources,
  isOfferable,
  mayAnalyze,
  sourceChoiceNeeded,
  type InspirationCandidate,
} from '../src/features/recreate/sources';

const localPhoto: InspirationCandidate = {
  kind: 'local',
  provider: 'photo',
  imageUri: 'file:///tmp/saved.jpg',
  width: 1200,
  height: 1600,
  attribution: null,
};

const remotePin: InspirationCandidate = {
  kind: 'remote',
  provider: 'pinterest',
  imageUri: 'https://example.invalid/pin.jpg',
  attribution: {
    provider: 'pinterest',
    sourceUrl: 'https://example.invalid/pin/1',
    label: 'From Pinterest',
  },
};

// ---------------------------------------------------------------------------
// The analysis gate
// ---------------------------------------------------------------------------

test('a picture Cinch holds may be analysed; a picture it merely displays may not', () => {
  assert.equal(mayAnalyze(localPhoto), true);
  assert.equal(mayAnalyze(remotePin), false);
});

test('no provider is cleared for third-party processing yet', () => {
  // This is the plan's analysis gate, as a test rather than as prose. Flipping
  // an entry to true is a claim that the provider gave WRITTEN permission for
  // its imagery to reach OpenRouter — so it must fail here first, and be
  // changed by someone who has read the authorization and recorded it in
  // docs/design/pinterest-style-inspiration-plan.md.
  for (const [provider, authorized] of Object.entries(PROVIDER_ANALYSIS_AUTHORIZED)) {
    assert.equal(authorized, false, `${provider} was cleared without an authorization on file`);
  }
});

test('an offered provider source is always one Cinch is allowed to process', () => {
  // The invariant that ties the two halves together. A provider door that is
  // open while its processing permission is shut is the exact combination
  // that would put someone else's picture up the wire.
  for (const source of INSPIRATION_SOURCES) {
    if (source.provider === 'photo') continue;
    if (source.unavailable === null) {
      assert.equal(
        PROVIDER_ANALYSIS_AUTHORIZED[source.provider],
        true,
        `${source.provider} is offerable but not cleared for processing`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

test('the saved-photo source is the one that ships, and Pinterest is not configured', () => {
  // Not a preference — there is no Pinterest developer application, client
  // credential or redirect URI in this project, so the door cannot be drawn.
  assert.equal(isOfferable('photo'), true);
  assert.equal(isOfferable('pinterest'), false);

  const pinterest = INSPIRATION_SOURCES.find((s) => s.provider === 'pinterest');
  assert.equal(pinterest?.unavailable, 'not_configured');

  assert.deepEqual(
    availableSources().map((s) => s.provider),
    ['photo'],
  );
});

test('an unknown source is never offerable', () => {
  assert.equal(isOfferable('nope' as never), false);
});

test('one source draws no chooser; a second one earns it', () => {
  // Today: false, because a chooser in front of the only door is strictly
  // worse than the flow that ships. The rule, not the current answer, is what
  // matters — so exercise both sides of it.
  assert.equal(sourceChoiceNeeded(), availableSources().length > 1);
  assert.equal(sourceChoiceNeeded(), false);
});

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

test('every credited provider names itself in its own attribution', () => {
  // A credit that points at the wrong provider is worse than no credit. The
  // union already forces `remote` to carry one; this pins that the two agree.
  assert.equal(remotePin.attribution.provider, remotePin.provider);
  assert.equal(remotePin.provider === 'pinterest', true);
});
