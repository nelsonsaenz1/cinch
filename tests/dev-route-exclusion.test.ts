/**
 * No design fixture ships.
 *
 * Expo Router's rule is the whole hazard: every file under `src/app` becomes a
 * route and is compiled into the bundle, linked or not. For a long time that
 * meant 205 `dev-*` screens — 22,592 lines — inside the production app, each
 * one presenting hard-coded outfits, wear counts and cost-per-wear as if they
 * were the reader's own.
 *
 * That was mitigated at runtime rather than removed: `_layout.tsx` bounces any
 * `dev-`-prefixed segment in release builds. The mitigation was real and is
 * kept, but "the user cannot reach it" is a weaker claim than "it is not in the
 * binary", and only the second one is checkable from here.
 *
 * These tests are the second claim. They are filesystem facts — no bundler, no
 * simulator — so they run in the default suite and fail the moment a fixture is
 * put back where the router can see it. The bundle-level proof (`expo export`,
 * grepped for fixture identifiers) belongs to the release path, which already
 * exports for iOS on every CI run.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const ROUTER_ROOT = 'src/app';
const FIXTURES = 'src/dev-fixtures';

/** Every file the router would register, at any depth. */
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) out.push(...routeFiles(path));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(path);
  }
  return out;
}

test('the router root registers no dev fixture, at any depth', () => {
  // Depth matters: the original problem was a flat directory, but a fixture
  // dropped into `src/app/dev/` or `src/app/(tabs)/dev-x.tsx` would ship just
  // as surely and a top-level readdir would not see it.
  const shipped = routeFiles(ROUTER_ROOT).filter((p) => {
    const name = p.slice(p.lastIndexOf('/') + 1);
    return name.startsWith('dev-');
  });
  assert.deepEqual(
    shipped,
    [],
    `these are registered routes and ship in the production bundle:\n${shipped.join('\n')}`,
  );
});

test('the fixtures still exist, outside the router', () => {
  // The other half of the contract. Deleting them would also pass the test
  // above, and would throw away the frames the launch-polish and UI-excellence
  // packets were accepted against.
  const fixtures = readdirSync(FIXTURES).filter((f) => f.startsWith('dev-') && f.endsWith('.tsx'));
  assert.ok(fixtures.length > 100, `expected the fixture set, found ${fixtures.length}`);
  assert.ok(fixtures.includes('dev-screens.tsx'), 'the fixture index is missing');
});

test('no production source imports a fixture', () => {
  // A single import is all it takes to pull the whole tree back into the
  // bundle, and it would not show up as a route.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) {
        if (path !== FIXTURES) walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(path)) continue;
      const src = readFileSync(path, 'utf8');
      if (/from '@\/dev-fixtures\/|from '.*\/dev-fixtures\//.test(src)) offenders.push(path);
    }
  };
  walk('src');
  assert.deepEqual(offenders, [], `these pull fixtures into the app bundle:\n${offenders.join('\n')}`);
});

test('the release-build guard is kept even though it is now unreachable', () => {
  // Defence in depth, and the thing that catches a reintroduced fixture: if one
  // lands in src/app again, the guard still refuses to render it in a release
  // build while the test above is what actually fails the change.
  const layout = readFileSync(`${ROUTER_ROOT}/_layout.tsx`, 'utf8');
  assert.match(layout, /segments\[0\]\?\.startsWith\('dev-'\)/);
  assert.match(layout, /if \(__DEV__\) return;/);
});

test('the mount helper only ever removes symlinks, so it cannot eat a real route', () => {
  // `off` runs against src/app, which is where the real routes live. If it
  // stopped filtering by symlink it would delete the app.
  const script = readFileSync('scripts/dev-fixtures.mjs', 'utf8');
  assert.match(script, /isSymbolicLink\(\)/);
  const off = script.slice(script.indexOf("mode === 'off'"));
  assert.match(off, /mountedLinks\(\)/);
  assert.doesNotMatch(off.slice(0, off.indexOf('} else')), /readdirSync\(appDir\)(?!.*isSymbolicLink)/);
});

test('the mount helper stays out of every native fingerprint input', () => {
  // package.json scripts, .gitignore and .easignore are all hashed by
  // @expo/fingerprint. Wiring the helper into any of them moves the runtime
  // version every shipped binary is keyed to, which costs a Store build to
  // announce a dev convenience.
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const scripts: Record<string, string> = pkg.scripts ?? {};
  assert.ok(
    !Object.values(scripts).some((v) => v.includes('dev-fixtures')),
    'package.json scripts is a fingerprint input',
  );
  for (const ignore of ['.gitignore', '.easignore']) {
    assert.doesNotMatch(readFileSync(ignore, 'utf8'), /dev-fixtures|app\/dev-\*/);
  }
});
