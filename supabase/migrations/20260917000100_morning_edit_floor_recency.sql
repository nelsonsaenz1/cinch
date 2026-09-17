-- ---------------------------------------------------------------------------
-- A87b (2026-09-16 nightly): the floor note goes to a WARM closet.
--
-- The first three sends ever (12:15:02Z 2026-09-16, dedupe key 'floor') went
-- to the three tokens that existed, last seen 09-05, 09-05 and 09-11 — all
-- three people had stopped opening the app before the note was written, and
-- none of them opened it after (the come-back bin the nightly scores at 9 for
-- 9). The `floor` branch keyed on closet size alone and had no recency term,
-- so nothing in it could have chosen differently.
--
-- The recency term: the person's device must have been seen inside 72 hours.
-- `push_tokens.last_seen_at` is written at the grant (registerPushToken) and,
-- from the same ship's OTA, touched on every launch by a granted device
-- (`touchPushToken`), so from here it means "opened the app in the last three
-- days" — before that OTA lands on a device it means "granted in the last
-- three days", which is the same population read more narrowly.
--
-- Ten-plus closets are untouched: their daily note is the promise on the
-- preferences screen, and a dead device is retired by its receipt, not by a
-- timestamp (see _shared/push.ts on why an old timestamp is never a fact).
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
           (select count(*) from public.items i where i.user_id = n.user_id) < 10 as on_floor,
           exists (select 1 from public.push_tokens t
                    where t.user_id = n.user_id
                      and t.last_seen_at > now() - interval '72 hours') as warm
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.morning_edit
       and p.deletion_requested_at is null
       and p.time_zone is not null
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
    -- A87b: the floor note waits for a warm device; a cold one is not claimed,
    -- so the one note is still owed the morning after the person comes back.
    select d.uid, 'morning_edit', case when d.on_floor then 'floor' else d.local_date end
      from due d
     where not d.on_floor or d.warm
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, c.dedupe_key = 'floor' as floor from claimed c;
$$;

revoke execute on function public.push_claim_morning_edit() from public, anon, authenticated;
grant  execute on function public.push_claim_morning_edit() to service_role, postgres;

comment on function public.push_claim_morning_edit() is
  'Claims morning-edit sends inside each person''s two-hour window: one per local day for a closet of ten or more, and ONE EVER (key ''floor'') for a closet under ten (12.13) whose device was seen inside 72 h (A87b, 2026-09-17) — the floor note says what the closet is waiting for, to someone who might read it.';
