-- ===========================================================================
-- Private Circles — membership, and nothing else.
--
-- WHAT A CUSTOMER SEES is a **group**, or a **private group**: a named,
-- invite-only room of at most twelve mutual friends. `circle` survives here as
-- the identifier only, and the split is deliberate rather than sloppy.
-- "Private Circles" is the internal programme label, so the schema follows the
-- internal label; and `group` is a RESERVED word in Postgres (verified with
-- `pg_get_keywords()`: `group` reserved, `groups` non-reserved), so a bare
-- `group` column, alias or CTE — exactly the identifier a tired hand writes —
-- breaks unquoted. `circles` / `circle_members` / `is_circle_member` sidestep
-- the whole neighbourhood. One testable invariant: identifiers say circle,
-- strings say group. Nothing in this file is a string a customer reads.
--
-- The existing friend-graph copy — "your circle", meaning your mutual friends —
-- is untouched by this packet and stays exactly as it is.
--
-- WHAT THIS IS MODELLED ON. `event_members` (20260807101000), almost line for
-- line: a composite-key membership table, a role enum, a state enum, an
-- `invited_by`, and a before-update trigger that is the only thing permitted to
-- move a state. The invite-link system is deliberately NOT the model — it is
-- account-level and codeless (20260810120100_invite_links.sql:1-14, "the handle
-- is the link"), has no state and no revocation, and cannot express "invited to
-- a thing". Per-group invite codes are the row nobody asked for.
--
-- THE FOUR PLACES THIS DEPARTS FROM THE EVENTS PRECEDENT, each because the
-- design record says so and each argued at the point it happens below:
--
--   1. THE ROSTER IS HIDDEN UNTIL YOU JOIN. `event_members`' select policy is
--      `can_see_event`, which shows an invitee the whole participant list. The
--      group promises the opposite — "You will see who else is in it after you
--      accept. Nothing of yours is shared until then." — so a membership row is
--      readable by its own subject always, and by anyone else only when the
--      caller is `joined`.
--   2. FIVE STATES, NOT FOUR. Events have no `left`, because nobody leaves an
--      event — they decline it. A group is durable and people leave it, and
--      `removed` reads as ejection to everyone looking at the roster. Someone
--      who walked out must not appear to have been thrown out.
--   3. MUTUAL FRIENDS ONLY, checked once. `is_friend` at invitation, never
--      re-checked on read: re-checking would make an unfollow a second,
--      invisible exit that nobody was told about.
--   4. NO DELETE ON `circle_members`. Events let a member delete their row.
--      Here `left` IS the record of leaving, and a delete verb would erase the
--      distinction (2) exists to draw. The membership row dies with the group,
--      or with the account, and not otherwise.
--
-- WHAT IS DELIBERATELY ABSENT. No visibility enum: `events` needs one because
-- it has two kinds, a private group has exactly one, and a single-valued enum
-- is a public mode nobody approved. No floor of two: a group necessarily begins
-- with one member, so a minimum would make creation impossible and, enforced on
-- departure, would trap the second-to-last person in a room they want to leave.
-- Two is a liveness property the client draws, not an invariant. No
-- group-scoped content table and no `activity_feed` kind — what flows through a
-- group, and how a group announces itself, are the Saves and Activity design
-- spaces and this packet must not spend them.
--
-- Ground rules restated from 20260807100000 §0, all held below: no `to anon`
-- anywhere, every client grant an explicit line at the bottom, EXECUTE revokes
-- targeting `public, anon, authenticated` before the deliberate grant,
-- `(select auth.uid())`, per-command policies, and a btree index on every
-- policy-filtered column.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · The two tables
-- ---------------------------------------------------------------------------

create type circle_member_role  as enum ('owner', 'member');

-- Five values, and `left` is the whole reason this is not `event_member_state`.
-- See departure (2) above.
create type circle_member_state as enum
  ('invited', 'joined', 'declined', 'removed', 'left');

create table circles (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- Shorter than an event title (80) on purpose: this renders as a list-row
  -- heading that must survive AX-XXXL without truncating, and the names the
  -- atlas draws are of the "Sunday tennis" kind, not sentences.
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index circles_owner_idx on circles using btree (owner_id);
alter table circles enable row level security;
create trigger circles_set_updated_at
  before update on circles for each row execute function set_updated_at();

create table circle_members (
  circle_id   uuid not null references circles (id)    on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        circle_member_role  not null default 'member',
  state       circle_member_state not null default 'invited',
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (circle_id, user_id)
);
-- The primary key's leading column covers every circle-scoped lookup below
-- (the predicates, the seat count, the roster). These three cover the rest:
-- `user_id` for "every group I am in" and for the block cascade, the partial
-- index for the joined-only roster read, and `invited_by` for the invite rate
-- limit's counting query.
create index circle_members_user_idx       on circle_members using btree (user_id);
create index circle_members_joined_idx
  on circle_members (circle_id) where state = 'joined';
create index circle_members_invited_by_idx on circle_members using btree (invited_by);
alter table circle_members enable row level security;
create trigger circle_members_set_updated_at
  before update on circle_members for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2 · The membership predicates
--
-- SECURITY DEFINER is REQUIRED here, not stylistic. `circle_members`' own
-- select policy references circle membership; evaluated as the caller it would
-- re-enter that policy forever. 20260807101000:64-66 says the same thing about
-- events in as many words. `set search_path = ''` so a definer function can
-- never be pointed at a shadowing schema.
-- ---------------------------------------------------------------------------

-- "Member" means `joined`, and only `joined`. An invitation is not membership.
create function is_circle_member(p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members
                  where circle_id = p_circle
                    and user_id   = (select auth.uid())
                    and state     = 'joined');
$$;

create function is_circle_owner(p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circles
                  where id = p_circle and owner_id = (select auth.uid()));
$$;

-- Who may see the GROUP — which is a wider set than who may see its roster,
-- and the gap between the two is the atlas's promise.
--
-- `invited` is included because an invitation you cannot see is not one: the
-- invitee has to read the group's name and who asked them. `declined` is
-- included because declining is not final — the matrix requires decline-then-
-- accept to work, so the invitation must stay reachable after it is turned
-- down. `removed` and `left` are excluded: both are exits, and an exit that
-- still shows you the room is not an exit.
create function can_see_circle(p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_circle_owner(p_circle)
      or exists (select 1 from public.circle_members
                  where circle_id = p_circle
                    and user_id   = (select auth.uid())
                    and state in ('invited', 'joined', 'declined'));
$$;

-- Policy expressions evaluate with the CALLER's privileges, so `authenticated`
-- needs EXECUTE. Default function privileges (20260805220000) already leave
-- these born uncallable; the revokes are belt-and-braces, the grants are the
-- deliberate lines.
revoke execute on function is_circle_member(uuid) from public, anon, authenticated;
revoke execute on function is_circle_owner(uuid)  from public, anon, authenticated;
revoke execute on function can_see_circle(uuid)   from public, anon, authenticated;
grant  execute on function is_circle_member(uuid) to authenticated;
grant  execute on function is_circle_owner(uuid)  to authenticated;
grant  execute on function can_see_circle(uuid)   to authenticated;

-- ---------------------------------------------------------------------------
-- 2a · How many, told to somebody who may not know who
--
-- PC-04 renders "4 members · private" directly above "You will see who else is
-- in it after you accept." Both are right, and the roster policy below cannot
-- serve the first: an invitee is not `joined`, so they read exactly their own
-- row and there is nothing for a client to count. The frame is unbuildable
-- without this function.
--
-- A COUNT IS NOT A ROSTER. It discloses how many and never who, which is
-- exactly the line PC-04 draws, and it is the same instrument
-- `friends_sharing_worn_outfits_count` (20260817000000:205) used for the same
-- shape of problem: deliberately NOT a view, because a view is joinable back to
-- the membership table and names people, while a scalar cannot be decomposed.
--
-- `joined` ONLY. Counting invitations would tell an invitee that three other
-- people are "in" a group none of them has agreed to join yet — disclosing the
-- existence of pending invitations to somebody outside the roster, which is a
-- smaller version of the leak the roster policy exists to prevent.
--
-- Gated on `can_see_circle`, and RETURNS 0 rather than null when the gate
-- fails. Both are safe against probing — the important property is that a
-- circle the caller may not see returns exactly what a circle id that was never
-- created returns, so this is not an existence oracle — and 0 is the better of
-- the two because it is UNREACHABLE through the visible path: a group always
-- has at least its owner joined (`handle_new_circle` puts them there, the
-- transition trigger refuses to let them leave, and no one else can touch their
-- row). So a client that receives 0 knows it means "not for you" and can never
-- confuse it with an empty group, and it has no null to thread through.
--
-- No equivalent is needed for PC-07's "Invitations · 2 waiting". The owner is
-- `joined` from birth and cannot leave or be removed, so `is_circle_member` is
-- permanently true for their own group and the roster policy already hands them
-- every row in every state. That count is a client-side filter over data they
-- already hold. Asserted rather than assumed, in 19_private_circles.sql.
-- ---------------------------------------------------------------------------

create function circle_member_count(p_circle uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case
           when public.can_see_circle(p_circle)
           then (select count(*)::integer from public.circle_members
                  where circle_id = p_circle and state = 'joined')
           else 0
         end;
$$;
-- Unlike `circle_seats_taken`, this one is called by the client, so the grant
-- is the point rather than belt-and-braces.
revoke execute on function circle_member_count(uuid) from public, anon, authenticated;
grant  execute on function circle_member_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 · The owner is a member from birth
--
-- Left to the client this is a group that can exist with nobody in it, and
-- every predicate above then has to special-case the owner — `is_circle_member`
-- would have to mean "joined, OR the owner", which is two rules where one will
-- do. Same reasoning, same shape, as `handle_new_event`.
--
-- SECURITY DEFINER: this insert would fail its own RLS policy (which admits
-- only `invited`/`member` rows written by the owner), and correctly so — the
-- owner row is not a thing anyone is allowed to write by hand.
-- ---------------------------------------------------------------------------

create function handle_new_circle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.circle_members (circle_id, user_id, role, state, invited_by)
  values (new.id, new.owner_id, 'owner', 'joined', new.owner_id)
  on conflict (circle_id, user_id) do nothing;
  return new;
end; $$;
create trigger on_circle_created after insert on circles
  for each row execute function handle_new_circle();
revoke execute on function handle_new_circle() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4 · The seat cap
--
-- Twelve, and it counts `invited` TOGETHER WITH `joined`.
--
-- Counting only `joined` would let an owner hold any number of outstanding
-- invitations against twelve seats, and the failure would then land on the
-- twelfth person to tap Accept — a race whose loser cannot understand it, could
-- not have avoided it, and is told about it at the worst possible moment. Count
-- both and refuse at the invitation, where the owner can see the cause and the
-- copy can name it ("Group is full").
--
-- The owner occupies one of the twelve. `handle_new_circle` above is what makes
-- that true from the first instant, so the eleventh invitation is the last one
-- that fits — not the twelfth. (Preparation §5 cases 14-15 count invitations as
-- if the owner sat outside the cap; the atlas is explicit that "a group holds
-- twelve people", so the people are what is counted.)
--
-- `removed`, `declined` and `left` rows do not consume a seat, which is what
-- makes a group recoverable after a mistake without deleting any history.
--
-- AND THE SEAT CHECK GUARDS THE UPDATE PATH TOO, not only the insert. A row
-- can arrive at a seat two ways: an invitation (INSERT), or a state change into
-- `invited`/`joined` from a state that held no seat (UPDATE). Guarding only the
-- first leaves two ways past twelve — the owner re-inviting somebody who was
-- removed, and, subtler, an invitee who DECLINED and then accepts after the
-- owner has refilled their seat. The second is reachable with nothing but the
-- transitions this schema shipped with, so the cap was never actually an
-- invariant until this trigger covered both verbs.
--
-- The count lives in ONE function with two callers rather than the same query
-- written twice, because a cap enforced by two copies of a predicate is a cap
-- that eventually disagrees with itself. It takes the row being changed as an
-- exclusion: on INSERT that row does not exist yet and the exclusion is inert,
-- on UPDATE it is what stops a row being counted against its own move.
--
-- SECURITY DEFINER because the count must be the truth about the group, not
-- the truth as filtered by whoever happens to be writing.
--
-- TWO LIMITS OF A COUNTING TRIGGER, stated rather than left to be discovered.
-- A row-level BEFORE trigger cannot see the other rows of its own multi-row
-- INSERT, and two concurrent transactions can each count eleven and each
-- insert. Neither is reachable from the client, which invites one person at a
-- time, and both are exactly the limits `enforce_event_limit` and
-- `enforce_social_rate_limits` have carried since they shipped — so this uses
-- the same instrument rather than introducing an advisory lock that the other
-- two would then be missing.
-- ---------------------------------------------------------------------------

create function circle_seats_taken(p_circle uuid, p_except_user uuid)
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.circle_members
   where circle_id = p_circle
     and state in ('invited', 'joined')
     and (p_except_user is null or user_id <> p_except_user);
$$;
-- Not granted to `authenticated`: no policy calls this, only the definer
-- trigger below does, and it already holds the owner's rights.
revoke execute on function circle_seats_taken(uuid, uuid)
  from public, anon, authenticated;

create function enforce_circle_size() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  -- On UPDATE, only a row ENTERING a seat is counted. An accept
  -- (`invited` -> `joined`) already held its seat and must not be re-checked,
  -- or the twelfth person to accept would be refused a seat they were given at
  -- the invitation — which is the exact race counting invitations exists to
  -- prevent. A departure holds no seat and needs no check either.
  --
  -- Nested rather than one `tg_op = 'UPDATE' and ...` condition on purpose:
  -- SQL's AND is not required to short-circuit, and `old` is an unassigned
  -- record on INSERT, where reading a field of it is an error rather than a
  -- null.
  if tg_op = 'UPDATE' then
    if not (new.state in ('invited', 'joined')
            and old.state not in ('invited', 'joined')) then
      return new;
    end if;
  end if;

  v_count := public.circle_seats_taken(new.circle_id, new.user_id);
  if v_count >= 12 then
    raise exception 'circle_full: % of 12 seats taken', v_count
      using errcode = 'check_violation',
            hint    = 'This group is full.';
  end if;
  return new;
end; $$;
create trigger circle_members_enforce_size
  before insert or update on circle_members
  for each row execute function enforce_circle_size();
revoke execute on function enforce_circle_size() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5 · Row level security
-- ---------------------------------------------------------------------------

-- `circles`. An invitee must be able to read the group they were invited to —
-- its name, and through the roster policy below, their own invitation row
-- naming who sent it. Everyone else sees nothing: groups are invite-only,
-- nobody can search for one, and no one outside sees that it exists.
create policy "circles: visible to members and invitees" on circles
  for select to authenticated using (public.can_see_circle(id));
create policy "circles: owner can insert" on circles
  for insert to authenticated with check ((select auth.uid()) = owner_id);
-- Rename only, in practice. `with check` on `owner_id` means an owner cannot
-- hand the group to somebody else by writing their id here; transfer is a
-- lifecycle question the design record leaves open, and an UPDATE policy is not
-- the place to answer it by accident.
create policy "circles: owner can update" on circles
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "circles: owner can delete" on circles
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- `circle_members`. THE ROSTER IS HIDDEN UNTIL YOU JOIN — departure (1).
--
-- Two terms and no third. Your own row, always: an invitee who cannot see their
-- own invitation has not been invited, and someone who was removed is entitled
-- to the row that says so. Everyone else's rows, only if you are `joined`.
--
-- Note what is NOT here: `can_see_circle`. That is the events policy, and using
-- it would hand an invitee the entire member list before they had agreed to
-- anything — the exact opposite of what the invitation says. The owner needs no
-- special case because `handle_new_circle` makes them `joined` from birth.
create policy "circle_members: roster visible once joined" on circle_members
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_circle_member(circle_id));

-- One insert path, unlike events, because there is no self-join door: a private
-- group has no visibility under which a stranger may add themselves. Only the
-- owner invites, only ever to `invited`/`member`, only ever attributed to
-- themselves.
--
-- `is_friend` already excludes a blocked pair (20260807100000:106), so
-- `blocked_between` here is redundant — and stated anyway, because the rule
-- "you cannot invite someone you have blocked, or who has blocked you" should
-- be legible in the policy that enforces it rather than inferred two files
-- away. `event_members` states it the same way for the same reason.
--
-- Mutual friendship is checked HERE AND NOWHERE ELSE. No read path re-tests it:
-- if it did, an unfollow would silently eject someone from a group, which is a
-- second exit that nobody performs, nobody is told about, and nobody can undo.
create policy "circle_members: owner invites a mutual friend" on circle_members
  for insert to authenticated
  with check (
    public.is_circle_owner(circle_id)
    and state      = 'invited'
    and role       = 'member'
    and invited_by = (select auth.uid())
    and user_id   <> (select auth.uid())
    and not public.blocked_between((select auth.uid()), user_id)
    and public.is_friend(user_id)
  );

-- Who may touch a row at all; `assert_circle_member_transition` below decides
-- what they may do to it. Split this way for the same reason
-- `borrow_requests` splits it: a policy answers "whose row is this", a trigger
-- answers "is that a legal move", and neither can express the other cleanly.
create policy "circle_members: self or owner can update" on circle_members
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_circle_owner(circle_id))
  with check ((select auth.uid()) = user_id or public.is_circle_owner(circle_id));

-- NO DELETE POLICY, and no DELETE grant at the foot of this file — departure
-- (4). Leaving is `left`; being removed is `removed`; both are records, and a
-- row a member could delete is a record that evaporates the moment it becomes
-- inconvenient. Rows go when the group goes (cascade) or when the account goes
-- (cascade to auth.users), and `delete-account` enumerates no tables on purpose
-- so this one was covered the day it was created.

-- ---------------------------------------------------------------------------
-- 6 · The state machine
--
--   self : invited|declined       -> joined|declined  (accept, decline, redecide)
--          joined                 -> left             (walk out)
--   owner: anything               -> removed          (eject)
--          removed|left|declined  -> invited          (ask again)
--
-- The owner may NOT flip somebody to `joined`. Being in a group is a thing you
-- agree to, and an owner who could write `joined` on your behalf could put you
-- in a room you never entered. The owner may not write `left` on your behalf
-- either: `left` is the record of a choice, and an ejection dressed as a
-- departure is a lie told to everyone reading the roster.
--
-- BUT THE OWNER MAY ASK AGAIN, and this is what makes the model reversible
-- rather than merely undoable-looking. Without it the primary key is a trap: a
-- re-invitation cannot INSERT over an existing row, so one mis-tapped Remove
-- would exclude somebody from a twelve-seat group permanently, with no path
-- back for either party. The brief asks for roles that are "obvious and
-- reversible", and PC-04 says so for the decline case in as many words — "You
-- can be invited again later." An asking-again is an invitation, so it lands in
-- `invited` and the invitee still has to accept it; nothing here writes
-- `joined` for anybody.
--
-- A re-invitation re-checks eligibility exactly as the INSERT policy does,
-- because time has passed since the first one. A block severs the follow edges
-- permanently, so somebody blocked and later unblocked is no longer a mutual
-- friend and must not be re-invitable without a fresh friendship — which is
-- also what keeps PC-10's "No longer a mutual friend" an honest thing to say.
-- The seat is re-checked by `enforce_circle_size`, which now covers UPDATE.
--
-- `created_at` and `invited_by` are deliberately left as they were: the row
-- keeps the moment it first existed, and `invited_by` can only ever have been
-- the owner, who is the same person asking again.
--
-- The invite rate limit does NOT cover this path, and that is a bounded gap
-- rather than an oversight: it counts `created_at` on INSERT, and an asking-
-- again is an UPDATE of a row that already exists. The fan-out it protects
-- against is not reachable here — a re-invitation can only ever target the
-- eleven-or-fewer people already in this one group's row set, each of whom the
-- owner is still a mutual friend of.
--
-- The owner cannot leave their own group. The design record leaves owner
-- departure unresolved and names the conservative default — the owner deletes
-- the group or it dissolves — so this refuses the move rather than inventing a
-- transfer or leaving behind a group whose owner is not in it. When the
-- departure design arrives it changes this one branch.
--
-- SECURITY INVOKER: the whole trigger turns on `auth.uid()` being the caller.
-- ---------------------------------------------------------------------------

create function assert_circle_member_transition() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.circle_id <> old.circle_id or new.user_id <> old.user_id
     or new.role <> old.role then
    raise exception 'only state may change' using errcode = '42501';
  end if;

  if (select auth.uid()) = old.user_id then
    -- Self.
    if old.role = 'owner' and new.state = 'left' then
      raise exception 'the owner cannot leave their own group'
        using errcode = '22023';
    end if;
    if not (old.state in ('invited','declined') and new.state in ('joined','declined'))
       and not (old.state = 'joined' and new.state = 'left')
       and new.state is distinct from old.state then
      raise exception 'invalid transition' using errcode = '22023';
    end if;
  else
    -- Owner path; the policy already guaranteed the caller owns the group.
    if new.state = 'removed' then
      null;                                  -- eject, or re-affirm an ejection
    elsif new.state = 'invited'
          and old.state in ('removed', 'left', 'declined') then
      -- Ask again. Same eligibility as a first invitation, re-tested now
      -- rather than trusted from whenever the row was first written. 42501 so
      -- the client maps it to the same sentence the INSERT path produces.
      if public.blocked_between((select auth.uid()), old.user_id)
         or not public.is_friend(old.user_id) then
        raise exception 'you can only invite a mutual friend'
          using errcode = '42501';
      end if;
    else
      raise exception 'the owner may only remove or re-invite'
        using errcode = '22023';
    end if;
  end if;

  return new;
end; $$;
create trigger circle_members_valid_transition
  before update on circle_members
  for each row execute function assert_circle_member_transition();
revoke execute on function assert_circle_member_transition()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7 · The gates the rest of the social surface already carries
--
-- Terms (20260808101000) and the invite rate limit (20260807103000) are not
-- new mechanisms here; they are the two existing ones pointed at a third
-- surface. Both are INSERT-only, and both are no-ops for any role other than
-- `authenticated`, which is why the owner row written by `handle_new_circle`
-- passes straight through them.
--
-- `circles` is gated as well as `circle_members`, and that is load-bearing
-- rather than tidy: `handle_new_circle` writes a membership row as a definer,
-- so gating only the membership table would leave `create a group` as an
-- unguarded way to acquire one. The terms gate's own rule is "everything that
-- creates content or joins someone to a shared space", and a private group is
-- a shared space.
--
-- The rate limit reuses the existing 100-invitations-per-day-per-inviter rather
-- than introducing a second number to keep in sync with the first.
-- ---------------------------------------------------------------------------

create trigger circles_require_terms
  before insert on circles
  for each row execute function assert_social_terms();

create trigger circle_members_require_terms
  before insert on circle_members
  for each row execute function assert_social_terms();

create or replace function enforce_social_rate_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if tg_table_name = 'event_comments' then
    select count(*) into v_count from public.event_comments
     where user_id = new.user_id and created_at > now() - interval '1 hour';
    if v_count >= 30 then
      raise exception 'rate_limited: comments' using errcode = '54000',
        hint = 'You are commenting very fast. Take a breath.';
    end if;
  elsif tg_table_name = 'event_members' then
    select count(*) into v_count from public.event_members
     where invited_by = new.invited_by and created_at > now() - interval '1 day';
    if v_count >= 100 then
      raise exception 'rate_limited: invites' using errcode = '54000';
    end if;
  -- New branch, same number as the events one above. An invitation is an
  -- invitation whichever room it points at, so the abuse ceiling is the same
  -- ceiling and there is exactly one of it.
  elsif tg_table_name = 'circle_members' then
    select count(*) into v_count from public.circle_members
     where invited_by = new.invited_by and created_at > now() - interval '1 day';
    if v_count >= 100 then
      raise exception 'rate_limited: invites' using errcode = '54000';
    end if;
  elsif tg_table_name = 'follows' then
    select count(*) into v_count from public.follows
     where follower_id = new.follower_id and created_at > now() - interval '1 day';
    if v_count >= 100 then
      raise exception 'rate_limited: follows' using errcode = '54000';
    end if;
  elsif tg_table_name = 'content_reports' then
    select count(*) into v_count from public.content_reports
     where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
    if v_count >= 20 then
      raise exception 'rate_limited: reports' using errcode = '54000';
    end if;
  elsif tg_table_name = 'borrow_requests' then
    select count(*) into v_count from public.borrow_requests
     where requester_id = new.requester_id and created_at > now() - interval '1 day';
    if v_count >= 20 then
      raise exception 'rate_limited: borrow requests' using errcode = '54000';
    end if;
  end if;
  return new;
end; $$;
-- Restated because the body moved: the grant surface of a SECURITY DEFINER
-- function is worth re-reading in the file that last touched it.
revoke execute on function enforce_social_rate_limits()
  from public, anon, authenticated;

create trigger circle_members_rate_limit
  before insert on circle_members
  for each row execute function enforce_social_rate_limits();

-- A group name is free text a client writes and up to eleven other people
-- read, which is precisely the surface `assert_clean_ugc` exists for. Same
-- trigger function, same shape as `events_clean_text`; adding a surface is a
-- CREATE TRIGGER and nothing else.
create trigger circles_clean_text
  before insert or update on circles
  for each row execute function assert_clean_ugc('name');

-- ---------------------------------------------------------------------------
-- 8 · The block cascade grows by one statement
--
-- `on_block_sever_graph` (20260809160000:48) already deletes both follow edges,
-- deletes the blocked account's votes on the blocker's own looks, and sets
-- `event_members.state = 'removed'` for events the blocker HOSTS. Groups the
-- blocker OWNS are the same case, and get the same treatment.
--
-- SCOPED TO THE BLOCKER'S OWN SPACES, matching the events precedent exactly.
-- This deliberately does NOT separate the pair inside a third party's group.
-- An event has one host; a shared group can have a third owner, and ejecting
-- somebody from a room a stranger runs is a promise nobody has made — the atlas
-- draws no such state and the preparation names it explicitly unresolved. It
-- also does not remove the blocker from groups the blocked person owns: the
-- copy promises one direction, and this file's ancestor was written to correct
-- copy that claimed more than the trigger did.
--
-- Guarded on the current state so a block-unblock-block cycle cannot churn
-- `updated_at` on rows that already say `removed`, and so a declined invitation
-- is not silently rewritten into an ejection.
--
-- No backfill, unlike 20260809160000. That migration had to reach back over
-- blocks made before its rule existed; `circles` is created in this file, so
-- there is no row anywhere for a pre-existing block to have missed.
-- ---------------------------------------------------------------------------

create or replace function on_block_sever_graph() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. The follow edge, both directions. Unchanged from 20260807100000, and
  -- permanent: unblocking does not put these back.
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);

  -- 2. Their votes on the blocker's own looks. Unchanged from 20260809160000.
  delete from public.event_outfit_votes v
   using public.event_outfit_posts p
   where v.post_id = p.id
     and p.user_id = new.blocker_id
     and v.voter_id = new.blocked_id;

  -- 3. Their membership of every event the blocker hosts. Unchanged.
  update public.event_members m
     set state = 'removed', updated_at = now()
    from public.events e
   where m.event_id = e.id
     and e.host_id = new.blocker_id
     and m.user_id = new.blocked_id
     and m.state in ('invited', 'joined');

  -- 4. Their membership of every private group the blocker owns. NEW.
  --
  -- `removed` rather than `left`: this is not their choice, and the roster must
  -- not say it was. It is also why the group's copy never needs a "blocked"
  -- state — the block severs the follow edges at step 1, so the pair simply
  -- stop being mutual friends, and an ineligible row can say "No longer a
  -- mutual friend" without disclosing that a block exists.
  update public.circle_members m
     set state = 'removed', updated_at = now()
    from public.circles c
   where m.circle_id = c.id
     and c.owner_id = new.blocker_id
     and m.user_id  = new.blocked_id
     and m.state in ('invited', 'joined');

  return new;
end; $$;

revoke execute on function on_block_sever_graph() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9 · Grants. Explicit, and never to anon — 20260806100000.
--
-- No DELETE on `circle_members`: departure (4). The verb list per table is
-- derived from the policies above, and the two must agree or a policy is dead
-- letter.
-- ---------------------------------------------------------------------------

revoke all on circles, circle_members from public, anon;
grant select, insert, update, delete on circles        to authenticated;
grant select, insert, update         on circle_members to authenticated;
