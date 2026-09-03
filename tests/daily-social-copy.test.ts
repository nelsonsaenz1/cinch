/**
 * The words of the Daily Social unit.
 *
 * Two things are being held here, and neither is style:
 *
 * 1. **THREE DIFFERENT EMPTINESSES.** S-1a (no circle), S-1b (nobody sharing
 *    yet) and S-2 (a quiet day) all arrive as a page with no looks on it, and
 *    they are three different problems with three different actions — find
 *    someone, go first, and nothing at all. Written at the call site three
 *    weeks apart they converge on one apologetic sentence, and the person who
 *    most needs to be told "turn yours on" gets told "check back later". So the
 *    distinctness is asserted rather than trusted.
 *
 * 2. **NOTHING COUNTS, INFERS OR HINTS AT A HIDDEN PIECE.** A friend can hide a
 *    garment from friends, so a shared look renders with fewer pieces than were
 *    worn. No caption, no footnote, no VoiceOver label may say "1 piece
 *    hidden", "and more", or anything a reader could subtract their way through
 *    to the owner's private decision. This cue and its VoiceOver label were
 *    REMOVED from the accepted atlas after review; this file is what stops them
 *    coming back through a well-meaning "helpful" edit.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CAUGHT_UP_ACCESSIBILITY_LABEL,
  CAUGHT_UP_LINE,
  DAY_HEADING,
  daySubtitle,
  lookAccessibilityLabel,
  NO_CIRCLE,
  NOBODY_SHARING,
  OFFLINE,
  piecesLine,
  QUIET_DAY,
  quietDayCoverage,
  REACTION_HINT,
  REACTION_LABELS,
  reactionAccessibilityLabel,
  reactionGroupAccessibilityLabel,
  UNNAMED_LOOK,
} from '../src/features/daily-social/copy.ts';
import { DAILY_REACTIONS } from '../src/features/daily-social/types.ts';
import { collageRows } from '../src/components/daily-social/look-card-spec.ts';
import { plateGrid } from '../src/components/today/plate-grid.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * Source with the two style tokens that are not prose removed.
 *
 * `overflow: 'hidden'` is a Yoga property and `accessibilityElementsHidden` is
 * an RN prop; neither is a sentence and neither says anything about a garment.
 * They are stripped by name rather than by loosening the scanner, because the
 * scanner's whole job is to catch the word "hidden" appearing near a piece.
 */
const prose = (path: string) =>
  body(path)
    .replace(/overflow:\s*'hidden'/g, '')
    .replace(/accessibilityElementsHidden/g, '');

/** Every sentence a state says, as its own string. */
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const NOW = new Date(2026, 7, 16, 10, 0, 0);

/**
 * Every user-facing string this lane can produce, evaluated rather than
 * scraped — a scanner reading the source would miss what a function returns.
 */
const ALL_COPY = [
  DAY_HEADING,
  daySubtitle(1, NOW),
  daySubtitle(4, NOW),
  daySubtitle(40, NOW),
  piecesLine(['Charcoal wool coat', 'Cream rollneck']),
  reactionGroupAccessibilityLabel('Maya'),
  UNNAMED_LOOK,
  NO_CIRCLE.title,
  NO_CIRCLE.body,
  // The conditions and the word on the disclosure that holds them (P2 #19).
  NO_CIRCLE.detail,
  NO_CIRCLE.detailLabel,
  NO_CIRCLE.action,
  NOBODY_SHARING.title,
  NOBODY_SHARING.body,
  // Redesign 17 moved the non-retroactive promise into its own line under the
  // action. It is user-facing copy and is scanned as such.
  NOBODY_SHARING.note,
  NOBODY_SHARING.action,
  QUIET_DAY.title,
  QUIET_DAY.body,
  quietDayCoverage(NOW),
  CAUGHT_UP_LINE,
  CAUGHT_UP_ACCESSIBILITY_LABEL,
  OFFLINE.kicker,
  OFFLINE.title,
  OFFLINE.body,
  OFFLINE.action,
  REACTION_HINT,
  ...DAILY_REACTIONS.map((r) => REACTION_LABELS[r]),
  ...DAILY_REACTIONS.map((r) => reactionAccessibilityLabel(r, 'Weekend layers')),
  ...DAILY_REACTIONS.map((r) => reactionAccessibilityLabel(r, null)),
  lookAccessibilityLabel({
    ownerName: 'Ada',
    name: 'Weekend layers',
    wornAt: new Date(2026, 7, 15, 9, 0, 0).toISOString(),
    pieces: ['Charcoal wool coat', 'Cream rollneck'],
    position: { index: 1, total: 4 },
    now: NOW,
  }),
  lookAccessibilityLabel({ ownerName: 'Ada', name: null, wornAt: NOW.toISOString(), now: NOW }),
].join('\n');

// ---------------------------------------------------------------------------
// 1 · The three emptinesses
// ---------------------------------------------------------------------------

test('S-1a, S-1b and S-2 share no sentence at all', () => {
  const states = {
    'S-1a': [NO_CIRCLE.title, NO_CIRCLE.body, NO_CIRCLE.detail, NO_CIRCLE.action],
    'S-1b': [NOBODY_SHARING.title, NOBODY_SHARING.body, NOBODY_SHARING.action],
    'S-2': [QUIET_DAY.title, QUIET_DAY.body],
  };

  const seen = new Map<string, string>();
  for (const [name, lines] of Object.entries(states)) {
    for (const sentence of lines.flatMap(sentences)) {
      const owner = seen.get(sentence);
      assert.equal(owner, undefined, `${name} and ${owner} both say "${sentence}"`);
      seen.set(sentence, name);
    }
  }
});

test('each of the three names a different action, and S-1b’s is about the reader', () => {
  assert.notEqual(NO_CIRCLE.action, NOBODY_SHARING.action);
  // S-1b must not send someone to find more friends. More friends who are also
  // not sharing changes nothing about this page.
  assert.doesNotMatch(NOBODY_SHARING.action, /friend|invite|people|search/i);
  assert.doesNotMatch(NOBODY_SHARING.body, /invite|find (more|another)/i);
  assert.match(NOBODY_SHARING.body, /\byou(rs)?\b/i);
  // And S-2 has no action at all — there is nothing to do about a quiet day.
  assert.equal('action' in QUIET_DAY, false);
});

test('S-1a never suggests a stranger', () => {
  // AMENDED 2026-09-02 (P2 #19): the two conditions moved out of the body and
  // into `detail`, behind a disclosure, so the empty state leads with one line
  // instead of a four-line paragraph. Both conditions are still shipped and
  // still scanned — the state's copy is now four strings rather than three.
  const all = `${NO_CIRCLE.title} ${NO_CIRCLE.body} ${NO_CIRCLE.detail} ${NO_CIRCLE.action}`;
  assert.doesNotMatch(all, /people you may know|suggested|discover|popular|nearby|browse/i);
  // It names the mutual condition instead, which is the only way anyone gets
  // in. Redesign 17 says it as "only if you’re both friends" where the shipped
  // line said "when they add you back" — the same condition, and the new
  // phrasing also names the SECOND condition the old one silently omitted:
  // that friend's own sharing switch, which is off by default. Someone who
  // added a friend on the strength of the old sentence and then met an empty
  // page had been told something untrue.
  assert.match(all, /follow|add you back|both friends/i);
  assert.match(all, /sharing/i, 'S-1a no longer names the sharing condition');
});

test('S-1a is the copy the page actually ships, not a second version of it', () => {
  // The unit draws no no-circle screen: Explore's own empty hero has been that
  // state since before the unit existed, and two of them on one page is a worse
  // answer than either. `NO_CIRCLE` is a transcript kept testable — so it has
  // to still BE the transcript.
  const src = body(NO_CIRCLE.source);
  for (const line of [
    NO_CIRCLE.title,
    NO_CIRCLE.body,
    NO_CIRCLE.detail,
    NO_CIRCLE.detailLabel,
    NO_CIRCLE.action,
  ]) {
    assert.ok(src.includes(line), `${NO_CIRCLE.source} no longer says "${line}"`);
  }
});

test('nothing draws a second no-circle screen', () => {
  const kit = readdirSync('src/components/daily-social');
  for (const file of kit) {
    assert.doesNotMatch(
      readFileSync(`src/components/daily-social/${file}`, 'utf8'),
      /NO_CIRCLE|NoCircleState/,
      `${file} draws a no-circle state the page already draws`,
    );
  }
});

test('S-1b carries the non-retroactive promise, not a week of history', () => {
  // Someone turning sharing on from this screen is deciding about their own
  // past. A sentence implying a week of it is about to appear would be false
  // and is the exact wording the atlas correction removed.
  //
  // REDESIGN 17 MOVED THE PROMISE, AND THE TEST MOVED WITH IT. The accepted
  // frame leads the body with the fact that explains the empty page — sharing
  // is off by default for everyone — and puts the non-retroactivity in its own
  // line directly under the button that acts on it, which is where a person
  // reads it. Both halves are still required; they are simply required across
  // the two strings the state now ships, and the state must still ship both.
  //
  // THE RULE CHANGED 2026-09-03 (founder ruling, migration 20260903010000):
  // sharing is ON by default and off is a choice. So the fact that explains
  // an empty page is no longer "off for everyone" but "your friends turned it
  // off" — and the non-retroactive promise is unchanged, because the boundary
  // column still starts at the instant a switch is flipped on.
  const promise = `${NOBODY_SHARING.body} ${NOBODY_SHARING.note}`;
  assert.match(promise, /from that moment|from the moment|before today|before you turned it on/i);
  assert.match(promise, /never anything you have already worn|nothing you wore before/i);
  assert.doesNotMatch(promise, /last seven days|past week|previous looks/i);
  // And the body still says the thing the empty page is actually caused by.
  assert.match(NOBODY_SHARING.body, /turned sharing off/i);
  assert.doesNotMatch(NOBODY_SHARING.body, /off by default/i);
});

// ---------------------------------------------------------------------------
// 2 · Offline is not quiet
// ---------------------------------------------------------------------------

test('S-5 says offline, in a sentence S-2 does not say', () => {
  assert.match(OFFLINE.kicker, /^OFFLINE$/);
  assert.match(`${OFFLINE.title} ${OFFLINE.body}`, /offline|connection/i);

  const quiet = new Set(sentences(`${QUIET_DAY.title}. ${QUIET_DAY.body}`));
  for (const sentence of sentences(`${OFFLINE.title}. ${OFFLINE.body}`)) {
    assert.equal(quiet.has(sentence), false, `offline reuses the quiet-day sentence "${sentence}"`);
  }
});

test('S-5 never blames the network for emptiness, and claims nothing about the data', () => {
  // The refusal `ErrorState` was built for: an error says the READ failed, and
  // says nothing about what is or is not there.
  assert.match(OFFLINE.body, /nothing in anyone’s closet has changed/i);
  assert.doesNotMatch(OFFLINE.body, /nobody wore|quiet day is|no looks today/i);
  // And the quiet day never offers the connection as an explanation.
  assert.doesNotMatch(QUIET_DAY.body, /connection|offline|network|try again|reload/i);
});

// ---------------------------------------------------------------------------
// 3 · The end, and nothing past it
// ---------------------------------------------------------------------------

test('the caught-up line is fixed, and is the one the app already ships', () => {
  assert.equal(CAUGHT_UP_LINE, 'You’re caught up with your circle.');
  // Imported from `features/explore/feed.ts`, not retyped — two surfaces that
  // end a circle must end it in the same words.
  const src = body('src/features/daily-social/copy.ts');
  assert.match(src, /import \{ CAUGHT_UP_LINE \} from '@\/features\/explore\/feed'/);
  assert.doesNotMatch(src, /caught up with your circle/i);
});

test('nothing anywhere implies more content past the end', () => {
  assert.doesNotMatch(ALL_COPY, /load more|show more|see more|and more|keep scrolling|swipe for more/i);
  assert.doesNotMatch(ALL_COPY, /\bnext page\b|\bolder\b|\bearlier looks\b/i);
  assert.doesNotMatch(CAUGHT_UP_ACCESSIBILITY_LABEL, /more|swipe|scroll/i);
  // The closure line is the whole label. A hint appended to it would be the
  // pagination affordance the contract forbids, spoken instead of drawn.
  assert.equal(CAUGHT_UP_ACCESSIBILITY_LABEL, CAUGHT_UP_LINE);
});

test('a quiet day says which day it covered', () => {
  assert.equal(quietDayCoverage(NOW), 'Covering Sun 16 Aug.');
  // The date is what stops a second read of the same quiet day being
  // indistinguishable from a page that never loaded.
  assert.match(quietDayCoverage(new Date(2026, 0, 1)), /Covering \w{3} 1 Jan\./);
});

// ---------------------------------------------------------------------------
// 4 · No hidden piece is ever counted, inferred or hinted at
// ---------------------------------------------------------------------------

const HIDDEN_PIECE_TELLS = [
  /\bhidden\b/i,
  /\d+\s*(piece|item|garment)/i,
  /(piece|item|garment)s?\s+(hidden|missing|not shown|withheld)/i,
  /\bsome pieces\b/i,
  /\bnot all\b/i,
  /\bpartial look\b/i,
  /\bincomplete\b/i,
];

test('no user-facing string counts, infers or hints at a hidden piece', () => {
  for (const tell of HIDDEN_PIECE_TELLS) {
    assert.doesNotMatch(ALL_COPY, tell, `copy hints at a hidden piece: ${tell}`);
  }
});

test('nor does any string inside the components, VoiceOver labels included', () => {
  // Comments are stripped: several files EXPLAIN at length why they must not
  // count, and a rule that punishes its own documentation teaches people to
  // stop writing it down.
  const dir = 'src/components/daily-social';
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.length >= 5, 'the component census found almost nothing — check the path');

  for (const file of files) {
    const src = prose(`${dir}/${file}`);
    for (const tell of HIDDEN_PIECE_TELLS) {
      assert.doesNotMatch(src, tell, `${file} hints at a hidden piece: ${tell}`);
    }
  }
});

test('the look’s spoken sentence names the pieces and counts none of them', () => {
  // `plate.tsx` announces "<name>, <n> pieces" and is right to — that is the
  // reader's own look. Here the number on screen IS what the owner allowed to
  // cross, so speaking it is speaking a measurement of what they hid. Naming
  // them is the opposite move and the atlas's own instruction: the collage is
  // hidden from VoiceOver so that no per-tile label can be counted off, and the
  // pieces are read from the outfit line instead. Without it a reader hears
  // that a look exists and never what it was.
  const label = lookAccessibilityLabel({
    ownerName: 'Ada',
    name: 'Weekend layers',
    wornAt: new Date(2026, 7, 15, 9, 0, 0).toISOString(),
    pieces: ['Charcoal wool coat', 'Cream rollneck'],
    position: { index: 1, total: 4 },
    now: NOW,
  });
  assert.equal(
    label,
    'Ada wore Weekend layers. Yesterday. Charcoal wool coat · Cream rollneck. Look 1 of 4.',
  );
  assert.doesNotMatch(label, /piece|item|garment/i);

  // Every part past the first is optional, and a card drawn alone — no pieces
  // visible, no place in a list — says only what it knows.
  assert.equal(
    lookAccessibilityLabel({ ownerName: 'Ada', name: null, wornAt: NOW.toISOString(), now: NOW }),
    `Ada wore ${UNNAMED_LOOK}. Just now.`,
  );
});

test('the outfit line prints every name that crossed, and never a stand-in for one that did not', () => {
  assert.equal(piecesLine(['Charcoal wool coat', 'Cream rollneck']), 'Charcoal wool coat · Cream rollneck');
  assert.equal(piecesLine(['Charcoal wool coat']), 'Charcoal wool coat');
  // A look whose pieces its owner all kept prints nothing rather than a
  // sentence about the silence — an apology here is a statement about what was
  // withheld, which is the inference the atlas removed.
  assert.equal(piecesLine([]), '');
  assert.equal(piecesLine(['  ', '']), '');
  // No ellipsis and no remainder. There is no "more" to have.
  assert.doesNotMatch(piecesLine(['a', 'b', 'c', 'd', 'e', 'f']), /…|\.\.\.|more/);
});

test('the day says how many looks it holds and that it ends', () => {
  // The atlas lists this line as the VISIBLE EQUIVALENT of scrolling to the
  // bottom: a reader who never reaches the end still learns the day is finite.
  const wednesday = new Date(2026, 7, 19, 10, 0, 0);
  assert.equal(daySubtitle(4, wednesday), 'Wednesday · four looks, then done');
  assert.equal(daySubtitle(1, wednesday), 'Wednesday · one look, then done');
  // Past a dozen the numeral is plainer than the word, and a circle is one to a
  // dozen anyway.
  assert.equal(daySubtitle(13, wednesday), 'Wednesday · 13 looks, then done');

  for (const n of [1, 2, 5, 12, 40]) {
    // It counts LOOKS, which is a fact about this page. It must never read as a
    // count of people, of reactions, or of what is inside a look.
    assert.doesNotMatch(daySubtitle(n, wednesday), /piece|item|garment|friend|people|reaction/i);
    // And it never implies there is more past the end — that is the whole point
    // of saying "then done".
    assert.match(daySubtitle(n, wednesday), /then done$/);
  }
});

test('a shorter look composes without a hole, at every length', () => {
  // The frame "must not read as broken" when a piece its owner hid is simply
  // absent. `plateGrid` is what buys that: three pieces are [2, 1], not a
  // five-cell grid with two gaps in it. Every cell it lays out gets a piece,
  // and every piece lands in exactly one cell.
  for (let n = 1; n <= 8; n += 1) {
    const pieces = Array.from({ length: n }, (_, i) => `piece-${i}`);
    const rows = collageRows(pieces);
    assert.deepEqual(rows.flat(), pieces, `a ${n}-piece look drops or duplicates a piece`);
    assert.ok(rows.every((row) => row.length > 0), `a ${n}-piece look draws an empty row`);
    assert.equal(
      plateGrid(n).reduce((a, b) => a + b, 0),
      n,
      `a ${n}-piece grid reserves a cell with nothing in it`,
    );
  }
  // And a look with nothing visible draws nothing rather than an apology —
  // "no pieces to show" is itself a statement about what was hidden.
  assert.deepEqual(collageRows([]), []);
  assert.deepEqual(plateGrid(0), []);
});

// ---------------------------------------------------------------------------
// 5 · The three reactions
// ---------------------------------------------------------------------------

test('there are exactly three, in this order, with these words', () => {
  assert.deepEqual([...DAILY_REACTIONS], ['sharp', 'cozy', 'noted']);
  assert.deepEqual(
    DAILY_REACTIONS.map((r) => REACTION_LABELS[r]),
    ['Sharp', 'Cozy', 'Noted'],
  );
  assert.equal(Object.keys(REACTION_LABELS).length, 3);
});

test('none of the three is negative, and none reads as a score', () => {
  const labels = Object.values(REACTION_LABELS).join(' ');
  assert.doesNotMatch(labels, /\b(dislike|downvote|meh|pass|bad|worst|hate|dull|ugly)\b/i);
  assert.doesNotMatch(ALL_COPY, /\bnot for me\b/i);
  assert.doesNotMatch(ALL_COPY, /\brate\b|\brating\b|\bscore\b|\bstars?\b|\bvote\b/i);
});

test('nothing counts people, reactions or anything else', () => {
  // "No public aggregation" is enforced by there being nothing to aggregate.
  // Copy that implied a tally would be promising a number the app cannot get.
  assert.doesNotMatch(ALL_COPY, /\bfollowers?\b|\blikes?\b|\bviews?\b|\btally\b|\bcount\b/i);
  assert.doesNotMatch(ALL_COPY, /\d+\s*(people|friends|reactions?|new)\b/i);
});

test('the reaction hint states the audience and the way back out', () => {
  assert.match(REACTION_HINT, /only you and the person who wore this/i);
  assert.match(REACTION_HINT, /take it back|again/i);
  // Every one of the three gets the same hint, so no reaction can quietly
  // acquire a different promise about who sees it.
  assert.equal(typeof REACTION_HINT, 'string');
});

test('a reaction label names the look it belongs to, and never a person’s handle', () => {
  assert.equal(reactionAccessibilityLabel('sharp', 'Weekend layers'), 'Sharp, on Weekend layers');
  assert.equal(reactionAccessibilityLabel('noted', null), `Noted, on ${UNNAMED_LOOK}`);
  assert.equal(reactionAccessibilityLabel('cozy', '   '), `Cozy, on ${UNNAMED_LOOK}`);
});

// ---------------------------------------------------------------------------
// 6 · House copy rules
// ---------------------------------------------------------------------------

test('apostrophes are typographic, and no placeholder survived', () => {
  assert.doesNotMatch(ALL_COPY, /\w'\w/, 'a straight apostrophe crept into the copy');
  assert.doesNotMatch(ALL_COPY, /TODO|TBD|TKTK|Lorem|coming soon|placeholder/i);
});

test('nothing on this surface reads as a notification', () => {
  // "Nothing that looks like a notification. No badge, no bell, no '3 new'.
  // This surface is opened, never pushed."
  assert.doesNotMatch(ALL_COPY, /\bnotification\b|\balert\b|\bbadge\b|\bunread\b|\bnotify\b/i);
  const dir = 'src/components/daily-social';
  for (const file of readdirSync(dir).filter((f) => /\.tsx$/.test(f))) {
    assert.doesNotMatch(body(`${dir}/${file}`), /badge|bell\b/i, `${file} draws a notification`);
  }
});

test('no free-text field exists anywhere in the kit', () => {
  // The unit ships no free text at all, which is what keeps UGC moderation,
  // text filtering and abuse review out of this surface entirely.
  const dir = 'src/components/daily-social';
  for (const file of readdirSync(dir).filter((f) => /\.tsx$/.test(f))) {
    const src = body(`${dir}/${file}`);
    assert.doesNotMatch(src, /<TextInput|<SearchField|multiline/, `${file} has a text field`);
  }
});

test('no camera, library or upload affordance exists anywhere in the kit', () => {
  // A look is a collage of garment images the app already has. There is no
  // capture step, no upload, no bucket and no permission — a photograph of a
  // person is a different product with a different review obligation.
  const dir = 'src/components/daily-social';
  for (const file of readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
    const src = body(`${dir}/${file}`);
    assert.doesNotMatch(
      src,
      /expo-camera|expo-image-picker|launchCamera|launchImageLibrary|<Avatar/,
      `${file} reaches for a camera, a library or a face`,
    );
  }
});
