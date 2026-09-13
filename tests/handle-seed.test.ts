/**
 * The seeded handle — ledger A54 (issued 2026-09-07, shipped 2026-09-13).
 *
 * 17 of 22 real ten-piece closets had no handle on 09-13 and so could not
 * reach the share sheet. `seedHandleCandidates` (handle-seed.ts) is pure, so
 * every rule runs here; what the claim and the two call sites must do is
 * pinned as source, the same way returning-free.test.ts reads its hook.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { HANDLE_PATTERN } from '../src/features/profile/handle';
import {
  SEED_MAX_ATTEMPTS,
  seedHandleCandidates,
  stemForHandle,
  stemFromEmail,
  suffixFor,
} from '../src/features/profile/handle-seed';
import { SEEDED_SHARE_ACTION, seededNote } from '../src/features/invite/invite-lines';

const UID = 'faaec810-2b7e-4c1d-9a55-0d3f8e6b1c22';

// ── The stems ────────────────────────────────────────────────────────────────

test('a display name folds to letters, digits and underscores', () => {
  assert.equal(stemForHandle('Dana Kowalski-Ng'), 'danakowalsking');
  assert.equal(stemForHandle('  Zoë  Ångström '), 'zoeangstrom');
  assert.equal(stemForHandle('dana_k'), 'dana_k');
});

test('a name too short to be a handle is not padded into one', () => {
  assert.equal(stemForHandle('Al'), null);
  assert.equal(stemForHandle(''), null);
  assert.equal(stemForHandle(null), null);
  assert.equal(stemForHandle('!!!'), null);
});

test('a long name is cut to the handle ceiling', () => {
  const stem = stemForHandle('abcdefghijklmnopqrstuvwxyz');
  assert.equal(stem, 'abcdefghijklmnopqrst');
  assert.equal(stem!.length, 20);
});

test('the email stem is the local part with any +tag removed', () => {
  assert.equal(stemFromEmail('sim-test+ja@cinchstyle.com'), 'simtest');
  assert.equal(stemFromEmail('Dana.K@example.org'), 'danak');
  assert.equal(stemFromEmail('no-at-sign'), 'noatsign');
  assert.equal(stemFromEmail(null), null);
});

test('the suffix is three digits and a pure function of the account id', () => {
  const s = suffixFor(UID);
  assert.match(s, /^[1-9]\d\d$/);
  assert.equal(suffixFor(UID), s, 'deterministic');
  assert.match(suffixFor('not-hex-at-all'), /^[1-9]\d\d$/, 'a malformed id still yields one');
});

// ── The list ─────────────────────────────────────────────────────────────────

test('every candidate is format-valid, unique, and the list is never empty', () => {
  const inputs = [
    { displayName: 'Dana Kowalski', email: 'dana@example.com', userId: UID },
    { displayName: null, email: null, userId: UID },
    { displayName: 'Al', email: 'a@b.c', userId: UID },
    { displayName: '!!!', email: '+++@x.y', userId: '00000000-0000-0000-0000-000000000000' },
  ];
  for (const input of inputs) {
    const out = seedHandleCandidates(input);
    assert.ok(out.length >= 1, 'never empty');
    assert.ok(out.length <= SEED_MAX_ATTEMPTS);
    for (const c of out) assert.match(c.handle, HANDLE_PATTERN);
    assert.equal(new Set(out.map((c) => c.handle)).size, out.length, 'no duplicates');
    assert.equal(out.at(-1)!.source, 'fallback', 'the stub is always last');
  }
});

test('the order is name, email, then each with the suffix, then the closet stubs', () => {
  const out = seedHandleCandidates({ displayName: 'Dana K', email: 'dkow@example.com', userId: UID });
  const digits = suffixFor(UID);
  assert.deepEqual(
    out.map((c) => c.handle),
    ['danak', 'dkow', `danak${digits}`, `dkow${digits}`, 'closet_faaec810', 'closet_faaec8102b7e'],
  );
  assert.deepEqual(
    out.map((c) => c.source),
    ['name', 'email', 'name', 'email', 'fallback', 'fallback'],
  );
});

test('a name and an email that agree collapse to one entry each', () => {
  const out = seedHandleCandidates({ displayName: 'dana', email: 'dana@example.com', userId: UID });
  assert.equal(out.filter((c) => c.handle === 'dana').length, 1);
  assert.equal(out[0]!.source, 'name', 'the name wins the tie');
});

test('a name at the ceiling still fits its suffix', () => {
  const out = seedHandleCandidates({
    displayName: 'abcdefghijklmnopqrstuvwxyz',
    email: null,
    userId: UID,
  });
  const suffixed = out.find((c) => c.source === 'name' && /\d{3}$/.test(c.handle));
  assert.ok(suffixed);
  assert.equal(suffixed.handle.length, 20);
});

test('with no name and no email the list is the two closet stubs only', () => {
  const out = seedHandleCandidates({ displayName: null, email: null, userId: UID });
  assert.deepEqual(
    out.map((c) => c.handle),
    ['closet_faaec810', 'closet_faaec8102b7e'],
  );
});

// ── The copy ─────────────────────────────────────────────────────────────────

test('the seeded line is the 09-13 §11.3 copy, verbatim', () => {
  assert.equal(seededNote('@danak'), "You're @danak on Cinch. Change it any time in Profile.");
  assert.equal(SEEDED_SHARE_ACTION, 'Share my closet');
});

// ── The claim and the two doors, pinned as source ───────────────────────────

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the claim walks the candidates on a unique violation and stops on anything else', () => {
  const io = strip(read('src/features/profile/handle-seed-io.ts'));
  assert.match(io, /seedHandleCandidates\(/);
  assert.match(io, /const UNIQUE_VIOLATION = '23505'/);
  assert.match(io, /if \(code === UNIQUE_VIOLATION \|\| code === CHECK_VIOLATION\) continue;/);
  assert.match(io, /return null;\s*\}\s*return null;/, 'any other error ends the walk');
  // An existing handle is returned untouched — the seed never overwrites a choice.
  assert.match(io, /if \(profile\?\.username\) return profile\.username;/);
  // Once, on success, with the bounded shape.
  assert.equal((io.match(/track\('handle_seeded'/g) ?? []).length, 1);
  assert.match(io, /track\('handle_seeded', \{ source: candidate\.source, attempts \}\)/);
  assert.match(io, /invalidateQueries\(\{ queryKey: \['my-profile'\] \}\)/);
  // Never throws at a caller.
  assert.match(io, /catch \{\s*return null;\s*\}\s*\}\s*$/);
});

test('the invite screen seeds on arrival and the page says so', () => {
  const screen = strip(read('src/app/invite.tsx'));
  assert.match(screen, /useSeedHandle\(\{ handle: link\.handle, settled: !loading && !error \}\)/);
  assert.match(screen, /linkLoading=\{loading \|\| seed\.seeding\}/);
  assert.match(screen, /seeded=\{seed\.seeded !== null\}/);

  const page = strip(read('src/components/invite/invite-page.tsx'));
  assert.match(page, /props\.seeded \? SEEDED_SHARE_ACTION : SHARE_ACTION/);
  assert.match(page, /props\.seeded && props\.handle \? seededNote\(props\.handle\) : LINK_NOTE/);

  const hook = strip(read('src/features/profile/use-seed-handle.ts'));
  assert.match(hook, /if \(!input\.settled \|\| input\.handle !== null \|\| attempted\.current\) return;/);
});

test('the plate share seeds too, inside its own deadline', () => {
  const link = strip(read('src/features/invite/my-link.ts'));
  assert.match(link, /const seeded = await claimSeedHandle\(\);/);
  assert.match(link, /if \(data\?\.username\) return inviteUrl\(bareHandle\(data\.username\)\);/);
});

test('handle_seeded is a declared event', () => {
  const posthog = read('src/lib/posthog.tsx');
  assert.match(posthog, /\| 'handle_seeded'/);
});
