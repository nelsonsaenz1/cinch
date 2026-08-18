/**
 * LP-04 and LP-10 — the event card's hierarchy and the event detail's two
 * scannable rows.
 *
 * Both surfaces are `.tsx` and therefore unreachable by this bundler (esbuild
 * cannot parse React Native's Flow source), which is why the DECISIONS they
 * make — which fact appears, in which slot, and which one is withheld — were
 * moved into `features/events/event-lines.ts`. This file checks the real
 * functions the screens call, not a transcription of them.
 *
 * Two of the rules below are privacy rules rather than layout preferences, and
 * they are the reason this file exists at all:
 *
 *   · §7.1 — coarse before joined, precise after. Someone who has only been
 *     invited gets the day and nothing else: no time, no venue, no weather.
 *   · a headcount is coarse in both directions and never names anybody.
 *
 * The rest is the brief's strict hierarchy, plus its refusals: no weather line
 * on a card, no second headcount, no blank row where a fact is missing.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  dateTimeLine,
  eventCardLabel,
  eventCardLines,
  NO_DATE_LINE,
  NO_VENUE_LINE,
  venueLines,
  viewerStanding,
  whenLabel,
} from '../src/features/events/event-lines';

const at = (h: number, m = 0) => new Date(2026, 7, 8, h, m, 0);

const summary = (over: Partial<Parameters<typeof eventCardLines>[0]> = {}) =>
  eventCardLines({
    title: 'Birthday dinner',
    startsAt: at(19, 30),
    endsAt: at(23),
    venueName: 'Bar Ideale',
    occasion: 'dinner',
    myState: 'joined',
    isHost: false,
    memberCount: 4,
    invitedCount: 6,
    myLookState: 'none',
    ...over,
  });

// ---------------------------------------------------------------------------
// The date/time line
// ---------------------------------------------------------------------------

test('a member gets the day and the hour; an invitee gets only the day', () => {
  const precise = dateTimeLine(at(19, 30), at(23));
  const coarse = dateTimeLine(at(19, 30), at(23), { coarse: true });

  assert.ok(precise.startsWith(coarse), `${precise} does not extend ${coarse}`);
  assert.ok(precise.length > coarse.length, 'the member line carries no time');
  // §7.1 in its strongest form: the coarse line contains no hour at all.
  assert.ok(!/\d{1,2}[:.]\d{2}/.test(coarse), coarse);
  assert.ok(!/[ap]m/.test(coarse), coarse);
});

test('a multi-day occasion prints its span and no single hour', () => {
  const line = dateTimeLine(new Date(2026, 8, 12), new Date(2026, 8, 16));
  assert.equal(line, whenLabel(new Date(2026, 8, 12), new Date(2026, 8, 16)));
  assert.ok(!/[ap]m/.test(line), 'a four-day trip has no one time');
});

test('an undated occasion says so rather than borrowing today', () => {
  assert.equal(dateTimeLine(null, null), NO_DATE_LINE);
  assert.equal(dateTimeLine(null, null, { coarse: true }), NO_DATE_LINE);
  // Never null: a blank row is what a host cannot see in order to fix.
  assert.equal(typeof dateTimeLine(null, null), 'string');
});

// ---------------------------------------------------------------------------
// The venue rows
// ---------------------------------------------------------------------------

test('the venue name leads and the address follows as a second line', () => {
  assert.deepEqual(venueLines('Bar Ideale', '14 Rue Oberkampf'), {
    value: 'Bar Ideale',
    secondary: '14 Rue Oberkampf',
  });
});

test('a place typed by hand carries no empty address line', () => {
  assert.deepEqual(venueLines('Sarah’s place', null), {
    value: 'Sarah’s place',
    secondary: null,
  });
  // And an address with no name is promoted rather than printed under a blank.
  assert.deepEqual(venueLines(null, '14 Rue Oberkampf'), {
    value: '14 Rue Oberkampf',
    secondary: null,
  });
});

test('no place at all is an honest missing state, not an empty row', () => {
  assert.deepEqual(venueLines(null, null), { value: NO_VENUE_LINE, secondary: null });
  assert.notEqual(NO_VENUE_LINE.trim(), '');
});

// ---------------------------------------------------------------------------
// The viewer's standing
// ---------------------------------------------------------------------------

test('standing is the viewer’s own state, and cancellation outranks it', () => {
  assert.equal(viewerStanding({ isHost: true, myState: 'joined' }), 'Hosting');
  assert.equal(viewerStanding({ isHost: false, myState: 'joined' }), 'Going');
  assert.equal(viewerStanding({ isHost: false, myState: 'invited' }), 'Invited');
  assert.equal(viewerStanding({ isHost: false, myState: null }), null);
  assert.equal(
    viewerStanding({ isHost: true, myState: 'joined', canceledAt: new Date() }),
    'Cancelled',
  );
});

test('standing takes no roster, so it can never name an absent person', () => {
  // The privacy rule enforced by SHAPE, the way `occasion-copy` enforces it:
  // one argument, and it is the viewer's own row.
  assert.equal(viewerStanding.length, 1);
});

// ---------------------------------------------------------------------------
// LP-10 — the card's four lines, and the ones that are gone
// ---------------------------------------------------------------------------

test('a member’s card is title, date, venue, and one signal', () => {
  const card = summary({ myLookState: 'posted' });
  assert.equal(card.title, 'Birthday dinner');
  assert.equal(card.state, null, 'a settled card announces no decision');
  assert.match(card.when, /Aug/);
  assert.equal(card.where, 'Bar Ideale');
  assert.equal(card.signal, '4 of 6 going · Your look shared');
});

test('the invitation is the one card that carries an actionable state', () => {
  const card = summary({ myState: 'invited', isHost: false });
  assert.equal(card.state, 'Invited');
  // And it stays coarse: no venue, no hour.
  assert.equal(card.where, 'Dinner', 'the occasion word, never the place');
  assert.ok(!/[ap]m/.test(card.when), card.when);
});

test('an invitee’s card never leaks the venue, whatever the row holds', () => {
  for (const myState of ['invited', null]) {
    const card = summary({ myState, isHost: false, venueName: 'Bar Ideale' });
    assert.ok(card.where !== 'Bar Ideale', `${myState} saw the venue`);
    assert.ok(!eventCardLabel(card).includes('Bar Ideale'), 'the spoken label leaked it');
  }
});

test('an occasion with no place says so on a member’s card', () => {
  assert.equal(summary({ venueName: null }).where, NO_VENUE_LINE);
});

test('an occasion with no date says so, and never guesses one', () => {
  const card = summary({ startsAt: null, endsAt: null });
  assert.equal(card.when, NO_DATE_LINE);
});

test('one is quiet: a host alone prints no headcount and no look clause', () => {
  const card = summary({
    isHost: true,
    myState: 'joined',
    memberCount: 1,
    invitedCount: 1,
    myLookState: 'none',
  });
  assert.equal(card.signal, null, '"1 going" is not a fact worth printing');
});

test('the headcount is printed once, and only in the signal slot', () => {
  const card = summary({ memberCount: 4, invitedCount: 4 });
  assert.equal(card.state, null);
  assert.equal(card.signal, '4 going');
  const printed = [card.state, card.when, card.where, card.signal].filter(Boolean).join(' | ');
  assert.equal(printed.match(/going/g)!.length, 1, `two headcounts on one card: ${printed}`);
});

test('a card carries no weather, in any state', () => {
  for (const over of [{}, { myState: 'invited' as const }, { startsAt: null, endsAt: null }]) {
    const card = summary(over);
    const all = Object.values(card).filter(Boolean).join(' ');
    assert.ok(!/Feels|Clear|Rain|Windy|Warm|Cold|forecast/i.test(all), all);
  }
});

test('the spoken label reads the card in the order the card is drawn', () => {
  const card = summary({ myState: 'invited', isHost: false });
  assert.equal(
    eventCardLabel(card),
    `${card.title}. ${card.state}. ${card.when}. ${card.where}. ${card.signal}`,
  );
  // An absent line is absent from the announcement too — never a stray ". .".
  const bare = summary({ startsAt: null, endsAt: null, venueName: null, memberCount: 1, invitedCount: 1 });
  assert.equal(eventCardLabel(bare), `${bare.title}. ${NO_DATE_LINE}. ${NO_VENUE_LINE}`);
});

// ---------------------------------------------------------------------------
// The detail page's fixed order, read off the source
// ---------------------------------------------------------------------------
//
// SUPERSEDED BY REDESIGN 03, and superseded rather than dropped.
//
// LP-04's page opened with a `ScreenHeader`, a `variant="title"`, two
// `FactRow`s labelled When and Where, and a `YourLookCard`. The accepted
// artifact replaces that composition wholesale with the poster: a tinted band
// carrying the name and one small line, then the look as the dominant plate,
// then the roster as chips. None of those four components exists any more, so
// an assertion naming them is an assertion about a screen nobody can open.
//
// Every RULE below is the rule it always was — the fixed order above the fold,
// the venue printed once, no fixed height under a fact, a way back from every
// branch, and §7.1 — asked of the surfaces that own them now. The page was
// also split route/body the way plan-week and new-event were, so the drawing
// rules are read from the body and the gating rules from the route.

const DETAIL = readFileSync('src/app/event/[id]/index.tsx', 'utf8');
const DETAIL_BODY_SRC = readFileSync('src/components/events/event-detail-body.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const detailBody = code(DETAIL);
const poster = code(DETAIL_BODY_SRC);

test('the four things above the fold appear in the brief’s order', () => {
  // The poster's order, and the artifact's: the band (name over its tinted
  // ground), `Your look` with its Change action, the plate, then the roster.
  const order = ['<Band', 'EVENT_DETAIL_COPY.yourLook', 'view.plate.kind', '<Roster'];
  let cursor = -1;
  for (const marker of order) {
    const next = poster.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, `${marker} is not after ${order[order.indexOf(marker) - 1]}`);
    cursor = next;
  }
});

test('the sentence-shaped status lines are gone from the page', () => {
  // They still exist in `occasion-copy.ts` and are still tested there. What
  // changed is that this page stopped restating what its own labels say.
  for (const src of [detailBody, poster]) {
    assert.doesNotMatch(src, /hostStatusLine/, 'the host status sentence is back');
    assert.doesNotMatch(src, /readyLine/, '"n have chosen a look" duplicates "n of m shared"');
  }
});

test('the venue is printed once on the detail page', () => {
  assert.doesNotMatch(detailBody, /<VenueCard/, 'the venue card is back');
  // Once, in the line under the name. The ADDRESS is a different fact and
  // belongs to the one quiet line; the name belongs to the poster line.
  assert.match(detailBody, /posterLine\(/);
  assert.doesNotMatch(poster, /venueName/, 'the body composes a venue line of its own');
  // Its one unique fact survived the poster losing the row it sat on: the
  // reservation is in the overflow menu, spelled by the same helper.
  assert.match(detailBody, /reservationLabel\(/);
});

test('every fact grows with Dynamic Type rather than being boxed', () => {
  // The rule, unchanged: a box sized for standard type clips at AX. The
  // poster's chips and its actions state FLOORS, and the only literal
  // `height:` in the body belongs to the plate, an avatar disc, a bead or a
  // skeleton — never to something carrying a sentence.
  assert.match(poster, /minHeight: large \? CHIP_MIN_HEIGHT_AX : MIN_TAP_TARGET/, 'the chip lost its floor');

  // The action states a FLOOR and grows past it. Read from the function's own
  // slice, because the loading frame draws bars at exactly those measures —
  // and a `height` on a Skeleton is right: a skeleton holds no type.
  const from = poster.indexOf('function Action(');
  const to = poster.indexOf('function FailureBand(');
  assert.ok(from > -1 && to > from, 'Action moved or was renamed');
  const action = poster.slice(from, to);
  assert.match(action, /minHeight: large\s*\n?\s*\? CTA_MIN_HEIGHT_AX/, 'the action lost its floor');
  assert.doesNotMatch(action, /\bheight: /, 'an action was given a fixed height');

  // `minHeight:` is not matched — the capital H makes these two different
  // words, which is the whole distinction being enforced.
  for (const line of (poster.match(/\bheight: [^,\n}]+/g) ?? []).map((l) => l.trim())) {
    assert.match(
      line,
      // A picture box, a mark, a glyph, or a skeleton bar drawn at the measure
      // the real control will settle at — never a label that grows with type.
      /avatar|row \* 2|large \? row|\bDOT\b|NOTICE_DOT|PLATE_ROW|\bsize\b|'100%'|\bh\b|\b(12|13)\b|CTA_MIN_HEIGHT|NAV_ROW_MIN_HEIGHT|MIN_TAP_TARGET/,
      `a fixed height under something that carries type — ${line}`,
    );
  }
});

test('the page keeps its back affordance in every branch it can render', () => {
  // LP-08: a pushed screen always has a visible way back, including the two
  // failure branches and the not-found branch. The poster's own way back is
  // the band's button, which is why the loading branch renders the body rather
  // than a bare skeleton; the two failure branches keep the `ScreenHeader`.
  const headers = detailBody.match(/<ScreenHeader/g) ?? [];
  assert.ok(headers.length >= 2, `only ${headers.length} failure branches carry a header`);
  assert.match(detailBody, /loadingView\(\(\) => router\.back\(\)\)/, 'the loading branch has no way back');
  assert.match(poster, /onPress=\{view\.onBack\}/, 'the band lost its back button');
});

test('§7.1 is enforced by the venue not reaching the poster before joining', () => {
  // The Where row is gone; the withholding is not. The route hands the band a
  // venue of `null` for a non-member and asks for the coarse date, so the
  // poster line has nothing to print and no missing-state to invent.
  assert.match(detailBody, /venueName: isMember \? event\.venueName : null/);
  assert.match(detailBody, /coarse: !isMember/);
  // The address, the party size and the dress code are the same rule.
  assert.match(detailBody, /logistics: isMember\s*\?/);
});
