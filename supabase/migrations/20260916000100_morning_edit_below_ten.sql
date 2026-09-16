-- ---------------------------------------------------------------------------
-- The morning note reaches a closet under the floor — once (founder ruling
-- 12.13, 2026-09-16; ledger A77).
--
-- Since A44 the claim skipped anyone with fewer than ten garments, because the
-- note said "the day's look is ready" and under the floor there is none. Three
-- people granted the permission on the floor and none ever received anything
-- (`push_tokens` 3, `push_sends` 0 for a week). The founder's ruling: send one
-- note, at their 7:30, that says what the closet is waiting for.
--
-- ONCE, not daily: a floor closet is claimed with the dedupe key 'floor'
-- rather than the local date, and `push_sends`' primary key
-- (user_id, channel, dedupe_key) makes the second morning a no-op. The day the
-- tenth piece is in, the person leaves the floor branch and the daily
-- date-keyed claim takes over as before. The sender reads `floor` off the
-- claim and picks the sentence (`send-push/copy.ts morningEditPayload`).
--
-- The return shape gains a column, so the function is dropped and recreated;
-- its guest list (service_role, postgres) is restated below, because a fresh
-- function starts with the default grant to PUBLIC.
-- ---------------------------------------------------------------------------

drop function if exists public.push_claim_morning_edit();

create function public.push_claim_morning_edit()
returns table (user_id uuid, dedupe_key text, floor boolean)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.user_id                                                as uid,
           to_char((now() at time zone p.time_zone)::date, 'YYYY-MM-DD') as local_date,
           (select count(*) from public.items i where i.user_id = n.user_id) < 10 as on_floor
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.morning_edit
       and p.deletion_requested_at is null
       and p.time_zone is not null
       -- A zone string predating the validating trigger would raise inside
       -- `at time zone` and take the whole sweep with it.
       and exists (select 1 from pg_catalog.pg_timezone_names z
                    where z.name = p.time_zone)
       and (now() at time zone p.time_zone)::time >= n.morning_edit_at
       and (now() at time zone p.time_zone)::time <  n.morning_edit_at + interval '2 hours'
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    -- 12.13: under the floor the key is the word 'floor' — one note, ever,
    -- until the tenth piece is in; at ten and above, one per local day.
    select d.uid, 'morning_edit', case when d.on_floor then 'floor' else d.local_date end
      from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, c.dedupe_key = 'floor' as floor from claimed c;
$$;

revoke execute on function public.push_claim_morning_edit() from public, anon, authenticated;
grant  execute on function public.push_claim_morning_edit() to service_role, postgres;

comment on function public.push_claim_morning_edit() is
  'Claims morning-edit sends inside each person''s two-hour window: one per local day for a closet of ten or more, and ONE EVER (key ''floor'') for a closet under ten (12.13, 2026-09-16) — the floor note says what the closet is waiting for.';
