-- ===========================================================================
-- RLS baseline: no base table in `public` is readable by an unauthenticated
-- caller, and every table has row level security switched on.
--
-- Run with:  supabase test db      (starts a local stack, applies migrations,
--                                   runs every file here under pg_prove)
--
-- These are written as invariants over the catalogue rather than as a list of
-- table names on purpose. A list goes stale the moment someone adds a table,
-- and the table someone forgets to protect is exactly the table they also
-- forget to add to the test.
--
-- The intended boundary for this project is:
--
--   Public data is exposed ONLY through the allowlisted projection views
--   (public_profiles, public_items, public_outfits, public_outfit_items,
--   public_like_counts). The base tables are never readable by `anon`.
--
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- ---------------------------------------------------------------------------
-- Probe helpers.
--
-- Each returns a row count, or -1 when the read was refused. Refusal is the
-- desired outcome for anon, and both refusal and zero rows are acceptable — the
-- failure mode under test is a positive count.
-- ---------------------------------------------------------------------------

create function pg_temp.visible_rows(tbl text) returns bigint
  language plpgsql
  as $$
declare
  n bigint;
begin
  execute format('select count(*) from public.%I', tbl) into n;
  return n;
exception
  when others then return -1;
end;
$$;

create function pg_temp.public_tables() returns setof text
  language sql
  as $$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
   order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Seed. Two unrelated tenants, one public and one private, each with a full
-- row in every table the public boundary touches.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'owner@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'stranger@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row
-- by the time this runs. A plain insert dies on profiles_pkey before a single
-- assertion executes — which is why this suite had never passed.
insert into profiles (user_id, display_name, username, visibility, sizes, home_city)
values ('11111111-1111-4111-8111-111111111111', 'Owner', 'owner', 'public',
        '{"shoe": "10", "waist": "32"}'::jsonb, 'Lisbon'),
       ('22222222-2222-4222-8222-222222222222', 'Stranger', 'stranger', 'private',
        '{"shoe": "8"}'::jsonb, 'Oslo')
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username, visibility = excluded.visibility, sizes = excluded.sizes, home_city = excluded.home_city;

insert into items (id, user_id, category, is_public, purchase_price,
                   image_path, thumb_path, cutout_path)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'top', true, 249.00,
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png');

insert into outfits (id, user_id, name, is_public)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'Monday', true);

insert into outfit_items (outfit_id, item_id, user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- 1. Every table in `public` has RLS enabled.
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity),
  null,
  'every base table in public has row level security enabled'
);

-- ---------------------------------------------------------------------------
-- 2. Every table in `public` also FORCES nothing to bypass it accidentally —
--    i.e. no table is left with RLS enabled but zero policies AND a standing
--    grant to anon or authenticated, which is a silent lockout rather than a
--    leak but is just as much a bug.
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(t order by t)
     from (select c.relname::text as t
             from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind = 'r'
              -- Only OUR tables. The local stack's services create and drop
              -- their own bookkeeping tables in public (realtime's
              -- `instances`), and probing one mid-drop aborts the file.
              and c.relowner = 'postgres'::regrole
              and c.relrowsecurity
              and not exists (select 1 from pg_policy p where p.polrelid = c.oid)) x
    where has_table_privilege('authenticated', 'public.' || quote_ident(t), 'SELECT')),
  null,
  'no table is granted to authenticated while having no policy at all'
);

-- ---------------------------------------------------------------------------
-- 3. anon can read no rows from any base table.
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select array_agg(t order by t)
     from pg_temp.public_tables() t
    where pg_temp.visible_rows(t) > 0),
  null,
  'anon sees zero rows in every base table — public data comes from the views only'
);

reset role;

-- ---------------------------------------------------------------------------
-- 4. An unrelated authenticated user sees nothing belonging to the owner.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from items where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'an unrelated authenticated user cannot read another tenant''s items'
);

select is(
  (select count(*) from outfit_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'an unrelated authenticated user cannot read another tenant''s outfit_items'
);

reset role;

-- ---------------------------------------------------------------------------
-- 5. The owner sees their own rows. (A boundary that blocks everyone is not a
--    boundary, it is an outage — this is the control.)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from items where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'the owner can read their own items'
);

reset role;

select * from finish();
rollback;
