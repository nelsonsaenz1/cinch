-- A failed export used to spend the daily allowance.
--
-- `failed` is terminal, and the limit counted every row in the last 24 hours
-- regardless of how it ended. So one transient storage blip — the archive
-- upload timing out, the bucket briefly refusing — locked the user out of
-- their own data for a day, with the page showing them a failure and a button
-- that would not work again until tomorrow.
--
-- That is the wrong direction to fail in. The limit exists to stop somebody
-- assembling a hundred archives an hour, and a run that produced no archive
-- cost nothing worth rationing. Found by the unit that built the worker, not
-- by the unit that wrote the rule — the rule reads correctly until you have
-- seen the row it leaves behind.
--
-- `pending` still counts. An export being built is work in progress, and
-- letting a second request stack on it is how you get two workers racing the
-- same rows.
create or replace function public.request_data_export()
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
       and d.status <> 'failed'
  ) then
    raise exception 'you can ask for one export a day' using errcode = '22023';
  end if;

  insert into public.data_exports (user_id)
  values (v_user)
  returning id into v_id;

  return v_id;
end;
$$;
