/**
 * How much of a spoken wardrobe the lexicon answers, and what the rest costs.
 *
 * ── What this measures that `tests/closet-parse.test.ts` does not ──────────
 *
 * That file asserts properties: a clause splits here, a correction replaces the
 * garment before it, a fabricated quotation is dropped. Every one of them is a
 * yes/no about a mechanism, and none of them can answer the question the plan
 * actually poses — over fifty-five transcripts, what share of the FIELDS come
 * out right, and what share of the transcripts spend an AI call.
 *
 * The second number is the one with a price on it. `needsFallback` is the gate
 * on the model, so its rate over a representative corpus IS the per-import AI
 * spend of the intake path, and it is reported as a first-class metric rather
 * than inferred from a log.
 *
 * ── Why the alignment is by name and not by index ──────────────────────────
 *
 * When the parser drops a garment it does not know the noun for — "a rain
 * shell" — every garment after it shifts by one. Scoring positionally would
 * then charge the drop twice: once for the missing garment and again for every
 * correct garment that moved. So expected garments are matched to produced ones
 * on the noun first, the slot second, and position last, and what remains
 * unmatched on either side is counted plainly as a miss or a spurious extra.
 *
 * There is deliberately no third "pair whatever is left" pass. It was written
 * and removed: on "my running trainers, a rain shell, and a bucket hat" it
 * paired the expected shell with the produced hat, scored both wrong, and then
 * scored the expected hat missing — three penalties for one dropped garment.
 * Leaving the shell unmatched charges the drop once, which is what it costs.
 */

import {
  needsFallback,
  parseCloset,
} from '../../../supabase/functions/_shared/closet-parse.ts';
import type { ParsedGarment } from '../../../supabase/functions/_shared/intake-schema.ts';
import {
  MAX_DIAGNOSTICS,
  corpusPath,
  rate,
  scoreFields,
  type EvalSuite,
  type SuiteResult,
  type Threshold,
} from '../harness.ts';
import { readFileSync } from 'node:fs';

/** The fields a review card shows, so these are the fields worth scoring. */
const SCORED_FIELDS = ['quantity', 'colour_term', 'fabric', 'pattern', 'name', 'slot'] as const;

type ExpectedGarment = Pick<ParsedGarment, 'quantity' | 'colour_term' | 'fabric' | 'pattern' | 'name' | 'slot'>;

type Case = {
  id: string;
  transcript: string;
  fallback: boolean;
  garments: ExpectedGarment[];
};

function loadCases(): Case[] {
  const raw = JSON.parse(readFileSync(corpusPath('closet-transcripts.json'), 'utf8')) as {
    cases: Case[];
  };
  return raw.cases;
}

/**
 * Pair each expected garment with the produced garment most likely to be it.
 *
 * Three passes rather than one, in descending order of confidence, so a weaker
 * rule never steals a garment a stronger one would have claimed.
 */
function align(
  expected: readonly ExpectedGarment[],
  actual: readonly ParsedGarment[],
): { pairs: [ExpectedGarment, ParsedGarment | null][]; spurious: ParsedGarment[] } {
  const taken = new Set<number>();
  const pairs: [ExpectedGarment, ParsedGarment | null][] = [];

  const claim = (predicate: (g: ParsedGarment) => boolean): ParsedGarment | null => {
    for (let i = 0; i < actual.length; i += 1) {
      if (taken.has(i)) continue;
      if (predicate(actual[i]!)) {
        taken.add(i);
        return actual[i]!;
      }
    }
    return null;
  };

  for (const want of expected) {
    const match = claim((g) => g.name === want.name) ?? claim((g) => g.slot === want.slot);
    pairs.push([want, match]);
  }

  const spurious = actual.filter((_, i) => !taken.has(i));
  return { pairs, spurious };
}

const thresholds: readonly Threshold[] = [
  {
    metric: 'fieldAccuracy',
    // Measured 0.8915 over 378 fields. The gap is the nine annotated cases the
    // lexicon cannot reach — four unknown nouns, a trim colour claimed as the
    // garment's, a cloth read as a colour, a clause "under" does not split.
    // Set two points below the measurement so one new hard transcript does not
    // turn the harness red on the day somebody adds one.
    min: 0.87,
    why: 'Two points under the 0.8915 measured today; the shortfall is nine annotated lexicon gaps, not a bug.',
  },
  {
    metric: 'garmentRecall',
    // Share of annotated garments the parser produced at all, right or wrong.
    // A dropped garment is the failure §7 calls unforgivable, so this is gated
    // closer to its measurement than field accuracy is to its own.
    min: 0.9,
    why: 'A dropped garment is silent data loss; measured 0.9194 and all five losses are nouns absent from the lexicon.',
  },
  {
    metric: 'fallbackAgreement',
    // Whether the parser asks for a model on exactly the transcripts a person
    // would say need one. This is currently perfect and should stay perfect —
    // a disagreement means either wasted spend or a guess presented as a parse.
    min: 1,
    why: 'Perfect today; either direction of disagreement is a defect rather than a limit.',
  },
  {
    metric: 'fallbackRate',
    // NOT a quality bar — a budget. Eight of fifty-five transcripts carry a
    // phrase that points at something already said, and those are the only ones
    // that reach the model. The ceiling is set at a quarter so a regression that
    // starts routing plain lists to AI is caught by cost rather than by a bill.
    max: 0.25,
    why: 'Measured 0.1455; the ceiling catches a regression that starts sending plain lists to the model.',
  },
];

function run(): SuiteResult {
  const cases = loadCases();
  const diagnostics: string[] = [];

  let checked = 0;
  let matched = 0;
  let expectedGarments = 0;
  let producedGarments = 0;
  let spuriousGarments = 0;
  let fallbackAgreed = 0;
  let fallbacks = 0;

  for (const kase of cases) {
    const parse = parseCloset(kase.transcript);
    const fallback = needsFallback(parse);
    if (fallback) fallbacks += 1;
    if (fallback === kase.fallback) fallbackAgreed += 1;
    else {
      diagnostics.push(
        `${kase.id}: fallback expected ${kase.fallback}, got ${fallback} — "${kase.transcript}"`,
      );
    }

    const { pairs, spurious } = align(kase.garments, parse.garments);
    spuriousGarments += spurious.length;
    expectedGarments += kase.garments.length;

    for (const [want, got] of pairs) {
      if (got) producedGarments += 1;
      const score = scoreFields(want, got, SCORED_FIELDS);
      checked += score.checked;
      matched += score.matched;
      if (score.wrong.length && diagnostics.length < MAX_DIAGNOSTICS) {
        diagnostics.push(`${kase.id}: ${score.wrong.join('; ')}`);
      }
    }

    for (const extra of spurious) {
      // An extra garment is not free: the user has to delete a card for
      // something they never said. It costs the whole record's worth of fields.
      checked += SCORED_FIELDS.length;
      if (diagnostics.length < MAX_DIAGNOSTICS) {
        diagnostics.push(`${kase.id}: spurious garment "${extra.name}" (${extra.slot})`);
      }
    }
  }

  return {
    id: 'closet-parsing',
    title: 'Closet parsing — spoken transcripts',
    caseCount: cases.length,
    metrics: {
      fieldAccuracy: rate(matched, checked),
      garmentRecall: rate(producedGarments, expectedGarments),
      fallbackAgreement: rate(fallbackAgreed, cases.length),
      fallbackRate: rate(fallbacks, cases.length),
    },
    counters: {
      transcripts: cases.length,
      annotatedGarments: expectedGarments,
      fieldsChecked: checked,
      spuriousGarments,
      /** One AI call each. This is the intake path's per-transcript spend. */
      transcriptsSpendingAnAiCall: fallbacks,
    },
    diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
    blockers: [],
  };
}

export const suite: EvalSuite = {
  id: 'closet-parsing',
  title: 'Closet parsing — spoken transcripts',
  thresholds,
  run,
};
