/**
 * The printed promise and the code that has to keep it.
 *
 * WHAT WENT WRONG, AND WHY A TEST IS THE RIGHT SHAPE OF FIX
 *
 * Three shipped surfaces tell the reader, in so many words, that a typed
 * catalogue search does not reach a model:
 *
 *   `CATALOGUE_DISCLOSURE`   "…nothing you type is sent to an AI model."
 *   the search sheet          "This is not a web search, and what you type is
 *                              not sent to an AI model."
 *   web/privacy.html          "This is not a web search and no AI model reads
 *                              those words."
 *
 * All three were true only while the unlicensed web provider stayed out of the
 * search chain — and `licensedFirst` used to open with `if (!opts) return
 * fallback;`, returning the bare web provider whenever Datafeedr was
 * unconfigured. That path ignored `GARMENT_SEARCH_ALLOW_UNLICENSED` entirely,
 * so the kill switch being off did not stop it. A pruned secret, a restored
 * project, a new environment stood up from the repository — any of those turned
 * three printed sentences false with no code change and no review, and nothing
 * anywhere would have reported it.
 *
 * The fix is in `catalog-wiring.ts`. This file is what stops it coming back:
 * the assertions below read the ACTUAL SENTENCE out of the shipping copy
 * module, and fail if the code stops being able to keep it. Anybody who
 * restores the fallback has to delete a claim from the app first, which is the
 * order those two decisions should always have been made in.
 *
 * `firstLicensed` is exercised directly rather than through `licensedFirst`,
 * because the latter reads `Deno.env` and builds a Supabase client. The env
 * reading is one line either side of this seam; the composition is the part
 * with a decision in it.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstLicensed } from '../supabase/functions/garment-search/catalog-provider.ts';
import type {
  GarmentImageProvider,
  MatchResult,
  ProviderResult,
} from '../supabase/functions/garment-search/provider.ts';
import { CATALOGUE_DISCLOSURE } from '../src/features/ingest/intake-routes.ts';

/** A provider that records whether it was asked anything at all. */
function spy(id: string): GarmentImageProvider & { searched: number; matched: number } {
  const self = {
    id,
    searched: 0,
    matched: 0,
    async search(): Promise<ProviderResult> {
      self.searched += 1;
      return {
        candidates: [
          { imageUrl: 'https://example.test/a.jpg', title: 'A', source: 'example.test', confidence: 0.8 },
        ],
        declined: [],
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: 0,
      };
    },
    async match(): Promise<MatchResult> {
      self.matched += 1;
      return {
        brands: ['Example'],
        candidates: [],
        declined: [],
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: 0,
      };
    },
  };
  return self;
}

const INPUT = { description: 'cream mohair sweater', maxCandidates: 6 };
const MATCH_INPUT = { descriptor: 'cream mohair sweater', photoUrl: 'https://example.test/p.jpg', maxCandidates: 6 };

// ---------------------------------------------------------------------------

test('the disclosure still makes the claim this file exists to protect', () => {
  // If the sentence is ever rewritten, the assertions below stop meaning what
  // they were written to mean — so the sentence itself is pinned first.
  assert.match(CATALOGUE_DISCLOSURE, /not\s+a\s+web\s+search/i);
  assert.match(CATALOGUE_DISCLOSURE, /(nothing|not)[^.]*sent to an AI model/i);
});

test('no licensed catalogue and the switch off means NO web fallback', () => {
  // The exact configuration the old early return mishandled: Datafeedr
  // unconfigured, `GARMENT_SEARCH_ALLOW_UNLICENSED` at its default false.
  const web = spy('openrouter-web');
  const chain = firstLicensed([], web, { search: false, match: true });

  return chain.search(INPUT).then((result) => {
    assert.equal(
      web.searched,
      0,
      `the web provider answered a typed search while the app prints: "${CATALOGUE_DISCLOSURE}"`,
    );
    assert.deepEqual(result.candidates, []);
  });
});

test('a licensed catalogue that finds nothing does not fall through to the web', () => {
  // "If nothing matches, it says so rather than searching the open web" is
  // printed under the results. An empty licensed answer is the whole answer.
  const licensed: GarmentImageProvider = {
    id: 'datafeedr',
    async search() {
      return {
        candidates: [],
        declined: [],
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: 0,
      };
    },
    async match() {
      return {
        brands: [],
        candidates: [],
        declined: [],
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: 0,
      };
    },
  };
  const web = spy('openrouter-web');
  const chain = firstLicensed([licensed], web, { search: false, match: true });

  return chain.search(INPUT).then(() => {
    assert.equal(web.searched, 0, 'an empty licensed result fell through to the open web');
  });
});

test('the switch is still an explicit act that works when set', () => {
  // Fail-closed must not mean the flag is dead. Somebody who deliberately sets
  // it gets the old behaviour — the point is that a MISSING secret cannot.
  const web = spy('openrouter-web');
  const chain = firstLicensed([], web, { search: true, match: true });

  return chain.search(INPUT).then((result) => {
    assert.equal(web.searched, 1);
    assert.equal(result.candidates.length, 1);
  });
});

test('brand identification from your own photograph is a separate switch', () => {
  // `match` reads a brand off a picture the user took. That is a vision
  // judgement producing TEXT — no image is copied, so no licence is implicated,
  // and welding it to the imagery switch turned off a feature no licensing
  // argument asks about.
  const web = spy('openrouter-web');
  const chain = firstLicensed([], web, { search: false, match: true });

  return chain.match(MATCH_INPUT).then((result) => {
    assert.equal(web.matched, 1);
    assert.deepEqual(result.brands, ['Example']);
  });
});

test('with no fallback at all, nothing throws and nothing is invented', () => {
  // The state after this packet when `OPENROUTER_API_KEY` is absent: the search
  // chain is empty. It must return an honest empty rather than crash — the
  // caller turns it into `catalogue_unavailable`, which is a different sentence
  // from "nothing matched".
  const chain = firstLicensed([], null, { search: false, match: false });

  return chain.search(INPUT).then((result) => {
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(result.declined, []);
    assert.equal(result.costUsd, null);
  });
});
