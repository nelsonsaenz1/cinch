/**
 * Event Detail — the poster. The layout bargain, and the decisions under it.
 * Redesign 03.
 *
 * Written to the shape `plan-week-layout.test.ts`, `new-event-layout.test.ts`
 * and `people-search-layout.test.ts` set: the drawn body is asserted as TEXT,
 * because esbuild cannot parse React Native's Flow source and there is no
 * renderer in this runner; everything the page DECIDES before it draws lives in
 * `event-detail-spec.ts` and is imported and exercised directly.
 *
 * This page has one thing to get wrong that neither of the other three does,
 * and it is not a layout: it is the only rebuilt surface that draws OTHER
 * PEOPLE. The roster is `event_members` and `event_members` is a policy, so the
 * half of this file that matters most is the half that checks the chips can
 * only ever narrow the set they are handed — a widened roster is a privacy
 * failure that looks exactly like a nicer screenshot.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHIP_AVATAR,
  CTA_MIN_HEIGHT,
  LOOK_OPTION_LIMIT,
  CTA_MIN_HEIGHT_AX,
  CTA_SECONDARY_MIN_HEIGHT,
  EVENT_DETAIL_COPY,
  NAV_ROW_MIN_HEIGHT,
  PLATE_GAP,
  PLATE_ROW,
  PLATE_ROW_AX,
  ROSTER_CHIP_LIMIT,
  emptyLookBody,
  firstNameOf,
  formalityTarget,
  heroTone,
  logisticsLine,
  moreFriendsLine,
  occasionTarget,
  optionPosition,
  posterLine,
  posterLinesAx,
  primaryGround,
  rosterChips,
  suggestionCount,
} from '../src/features/events/event-detail-spec';

const RAW = readFileSync('src/components/events/event-detail-body.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/event/[id]/index.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/events/event-detail-spec.ts', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(RAW);
const ROUTE = code(ROUTE_RAW);
const SPEC = code(SPEC_RAW);

// ---------------------------------------------------------------------------
// The layout bargain
// ---------------------------------------------------------------------------

test('a column that can grow is a column that can shrink', () => {
  // `flex: 1` alone does not permit a child to go smaller than its content in
  // every RN layout path; the zero minimum on the flexed axis is what makes the
  // shrink actually available. Horizontal boxes state `minWidth: 0`; the one
  // vertical region — the scrolling middle of the poster — states
  // `minHeight: 0`, which is the same bargain about the axis it flexes.
  const flexed = CODE.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(
    flexed.length >= 6,
    `expected the plate wells, the band buttons, the actions and the text columns — got ${flexed.length}`,
  );
  for (const column of flexed) {
    assert.match(column, /min(Width|Height): 0/, `a flexible box without a zero minimum — ${column}`);
  }

  // The plate's wide well is `flex: 2` and needs the same promise.
  assert.match(CODE, /flex: 2, minWidth: 0/, 'the plate’s wide well can overflow its row');
});

test('the fixed parts of a row keep their points explicitly', () => {
  // The other half of the same bargain: if the fixed parts do not say they are
  // fixed, the text column is not the one that gives. The band buttons, the
  // chip's avatar disc, the clay bead, the failure band's dot and the count
  // beside the chevron each state it.
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 6,
    'a fixed part of a row can be squeezed by the text beside it',
  );
});

test('the one quiet line truncates at standard size and wraps at large type', () => {
  // The governing clause — "in every case composition changes and height is
  // allowed. Nothing is capped, truncated, ellipsised or scaled below its
  // documented size" — so the ellipsis that the frame draws on the logistics
  // line is a STANDARD-SIZE treatment and lifts entirely above the threshold.
  assert.match(CODE, /numberOfLines=\{large \? undefined : 1\}/, 'the quiet line never stops truncating');
});

test('at the accessibility sizes the poster recomposes rather than shrinking', () => {
  // Four composition changes, each drawn in the accepted AX frame.
  assert.match(CODE, /flexDirection: large \? 'column' : 'row'/, 'the chips stop wrapping and stack');
  assert.match(CODE, /flexDirection: large \? 'column' : 'row', gap: 10/, 'the RSVP buttons stack');
  assert.match(CODE, /view\.linesAx\.map/, 'the venue does not take its own line');
  assert.match(CODE, /\{large \? null : well\(/, 'the plate keeps its third well at large type');

  // And the poster line itself splits rather than being squeezed.
  const input = { venueName: 'Contramar', dateLine: 'Sat 12 Sep · 8:30 pm' };
  assert.equal(posterLine(input), 'Contramar · Sat 12 Sep · 8:30 pm');
  assert.deepEqual(posterLinesAx(input), ['Contramar', 'Sat 12 Sep · 8:30 pm']);
  // Nothing was lost in the split — the same words, differently arranged.
  assert.equal(posterLinesAx(input).join(' · '), posterLine(input));
});

test('nothing on this page answers large type by shrinking text', () => {
  for (const [name, src] of [['body', CODE], ['spec', SPEC]] as const) {
    assert.doesNotMatch(src, /maxFontSizeMultiplier|adjustsFontSize|allowFontScaling=\{false\}/, name);
  }
  // The AX measures are LARGER than the standard ones, in every pair.
  assert.ok(CTA_MIN_HEIGHT_AX > CTA_MIN_HEIGHT);
  assert.ok(CTA_MIN_HEIGHT > CTA_SECONDARY_MIN_HEIGHT);
  // The one measure that shrinks is the plate's ROW, and only because the AX
  // frame draws one row where the standard frame draws two — the plate is
  // shorter overall and the type below it gets the height.
  assert.ok(PLATE_ROW_AX < PLATE_ROW * 2 + PLATE_GAP);
});

test('no fixed height sits under anything that carries type', () => {
  // Every literal height in the body has to belong to a picture box, a mark, a
  // glyph or a skeleton — never to a label that grows with Dynamic Type.
  const heights = CODE.match(/\bheight: [^,\n}]+/g) ?? [];
  assert.ok(heights.length > 0);
  for (const line of heights) {
    assert.match(
      line,
      /avatar|row \* 2|large \? row|\bDOT\b|NOTICE_DOT|OPTION_DOT|PLATE_ROW|\bsize\b|'100%'|\bh\b|\b(12|13)\b|CTA_MIN_HEIGHT|NAV_ROW_MIN_HEIGHT|MIN_TAP_TARGET/,
      `a fixed height under something that carries type — ${line}`,
    );
  }
});

test('every control on the poster clears the 44pt floor', () => {
  assert.ok(CTA_MIN_HEIGHT >= 44, 'the primary action is below the tap floor');
  assert.ok(CTA_SECONDARY_MIN_HEIGHT >= 44, 'the secondary action is below the tap floor');
  assert.ok(NAV_ROW_MIN_HEIGHT >= 44, 'the door down is below the tap floor');

  // The band's buttons, the `Change` target and the chips each state it.
  assert.ok(
    (CODE.match(/MIN_TAP_TARGET/g) ?? []).length >= 3,
    'a control on the poster has no 44pt floor',
  );
  assert.ok(CHIP_AVATAR < 44, 'the avatar disc is a mark inside the chip, not the target');
});

test('waiting is drawn with skeletons, never a spinner', () => {
  assert.match(CODE, /<Skeleton/);
  assert.doesNotMatch(CODE, /ActivityIndicator|<Spinner/, 'a spinner reached the poster');
  // And the band still paints, so the reader is not looking at a grey screen.
  assert.match(CODE, /view\.loading \? null : \(/, 'the loading band lost its composition');
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('no colour in the slice is a literal', () => {
  for (const [name, src] of [['body', CODE], ['spec', SPEC], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `a hardcoded colour in the ${name}`);
    assert.doesNotMatch(src, /rgba\(/, `a hand-composited colour in the ${name}`);
  }

  // The artifact's hexes ARE the tokens', which is exactly why typing one
  // would stay invisible until the palette moved.
  assert.doesNotMatch(CODE, /E3BFB1|FBF2EC|DFD9CC|E4DED2|D8D1C2|EFEBE1|EEDFD6|8B8375/, 'an artifact hex');
  assert.doesNotMatch(CODE, /F5E4C8|7A5312|B98A2A/, 'an artifact amber reached the poster');

  // The band's translucent buttons, its date line and the failure ground are
  // tokens at an alpha, not four new browns.
  assert.match(CODE, /canvasAlpha\(0\.14\)/, 'the band’s button wells');
  assert.match(CODE, /canvasAlpha\(0\.7\)/, 'the band’s date line');
  assert.match(CODE, /warningAlpha\(0\.22\)/, 'the failure band’s ground');
});

test('clay never carries type on this page', () => {
  // `accentWarm` is 2.98:1 and `theme/contrast.ts` declares it `text: false`.
  // The artifact paints both eyebrows, the plate caption and the "6" beside
  // the chevron in it; every one of those is `muted` here, via `colophon`.
  assert.doesNotMatch(CODE, /color: theme\.accentWarm/, 'clay set as type');
  // It is still the band's second ground and the logistics bead.
  assert.match(CODE, /backgroundColor: theme\.accentWarm/, 'clay lost its two legitimate jobs');
});

test('the poster spends one filled oxblood per state', () => {
  // The constitution's accent budget, decided ONCE so that no two controls on
  // the foot can both believe they are the primary.
  //
  // The BAND is not a control and is not counted: it is the poster's ground,
  // and the artifact's whole idea is that the name sits on it. What the budget
  // governs is how many things you can PRESS that are filled with the accent,
  // and the answer is one. `view.tone` is the band; the bare `tone` is Action.
  const grounds = CODE.match(/[^.]\btone === 'accent' \? theme\.accent/g) ?? [];
  assert.equal(grounds.length, 1, 'more than one control can fill itself with oxblood');
  assert.match(CODE, /view\.tone === 'accent' \? theme\.accent : theme\.accentWarm/, 'the band lost a tint');
  assert.match(CODE, /tone === 'accent' \? theme\.canvas/, 'and canvas is what goes on it');
  assert.equal((CODE.match(/primaryGround\(\{/g) ?? []).length, 1, 'the budget is decided twice');

  // And the decision itself: exactly one claimant in every state.
  assert.equal(primaryGround({ failed: true, hasLook: true, canRsvp: true }), 'retry');
  assert.equal(primaryGround({ failed: false, hasLook: false, canRsvp: true }), 'plan');
  assert.equal(primaryGround({ failed: false, hasLook: true, canRsvp: true }), 'rsvp');
  assert.equal(primaryGround({ failed: false, hasLook: true, canRsvp: false }), 'none');
  // The empty frame's arrangement: planning takes the fill, so BOTH RSVP
  // buttons demote to tints rather than one of them staying filled.
  assert.notEqual(primaryGround({ failed: false, hasLook: false, canRsvp: true }), 'rsvp');
});

test('the band’s two tints say what the line beneath them says', () => {
  assert.equal(heroTone({ venueName: 'Contramar' }), 'accent');
  assert.equal(heroTone({ venueName: null }), 'clay', 'an unplanned evening reads as settled');
  // A reader who has only been invited cannot see the venue, so their band
  // must not claim a completeness they are not being shown.
  assert.equal(heroTone({ venueName: 'Contramar', coarse: true }), 'clay');
});

// ---------------------------------------------------------------------------
// The gesture
// ---------------------------------------------------------------------------

test('the haptic goes through the policy, and is spent on the commit', () => {
  for (const [name, src] of [['body', CODE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /expo-haptics/, `the ${name} reached past the policy`);
  }
  assert.match(CODE, /haptic="commit"/, 'the RSVP commits without a tick');
  // Navigation gets none: opening the comments or the menu is a tap with a
  // visible result, and UX-07 reserves the vocabulary for what changes.
  assert.doesNotMatch(CODE, /haptic="[a-z]+"[\s\S]{0,200}onPress=\{view\.onComments\}/, 'the door down ticks');
});

// ---------------------------------------------------------------------------
// Privacy — the half that matters most
// ---------------------------------------------------------------------------

const MEMBERS = [
  { userId: 'a', state: 'joined', role: 'host', displayName: 'Alexandria', username: 'alex' },
  { userId: 'b', state: 'joined', role: 'member', displayName: 'Priya', username: 'priya' },
  { userId: 'c', state: 'invited', role: 'member', displayName: 'Marisol', username: 'mar' },
];

test('a guest’s chips show who is coming, and nobody who is still deciding', () => {
  const guest = rosterChips(MEMBERS, { isHost: false, me: 'b' });
  assert.deepEqual(guest.chips.map((c) => c.userId), ['a', 'b']);
  assert.ok(
    !guest.chips.some((c) => c.userId === 'c'),
    'a still-deciding guest was named to somebody who is not the host',
  );
});

test('the host sees the still-deciding rows, and they are marked as such', () => {
  const host = rosterChips(MEMBERS, { isHost: true, me: 'a' });
  assert.deepEqual(host.chips.map((c) => c.userId), ['a', 'b', 'c']);
  assert.equal(host.chips.find((c) => c.userId === 'c')?.going, false);
  // The section is headed "Going", so the chip that is not going must be able
  // to say so — the body reads this flag for both the tone and the label.
  assert.match(CODE, /going \? name : `\$\{name\}, still deciding`/);
});

test('the chips can only ever narrow the set they are handed', () => {
  // The rule expressed as a property rather than as a case: whatever goes in,
  // what comes out is a subset of it, and no chip can be conjured.
  for (const isHost of [true, false]) {
    const out = rosterChips(MEMBERS, { isHost, me: null });
    assert.ok(out.chips.length <= MEMBERS.length);
    for (const chip of out.chips) {
      assert.ok(MEMBERS.some((m) => m.userId === chip.userId), `${chip.userId} was invented`);
    }
  }
  // And it cannot reach for a row: it has no query, no client, no fetch.
  assert.doesNotMatch(SPEC, /supabase|socialFrom|useQuery|fetch\(/, 'the spec grew a data source');
});

test('the overflow chip is a count of people and never a list of them', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({
    userId: `u${i}`,
    state: 'joined',
    role: 'member',
    displayName: `Person ${i}`,
    username: `p${i}`,
  }));
  const out = rosterChips(many, { isHost: false, me: null });
  assert.equal(out.chips.length, ROSTER_CHIP_LIMIT);
  assert.equal(out.overflow?.count, 7 - ROSTER_CHIP_LIMIT);
  assert.equal(out.overflow?.label, '3 more friends');
  // No name in it, at any count.
  for (const person of many) {
    assert.ok(!out.overflow!.label.includes(person.displayName), 'the overflow chip named somebody');
  }
  assert.equal(moreFriendsLine(1), '1 more friend', 'the singular is not a plural with an s');
  assert.equal(moreFriendsLine(0), '0 more friends');
});

test('an invitee’s poster carries no venue, no address and no thread', () => {
  // §7.1, at the two places the poster could leak it.
  assert.equal(posterLine({ venueName: 'Contramar', dateLine: 'Sat 12 Sep', coarse: true }), 'Sat 12 Sep');
  assert.deepEqual(posterLinesAx({ venueName: 'Contramar', dateLine: 'Sat 12 Sep', coarse: true }), [
    'Sat 12 Sep',
  ]);
  // The route withholds rather than the line inventing a missing-state.
  assert.match(ROUTE, /venueName: isMember \? event\.venueName : null/);
  assert.match(ROUTE, /commentCount: isMember \? openComments : null/);
  // The board read never fires for a non-member — the gate is membership, not
  // the route.
  assert.match(ROUTE, /const boardEventId = isMember \? \(id \?\? null\) : null/);
});

test('the route does not widen the member query it reads from', () => {
  // `useEventMembers` selects three columns and filters to joined|invited. The
  // page must consume that and nothing else — no second query, no extra column.
  assert.doesNotMatch(ROUTE, /socialFrom\(|\.select\(|useEventInviteRoster/, 'the page fetched members itself');
  assert.match(ROUTE, /useEventMembers\(id \?\? ''\)/);
});

// ---------------------------------------------------------------------------
// What survived the poster losing its rows
// ---------------------------------------------------------------------------

test('the report affordance lives in the band’s menu, as the artifact places it', () => {
  assert.match(ROUTE, /reportFlow\.open\(\{/, 'the event cannot be reported');
  assert.match(ROUTE, /subject: 'event'/, 'the report has no subject');
  assert.match(ROUTE, /<ReportFlowSheets flow=\{reportFlow\} \/>/, 'the RP-01…RP-04 sheets are unmounted');
});

test('the destructive and organiser affordances are still reachable', () => {
  // The host cancels, everybody else leaves, and the host can still remove a
  // guest — the row that used to carry each of them is gone; none of them is.
  for (const affordance of [
    'Cancel this occasion',
    'Leave this occasion',
    'Remove someone',
    'Invite more people',
    'Add a date',
    'Add a place',
  ]) {
    assert.ok(ROUTE.includes(affordance), `${affordance} left the page`);
  }
  // And each destructive one still goes through its confirmation.
  assert.match(ROUTE, /HOST_CANCELLATION_FACTS/, 'the host’s confirmation lost its facts');
  assert.match(ROUTE, /CANCELLATION_FACTS/, 'the cancellation band is gone');
  assert.match(ROUTE, /destructiveButtonIndex/, 'the menu does not mark its destructive row');
});

test('the menu no longer offers a second door to the same conversation', () => {
  /**
   * The founder's items 7 and 8, asserted as an ABSENCE — which is the only
   * way to assert them, because the failure they prevent is a row quietly
   * coming back.
   *
   * `Table talk` opened the very thread the foot's own door opens, so the page
   * carried two differently-named controls for one destination. `Every option`
   * opened a separate screen for the looks and their votes, which is now the
   * top of that same thread — "Table Talk & Outfit Voting", one sheet where
   * members chat AND vote.
   *
   * The board ROUTE is deliberately not asserted gone: `/event/[id]/outfits`
   * still exists, the composer still lands on it after a post, and a deep link
   * still reaches it. What went is this page offering it.
   */
  assert.doesNotMatch(ROUTE, /label: 'Table talk'/, 'the menu offers Table talk again');
  assert.doesNotMatch(ROUTE, /label: 'Every option'/, 'the menu offers the board again');
  assert.doesNotMatch(ROUTE, /rows\.push\([\s\S]{0,80}\/outfits/, 'a menu row points at the board');
});

// ---------------------------------------------------------------------------
// What the poster will and will not say
// ---------------------------------------------------------------------------

test('the copy is the artifact’s, to the character', () => {
  assert.equal(EVENT_DETAIL_COPY.yourLook, 'Your look');
  assert.equal(EVENT_DETAIL_COPY.change, 'Change');
  assert.equal(EVENT_DETAIL_COPY.going, 'Going');
  assert.equal(EVENT_DETAIL_COPY.decline, 'Can’t make it');
  assert.equal(EVENT_DETAIL_COPY.planLook, 'Plan a look');
  assert.equal(EVENT_DETAIL_COPY.emptyLookTitle, 'No look planned yet');
  assert.equal(EVENT_DETAIL_COPY.noReplies, 'Nobody else has replied');
  // RENAMED BY THE FOUNDER, and the rename is the merge: one sheet where
  // members chat and vote, so the label names both halves.
  assert.equal(EVENT_DETAIL_COPY.comments, 'Table Talk & Outfit Voting');
  assert.equal(EVENT_DETAIL_COPY.rsvpErrorTitle, 'Your reply didn’t send');
  assert.equal(EVENT_DETAIL_COPY.rsvpErrorBody, 'Nobody has been notified yet.');
  assert.equal(EVENT_DETAIL_COPY.tryAgain, 'Try again');
  assert.equal(EVENT_DETAIL_COPY.venueTbc, 'Venue to be confirmed');

  // The typographic apostrophe, which is the app's convention and the
  // artifact's. A straight quote is a different string from the accepted one.
  for (const line of [EVENT_DETAIL_COPY.decline, EVENT_DETAIL_COPY.rsvpErrorTitle]) {
    assert.doesNotMatch(line, /'/, `a straight apostrophe in "${line}"`);
  }
});

test('the empty line says the true thing, and says nothing when there is none', () => {
  // The frame's sentence is what is true when the HOST has not named a venue —
  // not a general-purpose empty state, and not something to print over an
  // occasion with a confirmed table.
  assert.equal(
    emptyLookBody({ isMember: true, hostName: 'Theo', venueKnown: false }),
    'Theo hasn’t said where. Plan something anyway.',
  );
  assert.equal(emptyLookBody({ isMember: true, hostName: 'Theo', venueKnown: true }), null);
  assert.match(emptyLookBody({ isMember: true, hostName: null, venueKnown: false }) ?? '', /^Nobody/);
  // An invitee gets the withheld-data explanation LP-04 wrote, verbatim.
  assert.equal(
    emptyLookBody({ isMember: false, hostName: 'Theo', venueKnown: false }),
    'Joining puts it on your Plan — and shows you where and when.',
  );
});

test('the quiet line collapses the logistics, and is absent rather than blank', () => {
  assert.equal(
    logisticsLine({ venueAddress: 'Calle Durango 200', note: 'table under Priya' }),
    'Calle Durango 200 · table under Priya',
  );
  assert.equal(logisticsLine({ partySize: 6 }), 'table for 6');
  // Nothing to say means no bead: a dot with no sentence after it reads as a
  // loading state that never finishes.
  assert.equal(logisticsLine({}), null);
  assert.equal(logisticsLine({ venueAddress: '', note: '   ' }), null);
  // The order is the artifact's — where, then what kind of evening, then how
  // many, then what to wear, then the host's note, then the weather.
  assert.equal(
    logisticsLine({
      venueAddress: 'Calle Durango 200',
      occasion: 'dinner',
      partySize: 6,
      dressCode: 'smart',
      note: 'bring the gift',
      weather: 'Feels 70°',
    }),
    'Calle Durango 200 · dinner · table for 6 · smart · bring the gift · Feels 70°',
  );
});

test('the poster promises no count of anything it cannot count', () => {
  // The door down prints the comment count and nothing else claims a number.
  // A headcount stays coarse: the chips are people, the overflow is a total,
  // and neither is a claim about who answered what.
  assert.doesNotMatch(CODE, /\b\d+ (going|coming|attending)\b/i);
  assert.doesNotMatch(SPEC, /\b\d+ (going|coming|attending)\b/i);
});

// ---------------------------------------------------------------------------
// The chooser — the founder's items 2, 3 and 9
// ---------------------------------------------------------------------------
//
// `Your look` stopped being a verdict and became a question. The poster used
// to draw ONE dominant plate — whatever the reader had already pinned, or an
// outline if she had not — which is a record of a decision on the page where
// the decision is supposed to happen. It is Today's grammar now: up to three
// options, paged, dots beneath.
//
// The rule these tests hold is the one the founder's brief states twice and
// the constitution states everywhere: NO NEW BACKEND. The options come from
// machinery that already exists — the board's own posts, and the same
// on-device beam search Today runs — and putting one on the board goes through
// the same mutation the three-step composer's last step calls.

test('the chooser reuses the engine and the board, and invents neither', () => {
  // The generator is Today's, given this occasion as its context rather than
  // this morning's calendar.
  assert.match(ROUTE, /useOutfits\(\{/, 'the page grew its own generator');
  assert.match(ROUTE, /useStyleContext\(\{[\s\S]*?targetOccasion: occasionTarget/);
  assert.match(ROUTE, /targetFormality: formalityTarget/);
  // The publish is the composer's own mutation — one path from "these
  // garments" to a row in `event_outfit_posts`.
  assert.match(ROUTE, /useComposeAndPostLook\(\)/);
  // And nothing here reaches for a table itself.
  assert.doesNotMatch(ROUTE, /\.from\(|\.insert\(|\.select\(/, 'the page wrote its own query');
});

test('choosing a look publishes it without claiming it was worn', () => {
  // `saveToLately: false` is the one argument that differs from the composer's
  // default and it is the honest one: deciding what to wear on Saturday is not
  // a claim to have worn it, and a wear would land in the diary and move the
  // taste profile on the strength of a tap on a suggestion.
  const publish = ROUTE.slice(ROUTE.indexOf('const publishSuggestion'), ROUTE.indexOf('const sendRsvp'));
  assert.match(publish, /saveToLately: false/);
  assert.match(publish, /itemIds: outfit\.candidate\.items\.map/);
});

test('a suggestion carries no vote count, and the board’s looks carry theirs', () => {
  // "Zero is quiet" is the board's rule and this is not even a zero: a look
  // nobody else can see cannot have been picked, so the absence is null rather
  // than 0 and the card prints nothing at all.
  assert.match(ROUTE, /posted: false,[\s\S]{0,400}?votes: null/);
  assert.match(ROUTE, /posted: true,[\s\S]{0,200}?votes: look\.votes/);
  // The words are the board's own, not a second vocabulary for one number.
  assert.match(CODE, /'1 vote'/);
  assert.doesNotMatch(CODE, /'0 votes'|`0 votes`/, 'a zero reached the card');
});

test('the options are capped at three, posted first', () => {
  assert.equal(LOOK_OPTION_LIMIT, 3);
  assert.equal(suggestionCount(0), 3, 'a member with nothing on the board gets three');
  assert.equal(suggestionCount(2), 1);
  assert.equal(suggestionCount(3), 0, 'a full board still asks the engine for more');
  assert.equal(suggestionCount(9), 0, 'a negative number of suggestions');
  // Order is not a ranking: a decision somebody has made and other people are
  // voting on comes before a machine's proposal.
  assert.match(ROUTE, /\[\.\.\.postedOptions, \.\.\.suggestedOptions\]\.slice\(0, LOOK_OPTION_LIMIT\)/);
});

test('the option position is spoken, not left to the dots', () => {
  assert.equal(optionPosition(0, 3), 'Option 1 of 3');
  assert.equal(optionPosition(2, 3), 'Option 3 of 3');
  // One-based, because it is read aloud.
  assert.doesNotMatch(optionPosition(0, 1), /Option 0/);
  // And the dots themselves are decoration: a reader who cannot see them has
  // already been told where they are.
  assert.match(CODE, /accessibilityElementsHidden[\s\S]{0,120}importantForAccessibility="no-hide-descendants"/);
});

test('the occasion, not the morning, is what the engine is asked about', () => {
  // Lowercase single words, because `targetOccasion` is matched against each
  // garment's own `occasions` tags rather than against a label a designer
  // wrote — the same reason Today's `OCCASION_OPTIONS` carry them.
  assert.equal(occasionTarget('Birthday dinner'), 'dinner');
  assert.equal(occasionTarget('Wedding'), 'formal');
  assert.equal(occasionTarget('Team offsite'), 'team offsite');
  // A host who named nothing gets a null target, which is the occasion rule's
  // neutral — never a guess, and never a penalty.
  assert.equal(occasionTarget(null), null);
  assert.equal(occasionTarget('   '), null);

  // Formality is the 0..1 the scorer already reads, not a new axis.
  assert.equal(formalityTarget('Black tie'), 0.95);
  assert.equal(formalityTarget('casual'), 0.35);
  assert.equal(formalityTarget(null), null);
  // An unrecognised dress code leaves the engine's own reading in charge
  // rather than overriding it with a number nobody asked for.
  assert.equal(formalityTarget('come as a pirate'), null);
  for (const code of ['Black tie', 'cocktail', 'business', 'casual']) {
    const score = formalityTarget(code)!;
    assert.ok(score > 0 && score <= 1, `${code} is off the scale at ${score}`);
  }
});

test('the share goes out through the machinery that already exists', () => {
  // Item 9. Two paths because there are two kinds of thing to send, and each
  // takes the one that fits it:
  //
  //  · a SUGGESTION is a `StyledOutfit`, so it takes the app's own composer —
  //    `PlateCard` on its fixed 360×640 canvas, captured by `sharePlate`, the
  //    same pair Today and the packing memo use;
  //  · a POSTED look has garments but no `OutfitCandidate` behind it (the
  //    board's rows carry no feature vector), so it takes the board's own
  //    share: the sentence plus the sharer's invite link.
  //
  // Fabricating a candidate for the second would mean inventing scores the
  // engine never computed, which is a lie in the one place the card is meant
  // to be evidence.
  assert.match(ROUTE, /<PlateCard/);
  assert.match(ROUTE, /sharePlate\(shareView\)/);
  assert.match(ROUTE, /lookShareMessage\(\{/);
  // The link is the SHARER's, never the occasion's — an occasion is not
  // linkable and is not becoming linkable.
  assert.match(ROUTE, /url: myLink \?\? undefined/);
  assert.doesNotMatch(ROUTE, /url: `.*event/, 'the occasion became a link');
});

// ---------------------------------------------------------------------------
// The chips — the founder's item 5
// ---------------------------------------------------------------------------

test('a chip prints a first name and nothing after it', () => {
  const chips = rosterChips(
    [
      {
        userId: 'n',
        state: 'joined',
        role: 'member',
        displayName: 'Nelson Saenz',
        username: 'nelson',
        avatarUrl: 'https://example.test/n.jpg',
      },
    ],
    { isHost: false, me: null },
  );
  assert.equal(chips.chips[0]!.firstName, 'Nelson');
  // The full name survives on the chip for VoiceOver and for the host's own
  // removal sheet — what changed is what is DRAWN.
  assert.equal(chips.chips[0]!.name, 'Nelson Saenz');
  assert.match(CODE, /name=\{chip\.host \? `\$\{chip\.firstName\} \(host\)` : chip\.firstName\}/);

  // A surname is dropped because the page asks for less, never because it was
  // cut off — there is no clamp doing this work.
  assert.equal(firstNameOf('Marisol Delgado-Whitcomb'), 'Marisol');
  assert.equal(firstNameOf('Björk'), 'Björk', 'a mononym lost itself');
  assert.equal(firstNameOf('You'), 'You');
  assert.equal(firstNameOf('  Priya  Raghunathan '), 'Priya');
  assert.equal(firstNameOf(''), '', 'an empty name threw or invented one');
});

test('the chip’s disc takes a photograph when there is one, and letters when there is not', () => {
  const withPhoto = rosterChips(
    [{ userId: 'a', state: 'joined', role: 'member', displayName: 'Ana', username: 'ana', avatarUrl: 'u' }],
    { isHost: false, me: null },
  );
  assert.equal(withPhoto.chips[0]!.avatarUrl, 'u');
  // Absent by design rather than by failure — `social_profiles` excludes self,
  // and a caller that passes no avatar at all still type-checks and still
  // draws the initials.
  const without = rosterChips(
    [{ userId: 'b', state: 'joined', role: 'member', displayName: 'Ben', username: 'ben' }],
    { isHost: false, me: null },
  );
  assert.equal(without.chips[0]!.avatarUrl, null);

  // The disc is the SAME disc either way — one diameter, one circle, one place
  // in the row — so a chip with a face and a chip with letters sit on one
  // baseline. The image is drawn over the initials rather than instead of
  // them, so a URL that fails to decode leaves letters showing.
  assert.match(CODE, /avatarUrl \? \([\s\S]{0,300}position: 'absolute'/);
  assert.ok(CHIP_AVATAR < 44, 'the disc became the target');
});
