/**
 * Groups and the group room — the composition redesign 27 asked for, and the
 * refusals it was not allowed to spend to get it.
 *
 * ── WHAT THIS FILE IS FOR, GIVEN THAT SIX OTHERS ALREADY GUARD THIS FLOW ────
 *
 * `private-circles-{ax,client,copy,eligibility,reinvite,states}.test.ts` hold
 * the LAW: every sentence by value, every state transition, the 44pt floor, the
 * classification that must never name a block. All six pass unmodified after
 * this redesign, and that is the load-bearing fact about it — the brief was
 * "restyle only", and a copy pin that had to be edited would have been the
 * proof it was not.
 *
 * This file holds what those six deliberately do not: the DRAWING. Six
 * decisions were taken here that the law does not reach, and each of them is a
 * place where a later change could quietly undo the redesign or, worse, undo a
 * privacy promise while looking like a layout tweak:
 *
 *   1. The room is a TABLE, not a list of roster rows.
 *   2. Pending seats reach that table ONLY from an owner.
 *   3. The list row draws a COUNT, never an identity — the frames draw faces
 *      there and this build refuses to, for reasons the source states.
 *   4. The invite control is a footer, and it is ABSENT rather than disabled.
 *   5. The warm ground is never the only carrier of anything.
 *   6. `GroupGoneNotice` still refuses to say what happened.
 *
 * The drawn body is asserted as TEXT, the shape `trips-list-layout.test.ts`
 * set: esbuild cannot parse React Native's Flow source and there is no renderer
 * in this runner, so anything a component DECIDES before it draws is exercised
 * as a pure function instead — which for this flow is `states.ts` and `copy.ts`,
 * both already free of React by their own tests.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALONE,
  GROUP_GONE,
  MANAGE,
  NO_GROUPS,
  OVERVIEW,
  groupRowAccessibilityLabel,
} from '../src/features/circles/copy.ts';
import { canInvite, resolveCircleState, showsRoster } from '../src/features/circles/states.ts';

/** Source with comments stripped — the house helper, so prose is never a claim. */
const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const KIT = 'src/components/circles';
const PARTS = body(`${KIT}/room-parts.tsx`);
const GROUP_ROW = body(`${KIT}/group-row.tsx`);
const MEMBER_ROW = body(`${KIT}/member-row.tsx`);
const PICKER_ROW = body(`${KIT}/picker-row.tsx`);
const STATE_SCREENS = body(`${KIT}/state-screens.tsx`);
const INVITATION_CARD = body(`${KIT}/invitation-card.tsx`);

const LIST = body('src/app/groups/index.tsx');
const ROOM = body('src/app/groups/[circleId]/index.tsx');
const MANAGE_SCREEN = body('src/app/groups/[circleId]/manage.tsx');
const PICKER = body('src/app/groups/[circleId]/invite.tsx');
const CREATE = body('src/app/groups/create.tsx');

// ---------------------------------------------------------------------------
// 1 · The room is a table
// ---------------------------------------------------------------------------

test('the room draws a seat table, and no longer draws the roster as rows', () => {
  // The brief's own words: "the room as a table — member avatars prominent."
  // The shipped screen rendered five friends as five 44pt settings rows inside
  // a white card, which is the grammar the app uses for garments and merchants.
  assert.match(ROOM, /<SeatTable/);
  assert.match(ROOM, /from '@\/components\/circles\/room-parts'/);
  // And the row component it used to reach for is gone from this screen — not
  // merely unrendered, but unimported, so there is no half-migrated second path
  // for a later branch to fall back into.
  assert.doesNotMatch(ROOM, /MemberRow/);
  assert.doesNotMatch(ROOM, /<Card/);
});

test('the table is one grid, so a promised seat is never a second list', () => {
  // `enforce_circle_size` counts `invited` together with `joined`: a seat is off
  // the twelve whether it holds a person or a promise. Two lists would draw a
  // room with more capacity than it has.
  assert.match(PARTS, /export function SeatTable/);
  assert.match(PARTS, /members\.map\(/);
  assert.match(PARTS, /pending\.map\(/);
  // One `Seat`, one geometry, one accessible element per person.
  assert.equal(PARTS.match(/function Seat\(/g)?.length, 1);
});

test('a seat is announced once, as a sentence, and never as three fragments', () => {
  assert.match(PARTS, /accessible\n\s*accessibilityRole="text"/);
  assert.match(PARTS, /accessibilityLabel=\{detail \? `\$\{name\}\. \$\{detail\}` : name\}/);
});

test('nothing in the table is capped, shrunk or measured', () => {
  // The accessibility contract's rule for this flow: at every Dynamic Type
  // setting composition changes and HEIGHT IS ALLOWED. A four-column grid built
  // from measured widths would have a breakpoint somebody has to maintain; a
  // percentage flex basis has none.
  assert.match(PARTS, /flexBasis: SEAT_COLUMN/);
  assert.match(PARTS, /const SEAT_COLUMN = '25%'/);
  assert.doesNotMatch(PARTS, /numberOfLines|useWindowDimensions|onLayout|fontScale/);
});

// ---------------------------------------------------------------------------
// 2 · Only an owner's table has promised seats on it
// ---------------------------------------------------------------------------

test('pending seats are passed only when the reader owns the group', () => {
  // The roster policy hands every row in every state to anybody who is
  // `joined`, so this is a CLIENT decision and it has to be visible as one.
  // Telling a member who has been asked and has not replied would be gossip —
  // and it is the kind of leak that arrives as a refactor, because the data is
  // already in hand.
  assert.match(
    ROOM,
    /pending=\{\s*\(circle\.data\?\.isOwner \?\? false\)\s*\?\s*pending\.map\(/,
  );
  // And the fallback is an empty table of promises, never the unfiltered list.
  assert.match(ROOM, /:\s*\[\]\s*\}/);
});

test('the component itself invents no seat it was not given', () => {
  // `SeatTable` cannot enforce the rule above and does not pretend to. What it
  // guarantees is the weaker, checkable thing: it draws its props and nothing
  // else — no default roster, no padding to the cap, no placeholder seats.
  assert.doesNotMatch(PARTS, /CIRCLE_MAX_MEMBERS|Array\.from\(\{ length: (?!marks)/);
});

// ---------------------------------------------------------------------------
// 3 · The list draws a count, never an identity
// ---------------------------------------------------------------------------

test('the list row carries no roster, and could not draw one if it wanted to', () => {
  // THE ONE PLACE THIS BUILD DEVIATES FROM THE FRAMES, and the assertion that
  // keeps the deviation deliberate. Every populated list frame draws real
  // member faces on the row. `useCircles` returns a name, an owner and a scalar
  // count from an RPC that is deliberately not a view — precisely because a
  // view is joinable back to the membership table and names people.
  assert.doesNotMatch(GROUP_ROW, /Avatar|displayName|SeatTable/);
  assert.match(GROUP_ROW, /<SeatMarks memberCount=\{memberCount\}/);
});

test('the marks are decorative, derived from the count, and bounded', () => {
  assert.match(PARTS, /export function SeatMarks/);
  assert.match(PARTS, /accessibilityElementsHidden/);
  assert.match(PARTS, /importantForAccessibility="no-hide-descendants"/);
  // Hidden because the row's own label already speaks the count — and that
  // label is pinned by value elsewhere, names nobody, and is the reason faces
  // here would be four facts to the eye and three to VoiceOver.
  assert.equal(
    groupRowAccessibilityLabel({ name: 'Sunday tennis', memberCount: 4, isOwner: true }),
    'Sunday tennis. 4 members. Private. You own it.',
  );
  assert.doesNotMatch(
    groupRowAccessibilityLabel({ name: 'Sunday tennis', memberCount: 4, isOwner: true }),
    /Priya|Alexandria|and \d+ others/,
  );
  // Five marks maximum: past that it is a bar chart, and the sentence beside it
  // keeps counting.
  assert.match(PARTS, /const MARK_LIMIT = 5/);
  assert.match(PARTS, /Math\.max\(Math\.min\(safe, MARK_LIMIT\), 0\)/);
  // A count that never arrived draws nothing rather than NaN discs.
  assert.match(PARTS, /Number\.isFinite\(memberCount\)/);
});

test('the list is plates with air, not rows in a card', () => {
  assert.doesNotMatch(LIST, /<Card/);
  assert.match(LIST, /style=\{\{ gap: 12 \}\}/);
  assert.match(GROUP_ROW, /rounded-plate bg-tray/);
});

// ---------------------------------------------------------------------------
// 4 · The invite control is a footer, and absence is the refusal
// ---------------------------------------------------------------------------

test('the invite control lives outside the scroller', () => {
  // A twelve-seat table is taller than the viewport. A control at the end of
  // the content is a control an owner has to scroll past their whole group to
  // reach — which the shipped screen could not hit, because it drew four rows
  // where this draws twelve discs.
  const scrollerEnd = ROOM.indexOf('</ScrollView>');
  const control = ROOM.indexOf('canInvite(state)');
  assert.ok(scrollerEnd > 0 && control > scrollerEnd, 'the invite control is inside the scroller');
  assert.match(ROOM, /paddingBottom: Math\.max\(insets\.bottom/);
});

test('at the cap the control is gone, not greyed — and the resolver is what decides', () => {
  const focus = { memberCount: 4, pendingCount: 0, isOwner: true };
  const list = { failed: false, groupCount: 1, invitationCount: 0 };

  assert.equal(canInvite(resolveCircleState({ ...list, group: focus })), true);
  assert.equal(
    canInvite(resolveCircleState({ ...list, group: { ...focus, memberCount: 12 } })),
    false,
  );
  // A member never meets the cap at all: it is a fact about INVITING and only
  // the owner invites, so the resolver answers `joined` before the seat check.
  assert.equal(
    canInvite(resolveCircleState({ ...list, group: { ...focus, isOwner: false } })),
    false,
  );
  // The screen gates on exactly that, and never on a `disabled` prop.
  assert.match(ROOM, /\{canInvite\(state\) && !gone \?/);
  assert.doesNotMatch(ROOM, /disabled=\{.*canInvite/);
});

test('the two invite labels stay two, because they ask for different things', () => {
  assert.notEqual(ALONE.action, OVERVIEW.invite);
  assert.match(ROOM, /state\.kind === 'alone' \? ALONE\.action : OVERVIEW\.invite/);
});

test('the way in to a new group moved to the chrome, where a long list cannot bury it', () => {
  assert.match(LIST, /trailing=\{/);
  assert.match(LIST, /accessibilityLabel=\{NO_GROUPS\.action\}/);
  assert.equal(NO_GROUPS.action, 'Create a group');
  // Once, not twice: the shipped foot link is gone rather than doubled.
  assert.equal(LIST.match(/NO_GROUPS\.action/g)?.length, 2, 'the create control is drawn twice');
});

// ---------------------------------------------------------------------------
// 5 · The warm ground never carries anything on its own
// ---------------------------------------------------------------------------

test('the band is a shell with two tones and no words of its own', () => {
  assert.match(PARTS, /export function WarmBand/);
  assert.match(PARTS, /tone === 'blush' \? 'bg-blush' : 'bg-tray'/);
  // Nothing in the parts module writes a sentence. Every word on this flow
  // comes from the copy module, which is where six other test files hold it.
  const literals = (PARTS.match(/'[^'\n]*'|"[^"\n]*"/g) ?? []).map((l) => l.slice(1, -1));
  for (const literal of literals) {
    if (/^[@./]/.test(literal)) continue;
    assert.doesNotMatch(literal, /[a-z] [a-z]+\./i, `room-parts writes prose: ${literal}`);
  }
});

test('every ground has a word agreeing with it', () => {
  // A pending roster row is blush AND prints its status; a picker row is warm
  // only when it can be chosen AND the unavailable ones print their reason; a
  // pending seat has a well AND a caption. Colour is always the third channel.
  assert.match(MEMBER_ROW, /\$\{PLATE\} bg-blush/);
  assert.match(MEMBER_ROW, /detail=\{invitedLabel\(invitedAt\)\}/);

  assert.match(PICKER_ROW, /unavailable \? '' : 'bg-tray'/);
  assert.match(PICKER_ROW, /\{why\}/);

  assert.match(PARTS, /const detail = waiting \? invitedLabel\(invitedAt\) : ''/);
  assert.match(PARTS, /\{detail\}/);
});

test('the unticked ring appears only where a row can actually be ticked', () => {
  // Beside "No longer a mutual friend" an empty box reads as "not chosen yet",
  // which is the confusion the printed reason exists to end.
  assert.match(PICKER_ROW, /\) : unavailable \? null : \(/);
  assert.match(PICKER_ROW, /borderColor: theme\.ruleStrong/);
});

test('the invitation is a band, and the accent on it is the commitment', () => {
  assert.match(INVITATION_CARD, /<WarmBand>/);
  assert.doesNotMatch(INVITATION_CARD, /<Card/);
  assert.match(INVITATION_CARD, /title=\{INVITATION\.accept\}\s*\n\s*variant="primary"/);
  assert.match(INVITATION_CARD, /title=\{INVITATION\.decline\}\s*\n\s*variant="secondary"/);
});

test('the boundary notices are bands rather than hairlines, and still summaries', () => {
  assert.match(STATE_SCREENS, /<WarmBand tone=\{tone\}>/);
  assert.match(STATE_SCREENS, /accessibilityRole="summary"/);
  // Never an alert: a full group and a gone group are facts about the room, not
  // events that arrived. `ErrorState` owns the alert, and only the failed read
  // uses it.
  assert.doesNotMatch(STATE_SCREENS, /accessibilityRole="alert"/);
  assert.match(STATE_SCREENS, /<ErrorState/);
  assert.doesNotMatch(STATE_SCREENS, /<Rule/);
});

// ---------------------------------------------------------------------------
// 6 · The refusals survived the redesign
// ---------------------------------------------------------------------------

test('the gone screen still refuses to say what happened, or who did it', () => {
  // `useCircle` answers `null` for a deleted group and for a membership that
  // ended, identically and on purpose. A screen that could tell them apart
  // would be disclosing that somebody was removed — the one fact the removal
  // promise spends a whole sentence refusing.
  assert.equal(GROUP_GONE.title, 'This group no longer exists.');
  assert.doesNotMatch(GROUP_GONE.body, /deleted it|removed you|owner|no longer in this group/i);
  assert.match(MANAGE.removalNote, /not who removed them/);
  // And the screen draws that state before every branch that would describe a
  // group which is not there.
  const gone = ROOM.indexOf('<GroupGoneNotice');
  const table = ROOM.indexOf('<SeatTable');
  assert.ok(gone > 0 && gone < table, 'a branch describing the group is drawn before PC-09b');
});

test('the invitation still shows no roster, on either surface that draws it', () => {
  // The strictest promise on the flow, and it is kept by the SHAPE of the data:
  // `InvitationCard` takes a count and no names because that is all
  // `useCircleInvitations` has.
  assert.doesNotMatch(INVITATION_CARD, /members|roster|SeatTable|SeatMarks/);

  const invited = resolveCircleState({
    failed: false,
    groupCount: 0,
    invitationCount: 1,
    group: { memberCount: 4, pendingCount: 0, isOwner: false, awaitingAnswer: true },
  });
  assert.equal(showsRoster(invited), false);
  // And the room screen still gates the table on it.
  assert.match(ROOM, /\{showsRoster\(state\) \?/);
});

test('removing is still absent rather than disabled, and still only the owner’s', () => {
  assert.match(MANAGE_SCREEN, /const removable = isOwner && member\.role !== 'owner'/);
  assert.match(MANAGE_SCREEN, /removable \? \(\) => setRemoveFor\(/);
  assert.match(MANAGE_SCREEN, /: undefined/);
  // The room never offers it at all — removing carries a confirmation and a
  // sentence about what the removed person is told, and both live on manage.
  assert.doesNotMatch(ROOM, /onRemove/);
});

test('the owner is still told they cannot leave, in a sentence and not a dead button', () => {
  // The transition trigger refuses `owner -> left` with a 22023 the client maps
  // to a silent refetch. A Leave an owner could tap would do nothing and
  // explain nothing, which is the worst available outcome.
  assert.match(MANAGE_SCREEN, /isOwner \? setAskDelete\(true\) : setAskLeave\(true\)/);
  assert.match(MANAGE_SCREEN, /\{isOwner \? MANAGE\.ownerCannotLeave : memberPermissionNote/);
  assert.match(MANAGE_SCREEN, /\{isOwner \? null : \(/);
});

// ---------------------------------------------------------------------------
// 7 · The controls the redesign moved still clear the floor
// ---------------------------------------------------------------------------

test('every control this redesign introduced or moved carries the 44pt floor', () => {
  // Three of them are new or relocated: the list's create control moved into
  // the nav bar, the manage exit stopped being a `SettingsRow`, and the room's
  // invite became a footer. A floor held only inside the kit would have three
  // holes in it.
  for (const [name, src] of [
    ['list', LIST],
    ['room', ROOM],
    ['manage', MANAGE_SCREEN],
    ['create', CREATE],
  ] as const) {
    assert.match(src, /minHeight: MIN_TAP_TARGET/, `${name} draws a control under the floor`);
    assert.match(src, /hitSlop=\{8\}/, `${name} has a control with no slop around it`);
  }
  // The picker's own commit is a `Button`, which carries the floor itself.
  assert.match(PICKER, /<Button/);
});

test('the name field became a well rather than an underline, and stayed one field', () => {
  assert.match(CREATE, /borderRadius: 14/);
  assert.match(CREATE, /borderColor: theme\.ruleStrong/);
  assert.match(CREATE, /maxLength=\{60\}/);
  // Sixty, because `circles.name` carries `char_length(name) between 1 and 60`.
  // One field, and no second ungated path for free text.
  assert.equal(CREATE.match(/<TextInput/g)?.length, 1);
});

// ---------------------------------------------------------------------------
// 8 · The frames are drawable without a network
// ---------------------------------------------------------------------------

test('the redesign’s states each have a fixture, and none of them ships', () => {
  const fixtures = readdirSync('src/dev-fixtures').filter((f) => /^dev-gr-\d+\.tsx$/.test(f));
  assert.ok(fixtures.length >= 9, `expected the GR frames, found ${fixtures.length}`);

  const index = readFileSync('src/dev-fixtures/dev-screens.tsx', 'utf8');
  for (const file of fixtures) {
    const route = file.slice(0, -'.tsx'.length);
    assert.ok(index.includes(`'/${route}'`), `${route} is not in the fixture index`);
  }
  // And none of them is where expo-router would register it. `src/app` is
  // scanned in full by `dev-route-exclusion.test.ts`; this is the local half,
  // reported against this lane rather than against a suite-wide sweep.
  const routed = readdirSync('src/app').filter((f) => f.startsWith('dev-'));
  assert.deepEqual(routed, []);
});

test('the fixtures are deterministic: no clock, no network, no query', () => {
  for (const file of readdirSync('src/dev-fixtures').filter((f) => /^dev-gr-\d+\.tsx$/.test(f))) {
    const src = body(`src/dev-fixtures/${file}`);
    assert.doesNotMatch(src, /Date\.now|new Date|Math\.random/, `${file} is not deterministic`);
    assert.doesNotMatch(src, /useQuery|useMutation|supabase|@\/features\/circles\/queries/, file);
  }
});
