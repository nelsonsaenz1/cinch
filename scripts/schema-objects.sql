-- A normalized, deterministic inventory of the database schema.
--
-- WHY THIS EXISTS
--
-- Gate 3 has to answer one question: does replaying the 93 files in
-- supabase/migrations from zero produce the schema that is actually live in
-- production? The obvious tool is `supabase db dump`, and it is unavailable —
-- it needs a direct Postgres connection, and the three attempts made from the
-- audit machine hung and were killed. What IS available on both sides is
-- read-only catalog SQL: psql against the CI stack, and the Supabase MCP
-- endpoint against production. So the comparison is made out of catalog rows
-- rather than out of a dump, and this file is the single definition of which
-- rows count.
--
-- THE WRAPPING CONTRACT
--
-- This file is a BARE SELECT EXPRESSION: no leading CTE, no trailing
-- semicolon. That is load bearing, and it is the reason there is no second
-- copy of this query anywhere. Callers wrap it:
--
--   listing      select * from ( <this file> ) o order by 1,2
--   fingerprint  select section, count(*), md5(string_agg(...)) from ( <this file> ) o group by ...
--
-- One text, both sides, both outputs. A fingerprint computed from a different
-- object set than the listing it ships next to would be evidence of nothing,
-- and keeping the two in separate files is exactly how that drift happens.
--
-- DETERMINISM
--
-- Three things here are not decoration:
--
--   * `collate "C"` on every ordering. The CI stack and the production project
--     do not necessarily share lc_collate, and under a locale-aware collation
--     `string_agg(... order by ...)` puts the same rows in a different order on
--     the two sides — which changes the md5 while nothing about the schema has
--     changed at all.
--   * whitespace squeezed to single spaces. pg_get_functiondef and
--     pg_get_viewdef reflow their output; a definition that differs only in
--     indentation is the same definition.
--   * extension-owned objects excluded via pg_depend deptype 'e'. pg_net,
--     pg_cron and pgcrypto ship hundreds of functions whose bodies track the
--     extension version, which is a property of the platform rather than of
--     this repo's migrations.
--
-- `section` is `<schema>/<kind>` rather than just `<kind>` on purpose. `public`
-- is the only schema this repo's migrations own outright; `auth` and `storage`
-- are managed by Supabase and their contents track the running GoTrue/Storage
-- version, which differs between a local CLI stack and the hosted platform. Per
-- schema sections let that difference be reported and attributed instead of
-- being averaged into one hash that then disagrees for a reason nobody can name.

select 'public/table' as section,
       c.relname::text as obj_key,
       'rls=' || c.relrowsecurity::text || ' force=' || c.relforcerowsecurity::text as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')
   and not exists (select 1 from pg_depend d
                    where d.objid = c.oid and d.deptype = 'e')

union all
select n.nspname || '/column',
       c.relname || '.' || a.attname,
       regexp_replace(
         format_type(a.atttypid, a.atttypmod)
         || ' null=' || (not a.attnotnull)::text
         || ' default=' || coalesce(pg_get_expr(ad.adbin, ad.adrelid), '-')
         || ' identity=' || coalesce(nullif(a.attidentity::text, ''), '-'),
         '\s+', ' ', 'g')
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
 where n.nspname in ('public', 'auth', 'storage')
   and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
   and not exists (select 1 from pg_depend d
                    where d.objid = c.oid and d.deptype = 'e')

union all
select n.nspname || '/constraint',
       c.relname || '.' || con.conname,
       regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public', 'auth', 'storage')
   and not exists (select 1 from pg_depend d
                    where d.objid = con.oid and d.deptype = 'e')

union all
select schemaname || '/index',
       indexname,
       regexp_replace(indexdef, '\s+', ' ', 'g')
  from pg_indexes
 where schemaname in ('public', 'auth', 'storage')

union all
select schemaname || '/policy',
       tablename || '.' || policyname,
       regexp_replace(
         cmd || ' roles=' || array_to_string(roles, ',')
         || ' permissive=' || permissive
         || ' using=' || coalesce(qual, '-')
         || ' check=' || coalesce(with_check, '-'),
         '\s+', ' ', 'g')
  from pg_policies
 where schemaname in ('public', 'auth', 'storage')

union all
select schemaname || '/view',
       viewname,
       regexp_replace(definition, '\s+', ' ', 'g')
  from pg_views
 where schemaname in ('public', 'auth', 'storage')

union all
-- prokind is filtered to f/p because pg_get_functiondef raises on aggregates
-- and window functions rather than returning anything for them.
select n.nspname || '/function',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'auth', 'storage')
   and p.prokind in ('f', 'p')
   and not exists (select 1 from pg_depend d
                    where d.objid = p.oid and d.deptype = 'e')

union all
select n.nspname || '/trigger',
       c.relname || '.' || t.tgname,
       regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public', 'auth', 'storage')
   and not t.tgisinternal

union all
select n.nspname || '/type',
       t.typname,
       'enum=' || array_to_string(array(
         select e.enumlabel from pg_enum e
          where e.enumtypid = t.oid
          order by e.enumsortorder), ',')
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname in ('public', 'auth', 'storage')
   and t.typtype = 'e'
   and not exists (select 1 from pg_depend d
                    where d.objid = t.oid and d.deptype = 'e')

union all
-- Only the three roles a client can ever authenticate as. Grants to postgres,
-- to the supabase_* internal roles and to PUBLIC are platform bookkeeping that
-- a local stack has no reason to reproduce, and including them would drown the
-- grants that actually decide whether one user can read another's closet.
select table_schema || '/grant_table',
       table_name || '.' || grantee || '.' || privilege_type,
       'granted'
  from information_schema.role_table_grants
 where table_schema in ('public', 'auth', 'storage')
   and grantee in ('anon', 'authenticated', 'service_role')

union all
select routine_schema || '/grant_routine',
       routine_name || '.' || grantee || '.' || privilege_type,
       'granted'
  from information_schema.role_routine_grants
 where routine_schema in ('public', 'auth', 'storage')
   and grantee in ('anon', 'authenticated', 'service_role')
