-- Audit item 27: make the support-mail throttle mean something.
--
-- WHAT WAS WRONG
--
-- The check was a SELECT count, and the booking was a separate INSERT. Between
-- the two, nothing held. N simultaneous requests all read the same count, all
-- found room, and all sent. The old docblock called this "a benign race for a
-- throttle whose job is to stop a loop, not to be exact" — and that is exactly
-- backwards. A loop IS concurrency. An attacker flooding the founder's inbox
-- does not send three messages and wait; they open fifty connections at once,
-- which is the one case the check could not see.
--
-- Measured, not assumed: twelve simultaneous requests against a limit of three
-- let ELEVEN through.
--
-- WHY THIS CANNOT BE FIXED THE WAY `reaction_concurrency` WAS
--
-- 20260804202000 fixed its race with `select … for update`, taking a row lock
-- before comparing. That works there because the contended thing is a row that
-- EXISTS. Here the contended thing is a COUNT over rows that do not exist yet —
-- there is no "this user's throttle" row to lock, and you cannot take a row
-- lock on a row you are about to insert. `insert … select … where (count) < n`
-- does not close it either: under READ COMMITTED each transaction evaluates its
-- subquery against a snapshot taken before the other's insert is visible, so
-- both still find room.
--
-- So the serialization has to be on the USER, not on a row: an advisory lock
-- held for the transaction, keyed on the user id. Concurrent requests from one
-- person queue behind each other and each sees the previous one's booking;
-- requests from different people never contend at all.
--
-- The limits move here from the edge function on purpose. They are the rule,
-- and a rule enforced by the caller is the thing that just got fixed. The
-- SENTENCES stay in TypeScript — those are copy, and copy belongs where the
-- rest of the copy is.
create function claim_support_send(p_user_id uuid, p_topic text)
returns table (booking_id uuid, refused text)
language plpgsql security definer set search_path = '' as $$
declare
  v_per_hour constant integer := 3;
  v_per_day  constant integer := 10;
  v_hour     integer;
  v_day      integer;
  v_id       uuid;
begin
  if p_user_id is null then
    return query select null::uuid, 'unauthenticated'::text;
    return;
  end if;

  -- Everything below is now one critical section per user. `xact` so it is
  -- released when the transaction ends however it ends — an exception mid-way
  -- must not leave a person unable to write to support ever again.
  --
  -- Keyed on the uuid's own bits rather than a hash of its text: two keys
  -- avoids the birthday collisions a single 32-bit hashtext would give across
  -- a real user base, and a collision here would make two unrelated people
  -- queue behind each other for no reason.
  perform pg_advisory_xact_lock(
    ('x' || substr(replace(p_user_id::text, '-', ''), 1, 8))::bit(32)::integer,
    ('x' || substr(replace(p_user_id::text, '-', ''), 9, 8))::bit(32)::integer
  );

  select count(*) filter (where s.sent_at >= now() - interval '1 hour'),
         count(*) filter (where s.sent_at >= now() - interval '24 hours')
    into v_hour, v_day
    from public.support_sends s
   where s.user_id = p_user_id
     and s.sent_at >= now() - interval '24 hours';

  -- Day first, matching the order the endpoint answered in before: somebody at
  -- their daily limit is told about the day, not about the hour.
  if v_day >= v_per_day then
    return query select null::uuid, 'day'::text;
    return;
  end if;

  if v_hour >= v_per_hour then
    return query select null::uuid, 'hour'::text;
    return;
  end if;

  insert into public.support_sends (user_id, topic)
  values (p_user_id, p_topic)
  returning id into v_id;

  return query select v_id, null::text;
end;
$$;

revoke execute on function claim_support_send(uuid, text) from public, anon, authenticated;

comment on function claim_support_send(uuid, text) is
  'Audit 27. Counts and books in one critical section, serialized per user by an advisory transaction lock. Returns a booking_id, or a refusal of ''hour'' or ''day''. Release the booking with release_support_send if the mail does not go out.';

-- Deleting the booking when the send does not happen. Was an inline delete by
-- id in the edge function; named here so both halves of the transaction live
-- together and the id cannot be used to delete somebody else's row.
create function release_support_send(p_booking_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  delete from public.support_sends
   where id = p_booking_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke execute on function release_support_send(uuid, uuid) from public, anon, authenticated;
