#!/usr/bin/env bash
#
# Wrap scripts/schema-objects.sql twice — once as a listing, once as a hash —
# and write both to an output directory.
#
#   scripts/schema-fingerprint.sh [DB_URL] [OUT_DIR]
#
# DB_URL defaults to the local Supabase stack's Postgres port. There is no
# default that points anywhere else, and nothing in this script reads a
# Supabase access token, a project ref, or a database password: it is
# deliberately incapable of reaching the linked production project. The audit it
# supports is read-only, but "read-only against production" is a promise about
# an argument, and "cannot address production at all" is a promise about the
# script.
#
# The two outputs are not independent. The hash is computed over the same
# wrapped expression the listing is, so when the fingerprint disagrees between
# two databases the listing is guaranteed to be the diff that explains it — see
# the wrapping contract in scripts/schema-objects.sql.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BODY="$(cat "$ROOT/scripts/schema-objects.sql")"

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
OUT_DIR="${2:-${RUNNER_TEMP:-/tmp}/cinch-schema}"

mkdir -p "$OUT_DIR"

# chr(31)/chr(10) rather than E''/E'\n' so that nothing in the query
# depends on how the shell, psql -c and the server's standard_conforming_strings
# each decide to treat a backslash. Unit separator is used as the field
# delimiter because it cannot occur inside a catalog definition.
psql "$DB_URL" -v ON_ERROR_STOP=1 --no-psqlrc -At -F $'\t' -c "
  select section, obj_key, definition
    from ($BODY) o
   order by section collate \"C\", obj_key collate \"C\", definition collate \"C\"
" > "$OUT_DIR/schema-objects.tsv"

# The outer select exists only so ORDER BY can name a column: a UNION's own
# ORDER BY takes ordinals, and `order by 1 collate "C"` is rejected outright
# ("collations are not supported by type integer"). The display order does not
# feed the md5 — each hash orders its own string_agg — but an artifact whose
# row order drifts with the server's locale is a bad artifact to diff.
psql "$DB_URL" -v ON_ERROR_STOP=1 --no-psqlrc -At -F $'\t' -c "
  select * from (
    with o as ($BODY)
    select section,
           count(*)::text as objects,
           md5(string_agg(obj_key || chr(31) || definition,
                          chr(10) order by obj_key collate \"C\", definition collate \"C\")) as md5
      from o
     group by section
    union all
    select 'TOTAL',
           count(*)::text,
           md5(string_agg(section || chr(31) || obj_key || chr(31) || definition,
                          chr(10) order by section collate \"C\", obj_key collate \"C\", definition collate \"C\"))
      from o
  ) f
   order by section collate \"C\"
" > "$OUT_DIR/schema-fingerprint.tsv"

echo "wrote $OUT_DIR/schema-objects.tsv ($(wc -l < "$OUT_DIR/schema-objects.tsv" | tr -d ' ') rows)"
echo "wrote $OUT_DIR/schema-fingerprint.tsv"
cat "$OUT_DIR/schema-fingerprint.tsv"
