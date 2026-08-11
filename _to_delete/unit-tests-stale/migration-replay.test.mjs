// tests/migration-replay.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
var MIGRATIONS = "supabase/migrations";
var ADD_CONSTRAINT = /alter\s+table[^;]*?\badd\s+constraint\s+([a-z0-9_"]+)/gis;
function guardsFor(sql, name) {
  const bare = name.replace(/"/g, "");
  return new RegExp(`drop\\s+constraint\\s+if\\s+exists\\s+"?${bare}"?`, "i").test(sql) || new RegExp(`conname\\s*=\\s*'${bare}'`, "i").test(sql);
}
var GRANDFATHERED = /* @__PURE__ */ new Set([
  "20260803210000_styling_learning_social.sql",
  "20260804200000_public_boundary_tenant_integrity_and_commands.sql",
  "20260805160000_membership_tiers.sql",
  "20260807101000_events.sql",
  "20260807110000_profile_avatars_and_bio_length.sql",
  "20260807122000_ai_calls_survive_churn.sql"
]);
var files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
test("there are migrations to check", () => {
  assert.ok(files.length > 20, "the migrations directory should not be empty");
});
test("the grandfather list contains only files that still need it", () => {
  const stale = [...GRANDFATHERED].filter((file) => {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
    return [...sql.matchAll(ADD_CONSTRAINT)].every((m) => guardsFor(sql, m[1]));
  });
  assert.deepEqual(stale, [], `these are guarded now and should leave the list: ${stale.join(", ")}`);
});
for (const file of files) {
  if (GRANDFATHERED.has(file)) continue;
  const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
  const matches = [...sql.matchAll(ADD_CONSTRAINT)];
  if (matches.length === 0) continue;
  test(`${file}: every ADD CONSTRAINT is replay-safe`, () => {
    const unguarded = matches.map((m) => m[1]).filter((name) => !guardsFor(sql, name));
    assert.deepEqual(
      unguarded,
      [],
      `ADD CONSTRAINT has no IF NOT EXISTS form, so these will fail 42710 on a rebuild if this migration is ever applied twice: ${unguarded.join(", ")}. Wrap in a "do $$ begin if not exists (select 1 from pg_constraint where conname = '...') then ... end if; end; $$;" or precede with DROP CONSTRAINT IF EXISTS.`
    );
  });
}
test("migration versions are unique and sortable", () => {
  const versions = files.map((f) => f.split("_")[0]);
  const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
  assert.deepEqual(dupes, [], `duplicate migration versions: ${dupes.join(", ")}`);
  for (const v of versions) {
    assert.match(v, /^\d{14}$/, `"${v}" is not a 14-digit timestamp`);
  }
});
