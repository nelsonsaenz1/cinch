import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Migrations must survive being run twice.
 *
 * WHY THIS TEST EXISTS
 *
 * On 2026-08-10 a fresh rebuild of production stopped dead 35 migrations in,
 * with `42710: constraint "ai_config_timeout_ms_sane" for relation "ai_config"
 * already exists`. One migration had been recorded twice under two versions;
 * on the live database that was harmless, but a replay ran both, and the second
 * `ADD CONSTRAINT` hit a constraint the first had already created. Everything
 * after it — 22 migrations, including the entire data-export and push stack —
 * never applied. Branching and point-in-time restore were both broken and
 * nobody knew, because the only thing that ever exercises a replay is a
 * disaster.
 *
 * `ADD CONSTRAINT` is the trap specifically because it is the one piece of DDL
 * here with **no `IF NOT EXISTS` form**. `add column`, `create index`,
 * `create table` and `insert … on conflict` all have one and are used with it
 * throughout this directory. A constraint has to be guarded by hand, and a
 * missing guard is invisible until the day it matters.
 *
 * So: every `ALTER TABLE … ADD CONSTRAINT` must be paired with either a
 * `DROP CONSTRAINT IF EXISTS` of the same name, or a `pg_constraint` existence
 * check. Constraints declared inline in `CREATE TABLE` are exempt — the table
 * itself carries the guard.
 *
 * See docs/ci/migration-replay.md.
 */

// A bare relative path, resolved against the runner's cwd — the repository
// root. Not `import.meta.dirname`: `scripts/run-tests.mjs` bundles with esbuild
// into `node_modules/.cache/unit-tests`, so that would be the cache directory.
// Not `process.cwd()` either — declaring `process` would put it in the app's
// global type space, which `tests/node-test-runtime.d.ts` exists to avoid.
const MIGRATIONS = 'supabase/migrations';

/** `alter table x add constraint <name>` — the unguardable form. */
const ADD_CONSTRAINT = /alter\s+table[^;]*?\badd\s+constraint\s+([a-z0-9_"]+)/gis;

function guardsFor(sql: string, name: string): boolean {
  const bare = name.replace(/"/g, '');
  // Either drop-then-add, or an explicit catalogue check around it.
  return (
    new RegExp(`drop\\s+constraint\\s+if\\s+exists\\s+"?${bare}"?`, 'i').test(sql) ||
    new RegExp(`conname\\s*=\\s*'${bare}'`, 'i').test(sql)
  );
}

/**
 * Grandfathered, 2026-08-10. Not an exemption anyone may extend.
 *
 * These six predate the rule and carry seventeen unguarded constraints between
 * them. They are left alone for a specific reason rather than laziness: the
 * replay that actually broke runs PRODUCTION'S migration ledger, not these
 * files, so guarding them would not have prevented the outage and does not
 * protect against a repeat of it. What fixed that was making the duplicated
 * ledger entry idempotent, in the database.
 *
 * These files matter for the other rebuild path — `supabase db reset` against
 * a local stack — where each is applied exactly once and therefore cannot
 * collide. The risk they carry is real but conditional: it appears only if one
 * of them is ever re-recorded, which is what happened to
 * `ai_timeout_and_attempts` and is why the rule exists at all.
 *
 * The list is closed. A new migration may not join it — that is the whole
 * point of the test — and shrinking it is welcome work.
 */
const GRANDFATHERED = new Set([
  '20260803210000_styling_learning_social.sql',
  '20260804200000_public_boundary_tenant_integrity_and_commands.sql',
  '20260805160000_membership_tiers.sql',
  '20260807101000_events.sql',
  '20260807110000_profile_avatars_and_bio_length.sql',
  '20260807122000_ai_calls_survive_churn.sql',
]);

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

test('there are migrations to check', () => {
  assert.ok(files.length > 20, 'the migrations directory should not be empty');
});

/** The grandfather list may only ever shrink. A file that gets fixed and then
 *  left on the list would quietly re-open the exemption for its next edit. */
test('the grandfather list contains only files that still need it', () => {
  const stale = [...GRANDFATHERED].filter((file) => {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8');
    return [...sql.matchAll(ADD_CONSTRAINT)].every((m) => guardsFor(sql, m[1]!));
  });
  assert.deepEqual(stale, [], `these are guarded now and should leave the list: ${stale.join(', ')}`);
});

for (const file of files) {
  if (GRANDFATHERED.has(file)) continue;
  const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8');
  const matches = [...sql.matchAll(ADD_CONSTRAINT)];
  if (matches.length === 0) continue;

  test(`${file}: every ADD CONSTRAINT is replay-safe`, () => {
    const unguarded = matches
      .map((m) => m[1]!)
      .filter((name) => !guardsFor(sql, name));

    assert.deepEqual(
      unguarded,
      [],
      `ADD CONSTRAINT has no IF NOT EXISTS form, so these will fail 42710 on a ` +
        `rebuild if this migration is ever applied twice: ${unguarded.join(', ')}. ` +
        `Wrap in a "do $$ begin if not exists (select 1 from pg_constraint where ` +
        `conname = '...') then ... end if; end; $$;" or precede with DROP ` +
        `CONSTRAINT IF EXISTS.`,
    );
  });
}

/**
 * Filenames must be unique by the part that orders them.
 *
 * The duplicate that caused the outage was two records of the SAME migration
 * under different versions. In the repo the equivalent mistake is two files
 * whose timestamps sort ambiguously or whose names collide, so the ordering
 * that a rebuild depends on stops being total.
 */
test('migration versions are unique and sortable', () => {
  const versions = files.map((f) => f.split('_')[0]!);
  const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
  assert.deepEqual(dupes, [], `duplicate migration versions: ${dupes.join(', ')}`);

  for (const v of versions) {
    assert.match(v, /^\d{14}$/, `"${v}" is not a 14-digit timestamp`);
  }
});
