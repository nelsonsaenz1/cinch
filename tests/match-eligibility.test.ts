/**
 * The look-alike offer at upload — Packet 2 of the 2026-08-21 program.
 *
 * Two things can be wrong here and neither would show in a screenshot:
 * offering the match to somebody whose consent is not current (the 5.1.2(i)
 * gate the server would refuse anyway, so the offer would be a button built to
 * disappoint), and the pipeline quietly spending a vision call at settlement
 * instead of at the tap. The derivation is exercised directly; the pipeline's
 * restraint is pinned on its source, the same way `photo-match.test.ts` pins
 * that a local match spends no quota — the ingest module imports native code,
 * so a mocked-fetch import is not something this runner can do, and the
 * stronger claim is the one the source can prove: the calls do not exist.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  MATCH_OFFER_ACTION,
  deriveMatchEligible,
  matchOfferJob,
  type MatchEligibilityInput,
} from '../src/features/ingest/match-eligibility';
import type { UploadJob } from '../src/features/ingest/queue-store';

/** A fully-eligible settled upload; each test breaks exactly one clause. */
const eligible = (over: Partial<MatchEligibilityInput> = {}): MatchEligibilityInput => ({
  local: false,
  tagSettled: true,
  category: 'Knit',
  hasCutout: true,
  hasThumb: true,
  consentVersion: 2,
  currentConsentVersion: 2,
  ...over,
});

// ---------------------------------------------------------------------------
// 1 · The derivation
// ---------------------------------------------------------------------------

test('success + cutout + current consent is eligible', () => {
  assert.equal(deriveMatchEligible(eligible()), true);
});

test('no consent on record is never eligible', () => {
  assert.equal(deriveMatchEligible(eligible({ consentVersion: null })), false);
});

test('consent from before a policy-version bump is not consent', () => {
  // The same rule `hasAiConsent` and `use-consent.ts` apply: a recorded
  // version below the current one means the text changed under the user, and
  // nothing may act as though they agreed to the new one.
  assert.equal(
    deriveMatchEligible(eligible({ consentVersion: 1, currentConsentVersion: 2 })),
    false,
  );
});

test('a failed tag is never eligible', () => {
  assert.equal(deriveMatchEligible(eligible({ tagSettled: false })), false);
});

test('a tag that produced no category is never eligible', () => {
  // The match search would be guessing about a garment the model could not
  // even categorise, and a guess dressed as an offer is what M-03 refuses too.
  assert.equal(deriveMatchEligible(eligible({ category: null })), false);
});

test('a local-mode job is never eligible, whatever else is true', () => {
  // A-04: the photograph never left the phone, so there is nothing server-side
  // for `match` to look at. Enforced here as well as by the pipeline's own
  // routing, the same twice-enforced doctrine as the sweep's image_path guard.
  assert.equal(deriveMatchEligible(eligible({ local: true })), false);
});

test('either server-side image is enough; neither is not', () => {
  // `matchListing` reads `cutout_path ?? thumb_path ?? image_path`.
  assert.equal(deriveMatchEligible(eligible({ hasCutout: false, hasThumb: true })), true);
  assert.equal(deriveMatchEligible(eligible({ hasCutout: true, hasThumb: false })), true);
  assert.equal(deriveMatchEligible(eligible({ hasCutout: false, hasThumb: false })), false);
});

// ---------------------------------------------------------------------------
// 2 · The selector both surfaces read through
// ---------------------------------------------------------------------------

const job = (over: Partial<UploadJob>): UploadJob =>
  ({
    id: 'j1',
    localUri: 'file:///a.jpg',
    width: 3000,
    height: 4000,
    stage: 'done',
    attempts: 0,
    tagAttempts: 0,
    progress: 1,
    ...over,
  }) as UploadJob;

test('the offer job is found by item id, and only when the flag is true', () => {
  const jobs = [
    job({ id: 'a', itemId: 'item-1', matchEligible: true }),
    job({ id: 'b', itemId: 'item-2', matchEligible: false }),
    job({ id: 'c', itemId: 'item-3' }),
  ];
  assert.equal(matchOfferJob(jobs, 'item-1')?.id, 'a');
  // Explicitly false, and merely absent — a job persisted before the flag
  // existed — both mean no offer.
  assert.equal(matchOfferJob(jobs, 'item-2'), undefined);
  assert.equal(matchOfferJob(jobs, 'item-3'), undefined);
  assert.equal(matchOfferJob(jobs, null), undefined);
});

// ---------------------------------------------------------------------------
// 3 · The pipeline's restraint, pinned on its source
// ---------------------------------------------------------------------------

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const QUEUE = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
const MODULE = readFileSync('src/features/ingest/match-eligibility.ts', 'utf8');

test('the pipeline itself never calls the match or search function', () => {
  // The offer is offer-then-run (§2.4): the metered vision call happens on the
  // far side of the tap, in `use-match.ts`, never at settlement. `tag-item` is
  // the only Edge Function the queue may invoke.
  const body = strip(QUEUE);
  assert.ok(!/garment-search/.test(body), 'the upload pipeline reached the search function');
  assert.ok(!/action:\s*'match'/.test(body), 'the upload pipeline ran a match');
  const invoked = [...body.matchAll(/functions\.invoke[^(]*\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(invoked)], ['tag-item']);
});

test('the derivation reads consent from the cache, never the network', () => {
  // The one input that looks like it needs a round trip is taken from the
  // query cache at the derivation site, and the pure module cannot fetch at
  // all — no supabase, no invoke, no fetch, no analytics.
  const at = QUEUE.indexOf('deriveMatchEligible({');
  assert.ok(at > -1, 'the pipeline no longer derives eligibility');
  const before = QUEUE.slice(0, at);
  assert.ok(
    before.lastIndexOf('queryClient.getQueryData') > before.lastIndexOf('async function requestTag'),
    'consent is not read off the cache beside the derivation',
  );
  const pure = strip(MODULE);
  assert.ok(!/supabase|functions\.invoke|fetch\(|track\(/.test(pure), 'the pure module reaches out');
});

test('the flag is written in the settled arm, and nowhere else', () => {
  // One write site: `driveTagging`'s settled outcome, alongside `stage: 'done'`.
  // Failure arms must never carry it — a failed tag derives false by absence.
  assert.match(
    QUEUE,
    /update\(jobId, \{ stage: 'done', error: undefined, label: outcome\.label, matchEligible \}\)/,
  );
  const writes = [...strip(QUEUE).matchAll(/matchEligible/g)];
  assert.equal(writes.length, 2, 'the flag gained a second writer — derivation plus one update');
});

// ---------------------------------------------------------------------------
// 4 · The copy, and the surfaces that draw it
// ---------------------------------------------------------------------------

test('the affordance copy is the plan’s, verbatim, and lives in the spec module', () => {
  assert.equal(MATCH_OFFER_ACTION, 'Find a cleaner photo');
});

test('no surface retypes the string — one constant, two doors', () => {
  const surfaces = [
    'src/components/onboarding/ten-replace-sheet.tsx',
    'src/app/review.tsx',
    'src/features/onboarding/ten-copy.ts',
  ];
  for (const path of surfaces) {
    const body = strip(readFileSync(path, 'utf8'));
    assert.ok(
      !/['"`]Find a cleaner photo['"`]/.test(body),
      `${path} retypes the offer string instead of importing it`,
    );
  }
  // The Ten's copy table exposes it through the same import.
  assert.match(readFileSync('src/features/onboarding/ten-copy.ts', 'utf8'), /MATCH_OFFER_ACTION/);
});

test('both doors gate on the derived flag and open the existing match flow', () => {
  // Same routing capture's M-03 offer uses — `?match=1` on the piece itself —
  // so the sheet that opens is the one component item detail already renders.
  for (const path of ['src/app/the-ten.tsx', 'src/app/review.tsx']) {
    const body = readFileSync(path, 'utf8');
    assert.match(body, /matchOfferJob\(/, `${path} does not gate on eligibility`);
    assert.match(body, /\?match=1/, `${path} does not open the existing match flow`);
    // Each door is its own funnel entry, on the flow's one event.
    assert.match(body, /stage: 'listing_offer_opened'/);
  }
});

test('the item-detail entry point is untouched', () => {
  const detail = readFileSync('src/app/item/[id].tsx', 'utf8');
  assert.match(detail, /match === '1'/);
  assert.match(detail, /<MatchSheet visible=\{matching\}/);
  assert.ok(!/matchOfferJob|MATCH_OFFER_ACTION/.test(detail), 'item detail grew the upload offer');
});
