/**
 * A88b (2026-09-16 nightly): `tag_corrections` had 0 rows lifetime while
 * PostHog logged `item_tag_corrected` three times a week. The table A53's
 * question is answered from was never written to. This pins that the review
 * deck's write now records the labelled pair, and that the tagger stamps the
 * model id the pair is a correction OF.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MUTATIONS = readFileSync('src/features/closet/mutations.ts', 'utf8');
const TAGGER = readFileSync('supabase/functions/tag-item/index.ts', 'utf8');

test('a correction writes a tag_corrections row beside the item_tag_corrected event', () => {
  // Same guard as the event: only when something was actually corrected.
  assert.match(
    MUTATIONS,
    /track\('item_tag_corrected', \{ fields: corrected\.sort\(\)\.join\(','\), verified: verify \}\);\s+\/\/[^\n]*\n\s+\/\/[^\n]*\n\s+await recordTagCorrection\(\{ userId, itemId: id, patch: patch \?\? \{\}, verified: verify \}\);/,
  );
  const fn = MUTATIONS.slice(MUTATIONS.indexOf('async function recordTagCorrection'), MUTATIONS.indexOf('export function useVerifyItem'));
  assert.match(fn, /from\('tag_corrections'\)\.insert\(row\)/);
  // The pair: the tagger's raw output (with its model id) and the person's patch.
  assert.match(fn, /select\('ai_tags, image_path'\)/);
  assert.match(fn, /model_id: modelId,/);
  assert.match(fn, /typeof output\?\.model === 'string' \? output\.model : 'untracked'/);
  assert.match(fn, /corrected: \{ \.\.\.patch, verified \}/);
  // A courtesy after the correction has landed — never before it, never a throw.
  assert.ok(MUTATIONS.indexOf('await commitItemUpdate(') < MUTATIONS.indexOf('await recordTagCorrection('));
  assert.match(fn, /\} catch \{/);
});

test('the tagger records which model wrote the output it stores', () => {
  assert.match(TAGGER, /ai_tags: \{ \.\.\.tags, model: rescued && settings\.rescueModelId \? settings\.rescueModelId : config\.model_id \},/);
});
