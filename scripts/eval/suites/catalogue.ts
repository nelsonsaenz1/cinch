/**
 * One request, phrased four ways, and whether it stays one request.
 *
 * ── Why this is a privacy measurement as much as a parsing one ────────────
 *
 * `demand-intent.ts` states the guarantee plainly: a sentence becomes at most
 * four values from closed vocabularies, and a brand only survives when it came
 * from the KNOWN list, never from the leading-run heuristic that returns
 * whatever the user typed first. That is what stops a fragment of somebody's
 * words landing in an aggregate under a respectable column name.
 *
 * A guarantee like that is worth measuring rather than reading, so this suite
 * scores two things over the same corpus:
 *
 *   CANONICALISATION. Every variant of an intent must produce the identical
 *   `DemandIntent`. If word order can split one intent into two, the daily
 *   aggregate is counting phrasings rather than demand — and the header's
 *   claim that "word order never gets this far" would be false.
 *
 *   BRAND LEAKAGE. Across every query in the corpus AND every one of the 52
 *   recorded James Perse listing titles, no `brandSlug` may be produced from a
 *   guessed brand. This is gated at zero and cannot be anything else: one leak
 *   is one user's words in a table that promised not to hold them.
 *
 * The listing titles are used as query text on purpose. They are the ugliest
 * real strings available — resale keyword dumps, sizes, "Usa Made", country
 * names — and they are exactly the shape of thing that makes a leading-run
 * brand detector fire.
 *
 * ── The triple is reported and not gated ──────────────────────────────────
 *
 * `semanticTriple` keeps the raw colour term and the parsed brand, so "grey"
 * and "gray" split it while both reach the grey family. That is a real
 * difference between the two representations rather than a defect in either,
 * so the triple's canonicalisation rate is printed for contrast and the gate
 * sits on the intent, which is the thing that is actually stored.
 */

import { parseQuery, semanticTriple } from '../../../supabase/functions/_shared/catalog-query.ts';
import { demandIntent } from '../../../supabase/functions/_shared/demand-intent.ts';
import {
  MAX_DIAGNOSTICS,
  corpusPath,
  rate,
  sameValue,
  type EvalSuite,
  type SuiteResult,
  type Threshold,
} from '../harness.ts';
import { readFileSync } from 'node:fs';

type IntentGroup = {
  id: string;
  intent: {
    brandSlug: string | null;
    garmentClass: string | null;
    audience: string | null;
    colourFamily: string | null;
  };
  variants: string[];
};

type Corpus = { known: string[]; groups: IntentGroup[] };

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(corpusPath('catalogue-intents.json'), 'utf8')) as Corpus;
}

/**
 * The recorded James Perse response, read for its titles alone.
 *
 * It lives in `tests/fixtures/` rather than under `tests/fixtures/eval/`
 * because it predates this harness and is shared with the catalogue tests.
 * Copying it here would create two files that could disagree about what the
 * licensed feed returned, which is the one thing a recorded fixture must not
 * allow.
 */
function loadListingTitles(): string[] {
  const root = process.env.CINCH_EVAL_ROOT ?? process.cwd();
  const raw = JSON.parse(
    readFileSync(`${root}/tests/fixtures/catalogue-james-perse.json`, 'utf8'),
  ) as { products: { title: string }[] };
  return raw.products.map((p) => p.title);
}

const thresholds: readonly Threshold[] = [
  {
    metric: 'intentCanonicalisation',
    // Eleven of twelve groups collapse to one intent. The twelfth is "linen
    // shirt light blue", where the head-noun rule needs the noun in head
    // position and returns a null class when the colour trails it. Gated at
    // 0.85 — above the eleven-of-twelve floor a single new group would create,
    // and low enough that adding one more hard phrasing is not a build break.
    min: 0.85,
    why: 'Measured 0.9167; the one split is a trailing-colour phrasing the head-noun rule cannot see.',
  },
  {
    metric: 'intentAccuracy',
    // Share of individual queries producing the annotated intent, rather than
    // merely agreeing with their siblings. A group could canonicalise on the
    // WRONG intent and this is what would catch it.
    min: 0.94,
    why: 'Canonicalising on a wrong intent would still pass the group check; measured 0.9737 over 38 queries.',
  },
  {
    metric: 'brandGuessRefusal',
    // Every guessed brand refused at the aggregate, over both corpora. One is
    // the number here and there is no version of this that tolerates a miss:
    // a leaked slug is a piece of a user's sentence in a stored row.
    min: 1,
    why: 'A guessed brand reaching the aggregate is user text in a table that promised not to hold it.',
  },
];

function run(): SuiteResult {
  const { known, groups } = loadCorpus();
  const titles = loadListingTitles();
  const diagnostics: string[] = [];

  let canonicalGroups = 0;
  let canonicalTriples = 0;
  let queries = 0;
  let accurate = 0;
  let guessChecks = 0;
  let guessRefused = 0;

  const checkGuess = (query: string) => {
    const parsed = parseQuery(query, known);
    const intent = demandIntent(parsed);
    guessChecks += 1;
    if (parsed.brandSource !== 'known' && intent.brandSlug !== null) {
      diagnostics.push(`brand leak: "${query}" produced slug ${intent.brandSlug} from a guess`);
    } else {
      guessRefused += 1;
    }
  };

  for (const group of groups) {
    const intents = group.variants.map((variant) => demandIntent(parseQuery(variant, known)));
    const triples = group.variants.map((variant) => semanticTriple(parseQuery(variant, known)));

    if (intents.every((intent) => sameValue(intent, intents[0]))) canonicalGroups += 1;
    else if (diagnostics.length < MAX_DIAGNOSTICS) {
      diagnostics.push(
        `${group.id}: variants split into ${new Set(intents.map((i) => JSON.stringify(i))).size} intents`,
      );
    }

    if (triples.every((triple) => triple === triples[0])) canonicalTriples += 1;

    group.variants.forEach((variant, index) => {
      queries += 1;
      if (sameValue(intents[index], group.intent)) accurate += 1;
      else if (diagnostics.length < MAX_DIAGNOSTICS) {
        diagnostics.push(
          `${group.id}: "${variant}" → ${JSON.stringify(intents[index])}, expected ${JSON.stringify(group.intent)}`,
        );
      }
      checkGuess(variant);
    });
  }

  for (const title of titles) checkGuess(title);

  return {
    id: 'catalogue',
    title: 'Catalogue — query parse and demand canonicalisation',
    caseCount: queries + titles.length,
    metrics: {
      intentCanonicalisation: rate(canonicalGroups, groups.length),
      intentAccuracy: rate(accurate, queries),
      brandGuessRefusal: rate(guessRefused, guessChecks),
    },
    counters: {
      intentGroups: groups.length,
      variantQueries: queries,
      recordedListingTitles: titles.length,
      /** Printed for contrast with the intent rate; deliberately not gated. */
      canonicalSemanticTriples: canonicalTriples,
      /** Zero: `parseQuery` and `demandIntent` are pure string work. */
      queriesSpendingAnAiCall: 0,
    },
    diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
    blockers: [],
  };
}

export const suite: EvalSuite = {
  id: 'catalogue',
  title: 'Catalogue — query parse and demand canonicalisation',
  thresholds,
  run,
};
