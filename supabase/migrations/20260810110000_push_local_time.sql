-- ===========================================================================
-- The morning edit fires at seven-thirty. Whose seven-thirty?
--
-- `notification_prefs.morning_edit_at` is a bare `time` — 07:30 with no zone
-- attached, because the atlas offers four wall-clock slots and a person picking
-- 07:30 means the 07:30 on their own kitchen wall. The server has no idea what
-- that is. `profiles` carries `home_city` (free text, typed by the user) and
-- `units`, and neither is a zone: "Portland" is two cities eight hours apart,
-- and a city name is a guess dressed as a fact.
--
-- WHY A ZONE NAME AND NOT AN OFFSET
--
-- The cheaper answer is an integer of minutes from UTC, written by the client
-- on launch from `getTimezoneOffset()`. It is wrong twice a year. An offset is
-- only true until the next daylight-saving transition, and the account that
-- most needs the morning edit to keep working is the one that has not opened
-- the app in a fortnight — precisely the account whose offset is stale. An
-- IANA name does not go stale: Postgres ships the zone database and applies the
-- transition itself, so `now() at time zone p.time_zone` is right in March and
-- still right in November without the phone having said a word.
--
-- The client writes it from `Intl.DateTimeFormat().resolvedOptions().timeZone`
-- on launch. That is a device fact, so it lands on `profiles` beside the other
-- two device-shaped facts rather than in `notification_prefs`, which is a table
-- of choices the user made.
--
-- WHAT NULL MEANS, AND IT IS NOT "UTC"
--
-- Null means we do not know, and a sender that does not know a zone sends
-- nothing on the two channels that need one — the morning edit and the evening
-- before an event. Defaulting to UTC would put the 07:30 edit through a
-- Californian's phone at 11:30pm the night before, which is not an early
-- notification, it is the wrong one. Atlas 37's own footnote settles the
-- principle for us: "if the weather has not come in by then, the edit waits
-- rather than sending a guess." A zone we are guessing at is a guess.
--
-- CONSEQUENCE, STATED PLAINLY: until a build ships that writes this column, the
-- morning edit and event reminders fire for nobody. The two hourly batches and
-- the borrow channel do not read it and are unaffected.
--
-- See docs/design/diary-boards-activity-contract.md §6.3.
-- ===========================================================================

alter table profiles
  add column if not exists time_zone text;

comment on column profiles.time_zone is
  'IANA zone name for this person''s phone, e.g. America/Los_Angeles. Written by the client on launch. Null means unknown, which means no morning edit and no event reminder — never a guessed zone.';

-- ---------------------------------------------------------------------------
-- Validation, on the write rather than on the read.
--
-- `at time zone 'Mars/Olympus'` raises, and it raises inside a set-returning
-- sweep that is composing everybody's notifications at once — one bad string
-- from one client would take down the morning for every account in the same
-- statement. Two defences, because this one is worth two:
--
--   1. here, so a client that writes nonsense finds out immediately and loudly;
--   2. in the senders, which join against `pg_timezone_names` and skip a row
--      they cannot resolve, so even a value that arrived before this trigger
--      existed cannot break the sweep.
--
-- A check constraint cannot do this — `pg_timezone_names` is a function-backed
-- catalogue view and subqueries are not allowed in CHECK.
-- ---------------------------------------------------------------------------

create function profiles_check_time_zone() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.time_zone is not null
     and not exists (
       select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone
     )
  then
    -- 22023 is invalid_parameter_value: a 400 to the client, not a 500.
    raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_check_time_zone
  before insert or update of time_zone on profiles
  for each row execute function profiles_check_time_zone();

-- No new grant and no new policy. `time_zone` sits on a table whose owner-only
-- policies and table-level grant (20260806100000) already say who may write it,
-- and it is not filtered by any policy, so it needs no index.
