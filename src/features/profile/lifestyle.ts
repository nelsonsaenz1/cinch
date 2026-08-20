/**
 * The lifestyle profile — who this closet dresses, in two answers.
 *
 * A life stage and a handful of occasions, tapped once during onboarding and
 * editable forever in Settings. This module is the CLOSED VOCABULARY for both
 * answers, and the mappings that make them useful:
 *
 *   · the engine's occasion tags a lifestyle occasion corresponds to, so the
 *     scorer can quietly prefer clothes that fit the life being dressed for;
 *   · the stylist questionnaire options a lifestyle unlocks, so a college
 *     student's "What is the day asking for?" offers Class and Game day where
 *     a professional's offers Work and Dinner;
 *   · one sentence for the stylist brief, so the model knows who it is
 *     dressing without being handed a form.
 *
 * EVERYTHING HERE IS KEYS, NEVER PROSE — the questionnaire's own rule. The
 * answers live in `profiles.life_stage` / `profiles.dress_occasions` as plain
 * text (the `style_tags` idiom: permissive columns, closed UI), so a value
 * that drifts out of this list still loads; it simply stops unlocking things.
 *
 * Pure and import-free below the type layer, so `tests/lifestyle-profile.
 * test.ts` can hold every mapping without mounting anything.
 */

// ---------------------------------------------------------------------------
// Life stages
// ---------------------------------------------------------------------------

export type LifeStageKey = 'college' | 'early_career' | 'established' | 'parent' | 'mixed';

export type LifeStage = {
  key: LifeStageKey;
  label: string;
  /** The one-line reading under the label. */
  hint: string;
};

export const LIFE_STAGES: readonly LifeStage[] = [
  {
    key: 'college',
    label: 'Student',
    hint: 'Class, campus, and everything after dark.',
  },
  {
    key: 'early_career',
    label: 'Starting out',
    hint: 'First jobs, internships, a city to dress for.',
  },
  {
    key: 'established',
    label: 'In my stride',
    hint: 'Work, dinners, travel — a full calendar.',
  },
  {
    key: 'parent',
    label: 'Parent',
    hint: 'Real days, quick mornings, the odd big night.',
  },
  {
    key: 'mixed',
    label: 'A bit of everything',
    hint: 'No one label fits, and that is fine.',
  },
] as const;

export const lifeStageLabel = (key: string): string | null =>
  LIFE_STAGES.find((s) => s.key === key)?.label ?? null;

// ---------------------------------------------------------------------------
// Occasions
// ---------------------------------------------------------------------------

export type LifestyleOccasionKey =
  | 'class'
  | 'going_out'
  | 'game_day'
  | 'rush'
  | 'work'
  | 'internship'
  | 'date'
  | 'dinner'
  | 'travel'
  | 'wedding'
  | 'weekend'
  | 'gym';

export type LifestyleOccasion = {
  key: LifestyleOccasionKey;
  label: string;
  /**
   * The engine's own occasion tags this one reaches for — the tagger's closed
   * `OCCASIONS` vocabulary, which is what actually sits on garments. One
   * lifestyle word can fan out to two tags ("going out" is both `event` and
   * `date` clothes) but never invents a tag the tagger cannot write.
   */
  engine: string[];
  /** 1..5, the beam search's own scale — what this occasion usually asks for. */
  formality: number;
  /** First-person, present tense — composes into the stylist's sentence. */
  phrase: string;
};

export const LIFESTYLE_OCCASIONS: readonly LifestyleOccasion[] = [
  { key: 'class',      label: 'Class',           engine: ['casual'],            formality: 2, phrase: 'I have class today.' },
  { key: 'going_out',  label: 'Going out',       engine: ['event', 'date'],     formality: 3, phrase: 'I’m going out tonight.' },
  { key: 'game_day',   label: 'Game day',        engine: ['casual', 'event'],   formality: 2, phrase: 'It’s game day.' },
  { key: 'rush',       label: 'Rush & events',   engine: ['event'],             formality: 4, phrase: 'I have a sorority event.' },
  { key: 'work',       label: 'Work',            engine: ['office'],            formality: 3, phrase: 'I’m in the office today.' },
  { key: 'internship', label: 'Internship',      engine: ['office'],            formality: 3, phrase: 'I’m at my internship today.' },
  { key: 'date',       label: 'Dates',           engine: ['date'],              formality: 4, phrase: 'I have a date.' },
  { key: 'dinner',     label: 'Dinners out',     engine: ['date', 'event'],     formality: 4, phrase: 'I’m going out for dinner.' },
  { key: 'travel',     label: 'Travel',          engine: ['casual', 'outdoor'], formality: 2, phrase: 'I’m travelling today.' },
  { key: 'wedding',    label: 'Weddings',        engine: ['formal'],            formality: 5, phrase: 'I have a wedding.' },
  { key: 'weekend',    label: 'Casual weekends', engine: ['casual'],            formality: 2, phrase: 'It’s a casual weekend.' },
  { key: 'gym',        label: 'Gym',             engine: ['gym'],               formality: 1, phrase: 'I’m training today.' },
] as const;

/**
 * How many occasions one profile may hold.
 *
 * Six, because the point of the answer is emphasis: a profile that selects
 * everything has said nothing, and every consumer below (the scorer's soft
 * preference, the questionnaire's four slots, the one brief sentence) gets
 * WEAKER as the set grows. The screen enforces it; the column does not, for
 * the same reason `COLLECTION_NAME_MAX` lives beside the sentence that
 * promises it rather than in a check constraint.
 */
export const MAX_DRESS_OCCASIONS = 6;

export const lifestyleOccasion = (key: string): LifestyleOccasion | undefined =>
  LIFESTYLE_OCCASIONS.find((o) => o.key === key);

/**
 * The order occasions are OFFERED per stage — all twelve are always available,
 * but the ones this life actually contains come first, so the common case is
 * "tap the top row and done". Deliberately a full ordering rather than a
 * subset: a parent who tailgates every Saturday must not have to hunt for
 * Game day in an "everything else" bin.
 */
export function occasionOrderFor(stage: LifeStageKey | null): LifestyleOccasionKey[] {
  const lead: Record<LifeStageKey, LifestyleOccasionKey[]> = {
    college: ['class', 'going_out', 'game_day', 'rush', 'internship', 'date'],
    early_career: ['work', 'going_out', 'dinner', 'date', 'travel', 'gym'],
    established: ['work', 'dinner', 'travel', 'wedding', 'weekend', 'date'],
    parent: ['weekend', 'work', 'dinner', 'travel', 'wedding', 'gym'],
    mixed: ['weekend', 'work', 'going_out', 'dinner', 'travel', 'date'],
  };
  const first = stage ? lead[stage] : [];
  const rest = LIFESTYLE_OCCASIONS.map((o) => o.key).filter((k) => !first.includes(k));
  return [...first, ...rest];
}

// ---------------------------------------------------------------------------
// What the answers unlock
// ---------------------------------------------------------------------------

/**
 * The engine occasion tags this profile leans toward, deduplicated, in
 * selection order. Fed to `StyleContext.lifestyleOccasions`, where the
 * occasion rule uses it as a SOFT preference on days with no explicit target
 * — see `occasionRule` for the strength argument.
 */
export function engineOccasionsFor(selected: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of selected) {
    for (const tag of lifestyleOccasion(key)?.engine ?? []) {
      if (!out.includes(tag)) out.push(tag);
    }
  }
  return out;
}

/**
 * The stylist's day question, personalised.
 *
 * Shaped exactly like `questionnaire.ts`'s own `OCCASIONS` entries so
 * `composeAsk` can treat a tapped lifestyle answer identically to a stock
 * one. Three lifestyle slots plus the stock catch-all: "A normal day" is
 * always reachable, because a profile describes a life, not a promise about
 * any particular Tuesday.
 */
export type DayOption = {
  key: string;
  label: string;
  phrase: string;
  formality: number;
  occasion: string;
};

/** The stock catch-all, byte-identical to the questionnaire's own. */
const NORMAL_DAY: DayOption = {
  key: 'day',
  label: 'A normal day',
  phrase: 'Nothing in particular today.',
  formality: 2,
  occasion: 'casual',
};

export function dayOptionsFor(selected: readonly string[]): DayOption[] | null {
  const chosen = selected
    .map((key) => lifestyleOccasion(key))
    .filter((o): o is LifestyleOccasion => Boolean(o))
    .slice(0, 3)
    .map((o) => ({
      key: o.key,
      label: o.label,
      phrase: o.phrase,
      formality: o.formality,
      // The FIRST engine tag is the one the beam search targets — the fan-out
      // is for the soft preference, but a tapped answer is an instruction and
      // an instruction targets one thing.
      occasion: o.engine[0]!,
    }));

  // Under two real options there is nothing to personalise — the stock four
  // ask a better question than one lifestyle chip and a catch-all would.
  if (chosen.length < 2) return null;
  return [...chosen, NORMAL_DAY];
}

/**
 * Every day option a lifestyle can ever produce, for `composeAsk`'s lookup.
 * A closed set, because the vocabulary above is closed.
 */
export const ALL_LIFESTYLE_DAY_OPTIONS: readonly DayOption[] = LIFESTYLE_OCCASIONS.map((o) => ({
  key: o.key,
  label: o.label,
  phrase: o.phrase,
  formality: o.formality,
  occasion: o.engine[0]!,
}));

/**
 * One sentence for the stylist brief — rides in `styleSummary`, whose lines
 * the server prints as "They {sentence}." No count, no list punctuation
 * beyond commas, nothing the closed vocabularies above cannot say.
 */
export function lifestyleSummaryLine(
  stage: string | null,
  selected: readonly string[],
): string | null {
  const labels = selected
    .map((key) => lifestyleOccasion(key)?.label.toLowerCase())
    .filter((l): l is string => Boolean(l))
    .slice(0, MAX_DRESS_OCCASIONS);

  const stageClause =
    stage === 'college'
      ? 'are a student'
      : stage === 'early_career'
        ? 'are early in their career'
        : stage === 'parent'
          ? 'are a parent'
          : null;

  if (!labels.length) return stageClause ? `${stageClause}` : null;

  const list =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]!}`;

  return stageClause
    ? `${stageClause} and mostly dress for ${list}`
    : `mostly dress for ${list}`;
}

// ---------------------------------------------------------------------------
// The onboarding gate
// ---------------------------------------------------------------------------

/**
 * What the caller knows about the profile at the moment it asks — the
 * `TourGate` shape, for the same three-case reason: "not read yet" and "read,
 * and empty" must not collapse, and a failed read must never re-offer.
 */
export type StyleProfileGate =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      promptedAt: string | null;
      lifeStage: string | null;
      occasions: string[];
    };

/**
 * Once, ever, on any device — `shouldShowTour`'s rule, for the same reasons.
 *
 * The answers themselves are checked alongside the prompt mark: an account
 * that somehow holds answers with no mark (the Settings editor writes both,
 * but a partial failure could leave one) has demonstrably been through the
 * questionnaire and must not meet it again as a toll booth.
 */
export function shouldOfferStyleProfile(gate: StyleProfileGate): boolean {
  return (
    gate.status === 'ready' &&
    gate.promptedAt === null &&
    gate.lifeStage === null &&
    gate.occasions.length === 0
  );
}
