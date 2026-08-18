/**
 * Redesign 25 — Storage, as assertions.
 *
 * Two kinds of test, on the same split `voice-walkthrough-layout.test.ts` uses.
 *
 * The FIRST reads `storage-spec.ts`, which is pure data and pure functions, and
 * pins the arithmetic. That arithmetic is the whole screen: two ceilings that
 * mean different things, one of which blocks a restore and one of which
 * famously does not, and a line that must omit what it does not know rather
 * than fill it. Those are cheap and exact to check.
 *
 * The SECOND reads SOURCE TEXT, which is normally the wrong way to test a UI
 * and is the right way for the three properties this screen is under law about:
 *
 *   · No ceiling is ever TYPED — every figure a user reads derives from
 *     `plans.ts`. That is a statement about what the files say, not about a
 *     rendered tree, and the failure it guards against is somebody hard-coding
 *     "10" into a sentence where it happens to be true today.
 *   · No stored DATE is displayed anywhere, because no column records one.
 *   · Nothing on this route deletes a garment.
 *
 * `run-tests.mjs` has no React renderer by design; these are the assertions
 * that survive that, and they are the ones that were otherwise going to be
 * checked by eye once and then never again.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS, type Plan } from '../src/features/billing/plans';
import {
  CONTROL,
  GRID_COLUMNS,
  NOTICE,
  PLATE,
  STORAGE_COPY,
  TYPE,
  capacityLine,
  ceilings,
  primaryLabel,
  restoreBlocked,
  storageNotice,
  storageState,
  type StorageState,
} from '../src/features/closet/storage-spec';

const read = (p: string) => readFileSync(p, 'utf8');

/** Source with comments stripped, so a sentence quoted in a note is not a hit. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SCREEN = 'src/app/storage.tsx';
const PARTS = 'src/components/storage/storage-parts.tsx';
const SPEC = 'src/features/closet/storage-spec.ts';

const ALL_PLANS: Plan[] = ['free', 'standard', 'pro'];

// ---------------------------------------------------------------------------
// The arithmetic
// ---------------------------------------------------------------------------

test('the three-part line reads from plans.ts on every tier', () => {
  for (const plan of ALL_PLANS) {
    const { active: activeLimit, total: totalLimit } = ceilings(plan);

    // The limits are the plan's, not this test's — read the same way the screen
    // reads them, so a plan change moves both sides together and this test
    // cannot pass against a stale hard-coded pair.
    assert.equal(activeLimit, PLANS[plan].items);
    assert.equal(totalLimit, PLANS[plan].storedItems);

    const line = capacityLine({
      stored: 12,
      active: 6,
      activeLimit,
      total: 18,
      totalLimit,
    });

    assert.equal(line, `12 stored · 6 of ${activeLimit} active · 18 of ${totalLimit} total`);
  }
});

test('the artifact’s own three tier lines come out verbatim', () => {
  // The exact strings under the exact frames, so a change to the grammar has to
  // be a deliberate change to these.
  assert.equal(
    capacityLine({ stored: 12, active: 138, activeLimit: 150, total: 150, totalLimit: 450 }),
    '12 stored · 138 of 150 active · 150 of 450 total',
  );
  assert.equal(
    capacityLine({ stored: 14, active: 6, activeLimit: 10, total: 20, totalLimit: 30 }),
    '14 stored · 6 of 10 active · 20 of 30 total',
  );
  assert.equal(
    capacityLine({ stored: 214, active: 486, activeLimit: 1000, total: 700, totalLimit: 3000 }),
    '214 stored · 486 of 1000 active · 700 of 3000 total',
  );
});

test('an unknown clause is dropped, never zeroed, dashed or guessed', () => {
  const line = capacityLine({
    stored: 12,
    active: null,
    activeLimit: null,
    total: null,
    totalLimit: null,
  });

  assert.equal(line, '12 stored');
  // The three ways a ceiling gets invented. None of them may appear.
  assert.ok(!line.includes('0'), 'a dropped clause must not come back as zero');
  assert.ok(!line.includes('—') && !line.includes('-'), 'a dropped clause must not come back as a dash');
  assert.ok(!/of/.test(line), 'a dropped clause must not leave a dangling "of"');
});

test('a half-known capacity still drops the clause it cannot complete', () => {
  // The count arrived and the ceiling did not. One figure is not a clause: "138
  // of" is worse than nothing, and so is "138 of 0".
  const line = capacityLine({
    stored: 12,
    active: 138,
    activeLimit: null,
    total: 150,
    totalLimit: null,
  });
  assert.equal(line, '12 stored');
});

test('zero stored is worded, because a leading 0 reads as a failed count', () => {
  const line = capacityLine({
    stored: 0,
    active: 138,
    activeLimit: 150,
    total: 138,
    totalLimit: 450,
  });
  assert.equal(line, 'Nothing stored · 138 of 150 active · 138 of 450 total');
});

// ---------------------------------------------------------------------------
// The two ceilings, and the asymmetry between them
// ---------------------------------------------------------------------------

test('the six states are told apart by the two ceilings', () => {
  const at = (active: number, total: number): StorageState =>
    storageState({ active, activeLimit: 10, total, totalLimit: 30 });

  assert.equal(at(6, 20), 'room');
  assert.equal(at(10, 25), 'active_full');
  assert.equal(at(6, 30), 'total_full');
  assert.equal(at(10, 30), 'both_full');
  assert.equal(at(34, 46), 'over_active');
  assert.equal(at(8, 46), 'over_total');
});

test('TOTAL-FULL ALONE DOES NOT BLOCK A RESTORE', () => {
  // The screen's whole reason for existing as its own spec. Restoring flips
  // `is_archived` and moves the total by NOTHING, so the trigger has nothing to
  // refuse — and a reader's intuition runs the other way, which is why the copy
  // for this state says so outright.
  assert.equal(restoreBlocked('total_full'), false);
  assert.equal(restoreBlocked('over_total'), false);

  const notice = storageNotice({ state: 'total_full', activeLimit: 10, total: 30, totalLimit: 30 });
  assert.ok(notice);
  assert.match(notice.body, /still works/, 'total-full must state that restoring still works');
});

test('active-full blocks a restore, and so does being over it', () => {
  assert.equal(restoreBlocked('active_full'), true);
  assert.equal(restoreBlocked('both_full'), true);
  assert.equal(restoreBlocked('over_active'), true);
  assert.equal(restoreBlocked('room'), false);
});

test('both-full is offered the storing route, because storing is sufficient', () => {
  const notice = storageNotice({ state: 'both_full', activeLimit: 10, total: 30, totalLimit: 30 });
  assert.ok(notice);
  assert.deepEqual(
    notice.actions.map((a) => a.door),
    ['recover'],
  );
  // Freeing an active place resolves it. Nothing here may imply that deleting
  // or upgrading is REQUIRED, which is the dead end the two-ceiling split was
  // introduced to remove.
  assert.match(notice.body, /that is enough/);
});

test('every notice figure comes from the ceilings it is handed', () => {
  for (const plan of ALL_PLANS) {
    const { active: activeLimit, total: totalLimit } = ceilings(plan);

    const activeFull = storageNotice({
      state: 'active_full',
      activeLimit,
      total: totalLimit - 1,
      totalLimit,
    });
    assert.ok(activeFull);
    assert.ok(
      activeFull.body.includes(String(activeLimit)),
      `active-full copy must quote ${plan}'s own active ceiling`,
    );

    const totalFull = storageNotice({ state: 'total_full', activeLimit, total: totalLimit, totalLimit });
    assert.ok(totalFull);
    assert.ok(
      totalFull.body.includes(String(totalLimit)),
      `total-full copy must quote ${plan}'s own total ceiling`,
    );
  }
});

test('the downgrade states lead with the fact that nothing was deleted', () => {
  const overActive = storageNotice({ state: 'over_active', activeLimit: 10, total: 46, totalLimit: 30 });
  assert.ok(overActive);
  assert.match(overActive.body, /Nothing was deleted/);
  assert.match(overActive.body, /Every piece is still here/);

  const overTotal = storageNotice({ state: 'over_total', activeLimit: 10, total: 46, totalLimit: 30 });
  assert.ok(overTotal);
  assert.match(overTotal.body, /Nothing is deleted/);
  // Names precisely what is blocked — adding — and leaves restoring alone.
  assert.match(overTotal.body, /Adding new pieces/);
});

test('a resting closet says nothing at all', () => {
  assert.equal(storageNotice({ state: 'room', activeLimit: 10, total: 5, totalLimit: 30 }), null);
});

test('no notice offers three ways out', () => {
  const states: StorageState[] = [
    'room',
    'active_full',
    'total_full',
    'both_full',
    'over_active',
    'over_total',
  ];
  for (const state of states) {
    const notice = storageNotice({ state, activeLimit: 10, total: 30, totalLimit: 30 });
    assert.ok((notice?.actions.length ?? 0) <= 2, `${state} offers a menu, not a remedy`);
  }
});

// ---------------------------------------------------------------------------
// The one control
// ---------------------------------------------------------------------------

test('the primary action names its piece once one is picked', () => {
  assert.equal(primaryLabel(null), 'Activate a piece');
  assert.equal(primaryLabel('Wool overcoat'), 'Bring back Wool overcoat');
  // Never a bare "Continue": an action that names its object is one somebody
  // can check before committing it.
  assert.ok(!primaryLabel('Wool overcoat').includes('Continue'));
});

// ---------------------------------------------------------------------------
// Numbers are read, never typed
// ---------------------------------------------------------------------------

test('no ceiling is spelled out as a word in any storage copy', () => {
  // The artifact's frames read "Ten pieces are already active" and "under
  // thirty". A SPELLED number is a TYPED number — it cannot follow a plan
  // change, so the day a ceiling moves the sentence quietly starts lying. This
  // build prints numerals interpolated from `plans.ts` instead, and this test
  // is what stops the frames' wording being restored by a well-meaning hand.
  const spelled =
    /\b(ten|thirty|fifty|one hundred|hundred|forty-six|forty six|a hundred and fifty)\b/i;

  const copy = JSON.stringify(STORAGE_COPY);
  assert.ok(!spelled.test(copy), `a ceiling is spelled out in STORAGE_COPY: ${copy.match(spelled)}`);

  for (const state of ['active_full', 'total_full', 'both_full', 'over_active', 'over_total'] as const) {
    const notice = storageNotice({ state, activeLimit: 10, total: 46, totalLimit: 30 });
    assert.ok(notice);
    const text = `${notice.title} ${notice.body} ${notice.actions.map((a) => a.label).join(' ')}`;
    assert.ok(!spelled.test(text), `${state} spells a number: ${text}`);
  }
});

test('the screen derives its ceilings and types none of them', () => {
  const screen = code(SCREEN);

  // The counts and ceilings arrive through `useCapacity`, which reads plans.ts.
  assert.match(screen, /useCapacity\(\)/);
  assert.match(screen, /capacity\.limit/);
  assert.match(screen, /capacity\.storedLimit/);

  // And none of the three tiers' figures is written into the screen. A literal
  // 10 / 30 / 150 / 450 / 1000 / 3000 here would be a ceiling that survives a
  // plan change, which is exactly the drift `plans.ts` exists to prevent.
  for (const plan of ALL_PLANS) {
    for (const figure of [PLANS[plan].items, PLANS[plan].storedItems]) {
      assert.ok(
        !new RegExp(`\\b${figure}\\b`).test(screen),
        `${SCREEN} types the figure ${figure}, which belongs to plans.ts`,
      );
    }
  }
});

test('the spec reads plans.ts rather than restating it', () => {
  const spec = code(SPEC);
  assert.match(spec, /from '@\/features\/billing\/plans'/);
  assert.match(spec, /PLANS\[plan\]\.items/);
  assert.match(spec, /PLANS\[plan\]\.storedItems/);
});

// ---------------------------------------------------------------------------
// What this screen must never do
// ---------------------------------------------------------------------------

test('nothing on this route deletes a garment', () => {
  // Storage's promise is that nothing is lost. Delete stays a separate,
  // explicit act reachable from a piece's own screen once it is active again —
  // and the artifact's own deviation note says to ship the both-full sheet
  // WITHOUT its delete line rather than add an unconfirmed destructive path.
  for (const path of [SCREEN, PARTS, SPEC]) {
    const source = code(path);
    assert.ok(!/useRemoveItems|deleteItem|\.delete\(/.test(source), `${path} reaches for a delete`);
    assert.ok(
      !/Delete a piece permanently/.test(source),
      `${path} draws the delete line the artifact told this route to omit`,
    );
  }
});

test('no stored date is displayed, because no column records one', () => {
  const joined = [SCREEN, PARTS, SPEC].map(code).join('\n');
  assert.ok(!/stored_at|storedAt/.test(joined), 'there is no stored-at column to read');
  assert.ok(
    !/Stored in |stored since|put away on/i.test(joined),
    'a storing date is being displayed that the database does not record',
  );
});

test('a failed read renders its own state and never the empty one', () => {
  const screen = code(SCREEN);

  // The error branch must come BEFORE the empty branch, so a dropped connection
  // can never fall through to "Nothing put away yet" — telling somebody their
  // stored pieces are gone over a bad network is the one thing this screen must
  // never do.
  const errorAt = screen.indexOf('stored.isError');
  const emptyAt = screen.indexOf('items.length === 0');
  assert.ok(errorAt > -1 && emptyAt > -1);
  assert.ok(errorAt < emptyAt, 'the empty state is reachable by a failed read');

  assert.match(STORAGE_COPY.readError.body, /Nothing is lost/);
  assert.match(STORAGE_COPY.readError.body, /on the server/);
});

test('the restore write keeps its shape and relays the server’s own words', () => {
  const screen = code(SCREEN);

  // Same mutation, same argument shape, as the build before the redesign. The
  // presentation changed; the write did not.
  assert.match(screen, /useRestoreItems\(\)/);
  assert.match(screen, /restore\.mutate\(/);
  assert.match(screen, /\{ ids: \[item\.id\] \}/);

  // The trigger raises `closet_limit_reached` and the message travels up
  // untouched — this client cannot know which ceiling the database was looking
  // at, and a guess printed as a fact is worse than a blunt sentence that is true.
  assert.match(screen, /err instanceof Error \? err\.message/);
});

test('an in-flight restore cannot be fired twice', () => {
  const screen = code(SCREEN);
  // The action locks on the saving flow, and the sheet's cancel is withdrawn
  // while the write is out, so there is no way to leave or re-enter mid-write.
  assert.match(screen, /loading=\{flow\.kind === 'saving'\}/);
  assert.match(screen, /flow\.kind === 'saving' \? null :/);
});

test('the success haptic fires only after the write returns', () => {
  const screen = code(SCREEN);
  const onSuccess = screen.indexOf('onSuccess');
  const successHaptic = screen.indexOf('haptics.success()');
  assert.ok(onSuccess > -1 && successHaptic > onSuccess, 'success is announced before it happened');

  // And the tap that STARTS it gets a selection tick, never a success one.
  assert.match(screen, /haptics\.selection\(\)/);
});

// ---------------------------------------------------------------------------
// Geometry — the artifact's own "Tokens & measurements" line
// ---------------------------------------------------------------------------

test('the grid holds two columns at every type size', () => {
  // The closet runs three (redesign 14); this runs two, and that difference IS
  // the "lower emphasis" instruction. Unlike the closet there is no one-column
  // AX break: the plates yield height instead.
  assert.equal(GRID_COLUMNS, 2);
  assert.ok(PLATE.axHeight < PLATE.height, 'plates must yield height at AX rather than drop a column');
});

test('the measurements are the artifact’s', () => {
  assert.equal(PLATE.width, 157);
  assert.equal(PLATE.height, 188);
  assert.equal(PLATE.shortWidth, 148);
  assert.equal(PLATE.shortHeight, 172);
  assert.equal(PLATE.radius, 12);
  assert.equal(PLATE.gutter, 10);
  assert.equal(PLATE.storedOpacity, 0.72);

  assert.equal(CONTROL.primaryHeight, 56);
  assert.equal(CONTROL.primaryHeightAx, 62);
  assert.equal(CONTROL.secondaryHeight, 52);
  assert.equal(CONTROL.radius, 14);

  assert.equal(NOTICE.radius, 14);
  assert.equal(TYPE.title, 36);
  assert.equal(TYPE.titleAx, 32);
  assert.equal(TYPE.capacity, 12.5);
});

test('every target clears 44pt, and grows rather than shrinking at AX', () => {
  assert.ok(CONTROL.rowHeight >= 44);
  assert.ok(CONTROL.rowHeightAx >= CONTROL.rowHeight);
  assert.ok(CONTROL.primaryHeight >= 44);
  assert.ok(CONTROL.primaryHeightAx >= CONTROL.primaryHeight);
  assert.ok(CONTROL.secondaryHeight >= 44);
});

test('the capacity line is announced once, as context, not per tile', () => {
  const parts = code(PARTS);

  // The header owns the announcement.
  assert.match(parts, /accessibilityLabel=\{line\}/);

  // And the plate's own label carries its name and its stored-ness — never the
  // arithmetic, which a reader would then hear on every one of twelve tiles.
  const plateLabel = parts.match(/accessibilityLabel=\{`\$\{name\}\. Stored piece\.`\}/);
  assert.ok(plateLabel, 'the plate must announce its name and that it is stored');
  assert.ok(!/accessibilityLabel=\{`?\$\{line\}[^`]*`?\}[\s\S]{0,200}StoragePlate/.test(parts));
});

test('the sleeping well never dims the type', () => {
  const parts = code(PARTS);
  // "Asleep, not degraded" is a statement about the PHOTOGRAPH. A stored piece
  // is one you are still meant to be able to identify, so the opacity is on the
  // well's inner view and the name sits outside it at full strength.
  assert.match(parts, /opacity: PLATE\.storedOpacity/);

  const opacityAt = parts.indexOf('opacity: PLATE.storedOpacity');
  // The photograph is INSIDE the dimmed wrapper …
  const imageAt = parts.indexOf('<GarmentImage', opacityAt);
  // … and the name is after the well closes, at full strength.
  const nameAt = parts.indexOf('className="mt-2"', opacityAt);

  assert.ok(opacityAt > -1 && imageAt > opacityAt, 'the photograph must sit inside the dimmed well');
  assert.ok(nameAt > imageAt, 'the name must sit outside the dimmed well');

  // And it must not pick the dimming up by another route.
  const nameBlock = parts.slice(nameAt, nameAt + 400);
  assert.ok(!/opacity/.test(nameBlock), 'opacity is never applied to type in this group');
});

test('the expired and missing image share exactly one fallback', () => {
  const parts = code(PARTS);
  // The treatment must never reveal which problem occurred — a reader learns
  // nothing useful from being told their signature expired.
  assert.match(parts, /fallback=\{<PlateFallback \/>\}/);
  assert.match(parts, /waiting=\{<PlateFallback \/>\}/);
  assert.equal(
    (parts.match(/function PlateFallback/g) ?? []).length,
    1,
    'there must be exactly one fallback component',
  );
});

// ---------------------------------------------------------------------------
// The doors that route here
// ---------------------------------------------------------------------------

test('every door into Storage still lands on a route that exists', () => {
  // At-cap flows route here from The Ten, Add clothes, the Gap feed, the Closet
  // and a piece's own screen. The route is unchanged and takes no parameters,
  // so all five keep working — this pins that nobody gave it a required one.
  const doors = [
    'src/app/the-ten.tsx',
    'src/app/add-clothes.tsx',
    'src/app/gap-feed.tsx',
    'src/app/(tabs)/closet.tsx',
    'src/app/item/[id].tsx',
  ];
  for (const door of doors) {
    assert.match(read(door), /['"]\/storage['"]/, `${door} no longer opens Storage`);
  }

  const screen = code(SCREEN);
  assert.match(screen, /export default function StorageScreen/);
  // No `useLocalSearchParams` — a required parameter would break all five doors
  // at once, silently, since they all push the bare path.
  assert.ok(!/useLocalSearchParams/.test(screen), 'Storage must stay reachable with no parameters');
});
