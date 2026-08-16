#!/usr/bin/env node
/**
 * Mount the design fixtures back into the router, for local review only.
 *
 *   node scripts/dev-fixtures.mjs on     symlink src/dev-fixtures/*.tsx into src/app
 *   node scripts/dev-fixtures.mjs off    remove those symlinks
 *   node scripts/dev-fixtures.mjs status
 *
 * WHY THE FIXTURES LEFT THE ROUTER
 *
 * Expo Router registers every file under `src/app`, so all 205 `dev-*` screens
 * were compiled into the production bundle whether or not anything linked to
 * them. `_layout.tsx` bounced them at runtime in release builds, so this was
 * never a correctness or a deception risk — but 22,592 lines of fixture is a
 * real size and build-time cost, and "it is unreachable" is a weaker guarantee
 * than "it is not there".
 *
 * WHY THEY DID NOT SIMPLY DIE
 *
 * `dev-screens.tsx` argues the case itself: "a fixture nobody can open is a
 * fixture nobody checks, and the whole reason these exist is that a drawn state
 * is only settled once somebody has looked at it." The launch-polish and
 * UI-excellence packets were accepted against these frames. Deleting them would
 * throw away the evidence the design record is built on, and moving them out of
 * the router without a way back would make them unopenable, which is the same
 * loss on a slower fuse.
 *
 * So: they live in `src/dev-fixtures/`, where the router cannot see them and
 * the bundler never reaches them, and this script puts them back for as long as
 * a review takes. Symlinks, so nothing is copied and `off` cannot lose an edit.
 *
 * NOT WIRED INTO package.json ON PURPOSE. `packageJson:scripts` is an input to
 * the native fingerprint (`@expo/fingerprint` hashes it), so adding a script
 * entry would move the runtime version every shipped binary is keyed to and
 * cost a Store build to say "there is a new dev helper". Run it with `node`.
 *
 * The symlinks are deliberately NOT gitignored either — `.gitignore` is a
 * fingerprint input for the same reason. They show up in `git status` while
 * mounted, which is the correct amount of nagging: they are not meant to
 * outlive the review, and `off` clears them.
 */

import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'src', 'dev-fixtures');
const appDir = join(root, 'src', 'app');

const names = existsSync(fixtures)
  ? readdirSync(fixtures).filter((f) => f.startsWith('dev-') && f.endsWith('.tsx'))
  : [];

/** Only ever touches a path that is a symlink, so a real route is never removed. */
function mountedLinks() {
  return readdirSync(appDir)
    .filter((f) => f.startsWith('dev-') && f.endsWith('.tsx'))
    .filter((f) => lstatSync(join(appDir, f)).isSymbolicLink());
}

const mode = process.argv[2] ?? 'status';

if (mode === 'on') {
  let made = 0;
  for (const name of names) {
    const link = join(appDir, name);
    if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) continue;
    symlinkSync(relative(appDir, join(fixtures, name)), link);
    made += 1;
  }
  console.log(
    `dev-fixtures: mounted ${made} of ${names.length} into src/app.\n` +
      '  Restart Metro so the router picks them up, then open cinch://dev-screens.\n' +
      '  Run `node scripts/dev-fixtures.mjs off` before committing.',
  );
} else if (mode === 'off') {
  const links = mountedLinks();
  for (const name of links) unlinkSync(join(appDir, name));
  console.log(`dev-fixtures: removed ${links.length} symlink(s) from src/app.`);
} else {
  const links = mountedLinks();
  const real = readdirSync(appDir)
    .filter((f) => f.startsWith('dev-') && f.endsWith('.tsx'))
    .filter((f) => !lstatSync(join(appDir, f)).isSymbolicLink());
  console.log(
    `dev-fixtures: ${names.length} available, ${links.length} mounted.\n` +
      (real.length
        ? `  WARNING: ${real.length} real dev-* file(s) in src/app — those SHIP.\n    ${real.join('\n    ')}\n`
        : '  No real dev-* files in src/app, so none ship.\n'),
  );
}
