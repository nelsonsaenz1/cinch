-- Data export (PD-04, PD-05).
--
-- A request is a row, not a job queue: the user asks, a worker picks it up,
-- and the row is the only record either side reads. The page in the app is a
-- rendering of this table and nothing else, which is what lets PD-05 show
-- "Earlier exports" without a second source of truth.
--
-- WHAT IS NOT HERE, deliberately: no progress column. The atlas draws a
-- progress bar at 38%, and a bar is only honest if something can compute the
-- fraction. Assembling a manifest is a handful of queries with no meaningful
-- midpoint, so the app draws an indeterminate state instead of animating a
-- number nobody measured. See the contract, §4.
create table public.data_exports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- pending → ready | failed. There is no 'expired': expiry is a fact about
  -- the clock (expires_at < now()), not a state anyone transitions into, and
  -- a status that needs a cron job to stay true is a status that will one day
  -- be wrong.
  status       text not null default 'pending'
                 check (status in ('pending', 'ready', 'failed')),
  ready_at     timestamptz,
  -- Real size of the assembled archive. PD-05 prints it, so it is measured,
  -- never estimated.
  bytes        bigint check (bytes is null or bytes >= 0),
  object_path  text,
  expires_at   timestamptz,
  -- Shown to the user on failure, so it must read as a sentence, not a stack.
  error        text
);

comment on table public.data_exports is
  'One row per export request. The app''s export page is a rendering of this table.';

create index data_exports_user_recent_idx
  on public.data_exports (user_id, requested_at desc);

alter table public.data_exports enable row level security;

-- Read your own, and only your own. There is deliberately no insert policy:
-- the daily limit is only a limit if the client cannot route around it, so
-- creation goes through request_data_export() below. No update or delete
-- policy either — the history is the point, and a user who could delete rows
-- could clear the record and re-request without bound.
create policy data_exports_select_own
  on public.data_exports for select
  to authenticated
  using (user_id = (select auth.uid()));

/**
 * request_data_export — the only way a row is created.
 *
 * Definer because there is no insert policy to satisfy; the user is taken
 * from auth.uid() and never from an argument, which is what keeps a definer
 * function from becoming a way to act as somebody else.
 *
 * One a day, counted from the request rather than from completion, so a
 * failed run does not buy a second attempt and a slow one does not lock the
 * user out for longer than a fast one.
 */
create function public.request_data_export()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'you need to be signed in' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.data_exports d
     where d.user_id = v_user
       and d.requested_at > now() - interval '24 hours'
  ) then
    raise exception 'you can ask for one export a day' using errcode = '22023';
  end if;

  insert into public.data_exports (user_id)
  values (v_user)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_data_export() from public;
grant execute on function public.request_data_export() to authenticated;
