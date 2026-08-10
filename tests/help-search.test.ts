/**
 * Help search (HS-01/HS-03) — tokenising, the AND rule, ranking, the suggestion
 * rail, and the empty answers.
 *
 * The interesting assertions are the negative ones. `searchHelp` returning
 * NOTHING is what makes HS-03 reachable, and HS-03 is the only screen in the
 * app where Cinch says out loud what it has not built — so a matcher that
 * quietly finds a partial hit for every query would delete that screen without
 * anybody noticing a regression.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  HELP_ARTICLES,
  articleById,
  articlesInGroup,
  relatedArticles,
} from '../src/features/help/articles';
import { alsoAsk, emptyAnswerFor, searchHelp, tokenize } from '../src/features/help/search';

const ids = (query: string) => searchHelp(query).map((a) => a.id);

// ── The article set itself ────────────────────────────────────────────────

test('eight articles, three groups, the split the atlas names', () => {
  assert.equal(HELP_ARTICLES.length, 8);
  assert.equal(articlesInGroup('getting-started').length, 3);
  assert.equal(articlesInGroup('friends').length, 3);
  assert.equal(articlesInGroup('membership').length, 2);
});

test('every article is three paragraphs and every related id resolves', () => {
  for (const article of HELP_ARTICLES) {
    assert.equal(article.body.length, 3, `${article.id} should be three paragraphs`);
    for (const id of article.related) {
      assert.ok(articleById(id), `${article.id} points at a missing article: ${id}`);
      assert.notEqual(id, article.id, `${article.id} relates to itself`);
    }
    assert.equal(relatedArticles(article).length, article.related.length);
  }
});

test('no article ends by suggesting you write in — the atlas rule, asserted', () => {
  // "Answers, not deflection. Every article ends with the answer." A closing
  // sentence that points at the inbox is the failure this rule names, and it is
  // the one an editor adds by reflex months later.
  const deflections = [/write to us/i, /contact (us|support)/i, /get in touch/i, /reach out/i];
  for (const article of HELP_ARTICLES) {
    const last = article.body[article.body.length - 1]!;
    for (const pattern of deflections) {
      assert.ok(!pattern.test(last), `${article.id} ends by deflecting: ${last}`);
    }
  }
});

test('the banned sentences are not in the copy', () => {
  // Appendix A.1, mechanised. Each of these reads perfectly and is false, and
  // two of them are drawn on the atlas itself.
  const banned = [
    /do not see how often you wear/i,
    /can.?t see how often you wear/i,
    /no way to find you by searching/i,
    /you can hide (your closet|individual stats)/i,
    /photos are only ever sent for tagging/i,
    /generated for you overnight/i,
    /erases everything/i,
  ];
  const prose = HELP_ARTICLES.flatMap((a) => a.body).join('\n');
  for (const pattern of banned) {
    assert.ok(!pattern.test(prose), `banned sentence present: ${pattern}`);
  }
});

// ── Tokenising ────────────────────────────────────────────────────────────

test('tokenising folds case, accents and the typographic apostrophe', () => {
  assert.deepEqual(tokenize('Café Borrow'), ['cafe', 'borrow']);
  // U+2019 is removed rather than split on, so a possessive stays one word.
  assert.deepEqual(tokenize('a friend’s closet'), ['friends', 'closet']);
  // One-character tokens are dropped — a lone "a" matches everything and would
  // turn the AND rule below into a no-op.
  assert.deepEqual(tokenize('a b ai'), ['ai']);
  assert.deepEqual(tokenize('   ...   '), []);
});

// ── Matching ──────────────────────────────────────────────────────────────

test('an empty query is the whole set, not an empty result', () => {
  assert.equal(searchHelp('').length, HELP_ARTICLES.length);
  assert.equal(searchHelp('   ').length, HELP_ARTICLES.length);
});

test('a prefix hits without a stemmer', () => {
  // "photo" must reach "photos", "borrow" must reach "borrowable".
  assert.ok(ids('photo').includes('photo-quality'));
  assert.ok(ids('borrow').includes('lending-loop'));
});

test('the question outranks the body', () => {
  // "cancel" is the whole of one question and appears nowhere else as a
  // question, so it must come first even though other articles mention it.
  assert.equal(ids('cancel')[0], 'how-to-cancel');
  assert.equal(ids('lend')[0], 'lending-loop');
  assert.equal(ids('hide')[0], 'hide-a-piece');
});

test('every token must hit — one miss and the article is out', () => {
  // "apple" alone is in the prose of two articles; "apple watch" is in none.
  assert.ok(ids('apple').length > 0);
  assert.deepEqual(ids('apple watch'), []);
  assert.deepEqual(ids('android'), []);
});

test('results are stable for equally-scored queries', () => {
  const first = ids('closet');
  const second = ids('closet');
  assert.deepEqual(first, second);
});

// ── The suggestion rail ───────────────────────────────────────────────────

test('People also ask is always three, and never empty', () => {
  assert.equal(alsoAsk('apple watch').length, 3);
  assert.equal(alsoAsk('zzzzz').length, 3);
  assert.equal(alsoAsk('').length, 3);
  // Loose matching, so a query the strict pass rejected can still surface a
  // near neighbour: "apple" is in the cancel article's prose.
  assert.ok(alsoAsk('apple watch').some((a) => a.id === 'how-to-cancel'));
});

test('the suggestion rail never repeats an article', () => {
  const suggested = alsoAsk('closet photo borrow');
  assert.equal(new Set(suggested.map((a) => a.id)).size, suggested.length);
});

// ── The empty answers ─────────────────────────────────────────────────────

test('the five things Cinch has not built are answered by name', () => {
  assert.match(emptyAnswerFor('apple watch'), /Apple Watch/);
  assert.match(emptyAnswerFor('does it work on ipad'), /iPhone/);
  assert.match(emptyAnswerFor('android app'), /iPhone only/);
  assert.match(emptyAnswerFor('web version'), /no Cinch on the web/);
  assert.match(emptyAnswerFor('home screen widget'), /no home-screen widget/);
});

test('anything else gets the honest generic sentence, not an apology', () => {
  const generic = emptyAnswerFor('qwertyuiop');
  assert.match(generic, /Nothing here covers that/);
  assert.doesNotMatch(generic, /sorry|apolog/i);
  assert.equal(emptyAnswerFor(''), generic);
});

test('no empty answer promises a future release', () => {
  const answers = [
    'apple watch',
    'ipad',
    'android',
    'web',
    'widget',
    'qwertyuiop',
  ].map(emptyAnswerFor);
  for (const answer of answers) {
    assert.doesNotMatch(answer, /coming soon|not yet|on the roadmap|working on/i, answer);
  }
});

test('"watch" as a garment word does not trigger the platform answer', () => {
  // Somebody cataloguing a wristwatch is asking a closet question. The fence is
  // the reason `NOT_BUILT` entries carry an `unless` list at all.
  assert.doesNotMatch(emptyAnswerFor('add a watch to my closet'), /Apple Watch/);
});
