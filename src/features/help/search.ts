/**
 * Help search — matching, ranking, and the honest empty state.
 *
 * Pure logic, no React and no React Native, for the same reason `articles.ts`
 * is: `tests/help-search.test.ts` bundles this with esbuild.
 *
 * ── Why prefix matching, and why AND ──────────────────────────────────────
 *
 * Eight articles is not a corpus. Anything with an inverted index, a stemmer or
 * a similarity score would be machinery for a set a person can read in three
 * minutes, and would fail in the way small-corpus search always fails: it would
 * return something for everything, so "nothing found" — the state HS-03 exists
 * for, and the only state where Cinch gets to be honest about what it has not
 * built — would never fire.
 *
 * So: every query token must hit something (AND), and a token hits by PREFIX,
 * so "photo" finds "photos" and "borrow" finds "borrowable" without a stemmer.
 * Short tokens still match — "ai" is two letters and a real question — but a
 * one-character token is dropped, because a lone "a" matches every article and
 * would silently turn an AND into a no-op.
 */

import { HELP_ARTICLES, type HelpArticle } from '@/features/help/articles';

/**
 * Fold a string to searchable tokens.
 *
 * `normalize('NFD')` then stripping combining marks folds accents, so "café"
 * and "cafe" are one token. Apostrophes are REMOVED rather than split on —
 * every user-facing string in this app uses U+2019, so "friend’s" must become
 * `friends` and not `friend` + `s`. Everything else non-alphanumeric is a
 * separator.
 */
export function tokenize(input: string): string[] {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * What a hit is worth, by where it was found.
 *
 * The question is what the reader is trying to match, so it dominates;
 * keywords are the vocabulary we knew we were missing; the body is the
 * long tail. Ratios, not tuned constants — the only thing they decide is
 * ordering within a result set that is never longer than eight.
 */
const WEIGHT = { question: 6, keyword: 3, body: 1 } as const;

type Indexed = {
  readonly article: HelpArticle;
  readonly question: readonly string[];
  readonly keywords: readonly string[];
  readonly body: readonly string[];
};

function index(articles: readonly HelpArticle[]): readonly Indexed[] {
  return articles.map((article) => ({
    article,
    question: tokenize(article.question),
    keywords: article.keywords.flatMap((k) => tokenize(k)),
    body: article.body.flatMap((p) => tokenize(p)),
  }));
}

const INDEX = index(HELP_ARTICLES);

/** A token hits a field if any word in it starts with the token. */
function hits(field: readonly string[], token: string): boolean {
  return field.some((word) => word.startsWith(token));
}

function scoreOne(entry: Indexed, token: string): number {
  if (hits(entry.question, token)) return WEIGHT.question;
  if (hits(entry.keywords, token)) return WEIGHT.keyword;
  if (hits(entry.body, token)) return WEIGHT.body;
  return 0;
}

/**
 * The result list for a query. Empty means empty — see the docblock.
 *
 * A blank or punctuation-only query returns every article rather than none:
 * the index screen shows the full set when the field is untouched, and
 * "search for a space" is not a question anybody asked.
 */
export function searchHelp(query: string): readonly HelpArticle[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return HELP_ARTICLES;

  const scored: { article: HelpArticle; score: number; order: number }[] = [];

  INDEX.forEach((entry, order) => {
    let total = 0;
    for (const token of tokens) {
      const s = scoreOne(entry, token);
      // AND: one miss and the article is out. This is what lets HS-03 exist.
      if (s === 0) return;
      total += s;
    }
    scored.push({ article: entry.article, score: total, order });
  });

  // Declaration order breaks ties, so the list never reshuffles between two
  // queries that happen to score the same.
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.article);
}

/**
 * The three suggestions under an empty result.
 *
 * Deliberately a LOOSER match than `searchHelp` — OR rather than AND — because
 * these are "you might have meant" rather than "here is your answer", and the
 * whole reason this list is being drawn is that the strict pass found nothing.
 * Padded out of the default trio so it is always three: a suggestion rail with
 * one item in it looks like a bug.
 */
export function alsoAsk(query: string, count = 3): readonly HelpArticle[] {
  const tokens = tokenize(query);

  const scored = INDEX.map((entry, order) => ({
    article: entry.article,
    score: tokens.reduce((sum, token) => sum + scoreOne(entry, token), 0),
    order,
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((s) => s.article);

  const out: HelpArticle[] = [...scored];
  for (const fallback of DEFAULT_ASKS) {
    if (out.length >= count) break;
    if (out.some((a) => a.id === fallback)) continue;
    const article = HELP_ARTICLES.find((a) => a.id === fallback);
    if (article) out.push(article);
  }
  return out.slice(0, count);
}

/**
 * The three that stand in when a query resembles nothing at all.
 *
 * One per group, and the first question of each — a stranger who searched for
 * something we have never built should land on the three doors, not on three
 * near-misses of a question we cannot answer.
 */
const DEFAULT_ASKS: readonly string[] = ['closet-size', 'who-sees-my-closet', 'what-paying-buys'];

/**
 * Things Cinch genuinely has not built, answered rather than apologised for.
 *
 * HS-03's drawn copy is specific to the query "apple watch", and it is good
 * precisely because it is specific: "There is no Cinch app for Apple Watch, so
 * nothing here covers it. If that is what you were after, that is the whole
 * answer." Generalising that into "we couldn't find anything" throws away the
 * only thing on the screen worth reading. So the specificity is kept for the
 * handful of things people actually search for and we actually do not have,
 * and everything else falls back to one honest sentence.
 *
 * Every entry is a fact about the repository, not a roadmap:
 *   * iPhone only — `app.config.ts:79` sets `supportsTablet: false`, and the
 *     iOS-only dependency is the Apple Vision cutout module
 *     (`src/lib/bg-removal.ts:16`), which is why "an Android build" is not a
 *     recompile.
 *   * `web/` is a marketing site, not an app target (contract A.2 #13).
 *   * There is no widget or Live Activity target in the project.
 *
 * None of these promises a future. "Not yet" is a schedule; "there is not one"
 * is a fact, and a fact is what somebody searching at nine in the morning is
 * owed.
 */
type NotBuilt = {
  readonly id: string;
  /** Any of these tokens present in the query is a match. */
  readonly triggers: readonly string[];
  /**
   * A second list ALL of whose tokens must also be absent, for the entries
   * that would otherwise swallow a legitimate question. Optional.
   */
  readonly unless?: readonly string[];
  readonly answer: string;
};

const NOT_BUILT: readonly NotBuilt[] = [
  {
    id: 'watch',
    triggers: ['watch', 'watchos', 'wearable', 'applewatch'],
    // "Watch" alone is a garment word — somebody cataloguing a wristwatch as a
    // piece is asking a closet question, not a platform one.
    unless: ['closet', 'piece', 'item', 'accessory', 'jewellery', 'jewelry', 'add', 'tag'],
    answer:
      'There is no Cinch app for Apple Watch, so nothing here covers it. If that is what you were after, that is the whole answer.',
  },
  {
    id: 'ipad',
    triggers: ['ipad', 'tablet'],
    answer:
      'Cinch is built for iPhone. It will install on an iPad and run at phone size, but nothing about it is designed for that screen and there is no iPad version behind the scenes.',
  },
  {
    id: 'android',
    triggers: ['android', 'pixel', 'samsung', 'galaxy'],
    answer:
      'Cinch is iPhone only. The part that lifts a garment off its background is Apple’s, and it runs on the phone rather than on a server — so an Android version is a rebuild rather than a recompile, and there is not one.',
  },
  {
    id: 'web',
    triggers: ['web', 'website', 'browser', 'desktop', 'mac', 'laptop', 'computer', 'chrome'],
    answer:
      'There is no Cinch on the web. cinchstyle.com is a page about the app, not the app — your closet lives on your phone and in your account, and the phone is the only way in.',
  },
  {
    id: 'widget',
    triggers: ['widget', 'widgets', 'complication', 'lockscreen'],
    answer:
      'There is no home-screen widget. The morning edit arrives as a notification and opens Today; that is the whole of it.',
  },
];

/**
 * The generic fallback.
 *
 * Not an apology, per the atlas's rule, and not a promise either: it says what
 * is true — the set is small, it grows from what people actually write in
 * about — and then hands over to the note, which is the next thing on screen.
 */
const GENERIC_MISS =
  'Nothing here covers that. The set is short on purpose and it grows from what people write in about, so a question asked often enough becomes an article.';

/** What HS-03 prints under its headline. */
export function emptyAnswerFor(query: string): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) return GENERIC_MISS;

  // "apple watch" → also test the joined form, so a two-word product name is
  // one token for matching purposes without the trigger lists growing pairs.
  const joined = new Set<string>(tokens);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    joined.add(`${tokens[i]}${tokens[i + 1]}`);
  }

  for (const entry of NOT_BUILT) {
    if (!entry.triggers.some((t) => joined.has(t))) continue;
    if (entry.unless?.some((u) => joined.has(u))) continue;
    return entry.answer;
  }
  return GENERIC_MISS;
}

/** The headline over it. One sentence, unchanged by the query — HS-03. */
export const EMPTY_HEADLINE = 'Nothing on that yet';
