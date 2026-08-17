-- ===========================================================================
-- Activity Center — one row per RECIPIENT, and that is the whole security
-- model.
--
-- WHAT THIS IS. A private, recipient-scoped inbox of the things other people
-- did that concern you: an invitation to a private group, an answer to one you
-- sent, somebody arriving in or leaving a group you are in, a reaction to a
-- look you shared. Nothing derived, nothing aggregated across people, nothing
-- public. The design record is design-refs/ACTIVITY-CENTER-IMPLEMENTATION.md;
-- §5 is the taxonomy this file implements and §6 is the matrix it enforces.
--
-- THE GOLDEN RULE, and the reason there is a table here at all. A row exists
-- for, and is readable by, exactly ONE `recipient_id`. Activity is materialised
-- per recipient at write time — the fan-out below runs inside the same
-- transaction as the domain action — so the read policy is a single-column
-- check and there is no query anywhere that could accidentally hand one
-- person's inbox to another.
--
-- The alternative, and why it was refused: `activity_feed()`
-- (20260810100100) derives its seven kinds at read time by unioning five
-- tables. That works there because every branch is already filtered to rows
-- whose subject is the caller. It does NOT work here. `circle.member.joined`
-- fans out to every OTHER joined member, and a derived version would have to
-- read the whole roster of every group the caller is in, on every open,
-- through a definer function — which is a much wider read path than "select
-- your own rows", for a surface whose entire promise is narrowness.
--
-- WHAT IS DELIBERATELY ABSENT.
--
--   * No count, anywhere. There is no `unread_count` column, no aggregate view
--     and no function that returns one. The entry glyph carries a BOOLEAN dot,
--     and `activity_has_unseen()` below is the only thing that feeds it.
--   * No read receipts. `seen_at` is written by the recipient, readable only by
--     the recipient, and no policy anywhere lets the actor of an event see it.
--     Nobody is ever told that you looked.
--   * No client-authored events. There is no INSERT policy for `authenticated`
--     and no INSERT grant. Every row is written by one of the definer triggers
--     below, from a domain action the database has already validated.
--   * No ranking column. `created_at desc` is the only order, and there is
--     nothing here a future sort could be built from.
--   * No push. This file adds no notification machinery of any kind; delivery
--     is the client's own refresh.
--
-- THE FOUR-TABLE DEPENDENCY, stated once: this file reads `circle_members`,
-- `circles`, `daily_social_reactions` and `outfits`, and writes only
-- `activity_events`. Every trigger it installs is AFTER, so none of them can
-- change or refuse the domain write it is reporting on. An inbox that could
-- veto an invitation would be a spectacular way to break a feature.
--
-- Ground rules restated from 20260807100000 §0, all held below: no `to anon`
-- anywhere, every client grant an explicit line at the bottom, EXECUTE revokes
-- targeting `public, anon, authenticated` before the deliberate grant,
-- `(select auth.uid())`, per-command policies, and a btree index on every
-- policy-filtered column.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · The taxonomy, as a type
--
-- An enum rather than `text check (...)`, because these labels travel into a
-- TypeScript union and into an analytics allow-list, and the one thing that
-- must never happen is a value appearing in the table that neither of those
-- knows about. `pg_enum` is then the single place the closed set is written
-- down, and `tests/activity-center-taxonomy.test.ts` reads it back out of this
-- file so the client union cannot drift from it.
--
-- Dots in enum labels are legal (they are quoted string literals, not
-- identifiers) and they are the design record's own spelling. Keeping them
-- means the label in the database, the label in the union and the label in the
-- analytics enum are one string with no translation table between them.
--
-- `outfit.saved.shared` IS DECLARED AND NEVER WRITTEN. §13 ships it disabled:
-- it exists so a future save/share feature that genuinely creates a
-- recipient-directed event can emit it without a migration, and there is no
-- trigger below that produces one. A label with no producer is inert; a label
-- added later under time pressure is how a taxonomy acquires its first
-- ambiguous member.
-- ---------------------------------------------------------------------------

create type activity_event_type as enum (
  'circle.invite.received',
  'circle.invite.accepted',
  'circle.invite.declined',
  'circle.member.joined',
  'circle.member.left',
  'circle.self.left',
  'daily.reaction.received',
  'outfit.saved.shared'
);

-- ---------------------------------------------------------------------------
-- 2 · The table
--
-- `payload` IS A DENORMALISATION, AND IT IS LOAD-BEARING. AC-05 has to say
-- "This invitation to Sunday Roasts was withdrawn" about a group the reader can
-- no longer see — `can_see_circle` stops showing a removed person the room they
-- were removed from — and AC-08's collapsed summaries have to name the reaction
-- that was given after the reactor has changed their mind. Joining live would
-- render a sentence with a hole in it at exactly the moment the sentence is
-- needed. So the two facts a row can outlive are copied onto it: the group's
-- name and the reaction word.
--
-- NOTHING ELSE IS COPIED. No display name (the actor is an id, resolved through
-- `social_profiles` at read time and legitimately nameless when the reader is
-- not related to them), no avatar, no look title, no free text of any kind.
-- `daily_social_reactions.reaction` is a three-valued CHECK domain, not prose,
-- so the one string this table stores about a reaction is a bounded enum
-- wearing a jsonb coat.
--
-- `revoked_at` vs deletion, and when each happens:
--   * The subject is WITHDRAWN but the group still exists (an owner rescinds an
--     invitation, a reactor takes a reaction back) → `revoked_at`. The row stays
--     inert and readable, AC-05 explains the change, and it expires normally.
--     A notice that silently evaporated would leave the reader thinking they
--     had imagined it.
--   * The subject's whole CONTAINER goes (the group is deleted, the account is
--     deleted, the look is deleted) → the FK cascades and the row goes with it.
--     There is nothing left to explain and nobody left to explain it about.
--
-- `circle_id` is a real FK for exactly that cascade, and it is nullable because
-- a reaction event has no group.
-- ---------------------------------------------------------------------------

create table activity_events (
  id            uuid primary key default gen_random_uuid(),
  -- The only column the read policy looks at.
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  event_type    activity_event_type not null,
  -- Who did the thing. Null is legal and not exceptional: `circle.self.left` is
  -- an event about the recipient, and there is no third party in it.
  actor_id      uuid references auth.users (id) on delete set null,
  -- What the event is about, as a loose pair rather than eight nullable FKs.
  -- The FK integrity that matters is `circle_id` (it is what cascades); this
  -- pair is what the client routes on.
  subject_type  text not null check (subject_type in ('circle', 'outfit')),
  subject_id    uuid not null,
  circle_id     uuid references circles (id) on delete cascade,
  -- Bounded, denormalised, and never sent to analytics. See above.
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  -- Written by the recipient on screen open. Feeds the presence dot and
  -- nothing else; visible to nobody but the recipient.
  seen_at       timestamptz,
  -- Soft delete, recipient-only, reversible for five seconds by the undo
  -- toast. The purge below turns it into a hard delete.
  dismissed_at  timestamptz,
  -- The subject went away. Set by the definer triggers, never by a client.
  revoked_at    timestamptz
);

-- The read policy filters on `recipient_id` and `dismissed_at`, and the page
-- orders by `created_at desc`. One partial index serves all three, which is
-- also the only query shape this table has.
create index activity_events_inbox_idx
  on activity_events (recipient_id, created_at desc)
  where dismissed_at is null;
-- The fan-out's own lookups: "the live invitation event for this pair", "the
-- live reaction event for this look". Both are revocation paths, both run
-- inside a domain write, and neither may table-scan an inbox table.
create index activity_events_subject_idx on activity_events (subject_id, event_type);
-- The purge's predicate, and the `on delete cascade` from `circles`.
create index activity_events_created_idx  on activity_events using btree (created_at);
create index activity_events_circle_idx   on activity_events using btree (circle_id);

alter table activity_events enable row level security;

-- ---------------------------------------------------------------------------
-- 3 · Row level security — §6's matrix, one policy per verb
--
--   Recipient   | own live rows | seen_at / dismissed_at on own rows | own rows
--   Anyone else | nothing       | nothing                            | nothing
--   Definer     | fan-out       | revoked_at                         | purge
--
-- There is no `to service_role` insert policy, and the design record's sketch
-- of one is deliberately not transcribed. This project has no server-side
-- writer for this surface: the fan-out is a set of SECURITY DEFINER triggers
-- that run inside the user's own transaction, and a definer bypasses RLS
-- entirely, so the policy would be dead letter. Writing a policy that never
-- evaluates is worse than writing none — it reads as a door somebody is
-- expected to walk through. The enforceable statement is the ABSENCE of an
-- INSERT policy and of an INSERT grant, and that is what
-- 21_activity_center.sql asserts.
-- ---------------------------------------------------------------------------

-- Live rows only. A dismissed row is gone as far as every read is concerned;
-- the undo path below is an UPDATE, which is governed by the next policy and
-- does not need to see the row through this one.
-- Whose rows these are, and NOTHING about dismissal.
--
-- An earlier revision read `... and dismissed_at is null`, which reads as the
-- stronger statement and is the one thing that cannot work. PostgreSQL applies
-- SELECT policies to the NEW row of an UPDATE, so a row may not be updated out
-- of its own visibility: `set dismissed_at = now()` produced
-- "new row violates row-level security policy" and the dismissal was
-- impossible, not merely invisible. Reproduced on a scratch table carrying only
-- these three policies — `set seen_at` succeeded and `set dismissed_at` raised
-- 42501 — so it is the policy shape, not the fixture.
--
-- That also means the undo the design rests on could never have worked: a row
-- the reader cannot select is a row they cannot un-dismiss.
--
-- So the policy states the security boundary, which is `recipient_id`, and
-- nothing else. Dismissal is a UX filter rather than a privacy one — it hides
-- the reader's own row from the reader — and it belongs in the query, where
-- `features/activity-center/queries.ts` now applies it explicitly.
create policy "activity_events: recipient reads own rows" on activity_events
  for select to authenticated
  using ((select auth.uid()) = recipient_id);

-- Whose row this is. `assert_activity_event_update` decides what may change.
-- Split for the same reason `circle_members` splits it: a policy answers
-- "whose", a trigger answers "is that a legal move".
--
-- No `dismissed_at is null` here, and that is the whole undo: the row the
-- reader just removed is unreadable but still writable by them for as long as
-- the toast is up.
create policy "activity_events: recipient updates own rows" on activity_events
  for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

-- Clear All (AC-10) and the hard half of a dismissal. Scoped to self, and there
-- is no other delete path for a client.
create policy "activity_events: recipient deletes own rows" on activity_events
  for delete to authenticated
  using ((select auth.uid()) = recipient_id);

-- ---------------------------------------------------------------------------
-- 4 · What a recipient may actually write
--
-- The UPDATE policy above says "your row". Without this trigger it would also
-- say "any column of your row", and a client could rewrite `event_type`,
-- re-point `actor_id`, forge a `created_at` to sort itself to the top, or clear
-- its own `revoked_at` and put live Accept buttons back on a withdrawn
-- invitation. None of those is a thing an inbox is for.
--
-- Two columns move, and `revoked_at` is not one of them: revocation is a fact
-- about the world, reported by the definer that observed it.
--
-- SECURITY INVOKER, and it must be: the whole point is to constrain the caller,
-- and the definer fan-out below has to be able to write everything this
-- refuses. A definer's writes bypass this table's POLICIES but they still fire
-- this TRIGGER, so it has to recognise them and stand aside.
--
-- IT RECOGNISES THEM BY `current_user`, NOT BY `auth.uid()`, and the difference
-- is worth writing down because the obvious version is wrong. `auth.uid()`
-- reads the JWT claim off the SESSION, and SECURITY DEFINER does not clear it
-- — so inside `fan_out_circle_transition`, running because a real person just
-- declined an invitation, `auth.uid()` is still that person, and a guard keyed
-- on it would refuse the definer's own `revoked_at` write and take the decline
-- down with it. `current_user` IS what SECURITY DEFINER changes: it becomes the
-- function's owner. So the two client roles are named here and everything else
-- — the fan-out, the purge, a migration — passes through.
-- ---------------------------------------------------------------------------

create function assert_activity_event_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- A definer trigger, the purge job, or a migration. None of the three is what
  -- this rule is about, and all three legitimately write the nine columns
  -- below.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id           is distinct from old.id
     or new.recipient_id is distinct from old.recipient_id
     or new.event_type   is distinct from old.event_type
     or new.actor_id     is distinct from old.actor_id
     or new.subject_type is distinct from old.subject_type
     or new.subject_id   is distinct from old.subject_id
     or new.circle_id    is distinct from old.circle_id
     or new.payload      is distinct from old.payload
     or new.created_at   is distinct from old.created_at
     or new.revoked_at   is distinct from old.revoked_at then
    raise exception 'only seen_at and dismissed_at may change'
      using errcode = '42501';
  end if;

  return new;
end; $$;

create trigger activity_events_guard_update
  before update on activity_events
  for each row execute function assert_activity_event_update();
revoke execute on function assert_activity_event_update()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5 · The fan-out writer
--
-- One function, called by every trigger below, so the shape of a row is
-- decided in exactly one place. SECURITY DEFINER because a fan-out writes rows
-- for OTHER people — that is what a fan-out is — and no policy could express
-- "you may write a row addressed to someone else if and only if you just did a
-- thing to them that the database validated". The validation already happened;
-- this is its report.
--
-- IT REFUSES TO ADDRESS A ROW TO ITS OWN ACTOR. `circle.self.left` is the one
-- event where recipient and actor are the same person, and it passes its actor
-- as null for exactly that reason. Everything else that would be self-addressed
-- is a mistake — notifying somebody that they accepted their own invitation —
-- and it is dropped here rather than at seven call sites.
-- ---------------------------------------------------------------------------

create function emit_activity_event(
  p_recipient    uuid,
  p_type         activity_event_type,
  p_actor        uuid,
  p_subject_type text,
  p_subject      uuid,
  p_circle       uuid,
  p_payload      jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;

  insert into public.activity_events
    (recipient_id, event_type, actor_id, subject_type, subject_id, circle_id, payload)
  values
    (p_recipient, p_type, p_actor, p_subject_type, p_subject, p_circle,
     coalesce(p_payload, '{}'::jsonb));
end; $$;

revoke execute on function
  emit_activity_event(uuid, activity_event_type, uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6 · Private groups → the inbox
--
-- Five of the seven live event types come from `circle_members`, and every one
-- of them is a state the transition trigger
-- (`assert_circle_member_transition`) has already ruled legal. This runs AFTER
-- that, so there is no state here that the group itself did not agree to.
--
-- WHO GETS WHAT, and the one place it differs from a naive reading of §5:
--
--   invite received  → the invitee. Actor is the owner who invited them.
--   invite accepted  → the INVITER, and the inviter only.
--   invite declined  → the inviter. §5 marks it "quiet, no CTA"; that is a
--                      presentation fact and the row carries no action either
--                      way.
--   member joined    → every other joined member — EXCEPT the inviter, who is
--                      already getting `circle.invite.accepted` about the same
--                      person in the same second. Two rows for one arrival is
--                      the kind of double-notification that makes people turn a
--                      surface off, and the inviter's row is the more specific
--                      of the two.
--   member left      → every remaining joined member.
--   self left        → the leaver. §5's `circle.self.left`, and the row AC-08
--                      draws as "You left Coffee Club."
--
-- Being REMOVED writes nothing to anyone. The group's own design is explicit
-- that a removed person is told they were removed and never by whom
-- (components/circles/confirm-dialogs.tsx), and the roster deliberately cannot
-- distinguish a departure from an ejection to onlookers. An inbox row
-- announcing an ejection to the rest of the room would undo both promises in
-- one line. The removed person's own pending invitation, if they had one, is
-- revoked below — that is a different fact and it is theirs.
-- ---------------------------------------------------------------------------

create function fan_out_circle_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.state <> 'invited' then
    return null;
  end if;

  select c.name into v_name from public.circles c where c.id = new.circle_id;

  perform public.emit_activity_event(
    new.user_id,
    'circle.invite.received',
    new.invited_by,
    'circle',
    new.circle_id,
    new.circle_id,
    jsonb_build_object('circle_name', v_name)
  );
  return null;
end; $$;

create trigger circle_members_fan_out_invite
  after insert on circle_members
  for each row execute function fan_out_circle_invite();
revoke execute on function fan_out_circle_invite() from public, anon, authenticated;

create function fan_out_circle_transition() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name    text;
  v_payload jsonb;
  v_other   uuid;
begin
  if new.state = old.state then
    return null;
  end if;

  select c.name into v_name from public.circles c where c.id = new.circle_id;
  v_payload := jsonb_build_object('circle_name', v_name);

  -- A fresh invitation on a row that already existed — the owner asking
  -- somebody back. Same event as the INSERT path; the invitee cannot tell, and
  -- should not be able to, whether their row was new.
  if new.state = 'invited' then
    perform public.emit_activity_event(
      new.user_id, 'circle.invite.received', new.invited_by,
      'circle', new.circle_id, new.circle_id, v_payload);

  elsif new.state = 'joined' then
    perform public.emit_activity_event(
      new.invited_by, 'circle.invite.accepted', new.user_id,
      'circle', new.circle_id, new.circle_id, v_payload);

    -- The rest of the room. `invited_by` is excluded because they have the
    -- more specific row above.
    for v_other in
      select m.user_id from public.circle_members m
       where m.circle_id = new.circle_id
         and m.state     = 'joined'
         and m.user_id  <> new.user_id
         and m.user_id  is distinct from new.invited_by
    loop
      perform public.emit_activity_event(
        v_other, 'circle.member.joined', new.user_id,
        'circle', new.circle_id, new.circle_id, v_payload);
    end loop;

  elsif new.state = 'declined' and old.state = 'invited' then
    perform public.emit_activity_event(
      new.invited_by, 'circle.invite.declined', new.user_id,
      'circle', new.circle_id, new.circle_id, v_payload);

  elsif new.state = 'left' then
    -- Your own record of leaving. Actor null: there is no third party in it,
    -- and `emit_activity_event` would drop a row whose actor is its recipient.
    perform public.emit_activity_event(
      new.user_id, 'circle.self.left', null,
      'circle', new.circle_id, new.circle_id, v_payload);

    for v_other in
      select m.user_id from public.circle_members m
       where m.circle_id = new.circle_id
         and m.state     = 'joined'
         and m.user_id  <> new.user_id
    loop
      perform public.emit_activity_event(
        v_other, 'circle.member.left', new.user_id,
        'circle', new.circle_id, new.circle_id, v_payload);
    end loop;
  end if;

  -- REVOCATION. An invitation that is no longer waiting must not keep a live
  -- Accept button anywhere. Two causes, one answer:
  --   * the owner rescinded it (`invited` → `removed`), which is AC-05;
  --   * the invitee answered it, which makes their own notice inert.
  -- Both set `revoked_at` on the invitee's own live invitation rows for this
  -- group. The DETAIL screen additionally re-reads live membership, so a deep
  -- link can never present an answered invitation as answerable even if this
  -- row were somehow missed.
  if old.state = 'invited' and new.state <> 'invited' then
    update public.activity_events
       set revoked_at = now()
     where recipient_id = new.user_id
       and event_type   = 'circle.invite.received'
       and circle_id    = new.circle_id
       and revoked_at  is null;
  end if;

  return null;
end; $$;

create trigger circle_members_fan_out_transition
  after update on circle_members
  for each row execute function fan_out_circle_transition();
revoke execute on function fan_out_circle_transition() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7 · Daily Social → the inbox
--
-- The seventh live type, and the narrowest. `daily_social_reactions` is one row
-- per (outfit, reactor) with a three-valued CHECK domain, so there is exactly
-- one live event per pair and it cannot accumulate into a tally even by
-- accident — which is the same property the reactions table was built for.
--
-- CHANGING YOUR MIND UPDATES THE ROW RATHER THAN ADDING ONE. The event keeps
-- its `created_at`, so it holds its place in a reverse-chronological list and
-- does not jump to the top every time somebody reconsiders; only the word
-- changes. Re-surfacing it as new would make "somebody is fiddling with a
-- reaction" indistinguishable from "somebody reacted", and the second is the
-- only one worth a reader's attention.
--
-- TAKING A REACTION BACK REVOKES, rather than deletes. AC-05 exists so a change
-- makes sense rather than leaving the reader wondering whether they misread
-- something; a silently vanishing notice is the failure mode it was drawn
-- against.
-- ---------------------------------------------------------------------------

create function fan_out_daily_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.emit_activity_event(
    new.owner_id,
    'daily.reaction.received',
    new.reactor_id,
    'outfit',
    new.outfit_id,
    null,
    jsonb_build_object('reaction', new.reaction)
  );
  return null;
end; $$;

create trigger daily_social_reactions_fan_out
  after insert on daily_social_reactions
  for each row execute function fan_out_daily_reaction();
revoke execute on function fan_out_daily_reaction() from public, anon, authenticated;

create function sync_daily_reaction_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.activity_events
       set revoked_at = now()
     where recipient_id = old.owner_id
       and event_type   = 'daily.reaction.received'
       and subject_id   = old.outfit_id
       and actor_id     = old.reactor_id
       and revoked_at  is null;
    return null;
  end if;

  if new.reaction is distinct from old.reaction then
    update public.activity_events
       set payload = jsonb_build_object('reaction', new.reaction)
     where recipient_id = new.owner_id
       and event_type   = 'daily.reaction.received'
       and subject_id   = new.outfit_id
       and actor_id     = new.reactor_id
       and revoked_at  is null;
  end if;
  return null;
end; $$;

create trigger daily_social_reactions_sync_event
  after update or delete on daily_social_reactions
  for each row execute function sync_daily_reaction_event();
revoke execute on function sync_daily_reaction_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8 · The dot — a boolean, and the only thing anywhere that reads the inbox in
--     aggregate
--
-- `ActivityEntryButton` renders one 9px dot when this is true. It is a function
-- rather than a client-side `count > 0` for one reason that matters: a client
-- that can count has a number in hand, and a number in hand eventually gets
-- rendered. `exists` returns a boolean and cannot be decomposed into one.
--
-- STABLE, not IMMUTABLE, and deliberately not cached anywhere: it has to be
-- true on a screen the reader is not looking at.
-- ---------------------------------------------------------------------------

create function activity_has_unseen() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.activity_events
     where recipient_id = (select auth.uid())
       and dismissed_at is null
       and seen_at      is null
  );
$$;

revoke execute on function activity_has_unseen() from public, anon, authenticated;
grant  execute on function activity_has_unseen() to authenticated;

-- SECURITY INVOKER above is the point, not an oversight: the function reads
-- through the caller's own SELECT policy, so it cannot answer about anybody
-- else's inbox even if it were called with a forged argument — and it takes no
-- argument, so there is nothing to forge.

-- ---------------------------------------------------------------------------
-- 9 · Retention — thirty days, and the dismissal grace
--
-- §7: rows auto-expire 30 days after `created_at`, and a dismissal is
-- reversible for five seconds and then hard-deleted. The purge does both, and
-- the dismissal grace is a generous minute rather than five seconds so a
-- backgrounded app that comes back mid-toast still finds the row.
--
-- The number is here and nowhere else. `features/activity-center/retention.ts`
-- states the same 30 to the reader and cites this line; there is no client
-- filter that could disagree with it, because the client never asks for a
-- window at all.
-- ---------------------------------------------------------------------------

create function purge_activity_events() returns void
language sql security definer set search_path = '' as $$
  delete from public.activity_events
   where created_at < now() - interval '30 days'
      or (dismissed_at is not null and dismissed_at < now() - interval '1 minute');
$$;

comment on function purge_activity_events() is
  'Deletes activity older than 30 days, and dismissed rows past their undo '
  'window. See design-refs/ACTIVITY-CENTER-IMPLEMENTATION.md §7.';

revoke execute on function purge_activity_events() from public, anon, authenticated;
grant  execute on function purge_activity_events() to postgres;

create extension if not exists pg_cron;

-- Re-runnable, matching 20260810140300: `cron.schedule` raises on a replay, and
-- these migrations have to survive being applied to a fresh branch.
do $$
begin
  if exists (select 1 from cron.job j where j.jobname = 'cinch-purge-activity') then
    perform cron.unschedule('cinch-purge-activity');
  end if;
end;
$$;

-- Every ten minutes rather than nightly. The 30-day half would be happy with
-- nightly; the dismissal half is what sets the cadence, because a hard delete
-- that waits until 3am leaves a soft-deleted row lying around all day for a
-- reader who asked for it to be gone.
select cron.schedule('cinch-purge-activity', '*/10 * * * *',
                     $sql$select public.purge_activity_events();$sql$);

-- ---------------------------------------------------------------------------
-- 10 · Grants. Explicit, and never to anon — 20260806100000.
--
-- NO INSERT. Not to `authenticated`, not to `anon`, not to anybody. The fan-out
-- is definer-only and a client-authored event is the one thing this table must
-- refuse; the absence of this verb is the enforcement, and
-- 21_activity_center.sql asserts it as a catalogue fact rather than trusting
-- the comment.
-- ---------------------------------------------------------------------------

revoke all on activity_events from public, anon;
grant select, update, delete on activity_events to authenticated;
