-- ---------------------------------------------------------------------------
-- The morning edit waits for the closet (ledger A44, 2026-09-05).
--
-- The push ask on Today is no longer gated on the activation floor: three
-- real people ran the push build with zero garments and none was ever asked.
-- The card now draws on the floor too, and its sentence there is CONDITIONAL —
-- "once your ten are in, tomorrow's look is ready when you wake up" — because
-- the note itself is unconditional ("The day's look is ready to read") and
-- opens Today, which under the floor has no look to read. So the claim keeps
-- the card's promise: nobody whose closet holds fewer than ten pieces is
-- claimed, and a grant made at zero pieces produces its first note the
-- morning after the tenth lands.
--
-- TEN is `TODAY_ACTIVATION_FLOOR` (src/features/today/today-spec.ts), the
-- product's floor rather than the engine's eight, and `tests/push-ask.test.ts`
-- holds this literal against that constant. A count of rows, not a stylability
-- check — the engine's "can this closet be dressed" lives on the device and
-- the server has never held a wardrobe; ten pieces the floor screen has
-- accepted is the honest proxy, and a closet of ten that still cannot be
-- dressed opens onto a Today that says which piece is missing.
--
-- Body otherwise identical to 20260810110100.
-- ---------------------------------------------------------------------------

create or replace function public.push_claim_morning_edit()
returns table (user_id uuid, dedupe_key text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.user_id                                                as uid,
           to_char((now() at time zone p.time_zone)::date, 'YYYY-MM-DD') as local_date
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
       -- A44: the note says a look is ready; under the floor there is none.
       and (select count(*) from public.items i where i.user_id = n.user_id) >= 10
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'morning_edit', d.local_date from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key from claimed c;
$$;

comment on function public.push_claim_morning_edit() is
  'Claims one morning-edit send per person per local day, inside their two-hour window, for accounts with a token, a prefs row and at least ten garments (A44: the card promises the edit "once your ten are in").';
