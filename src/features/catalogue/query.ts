/**
 * The one normalised catalogue query. Typed words and spoken words both become
 * this, and there is no second path.
 *
 * WHY THIS FILE IS ONE FUNCTION AND NOT TWO
 *
 * §8 of the handoff says the spoken path runs "the identical search call as
 * typed" and lands on "the identical CPV2-04". The cheap way to build that is
 * two call sites that happen to pass the same arguments today, and the thing
 * that always goes wrong is that one of them acquires a fix the other does not
 * — a trim, a length floor, a cancellation — and the two paths drift until the
 * spoken one is a slightly worse copy of the typed one.
 *
 * So `normaliseCatalogueQuery` is the only way to build a query, `CatalogueQuery`
 * is the only shape the search accepts, and `tests/catalogue-query-shared.test.ts`
 * asserts that a transcript and the same words typed produce byte-identical
 * queries. A second normalisation added anywhere fails that test.
 *
 * WHAT `path` IS AND IS NOT. It records which door the words came through, for
 * the bounded analytics event in `analytics.ts`. It is NEVER read by the search
 * itself — no branch anywhere may say "if voice, do X" — which is what keeps
 * the convergence real rather than nominal.
 */

/** Which door the words came through. Analytics only; never changes behaviour. */
export type CataloguePath = 'typed' | 'voice' | 'walkthrough';

export type CatalogueQuery = {
  /** The words the search actually sends. Trimmed, collapsed, never empty. */
  text: string;
  /** Analytics only. See the header. */
  path: CataloguePath;
  /**
   * Colour words the caller already knows about — the bulk walkthrough carries
   * them from the utterance it parsed (§8: `CPV2-05` opens with `namedColours`
   * pre-selected). They do NOT change the query text: colour is a variant axis
   * the server groups on, and putting it in the words would ask the catalogue
   * for one colourway of a garment that has six.
   */
  namedColours: readonly string[];
};

/**
 * The floor, shared with the old typed-words path.
 *
 * Two characters cannot identify a garment and a one-character query would
 * spend a metered request to prove it. `canFileTypedWords` uses the same floor
 * for the escape hatch, so a phrase is never long enough to file and too short
 * to search.
 */
export const MIN_QUERY_LENGTH = 3;

/**
 * Collapse a raw string to the words that get searched.
 *
 * Deliberately gentle: it trims, collapses runs of whitespace, and strips the
 * trailing punctuation a dictated sentence arrives with. It does NOT lowercase,
 * strip diacritics, or drop stop-words — that is the SERVER's parse
 * (`supabase/functions/_shared/catalog-query.ts`), which owns the brand
 * heuristic and the ladder, and doing a second, different version of it here
 * would mean the client and the server disagreed about what was asked.
 *
 * The one thing it does beyond whitespace is the trailing full stop, and that
 * is here rather than on the server because it is a property of DICTATION, not
 * of queries: Cinch's voice processor ends a transcript with a period and a
 * person typing does not. Normalising it here is what makes "James Perse men's
 * T-shirt." and "James Perse men's T-shirt" the same query — which is the whole
 * point of the file.
 */
export function normaliseQueryText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;,]+$/, '')
    .trim();
}

/** Whether these words are worth a metered request. */
export function isSearchableQuery(raw: string): boolean {
  return normaliseQueryText(raw).length >= MIN_QUERY_LENGTH;
}

/**
 * Build the query. The only constructor — see the header.
 *
 * Returns null when the words are too short, so a caller cannot accidentally
 * spend a request on an empty field. Callers that need to know why should ask
 * `isSearchableQuery` first; the null here is a guard, not a message.
 */
export function normaliseCatalogueQuery(
  raw: string,
  path: CataloguePath,
  namedColours: readonly string[] = [],
): CatalogueQuery | null {
  const text = normaliseQueryText(raw);
  if (text.length < MIN_QUERY_LENGTH) return null;

  // Deduplicated case-insensitively but kept in the caller's own casing: these
  // are matched against the merchant's printed colour names, and "Heather Grey"
  // reads better in a VoiceOver announcement than "heather grey".
  const seen = new Set<string>();
  const colours: string[] = [];
  for (const colour of namedColours) {
    const key = colour.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    colours.push(colour.trim());
  }

  return { text, path, namedColours: colours };
}

/**
 * Are these two queries asking the same thing?
 *
 * Used to decide whether an edit needs a new request. `path` is excluded on
 * purpose: re-running the identical words because the user re-dictated rather
 * than re-typed them would spend a metered request to get the answer already on
 * screen.
 */
export function sameQuery(a: CatalogueQuery | null, b: CatalogueQuery | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.text === b.text &&
    a.namedColours.length === b.namedColours.length &&
    a.namedColours.every((c, i) => c.toLowerCase() === b.namedColours[i]?.toLowerCase())
  );
}
