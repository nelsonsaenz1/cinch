import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * commerce-directive.md §0: "Commission may never influence what Cinch
 * recommends, in what order, or how loudly... a test must assert the ranking
 * module has no import edge to the commerce module."
 *
 * Enforced as a static source check on the two files that make up the Gap
 * Feed's ranking module — `outfit-count.ts` (the counting/ranking function
 * itself) and `gap-feed.ts` (its own derivations, which `ShopRow` reads the
 * gap label and gain from but never the other way around). This repo's test
 * runner (`scripts/run-tests.mjs`, esbuild + `node --test`) transpiles each
 * test file independently rather than building a whole-program dependency
 * graph the tests could introspect, so this checks the one fact a graph walk
 * would otherwise confirm: neither file's OWN `import` statements name a
 * commerce module. Paths are plain strings resolved against the runner's cwd
 * (the repository root) — the same convention `push-channels.test.ts` and
 * `migration-replay.test.ts` use, and the reason `node:fs`'s ambient
 * declaration (`tests/node-test-runtime.d.ts`) takes a bare `string` rather
 * than a `URL`: `path`/`process` are deliberately not declared for tests, so
 * an `import.meta.url` resolution has nothing to convert back to a path with.
 *
 * THIS IS A DIRECT-EDGE CHECK, NOT A TRANSITIVE ONE. If `outfit-count.ts` or
 * `gap-feed.ts` ever gains an import that itself imports commerce two hops
 * away, this test would not catch it — recorded here so that limit is a
 * documented trade-off rather than a surprise a future reader has to
 * rediscover. Today neither file imports anything but `node`-free pure
 * TypeScript from within `features/closet`, so the direct check is also the
 * true one.
 */

const RANKING_FILES = [
  'src/features/closet/outfit-count.ts',
  'src/features/closet/gap-feed.ts',
] as const;

/** Matches an import specifier naming any commerce module, by path or by
 *  the bare word — catches `@/features/commerce/...`, a relative
 *  `../commerce/...`, and the Deno-only `_shared/commerce.ts` alike. */
const NAMES_COMMERCE_MODULE = /from\s+['"][^'"]*\bcommerce[^'"]*['"]/;

test('the ranking module has no import edge to any commerce module', () => {
  for (const relativePath of RANKING_FILES) {
    const source = readFileSync(relativePath, 'utf8');

    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /^\s*export\s+\{[^}]*\}\s+from\b/.test(line));

    for (const line of importLines) {
      assert.equal(
        NAMES_COMMERCE_MODULE.test(line),
        false,
        `${relativePath} imports a commerce module, which commerce-directive.md §0 forbids: ${line.trim()}`,
      );
    }
  }
});

/**
 * The inverse sanity check — proves the regex above isn't vacuously true
 * because it never matches anything. Runs the same pattern against a known
 * commerce import line to confirm a real violation would be caught.
 */
test('the commerce-module pattern actually matches a commerce import', () => {
  assert.equal(
    NAMES_COMMERCE_MODULE.test("import { PAID_LINK_LABEL } from '@/features/commerce/copy';"),
    true,
  );
  assert.equal(
    NAMES_COMMERCE_MODULE.test("import { trackingUrl } from '../_shared/commerce.ts';"),
    true,
  );
});
