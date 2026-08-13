/**
 * Whether the packing memo says the same thing twice, and only says true things.
 *
 * ── Repeatability is the whole point of the workstream ────────────────────
 *
 * A model wrote this paragraph until Workstream 3. The observable difference
 * between a model and `buildPackingMemo` is not quality — it is that the same
 * bag produces the same sentence. So the first metric here is byte-identical
 * repeatability: every scenario is built twice, from separately constructed
 * inputs, and the two memos are compared as serialised JSON. Anything reaching
 * for a clock, a random number or a locale would show up as a difference, and
 * nothing else in the harness would catch it.
 *
 * Building the input twice rather than calling `buildPackingMemo(input)` twice
 * matters: a memo that mutated its input would pass the cheap version of this
 * test and fail in the app on a re-render.
 *
 * ── Unsupported claims ────────────────────────────────────────────────────
 *
 * The second metric recomputes, from the scenario alone, what the memo is
 * entitled to say — and does the arithmetic independently rather than by
 * importing the module's own helpers, which would be marking its homework:
 *
 *   COUNTS. The piece count and the filled-look count in the observation are
 *   recomputed here, in words, from a number table this file owns.
 *   CITATIONS. Every item id a part note cites must be a piece in the bag.
 *   THE SHORTFALL. Gaps must be present exactly when the scenario has an
 *   unfilled look or has rain with no outerwear packed, and absent otherwise —
 *   a memo that stayed silent about a missing look would be the K-06 failure.
 *   PROVENANCE. When the numbers are seasonal normals rather than a forecast,
 *   the temperature fragment must say so. Printing normals as a forecast is
 *   the specific lie that section names.
 *   MONEY. The memo prints none. A currency symbol appearing in it would mean
 *   a cost-per-wear claim had leaked into an artefact that has no prices.
 */

import { buildPackingMemo, type MemoInput } from '@/features/plan/packing-memo';
import type { PackedLook, PackedPiece, PackingResult } from '@/features/plan/packing';
import type { DayPartKey } from '@/features/plan/trip';
import type { Garment, OutfitCandidate, WeatherContext } from '@/lib/styling';
import {
  MAX_DIAGNOSTICS,
  corpusPath,
  rate,
  type EvalSuite,
  type SuiteResult,
  type Threshold,
} from '../harness.ts';
import { readFileSync } from 'node:fs';

export type Scenario = {
  id: string;
  days: number;
  parts: DayPartKey[];
  vibes: { label: string; formality: number }[];
  weatherSource: 'forecast' | 'normals';
  units: 'C' | 'F';
  /** [lowC, highC, precipitationChance] per day. */
  forecasts: [number, number, number][];
  requestedLooks: number;
  pieces: { id: string; slot: string; subcategory: string; looks: number; worn: boolean }[];
  looks: { dayIndex: number; part: DayPartKey; items: string[] | null }[];
};

/** The memo's own spelled numbers, recomputed here rather than imported. */
const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];
const spell = (n: number): string => WORDS[n] ?? String(n);

/** The precipitation share at which the memo calls a day wet. */
const WET_DAY_THRESHOLD = 0.4;

export function loadScenarios(): Scenario[] {
  return (JSON.parse(readFileSync(corpusPath('packing-scenarios.json'), 'utf8')) as {
    scenarios: Scenario[];
  }).scenarios;
}

export function buildInput(scenario: Scenario): MemoInput {
  const garments = new Map<string, Garment>(
    scenario.pieces.map((piece) => [
      piece.id,
      {
        id: piece.id,
        slot: piece.slot,
        category: piece.slot,
        subcategory: piece.subcategory,
        colors: [],
        formality: 3,
        warmth: 3,
        wearCount: 0,
        lastWornAt: null,
        purchasePrice: null,
      } as unknown as Garment,
    ]),
  );

  const items: PackedPiece[] = scenario.pieces.map((piece) => ({
    garment: garments.get(piece.id)!,
    looks: piece.looks,
    worn: piece.worn,
  }));

  const looks: PackedLook[] = scenario.looks.map((look) => ({
    dayIndex: look.dayIndex,
    // A fixed date derived from the day index rather than from today, so the
    // corpus does not silently re-date itself overnight.
    date: `2026-05-${String(look.dayIndex + 1).padStart(2, '0')}`,
    part: look.part,
    weather: null,
    outfit: look.items
      ? ({
          items: look.items.map((id) => garments.get(id)!),
          features: {},
          score: 0.8,
          notes: {},
          harmonies: [],
        } as unknown as OutfitCandidate)
      : null,
  })) as PackedLook[];

  const packing: PackingResult = {
    looks,
    items,
    unfilled: scenario.looks.filter((l) => l.items === null).length,
  };

  const forecasts: WeatherContext[] = scenario.forecasts.map(
    ([lowC, highC, precipitationChance]) =>
      ({
        lowC,
        highC,
        feelsLikeC: (lowC + highC) / 2,
        precipitationChance,
        windKph: 6,
        swing: false,
      }) as unknown as WeatherContext,
  );

  return {
    vibes: scenario.vibes,
    parts: scenario.parts,
    days: scenario.days,
    forecasts: forecasts.length ? forecasts : undefined,
    weatherSource: scenario.weatherSource,
    packing,
    requestedLooks: scenario.requestedLooks,
    units: scenario.units,
  };
}

/** Everything the scenario entitles the memo to say, checked one claim at a time. */
export function unsupportedClaims(
  scenario: Scenario,
  memo: ReturnType<typeof buildPackingMemo>,
): string[] {
  const problems: string[] = [];
  const pieceIds = new Set(scenario.pieces.map((p) => p.id));
  const filled = scenario.looks.filter((l) => l.items !== null).length;
  const unfilled = scenario.looks.length - filled;
  const wetDays = scenario.forecasts.filter((f) => f[2] >= WET_DAY_THRESHOLD).length;
  const hasOuterwear = scenario.pieces.some((p) => p.slot === 'outerwear');

  const whole = [memo.headline, memo.observation, memo.gaps ?? '', ...memo.spec, ...memo.parts.map((p) => p.note)].join(' ');

  if (scenario.pieces.length > 0) {
    const pieces = scenario.pieces.length;
    const expectedOpening = `${spell(pieces)} ${pieces === 1 ? 'piece' : 'pieces'} covering ${spell(filled)} ${filled === 1 ? 'look' : 'looks'}`;
    if (!memo.observation.toLowerCase().includes(expectedOpening)) {
      problems.push(`${scenario.id}: observation does not count "${expectedOpening}" — "${memo.observation}"`);
    }
  } else if (!memo.observation.includes('Nothing is packed yet')) {
    problems.push(`${scenario.id}: an empty bag must say so — "${memo.observation}"`);
  }

  for (const part of memo.parts) {
    for (const id of part.itemIds) {
      if (!pieceIds.has(id)) problems.push(`${scenario.id}: part note cites unpacked piece ${id}`);
    }
  }

  const owesAGap = unfilled > 0 || (wetDays > 0 && !hasOuterwear);
  if (owesAGap && memo.gaps === null) {
    problems.push(`${scenario.id}: ${unfilled} unfilled look(s) and ${wetDays} wet day(s), but no gap sentence`);
  }
  if (!owesAGap && memo.gaps !== null) {
    problems.push(`${scenario.id}: gap sentence with nothing to report — "${memo.gaps}"`);
  }

  const range = memo.spec.find((fragment) => fragment.includes('–'));
  if (scenario.weatherSource === 'normals' && range && !range.includes('typical')) {
    problems.push(`${scenario.id}: normals printed as a forecast — "${range}"`);
  }
  if (scenario.weatherSource === 'forecast' && range?.includes('typical')) {
    problems.push(`${scenario.id}: a real forecast hedged as typical — "${range}"`);
  }
  if (scenario.forecasts.length === 0 && range) {
    problems.push(`${scenario.id}: temperature quoted with no weather at all — "${range}"`);
  }

  if (whole.includes('$')) {
    problems.push(`${scenario.id}: the memo prints a price, which it has no data for`);
  }

  return problems;
}

const thresholds: readonly Threshold[] = [
  {
    metric: 'repeatability',
    // The property that replaced the model. Anything below one means the memo
    // reads a clock, a locale or a random number, and the whole workstream's
    // claim — same bag, same words — is false.
    min: 1,
    why: 'Byte-identical output is the property that replaced the model; below one the claim is simply untrue.',
  },
  {
    metric: 'supportedClaimRate',
    // Share of scenarios whose every printed claim is recomputable from the
    // scenario. There is no honest reason for this to be below one: each claim
    // is arithmetic over data the memo was handed.
    min: 1,
    why: 'Every sentence is arithmetic over the bag; one unsupported claim is one sentence nobody can check.',
  },
];

function run(): SuiteResult {
  const scenarios = loadScenarios();
  const diagnostics: string[] = [];

  let repeatable = 0;
  let supported = 0;
  let claimsChecked = 0;

  for (const scenario of scenarios) {
    // Two separately constructed inputs, so a memo that mutated what it was
    // given would fail here rather than in somebody's simulator.
    const first = buildPackingMemo(buildInput(scenario));
    const second = buildPackingMemo(buildInput(scenario));

    if (JSON.stringify(first) === JSON.stringify(second)) repeatable += 1;
    else diagnostics.push(`${scenario.id}: two runs of the same bag disagreed`);

    const problems = unsupportedClaims(scenario, first);
    claimsChecked += 1;
    if (!problems.length) supported += 1;
    for (const problem of problems) {
      if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(problem);
    }
  }

  return {
    id: 'packing',
    title: 'Packing — deterministic memo scenarios',
    caseCount: scenarios.length,
    metrics: {
      repeatability: rate(repeatable, scenarios.length),
      supportedClaimRate: rate(supported, claimsChecked),
    },
    counters: {
      scenarios: scenarios.length,
      memosBuilt: scenarios.length * 2,
      /** Zero, and structurally so: `buildPackingMemo` has no network path. */
      scenariosSpendingAnAiCall: 0,
    },
    diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
    blockers: [],
  };
}

export const suite: EvalSuite = {
  id: 'packing',
  title: 'Packing — deterministic memo scenarios',
  thresholds,
  run,
};
