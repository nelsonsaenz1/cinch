/**
 * The nine states of the private-groups flow, and every transition between
 * them.
 *
 * Six of the nine are waiting, emptiness or refusal, which is where a unit like
 * this is actually judged. The two easiest to get wrong are the two that look
 * identical from the data:
 *
 *   · **`no_groups` versus `loading`.** Both arrive as a page with nothing on
 *     it. One of them carries a "Create a group" button, and drawn over a
 *     pending read it invites somebody to create a second copy of the group
 *     they already have.
 *   · **`alone` versus `no_groups`.** Both arrive as a page with no other
 *     people on it. One means "you have nothing"; the other means "you have a
 *     group and it is waiting for somebody". Ship them swapped and the person
 *     who just successfully created a group is told they have none.
 *
 * The resolver is pure — no React, no react-native, no supabase — so these
 * exercise the real function rather than describing it.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CIRCLE_MAX_MEMBERS } from '../src/features/circles/types.ts';
import {
  CIRCLE_STATES,
  canInvite,
  isEmpty,
  resolveCircleState,
  seatsFree,
  showsRoster,
  stateAfterRecovery,
  type CircleStateInput,
  type CircleStateKind,
} from '../src/features/circles/states.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** A reader with groups and nothing waiting. */
const LIST: CircleStateInput = { failed: false, groupCount: 3, invitationCount: 0 };

const focus = (over: Partial<NonNullable<CircleStateInput['group']>> = {}) => ({
  memberCount: 4,
  pendingCount: 0,
  isOwner: true,
  ...over,
});

// ---------------------------------------------------------------------------
// 1 · The nine, each reachable
// ---------------------------------------------------------------------------

test('the map names exactly nine states', () => {
  assert.deepEqual(
    [...CIRCLE_STATES],
    [
      'loading',
      'offline',
      'no_groups',
      'invited',
      'groups',
      'alone',
      'owned',
      'full',
      'joined',
    ],
  );
});

test('each of the nine is reachable from some input', () => {
  const reached = new Set<CircleStateKind>([
    resolveCircleState({ ...LIST, loading: true }).kind,
    resolveCircleState({ ...LIST, failed: true }).kind,
    resolveCircleState({ failed: false, groupCount: 0, invitationCount: 0 }).kind,
    resolveCircleState({ failed: false, groupCount: 0, invitationCount: 1 }).kind,
    resolveCircleState(LIST).kind,
    resolveCircleState({ ...LIST, group: focus({ memberCount: 1 }) }).kind,
    resolveCircleState({ ...LIST, group: focus() }).kind,
    resolveCircleState({ ...LIST, group: focus({ memberCount: 12 }) }).kind,
    resolveCircleState({ ...LIST, group: focus({ isOwner: false }) }).kind,
  ]);
  assert.deepEqual([...reached].sort(), [...CIRCLE_STATES].sort());
});

// ---------------------------------------------------------------------------
// 2 · The liveness rule — one member is legal
// ---------------------------------------------------------------------------

test('a group with only its owner in it is `alone`, not empty and not an error', () => {
  // `handle_new_circle` inserts the owner as `joined` in the same transaction
  // that creates the group, and the schema enforces no floor of two — a
  // minimum would make creation impossible. So this is the FIRST state of
  // every group, not a degenerate one.
  const state = resolveCircleState({
    failed: false,
    groupCount: 1,
    invitationCount: 0,
    group: focus({ memberCount: 1 }),
  });
  assert.equal(state.kind, 'alone');
  assert.equal(isEmpty(state), false);
  assert.equal(canInvite(state), true);
  assert.equal(showsRoster(state), true);
});

test('an outstanding invitation is enough to leave the alone state', () => {
  // The owner has already done the thing `alone` asks for. Asking again would
  // be the app forgetting.
  const state = resolveCircleState({
    ...LIST,
    group: focus({ memberCount: 1, pendingCount: 1 }),
  });
  assert.equal(state.kind, 'owned');
});

test('only `no_groups` is an emptiness; nothing else claims one', () => {
  const inputs: CircleStateInput[] = [
    { ...LIST, loading: true },
    { ...LIST, failed: true },
    { failed: false, groupCount: 0, invitationCount: 1 },
    LIST,
    { ...LIST, group: focus({ memberCount: 1 }) },
    { ...LIST, group: focus() },
    { ...LIST, group: focus({ memberCount: 12 }) },
    { ...LIST, group: focus({ isOwner: false }) },
  ];
  for (const input of inputs) {
    assert.equal(isEmpty(resolveCircleState(input)), false);
  }
  assert.equal(
    isEmpty(resolveCircleState({ failed: false, groupCount: 0, invitationCount: 0 })),
    true,
  );
});

// ---------------------------------------------------------------------------
// 3 · The roster is hidden until you accept
// ---------------------------------------------------------------------------

test('an invitation never shows a roster, however it is reached', () => {
  // PC-04: "You will see who else is in it after you accept. Nothing of yours
  // is shared until then." The schema keeps it — the membership select policy
  // is "your own row, always; everyone else's only if you are joined" — and
  // this is where the client stops asking for what it would be refused.
  const opened = resolveCircleState({
    failed: false,
    groupCount: 0,
    invitationCount: 1,
    group: focus({ awaitingAnswer: true, isOwner: false }),
  });
  assert.equal(opened.kind, 'invited');
  assert.equal(showsRoster(opened), false);

  const listOnly = resolveCircleState({ failed: false, groupCount: 0, invitationCount: 2 });
  assert.equal(listOnly.kind, 'invited');
  assert.equal(showsRoster(listOnly), false);
});

test('awaiting an answer outranks owning, so no invitation can leak a roster', () => {
  // An incoherent input — you cannot be invited to a group you own — resolves
  // to the CLOSED side rather than the open one. The failure mode of getting
  // this precedence wrong is a roster shown to somebody outside it.
  const state = resolveCircleState({
    ...LIST,
    group: focus({ awaitingAnswer: true, isOwner: true }),
  });
  assert.equal(state.kind, 'invited');
  assert.equal(showsRoster(state), false);
});

// ---------------------------------------------------------------------------
// 4 · The cap, and who ever meets it
// ---------------------------------------------------------------------------

test('the cap counts invitations together with members', () => {
  assert.equal(CIRCLE_MAX_MEMBERS, 12);
  assert.equal(seatsFree(4, 0), 8);
  assert.equal(seatsFree(4, 8), 0);
  assert.equal(seatsFree(11, 1), 0);
  // Never negative: a group that has somehow overrun reports zero free rather
  // than a minus sign in a sentence.
  assert.equal(seatsFree(20, 5), 0);

  const full = resolveCircleState({ ...LIST, group: focus({ memberCount: 4, pendingCount: 8 }) });
  assert.equal(full.kind, 'full');
  assert.equal(canInvite(full), false);
});

test('the eleventh invitation is the last that fits, because the owner holds a seat', () => {
  const eleven = resolveCircleState({ ...LIST, group: focus({ memberCount: 1, pendingCount: 10 }) });
  assert.equal(eleven.kind, 'owned');
  assert.equal(eleven.kind === 'owned' ? eleven.seatsFree : -1, 1);

  const twelve = resolveCircleState({ ...LIST, group: focus({ memberCount: 1, pendingCount: 11 }) });
  assert.equal(twelve.kind, 'full');
});

test('a member in a full group is in an ordinary group, never shown a wall', () => {
  // The cap is only ever a fact about INVITING, and only the owner invites —
  // the INSERT policy has one path and no self-join door. Showing a member
  // PC-10 would be drawing a door into a wall.
  const state = resolveCircleState({
    ...LIST,
    group: focus({ isOwner: false, memberCount: 12 }),
  });
  assert.equal(state.kind, 'joined');
  assert.equal(canInvite(state), false);
  assert.equal(showsRoster(state), true);
});

test('only an owner with a seat may be offered the invite affordance', () => {
  const cases: [CircleStateInput, boolean][] = [
    [{ ...LIST, group: focus({ memberCount: 1 }) }, true],
    [{ ...LIST, group: focus() }, true],
    [{ ...LIST, group: focus({ memberCount: 12 }) }, false],
    [{ ...LIST, group: focus({ isOwner: false }) }, false],
    [{ ...LIST, group: focus({ awaitingAnswer: true }) }, false],
    [LIST, false],
    [{ ...LIST, loading: true }, false],
    [{ ...LIST, failed: true }, false],
  ];
  for (const [input, expected] of cases) {
    assert.equal(canInvite(resolveCircleState(input)), expected, JSON.stringify(input));
  }
});

// ---------------------------------------------------------------------------
// 5 · Every transition the atlas draws
// ---------------------------------------------------------------------------

test('PC-01 → PC-04 when the first invitation arrives', () => {
  const before = { failed: false, groupCount: 0, invitationCount: 0 };
  assert.equal(resolveCircleState(before).kind, 'no_groups');
  // "No groups yet" over an unanswered invitation would be true and useless:
  // the reader's next act is to answer it, not to create something.
  assert.equal(resolveCircleState({ ...before, invitationCount: 1 }).kind, 'invited');
});

test('PC-04 → PC-06 on accepting, and the roster opens at exactly that moment', () => {
  const invited = resolveCircleState({
    failed: false,
    groupCount: 0,
    invitationCount: 1,
    group: focus({ awaitingAnswer: true, isOwner: false, memberCount: 4 }),
  });
  assert.equal(showsRoster(invited), false);

  const joined = resolveCircleState({
    failed: false,
    groupCount: 1,
    invitationCount: 0,
    group: focus({ isOwner: false, memberCount: 5 }),
  });
  assert.equal(joined.kind, 'joined');
  assert.equal(showsRoster(joined), true);
});

test('PC-01 → alone on creating, and alone → owned on the first invitation', () => {
  assert.equal(
    resolveCircleState({ failed: false, groupCount: 0, invitationCount: 0 }).kind,
    'no_groups',
  );
  const made = { failed: false, groupCount: 1, invitationCount: 0, group: focus({ memberCount: 1 }) };
  assert.equal(resolveCircleState(made).kind, 'alone');
  assert.equal(
    resolveCircleState({ ...made, group: focus({ memberCount: 1, pendingCount: 1 }) }).kind,
    'owned',
  );
});

test('owned ⇄ full by the twelfth seat, in both directions', () => {
  const eleven = { ...LIST, group: focus({ memberCount: 11, pendingCount: 0 }) };
  assert.equal(resolveCircleState(eleven).kind, 'owned');
  assert.equal(
    resolveCircleState({ ...LIST, group: focus({ memberCount: 12, pendingCount: 0 }) }).kind,
    'full',
  );
  // And back. A `removed`, `left` or `declined` row does not consume a seat,
  // which is what makes a group recoverable after a mistake without deleting
  // any history.
  assert.equal(resolveCircleState(eleven).kind, 'owned');
});

test('owned → alone when the group empties back down to its owner', () => {
  // Everybody leaves. The group is still real and still theirs, so it returns
  // to the liveness state rather than to an empty one.
  assert.equal(
    resolveCircleState({ ...LIST, group: focus({ memberCount: 1, pendingCount: 0 }) }).kind,
    'alone',
  );
});

test('groups → no_groups when the last one goes', () => {
  assert.equal(resolveCircleState(LIST).kind, 'groups');
  assert.equal(
    resolveCircleState({ failed: false, groupCount: 0, invitationCount: 0 }).kind,
    'no_groups',
  );
});

test('any state → offline on failure, from every one of the other eight', () => {
  const inputs: CircleStateInput[] = [
    { failed: false, groupCount: 0, invitationCount: 0 },
    { failed: false, groupCount: 0, invitationCount: 1 },
    LIST,
    { ...LIST, group: focus({ memberCount: 1 }) },
    { ...LIST, group: focus() },
    { ...LIST, group: focus({ memberCount: 12 }) },
    { ...LIST, group: focus({ isOwner: false }) },
    { ...LIST, group: focus({ awaitingAnswer: true }) },
  ];
  for (const input of inputs) {
    assert.equal(resolveCircleState({ ...input, failed: true }).kind, 'offline');
  }
});

test('and back from offline to exactly the state it left', () => {
  const inputs: CircleStateInput[] = [
    { failed: false, groupCount: 0, invitationCount: 0 },
    { failed: false, groupCount: 0, invitationCount: 1 },
    LIST,
    { ...LIST, group: focus({ memberCount: 1 }) },
    { ...LIST, group: focus() },
    { ...LIST, group: focus({ memberCount: 12 }) },
    { ...LIST, group: focus({ isOwner: false }) },
    { ...LIST, group: focus({ awaitingAnswer: true }) },
  ];
  for (const input of inputs) {
    const before = resolveCircleState(input);
    assert.equal(resolveCircleState({ ...input, failed: true }).kind, 'offline');
    assert.deepEqual(stateAfterRecovery({ ...input, failed: true }), before);
  }
});

// ---------------------------------------------------------------------------
// 6 · Inputs that have not answered yet
// ---------------------------------------------------------------------------

test('a pending read never claims an empty list, and outranks failure', () => {
  // `no_groups` carries a "Create a group" button. Drawn over a pending read it
  // invites somebody to create a second copy of the group they already have.
  assert.equal(
    resolveCircleState({ loading: true, failed: false, groupCount: 0, invitationCount: 0 }).kind,
    'loading',
  );
  assert.equal(
    resolveCircleState({ loading: true, failed: true, groupCount: 0, invitationCount: 0 }).kind,
    'loading',
  );
});

test('a count that has not arrived never invents a group or loses one', () => {
  const missing = undefined as unknown as number;
  assert.equal(
    resolveCircleState({ failed: false, groupCount: missing, invitationCount: missing }).kind,
    'no_groups',
  );
  assert.equal(
    resolveCircleState({ failed: true, groupCount: missing, invitationCount: missing }).kind,
    'offline',
  );
  assert.equal(
    resolveCircleState({ failed: false, groupCount: Number.NaN, invitationCount: 2 }).kind,
    'invited',
  );
  assert.equal(
    resolveCircleState({ failed: false, groupCount: -3, invitationCount: 0 }).kind,
    'no_groups',
  );
  // An opened invitation with no list count behind it still reports at least
  // one — the reader is looking at it.
  const opened = resolveCircleState({
    failed: false,
    groupCount: 0,
    invitationCount: missing,
    group: focus({ awaitingAnswer: true }),
  });
  assert.equal(opened.kind === 'invited' ? opened.invitationCount : 0, 1);
});

// ---------------------------------------------------------------------------
// 7 · The module is pure, and stays that way
// ---------------------------------------------------------------------------

test('the resolver imports nothing that would stop it being callable from a test', () => {
  // The moment this file reaches for react-native, `tsc` is happy and the node
  // runner cannot parse RN's Flow source — the nine states become untestable
  // and every assertion above quietly stops running.
  for (const path of [
    'src/features/circles/states.ts',
    'src/features/circles/copy.ts',
    // At integration this is Worker B's real `types.ts` rather than the local
    // stand-in it replaced. The guard matters MORE now, not less: `states.ts`
    // and `copy.ts` import it, so a runtime dependency landing in the shared
    // vocabulary module would take the node runner down with it.
    'src/features/circles/types.ts',
  ]) {
    const src = body(path);
    assert.doesNotMatch(src, /from 'react/, path);
    assert.doesNotMatch(src, /from 'react-native/, path);
    assert.doesNotMatch(src, /@supabase|@\/lib\/supabase/, path);
    assert.doesNotMatch(src, /useQuery|useState|useEffect/, path);
  }
});

test('the state screens hold no state of their own', () => {
  // A presentational component that owned a `useState` would give the surface a
  // reason to remount it, and a remounted list starts at the top — which is the
  // other half of "back from offline without losing your place".
  for (const file of ['state-screens.tsx', 'group-row.tsx', 'member-row.tsx', 'picker-row.tsx', 'invitation-card.tsx']) {
    const src = body(`src/components/circles/${file}`);
    assert.doesNotMatch(src, /useState|useReducer/, file);
    assert.doesNotMatch(src, /useQuery|useMutation|supabase/, file);
  }
});

test('the kit is presentational: nothing fetches, mutates or navigates', () => {
  for (const file of [
    'confirm-dialogs.tsx',
    'group-row.tsx',
    'invitation-card.tsx',
    'member-row.tsx',
    'picker-row.tsx',
    'state-screens.tsx',
  ]) {
    const src = body(`src/components/circles/${file}`);
    assert.doesNotMatch(src, /useRouter|expo-router|router\./, file);
    assert.doesNotMatch(src, /@\/lib\/supabase|from '@tanstack/, file);
  }
});

test('the stand-in is gone and the data lane is the one that landed', () => {
  // BEFORE INTEGRATION this test read the other way round: it asserted Worker
  // B's modules were ABSENT and `contract-types.ts` was PRESENT, because this
  // lane compiled alone against a local transcription of B's interface. Both
  // halves of that premise are inverted once the lanes are one tree, so the
  // assertion is inverted with them rather than deleted — the seam it watches
  // is the same seam, and it is worth more closed than open.
  const owned = new Set(readdirSync('src/features/circles'));
  for (const required of [
    'types.ts',
    'queries.ts',
    'mutations.ts',
    'errors.ts',
    'eligibility.ts',
    'analytics.ts',
  ]) {
    assert.ok(owned.has(required), `${required} did not survive integration`);
  }
  // No stand-in, and no re-export shim wearing its name: a placeholder that
  // outlives the placement is a second name for `types.ts`, and two names for
  // one type is how the next person ends up importing the wrong one.
  assert.equal(owned.has('contract-types.ts'), false);
  for (const file of [...owned].filter((f) => f.endsWith('.ts'))) {
    assert.doesNotMatch(
      readFileSync(`src/features/circles/${file}`, 'utf8'),
      /contract-types/,
      `${file} still refers to the stand-in`,
    );
  }
});
