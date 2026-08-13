/**
 * When a measured intent is allowed to become a public regression fixture.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 *
 * `catalogue_demand_daily` is the private answer to "what are people actually
 * searching for". Its whole value is that the golden fixtures stop being a list
 * of things the founder thought of and start being a list of things users
 * asked for. But a fixture is committed to the repository, and the repository
 * is not private — so the act of promoting an intent moves it from a founder-
 * only surface into a public one, and that move needs a rule.
 *
 * ── What this rule is, and what it is NOT ──────────────────────────────────
 *
 * It is a POPULARITY FLOOR, not k-anonymity. The aggregate deliberately holds
 * no user column — that was the point of Workstream 2 — so nothing here can
 * count distinct people, and claiming a k-anonymity guarantee would be a lie
 * told in a comment. What it can say is: this intent was searched for at least
 * `MIN_SEARCHES` times, on at least `MIN_DISTINCT_DAYS` separate days. One
 * person having an unusual afternoon does not clear that; a real demand
 * pattern does.
 *
 * The residual exposure is bounded by what a row can hold in the first place.
 * Every field is drawn from a closed vocabulary — a brand slug only survives
 * when it matched a known catalogue brand, the class and colour come from
 * fixed lexicons, the audience is one of three values. The worst case is
 * therefore "somebody searched for a mens James Perse t-shirt", never a
 * sentence, and never anyone in particular. That is the honest ceiling on this
 * function's claim.
 *
 * ── Why zero-result intents get a lower bar ────────────────────────────────
 *
 * A search that returned nothing is the most useful fixture in the set: it is a
 * measured hole in the catalogue path, and it is the case most likely to be
 * fixed by the next change. Holding it to the same popularity floor as a
 * working query would keep the failures out of the regression set for exactly
 * as long as they stay rare, which is backwards. It still needs a floor — one
 * failed search is an anecdote — but a lower one.
 */

/** One aggregated intent, rolled up across days. */
export type DemandRollup = {
  intentKey: string;
  brandSlug: string | null;
  garmentClass: string | null;
  audience: string | null;
  colourFamily: string | null;
  searches: number;
  zeroResultSearches: number;
  /** How many separate days the intent appeared on. */
  distinctDays: number;
};

/**
 * Chosen to be defensible rather than derived: this is a judgement about
 * exposure, and there is no measurement that produces the number for you. They
 * are named so a founder can move them with an argument rather than a patch.
 */
export const MIN_SEARCHES = 25;
export const MIN_DISTINCT_DAYS = 3;

/** A hole in the catalogue is worth fixing before it is popular. */
export const MIN_ZERO_RESULT_SEARCHES = 8;
export const MIN_ZERO_RESULT_DAYS = 2;

export type PromotionVerdict =
  | { promotable: true; because: 'demand' | 'zero_result' }
  | { promotable: false; because: 'too_few_searches' | 'too_few_days' | 'not_an_intent' };

/**
 * May this intent be written into a committed fixture?
 *
 * Deliberately returns a reason on refusal. "No" with no reason is how a
 * threshold ends up quietly excluding everything after somebody fat-fingers a
 * constant, and the promotion step is run rarely enough that nobody would
 * notice for months.
 */
export function isPromotable(row: DemandRollup): PromotionVerdict {
  // The table's own constraint, restated: a row with nothing recognised in it
  // is noise with a hash attached, and promoting one would add a fixture that
  // asserts nothing.
  if (!row.brandSlug && !row.garmentClass) return { promotable: false, because: 'not_an_intent' };

  if (row.zeroResultSearches >= MIN_ZERO_RESULT_SEARCHES) {
    if (row.distinctDays >= MIN_ZERO_RESULT_DAYS) return { promotable: true, because: 'zero_result' };
    return { promotable: false, because: 'too_few_days' };
  }

  if (row.searches < MIN_SEARCHES) return { promotable: false, because: 'too_few_searches' };
  if (row.distinctDays < MIN_DISTINCT_DAYS) return { promotable: false, because: 'too_few_days' };
  return { promotable: true, because: 'demand' };
}

/**
 * The fixture an intent becomes.
 *
 * Only the four canonical fields and the counts that justified promotion. The
 * `intentKey` hash is deliberately NOT carried across: it is the private
 * table's join key, and a committed file has no use for it beyond making the
 * public and private surfaces trivially linkable.
 */
export type PromotedIntent = {
  brandSlug: string | null;
  garmentClass: string | null;
  audience: string | null;
  colourFamily: string | null;
  because: 'demand' | 'zero_result';
};

export function promote(rows: readonly DemandRollup[]): PromotedIntent[] {
  const out: PromotedIntent[] = [];
  for (const row of rows) {
    const verdict = isPromotable(row);
    if (!verdict.promotable) continue;
    out.push({
      brandSlug: row.brandSlug,
      garmentClass: row.garmentClass,
      audience: row.audience,
      colourFamily: row.colourFamily,
      because: verdict.because,
    });
  }
  // Stable order so a re-run of the promotion step produces the same file and a
  // diff means something changed in the data, not in the iteration.
  return out.sort((a, b) =>
    `${a.brandSlug}|${a.garmentClass}|${a.audience}|${a.colourFamily}`.localeCompare(
      `${b.brandSlug}|${b.garmentClass}|${b.audience}|${b.colourFamily}`,
    ),
  );
}
