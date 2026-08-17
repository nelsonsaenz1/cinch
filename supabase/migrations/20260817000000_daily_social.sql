-- ===========================================================================
-- Daily Social — the friend-worn read path, and the boundary that makes it
-- non-retroactive.
--
-- WHY THIS EXISTS AT ALL
--
-- Before this migration there was no way for one person to see what another
-- wore. `outfits` is owner-only select; its one non-owner policy requires
-- `is_public`, which defaults false and which nothing in `src/` ever writes.
-- No view exposed a friend's outfit — `friend_items` is items-only,
-- `event_post_items` is event-scoped. The unit's whole premise needed a path
-- that did not exist, so this is that path, built as narrow as it can be.
--
-- THE BOUNDARY IS THE POINT
--
-- A boolean plus a seven-day window would expose up to a week of ALREADY-WORN
-- looks the instant sharing is switched on. That is the opposite of what the
-- control promises, and no client test would catch it because the client would
-- be faithfully rendering a view that was already answering wrongly. So the
-- control and the boundary are ONE column: `worn_outfits_shared_since` is null
-- when off and holds the instant sharing began when on, and the view demands
-- `worn_at >= that instant` as well as the seven-day window.
--
-- One column rather than a boolean beside a timestamp, because two columns can
-- disagree and the disagreeing state — true beside null — is the one that fails
-- open.
--
-- AND THE CLIENT DOES NOT GET TO PICK THE INSTANT. `profiles: owner can update`
-- (20260803154431_initial_schema.sql:60) is a plain RLS policy, so an owner can
-- write any value into their own row, including a timestamp dated 2020, which
-- would expose their whole history. A before-update trigger overrides whatever
-- arrives: the client expresses on or off, the database decides when.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · The control, which is also the boundary
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists worn_outfits_shared_since timestamptz;

comment on column profiles.worn_outfits_shared_since is
  'Null means worn outfits are not shared. Non-null means shared since exactly '
  'this instant, and only looks worn at or after it ever cross. Set by '
  'profiles_worn_outfits_boundary, never by the client.';

-- ---------------------------------------------------------------------------
-- 2 · The trigger. The client says on or off; this decides when.
-- ---------------------------------------------------------------------------

create or replace function enforce_worn_outfits_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Off -> on. The instant is NOW, whatever the client sent. A backdated value
  -- is the attack this exists to refuse, and an accurate one is redundant.
  if old.worn_outfits_shared_since is null
     and new.worn_outfits_shared_since is not null then
    new.worn_outfits_shared_since := now();

  -- On -> on. Left exactly as it was, deliberately NOT advanced: advancing on
  -- an unrelated profile write would retract looks friends can already see,
  -- which is a surprise in the other direction.
  elsif old.worn_outfits_shared_since is not null
        and new.worn_outfits_shared_since is not null then
    new.worn_outfits_shared_since := old.worn_outfits_shared_since;
  end if;

  -- On -> off falls through: null is null, and everything stops crossing at
  -- the next read. Turning it on again re-enters the first branch and starts a
  -- fresh boundary, so the gap is never backfilled.
  return new;
end;
$$;

create trigger profiles_worn_outfits_boundary
  before update on profiles
  for each row execute function enforce_worn_outfits_boundary();

-- ---------------------------------------------------------------------------
-- 3 · The read path
--
-- Four columns, and the omissions are the design: no `reasoning` (model prose
-- about the owner's day), no `context_snapshot` (weather, location, event
-- titles), no `note` (500 characters of private diary), no `rating`,
-- `wear_rating` or `favorited_at` (private taste, shipped deliberately
-- private), no `saved_at`, `board_id` or `origin_outfit_id`.
-- ---------------------------------------------------------------------------

create view friend_worn_outfits
with (security_invoker = false) as
  select o.id,
         o.user_id,
         o.name,
         o.worn_at
    from outfits o
    join profiles p on p.user_id = o.user_id
   where o.worn_at is not null
     and p.worn_outfits_shared_since is not null       -- opted in
     and o.worn_at >= p.worn_outfits_shared_since      -- and never before that
     and o.worn_at > now() - interval '7 days'         -- and not older than a week
     and not p.closet_hidden                           -- a hidden closet hides its looks
     and is_friend(o.user_id);                         -- mutual, not blocked, not self

-- The pieces. Routed through `friend_items`, so this adds NO new item exposure:
-- a garment the owner has hidden, archived, or that belongs to a hidden closet
-- is already absent there and is therefore absent here. A shared look can
-- legitimately render with fewer pieces than were worn, and nothing anywhere
-- says how many are missing — a count would be the inference the design
-- forbids.
create view friend_worn_outfit_items
with (security_invoker = false) as
  select oi.outfit_id,
         oi.item_id
    from outfit_items oi
    join friend_worn_outfits f on f.id = oi.outfit_id
   where exists (select 1 from friend_items fi where fi.id = oi.item_id);

-- ---------------------------------------------------------------------------
-- 4 · Reactions — three, fixed, private to the pair
--
-- A NEW table, because nothing existing can hold this. `outfit_reactions` is
-- owner-only RLS (the owner of what was reacted to could never see it), its
-- domain is `check (reaction in (-1, 1))` — it IS a negative signal — and it is
-- the styling learner's training corpus. `closet_likes` is
-- `select to anon, authenticated using (true)`, world-readable. And
-- `event_outfit_votes` is one-vote-per-event contest semantics.
--
-- There is NO count column and NO aggregate view. "No public aggregation" is
-- enforced by there being nothing to aggregate.
-- ---------------------------------------------------------------------------

create table daily_social_reactions (
  outfit_id  uuid not null references outfits (id)    on delete cascade,
  reactor_id uuid not null references auth.users (id) on delete cascade,
  -- Denormalised so the owner's select needs no join to `outfits`.
  owner_id   uuid not null references auth.users (id) on delete cascade,
  reaction   text not null check (reaction in ('sharp', 'cozy', 'noted')),
  created_at timestamptz not null default now(),
  -- One per pair. Changing your mind is an update, never a second row, so no
  -- tally can accumulate even by accident.
  primary key (outfit_id, reactor_id),
  constraint daily_social_reactions_not_self check (reactor_id <> owner_id)
);

create index daily_social_reactions_owner_idx on daily_social_reactions (owner_id);

alter table daily_social_reactions enable row level security;

-- The reactor sees their own.
create policy "daily_social_reactions: reactor can select"
  on daily_social_reactions for select to authenticated
  using ((select auth.uid()) = reactor_id);

-- The owner sees reactions to their own looks. This is the half
-- `outfit_reactions` could never do.
create policy "daily_social_reactions: owner can select"
  on daily_social_reactions for select to authenticated
  using ((select auth.uid()) = owner_id);

-- You may only react to something you can CURRENTLY see. Routing the check
-- through the view means sharing turned off, a block, an expiry or a hidden
-- closet all refuse the write, with no second rule to keep in sync.
create policy "daily_social_reactions: reactor can insert"
  on daily_social_reactions for insert to authenticated
  with check (
    (select auth.uid()) = reactor_id
    and exists (select 1 from friend_worn_outfits f
                 where f.id = outfit_id and f.user_id = owner_id)
  );

create policy "daily_social_reactions: reactor can update"
  on daily_social_reactions for update to authenticated
  using ((select auth.uid()) = reactor_id)
  with check ((select auth.uid()) = reactor_id);

create policy "daily_social_reactions: reactor can delete"
  on daily_social_reactions for delete to authenticated
  using ((select auth.uid()) = reactor_id);

-- ---------------------------------------------------------------------------
-- 5 · Grants. Explicit, and never to anon — the house rule from
--     20260806100000_explicit_client_grants.sql.
-- ---------------------------------------------------------------------------

revoke all on friend_worn_outfits, friend_worn_outfit_items from public, anon;
grant select on friend_worn_outfits, friend_worn_outfit_items to authenticated;

revoke all on daily_social_reactions from public, anon;
grant select, insert, update, delete on daily_social_reactions to authenticated;
