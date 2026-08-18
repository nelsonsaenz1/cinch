/**
 * ACTIVITY, REDESIGN 28 — the drawn contract.
 *
 * The page became a column of 44pt faces, one written sentence each, the day
 * under the sentence, and a warm dot at the trailing edge; the colophon left the
 * scroll view and is pinned in every state.
 *
 * NOTHING ABOUT WHAT THE PAGE MAY KNOW MOVED, and this file is what stops a
 * presentation change from quietly becoming a privacy change. Four laws are
 * asserted rather than trusted:
 *
 *   1. No count exists anywhere on the drawn surface. The unseen signal is a
 *      dot and a spoken word, and there is no number on the path to render.
 *   2. The colophon is exact, and it is in every state — including the ones
 *      that used to have none.
 *   3. The thirty-day claim and the recipient-only claim still reach a screen
 *      reader VERBATIM, which is the only reason the two sentences are allowed
 *      to be five tracked words on screen.
 *   4. The taxonomy is untouched: the sentence grammar, the sections, the seen
 *      rule and the routes are the ones `tests/activity-center-*.test.ts`
 *      already pin, and this wave modified none of them.
 *
 * Read as SOURCE where the claim is about what a component draws, and as
 * evaluated functions where the claim is arithmetic. The components import
 * React Native, whose Flow source the node test bundler cannot parse — which is
 * why the decisions live in `activity-spec.ts` in the first place.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  AX_SCALE,
  BACK_TILE,
  CLEAR_BAR_HEIGHT,
  META_SIZE,
  REMOVE_DISC,
  ROW_AVATAR,
  ROW_AVATAR_AX,
  SENTENCE_LEADING,
  SENTENCE_SIZE,
  STAMP_PLACEMENT,
  UNSEEN_DOT,
  dotOffset,
  isCollapsibleSection,
  rowMetrics,
  showsSectionHeadings,
  startsCollapsed,
} from '../src/features/activity-center/activity-spec.ts';
import {
  CLEAR_ALL,
  EDIT,
  EDIT_DONE,
  EDIT_NOTE,
  EMPTY_BODY,
  EMPTY_TITLE,
  ERROR_BODY,
  ERROR_RETRY,
  ERROR_TITLE,
  FOOTER_MARK,
  FOOTER_PRIVACY,
  OFFLINE_BANNER,
  RETENTION_NOTE,
  SECTION_HIDE,
  SECTION_NEW,
  SECTION_SHOW,
  UNREAD_SPOKEN,
} from '../src/features/activity-center/copy.ts';
import { AX_FONT_SCALE } from '../src/components/today/reaction-spec.ts';
import { MIN_TAP_TARGET } from '../src/theme/metrics.ts';

const code = (path: string): string => readFileSync(path, 'utf8');

/** Source with comments stripped — a rule explained in prose is not a rule kept. */
const body = (path: string): string =>
  code(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ROUTE = 'src/app/activity.tsx';
const DIR = 'src/components/activity-center';
const BODY = `${DIR}/activity-body.tsx`;
const PARTS = `${DIR}/activity-parts.tsx`;
const ROWS = `${DIR}/rows.tsx`;
const STATES = `${DIR}/state-screens.tsx`;
const GLYPHS = `${DIR}/glyphs.tsx`;
const LEGACY_ROW = 'src/components/activity/ActivityRow.tsx';
const SPEC = 'src/features/activity-center/activity-spec.ts';

const kit = (): string[] => readdirSync(DIR).filter((f) => /\.tsx$/.test(f));

// ---------------------------------------------------------------------------
// 1 · No count, anywhere on the drawn surface
// ---------------------------------------------------------------------------

/**
 * The refusal that outlives this wave.
 *
 * `activity-center-privacy.test.ts` already holds the DATA path — the RPC is an
 * `exists`, and the query and grouping layers name no count. This is the same
 * refusal one layer up, over every file that draws a pixel, because the drawn
 * surface is where a count would actually be invented: a section header with
 * `{section.data.length}` beside it, or a badge over the entry glyph.
 */
test('no drawn component names or renders a count', () => {
  for (const file of [...kit().map((f) => `${DIR}/${f}`), ROUTE, LEGACY_ROW, SPEC]) {
    const source = body(file);
    assert.doesNotMatch(
      source,
      /\b(unseenCount|unreadCount|badgeCount|newCount|totalUnseen)\b/,
      `${file} named a count`,
    );
    // The two shapes a count is actually reached by on a sectioned list.
    assert.doesNotMatch(source, /\.data\.length\s*\}/, `${file} rendered a section length`);
    assert.doesNotMatch(source, /\{\s*sections\.length\s*\}/, `${file} rendered a section count`);
  }
});

test('the spec exports no number that could stand in for a count', () => {
  // Every exported constant here is a MEASUREMENT. The test is that none of
  // them is named after a quantity of rows, which is the only way a layout
  // module could become the place a badge value came from.
  const source = code(SPEC);
  const exported = [...source.matchAll(/export const ([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
  for (const name of exported) {
    assert.doesNotMatch(name, /COUNT|TALLY|BADGE|TOTAL/i, `${name} reads as a quantity`);
  }
});

test('unseen is a boolean prop and never a number', () => {
  const source = body(ROWS);
  assert.match(source, /unseen\?:\s*boolean/);
  assert.match(body(LEGACY_ROW), /unseen\?:\s*boolean/);
  // And the row draws the dot on the boolean alone — no arithmetic in between.
  assert.match(source, /\{unseen \? \(/);
});

// ---------------------------------------------------------------------------
// 2 · The colophon — exact, and in every state
// ---------------------------------------------------------------------------

test('the colophon string is exactly what the atlas prints', () => {
  assert.equal(FOOTER_MARK, 'PRIVATE TO YOU · KEPT 30 DAYS');
});

/**
 * It is drawn ONCE, OUTSIDE the scroll view, and after the branch.
 *
 * That is the whole of "in every state": if `ActivityColophon` sat inside the
 * conditional that chooses between the skeleton, the empty page and the rows,
 * it would go missing from two of the three exactly as it used to.
 */
test('the colophon is outside the scroll view, so no state can lose it', () => {
  const source = body(BODY);
  const colophon = source.indexOf('<ActivityColophon');
  const close = source.indexOf('</ScrollView>');
  assert.ok(colophon > 0, 'the colophon has moved');
  assert.ok(close > 0 && colophon > close, 'the colophon is inside the ScrollView again');
  // Once. A second copy is how one state ends up with two.
  assert.equal(source.split('<ActivityColophon').length - 1, 1);
});

test('the two claims still reach a screen reader verbatim', () => {
  // The colophon is five tracked words; the sentences are the real copy. This
  // arrangement is the only reason the thirty-day line is allowed to be a mark.
  const source = code(PARTS);
  assert.match(source, /accessibilityLabel=\{`\$\{FOOTER_PRIVACY\} \$\{RETENTION_NOTE\}`\}/);
  assert.match(RETENTION_NOTE, /older than 30 days/);
  assert.match(FOOTER_PRIVACY, /Only you can see your activity/);
});

test('the retention window the copy states is the window the purge enforces', () => {
  // Restated from the privacy suite deliberately: this wave rewrote the page
  // that says "30 days", and the claim is only true because of the migration.
  assert.match(code('supabase/migrations/20260820000000_activity_center.sql'), /interval '30 days'/);
});

// ---------------------------------------------------------------------------
// 3 · The row anatomy — face, sentence, day, dot
// ---------------------------------------------------------------------------

test('the mark is 44 at default size and grows with the type', () => {
  assert.equal(ROW_AVATAR, MIN_TAP_TARGET);
  assert.equal(rowMetrics(1).avatar, ROW_AVATAR);
  assert.equal(rowMetrics(AX_SCALE).avatar, ROW_AVATAR_AX);
  assert.ok(ROW_AVATAR_AX > ROW_AVATAR);
});

test('both halves of the merged list draw the same mark and the same sentence', () => {
  // The seam between `activity_events` and `activity_feed()` must be invisible.
  // Both row components read their measurements from the one spec module.
  for (const file of [ROWS, LEGACY_ROW]) {
    assert.match(body(file), /activity-center\/activity-spec/, `${file} kept its own measurements`);
  }
  assert.match(body(LEGACY_ROW), /const MARK = ROW_AVATAR/);
});

test('the stamp is under the sentence, not in a trailing column', () => {
  assert.equal(STAMP_PLACEMENT, 'below');
  // The trailing column belongs to the dot now, and nothing else is in it.
  const source = body(ROWS);
  const trailing = source.slice(source.indexOf('{unseen ? ('));
  assert.doesNotMatch(trailing.slice(0, 400), /line\.stamp/);
});

test('the dot sits on the sentence’s first line at any leading', () => {
  // A two-line sentence must not drag it down the row — the failure the old
  // trailing stamp actually had.
  assert.equal(dotOffset(SENTENCE_LEADING), Math.round((SENTENCE_LEADING - UNSEEN_DOT) / 2));
  assert.ok(dotOffset(26) > dotOffset(22), 'the offset must follow the leading');
});

test('the dot is nine points of the accent, with no ring on paper', () => {
  assert.equal(UNSEEN_DOT, 9);
  const source = body(GLYPHS);
  const fn = /export function UnreadDot[\s\S]*?\n}/.exec(source)![0];
  assert.match(fn, /backgroundColor: theme\.accent/);
  assert.doesNotMatch(fn, /borderWidth/);
});

test('the sentence is set at the artifact’s measurement and the day beneath it is smaller', () => {
  assert.equal(SENTENCE_SIZE, 15.5);
  assert.equal(SENTENCE_LEADING, 22);
  assert.ok(META_SIZE < SENTENCE_SIZE, 'the day must not compete with the sentence');
});

/**
 * Emphasis is COLOUR, not weight — TY-01, and it is a cross-taxonomy rule here.
 *
 * The frames set the proper nouns in semibold. This repository removed weight
 * from the product and expresses the same emphasis as ink-against-muted, and on
 * THIS page the choice is not a preference: the two kinds of row are interleaved
 * down one column, so two dialects of emphasis would be more visible than either
 * on its own.
 */
test('neither row component reaches for a font weight', () => {
  for (const file of [ROWS, LEGACY_ROW]) {
    assert.doesNotMatch(body(file), /fontWeight/, `${file} carried a weight`);
    assert.match(body(file), /segment\.bold \? 'text-ink' : 'text-muted'/, file);
  }
});

// ---------------------------------------------------------------------------
// 4 · Sections
// ---------------------------------------------------------------------------

test('one section draws no heading; two or more do', () => {
  assert.equal(showsSectionHeadings(0), false);
  assert.equal(showsSectionHeadings(1), false);
  assert.equal(showsSectionHeadings(2), true);
  assert.equal(showsSectionHeadings(4), true);
});

test('only the oldest section folds, and it arrives folded', () => {
  assert.equal(isCollapsibleSection('month'), true);
  for (const key of ['new', 'earlier', 'week']) {
    assert.equal(isCollapsibleSection(key), false, key);
    assert.equal(startsCollapsed(key), false, key);
  }
  assert.equal(startsCollapsed('month'), true);
});

test('the fold is a word with a spoken expanded state, never a bare chevron', () => {
  assert.equal(SECTION_SHOW, 'Show');
  assert.equal(SECTION_HIDE, 'Hide');
  const source = body(PARTS);
  assert.match(source, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(source, /accessibilityLabel=\{`\$\{title\}, \$\{toggleLabel\}`\}/);
});

test('the section eyebrow is the accent, and `New` still means unseen', () => {
  assert.match(body(PARTS), /variant="eyebrow" style=\{\{ color: theme\.accent \}\}/);
  assert.equal(SECTION_NEW, 'New');
  // The heading and the dot answer to the same authority — the section a row
  // landed in — so they can never disagree about what New means.
  assert.match(body(BODY), /const unseen = section\.key === 'new'/);
});

// ---------------------------------------------------------------------------
// 5 · Accessibility
// ---------------------------------------------------------------------------

test('unseen is spoken as a word, so the dot is never the only carrier', () => {
  assert.equal(UNREAD_SPOKEN, 'unread');
  // The dot itself is hidden from the reader — the row's composed label says it.
  const fn = /export function UnreadDot[\s\S]*?\n}/.exec(body(GLYPHS))![0];
  assert.match(fn, /accessibilityElementsHidden/);
});

test('the Remove disc is a glyph that says its whole row out loud', () => {
  // The shipped control was the WORD "Remove", refusing a glyph as "the one
  // destructive control identified by shape alone". The frames draw the disc;
  // the objection is answered by the label rather than overruled.
  assert.equal(REMOVE_DISC, 28);
  assert.match(body(PARTS), /export const removeLabel = \(spoken: string\)/);
  assert.match(body(ROWS), /label=\{removeLabel\(line\.spoken\)\}/);
});

test('every control on the page clears the 44pt floor', () => {
  assert.equal(BACK_TILE, MIN_TAP_TARGET);
  assert.ok(CLEAR_BAR_HEIGHT >= MIN_TAP_TARGET);
  // The inline Accept / Decline grew from 34 to the floor, which retires the
  // hitSlop that used to make up the difference.
  const rows = body(ROWS);
  // Sliced to the next top-level declaration rather than matched with a lazy
  // `\n}`, which stops at the destructured parameter list.
  const from = rows.indexOf('function InlineAction');
  const inline = rows.slice(from, rows.indexOf('export type ActivityCenterRowProps', from));
  assert.ok(inline.length > 0, 'InlineAction has moved');
  assert.match(inline, /minHeight: MIN_TAP_TARGET/);
  assert.doesNotMatch(inline, /hitSlop/);
  // The disc is under the floor by design and compensates.
  assert.match(body(PARTS), /hitSlop=\{\(MIN_TAP_TARGET - REMOVE_DISC\) \/ 2\}/);
});

test('the AX threshold is the app’s one threshold', () => {
  assert.equal(AX_SCALE, AX_FONT_SCALE);
  assert.equal(rowMetrics(AX_SCALE).stacksActions, true);
  assert.equal(rowMetrics(1.34).stacksActions, false);
});

test('the loading status is announced even though it is not drawn', () => {
  const source = body(STATES);
  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(source, /accessibilityLabel=\{LOADING_STATUS\}/);
});

test('Edit mode stays reachable, though the default frame omits the control', () => {
  // §11: swipe-to-dismiss and long-press each need a visible equivalent. A
  // surface whose only way to remove a row is a swipe cannot be cleared by a
  // VoiceOver user, so `Edit` is drawn where the frames draw only `Done`.
  assert.equal(EDIT, 'Edit');
  assert.equal(EDIT_DONE, 'Done');
  assert.match(body(PARTS), /editing \? EDIT_DONE : EDIT/);
});

// ---------------------------------------------------------------------------
// 6 · Copy
// ---------------------------------------------------------------------------

test('the redesign’s state copy is the artifact’s, word for word', () => {
  assert.equal(EMPTY_TITLE, 'Nothing yet');
  assert.equal(
    EMPTY_BODY,
    'When someone invites you to a group or reacts to what you wore, it arrives here.',
  );
  assert.equal(ERROR_TITLE, 'Couldn’t load');
  assert.equal(
    ERROR_BODY,
    'Your activity is safe on the server. This device could not read it just now.',
  );
  assert.equal(ERROR_RETRY, 'Try again');
  assert.equal(OFFLINE_BANNER, 'You are offline. This is what arrived before you lost signal.');
  assert.equal(CLEAR_ALL, 'Clear all');
});

/**
 * The edit note is the one string on the page that exists to prevent a mistake
 * rather than to describe the interface.
 *
 * A reader clearing a row that says "Marisol invited you to the circle Sunday
 * Roasts" has every reason to believe they have just declined an invitation.
 * `activity_events` and `circle_members` are different tables and Remove touches
 * only the first.
 */
test('edit mode says what removing does NOT do', () => {
  assert.match(EDIT_NOTE, /hides it from your inbox only/);
  assert.match(EDIT_NOTE, /answers nothing and tells nobody/);
});

test('no state screen is dressed as another', () => {
  // An empty inbox and a failed read look identical from the outside and mean
  // opposite things. Nothing in the failure's copy may read as "nothing here".
  assert.notEqual(EMPTY_TITLE, ERROR_TITLE);
  assert.doesNotMatch(ERROR_BODY, /nothing/i);
  assert.match(ERROR_BODY, /safe on the server/);
});

// ---------------------------------------------------------------------------
// 7 · What this wave did not touch
// ---------------------------------------------------------------------------

/**
 * The presentation change is a presentation change.
 *
 * These four modules carry the taxonomy, the sentence grammar, the sections and
 * the merge, and `tests/activity-center-*.test.ts` pin every one of them. If a
 * future wave needs to edit them it will — but it must not do so from a file
 * whose job is drawing, so the assertion is that the drawn layer imports them
 * and adds nothing to them.
 */
test('the drawn layer reads the taxonomy and never restates it', () => {
  for (const file of [...kit().map((f) => `${DIR}/${f}`), ROUTE]) {
    const source = body(file);
    // No component builds a sentence: the strings live in `copy.ts` and the
    // segmentation in `sentence.ts`.
    assert.doesNotMatch(source, /invited you to/, `${file} typed a row sentence`);
    assert.doesNotMatch(source, /reacted “/, `${file} typed a row sentence`);
    // And nothing re-decides which section a row is in.
    assert.doesNotMatch(source, /function sectionOf/, `${file} restated the seen rule`);
  }
});

test('the client still cannot write a row, only its own seen and dismissed marks', () => {
  const source = code('src/features/activity-center/client.ts');
  const block = /from\(relation: 'activity_events'\)[\s\S]*?\};/.exec(source)![0];
  assert.doesNotMatch(block, /\binsert\s*\(/);
});

// ---------------------------------------------------------------------------
// 8 · The fixtures
// ---------------------------------------------------------------------------

test('the eight drawn states each have a fixture', () => {
  const av = readdirSync('src/dev-fixtures').filter((f) => /^dev-av-\d\d-.*\.tsx$/.test(f));
  assert.equal(av.length, 8, `av fixtures: ${av.sort().join(', ')}`);
});

/**
 * A fixture that typed its own sentences would photograph a page nobody ships.
 *
 * The frames go through the same `describeActivity`, `buildSections` and
 * `mergeLegacy` the screen calls, so a frame keeps looking correct only while
 * the real composition does.
 */
test('the fixtures build their rows through the shipping composition', () => {
  const source = body('src/dev-fixtures/av-frames.tsx');
  for (const fn of ['describeActivity', 'buildSections', 'mergeLegacy']) {
    assert.match(source, new RegExp(`\\b${fn}\\b`), `the fixture bypassed ${fn}`);
  }
  // And it draws the shipping body rather than a copy of it.
  assert.match(source, /<ActivityBody/);
});
