-- ===========================================================================
-- Saved looks — a private pointer, a snapshot of what was already visible, and
-- an availability that is recomputed on every single read.
--
-- WHAT ALREADY EXISTED, AND WHY IT IS NOT ENOUGH
--
-- `outfits.saved_at` + `outfits.board_id` (20260810100000) already keep YOUR
-- OWN outfits: atlas 35's kept plates, shipped, on screen today at `/saved`.
-- What no table can express is the thing the OS atlas is actually about —
-- keeping a look that is SOMEBODY ELSE'S. `outfits` is owner-only in every
-- policy it has, `friend_worn_outfits` is a read-through view with no row of
-- its own to mark, and `event_outfit_posts` belongs to the poster. There was
-- nowhere for "I want to remember Maya's Tuesday" to live, and no honest way to
-- invent one on `outfits`: a row there is a garment set the owner possesses,
-- and writing Maya's look into it would be the copy this whole design refuses.
--
-- SO: ONE TABLE, `saved_looks`, AND IT IS A POINTER, NOT A COPY.
--
-- The row holds an id, the fields the owner could ALREADY SEE at the moment
-- they saved, and their own note. It holds no garment, no size, no link, no
-- item id, and there is no foreign key from it to `items` or `outfit_items` —
-- asserted in 21_saved_looks.sql rather than merely intended.
--
-- ── COLLECTIONS ARE `boards`. THIS IS THE ONE STRUCTURAL DECISION HERE ──────
--
-- The atlas calls the shelf a "collection": `{id, owner_id, name, created_at,
-- updated_at}`, private, and deleting one "keeps the N looks inside" in Saved.
-- That is `boards` (20260810100000 §1) in every particular — owner-scoped, RLS
-- on with four owner policies, a name, and `on delete set null` on the member's
-- pointer, which is the same sentence written as a constraint. A `collections`
-- table would therefore be a SECOND NAME FOR ONE IDEA, and its cost is not
-- abstract: a look you kept of your own would sit on a "board" while a look you
-- kept of Maya's would sit in a "collection", two words for one shelf, in one
-- app, two taps apart.
--
-- The two differences were checked before deciding, and neither is structural:
--
--   · NAME LENGTH. The atlas says 40 characters ("Names are private and visible
--     only to you. 40 characters max."); `boards.name` admits 60. The check is
--     NOT tightened here — boards with 41-60 character names exist and a
--     narrowed constraint would refuse to load somebody's own data. 40 is
--     enforced at the field, in `features/saved-looks/types.ts`, which is where
--     the sentence promising it is printed.
--   · DATES. `boards` may carry a paired `starts_on`/`ends_on` — "dates make it
--     a trip". A collection made from the Saved surface simply leaves them
--     null, which is the majority shape of the column already. Nothing here
--     writes them and nothing here reads them.
--
-- ── AVAILABILITY IS NOT A COLUMN, AND CANNOT BECOME ONE ─────────────────────
--
-- A stored `available` boolean is a cache of somebody else's privacy decision,
-- and a cache of a privacy decision fails open the moment it goes stale — which
-- is precisely the case this feature exists to handle. So availability is a
-- view expression over `can_save_source`, evaluated per row per read. A revoked
-- source becomes unavailable on the next fetch with nothing to invalidate and
-- nothing to sweep, and there is no column anywhere for a stale value to sit in.
--
-- ── GROUND RULES, restated from 20260807100000 §0 and held below ────────────
--
-- No `to anon` anywhere; every client grant an explicit line at the foot;
-- EXECUTE revoked from `public, anon, authenticated` before each deliberate
-- grant; `(select auth.uid())` in every policy; per-command policies; a btree
-- index on every policy-filtered column.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · Where a save can have come from
--
-- Three, and the set is closed by the enum rather than by a check constraint so
-- `can_save_source` can dispatch on a type the planner knows is exhaustive.
-- There is no `public_look` and no `link`: every branch below routes through a
-- visibility predicate that already exists, and a fourth value would be a
-- fourth read path this packet is not allowed to open.
-- ---------------------------------------------------------------------------

create type saved_look_source as enum ('own_outfit', 'daily_look', 'event_look');

-- ---------------------------------------------------------------------------
-- 2 · The table
-- ---------------------------------------------------------------------------

create table saved_looks (
  id              uuid primary key default gen_random_uuid(),

  -- The ONLY principal. Every policy below is this column and nothing else.
  owner_id        uuid not null references auth.users (id) on delete cascade,

  source_type     saved_look_source not null,

  -- DELIBERATELY NOT A FOREIGN KEY, and this is the load-bearing omission in
  -- the file. `source_id` points at one of three different relations depending
  -- on `source_type`, so no single FK could express it — but even for a single
  -- target it would be wrong here. A cascade would delete the owner's private
  -- note the moment somebody else deleted their look, and `set null` would turn
  -- an unavailable save into an unattributable one. OS-06's whole promise is
  -- that "deleting the source does not delete your note", and a dangling id is
  -- exactly what makes that promise keepable: the recheck simply finds nothing
  -- and answers `unavailable`.
  source_id       uuid not null,

  -- Whose look it was. Two jobs: the provenance line's fallback, and the
  -- account-deletion story. `set null` rather than cascade — an account leaving
  -- must not reach into a third party's private note — and a null here is not a
  -- state the client has to draw, because a source whose owner is gone is
  -- already `unavailable` and `snap_source_label` still carries the words the
  -- provenance row prints.
  source_owner_id uuid references auth.users (id) on delete set null,

  -- The shelf. `boards`, because a collection IS a board — see the header. And
  -- `on delete set null` is not a convenience default here any more than it was
  -- there: it is OS-05c's sentence, "The N looks inside stay in Saved."
  collection_id   uuid references boards (id) on delete set null,

  -- ── The snapshot ────────────────────────────────────────────────────────
  --
  -- Display fields only, and only fields the owner could already see at the
  -- moment they saved. Bounded like every other free-text column that survives
  -- a source (20260807110000's bio precedent), because these outlive the thing
  -- they describe and an unbounded string that outlives its source is a string
  -- nobody will ever go back and check.
  --
  -- `snap_image_url` may be null, and that is a first-class card in OS-03, not
  -- a failure: an event look posted without a photograph has no image to keep.
  snap_title              text check (snap_title is null or char_length(snap_title) <= 200),
  snap_image_url          text check (snap_image_url is null or char_length(snap_image_url) <= 2048),
  -- "Maya's Daily look", "Your outfit", "Jordan's event". Written by the client
  -- from what was on screen. It can only ever lie to its own owner — nobody
  -- else can read this row — so it is not gated by `assert_clean_ugc`, which
  -- exists for text OTHER people read.
  snap_source_label       text not null check (char_length(btrim(snap_source_label)) between 1 and 120),
  -- "Visible to your Circle", "Event look", "Private". The visibility AS IT WAS,
  -- which is why it is snapshotted rather than re-read: after a revocation
  -- there is nothing left to re-read it from, and OS-04's provenance row still
  -- has to say what the look was when it was kept.
  snap_source_visibility  text not null check (char_length(btrim(snap_source_visibility)) between 1 and 120),
  -- The moment the SOURCE carried — when it was worn, or posted. Not when this
  -- row was written; `created_at` is that, and OS-04 prints both ("Visible to
  -- your Circle · Aug 3, 2026" over "Saved  Aug 3 · 9:12 AM").
  snap_saved_at           timestamptz not null,

  -- ── The owner's own words ───────────────────────────────────────────────
  --
  -- Same 500 as `outfits.note`, deliberately: it is the same kind of sentence
  -- about the same kind of thing, and two different ceilings for one idea is
  -- how a note that fits in the diary is refused by Saved.
  note            text check (note is null or char_length(note) <= 500),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- ONE SAVE PER SOURCE PER PERSON. This is what makes OS-02's duplicate state
  -- a fact rather than a client-side convention: a second tap cannot write a
  -- second row, so "Already in your looks" is what the database says, not what
  -- the interface remembered.
  constraint saved_looks_once unique (owner_id, source_type, source_id)
);

-- Every policy filters on `owner_id`; the list reads newest-first and the
-- collection filter is a facet over the same set, so one composite index serves
-- the list and the unique constraint above serves the dedupe lookup.
create index saved_looks_owner_created_idx on saved_looks (owner_id, created_at desc);
-- The collection chip counts, and the detach that follows a board deletion.
create index saved_looks_collection_idx on saved_looks (collection_id)
  where collection_id is not null;

alter table saved_looks enable row level security;

create trigger saved_looks_set_updated_at
  before update on saved_looks for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3 · `can_save_source` — the one predicate, reusing the three that exist
--
-- SECURITY DEFINER for the ordinary reason: it reads relations whose own RLS
-- would otherwise re-enter through the policy that called it, and
-- `friend_worn_outfits` is a `security_invoker = false` view whose grant is to
-- `authenticated` alone. `set search_path = ''` so a definer can never be
-- pointed at a shadowing schema.
--
-- NOT ONE OF THE THREE BRANCHES IS NEW LOGIC. That is the requirement, not a
-- happy accident: a fourth definition of "can this person see that look" is a
-- fourth thing to keep in sync with Circles, and the one that drifts is always
-- the one written last.
--
--   own_outfit  → `outfits.user_id = auth.uid()`, which is `outfits: owner can
--                 select` written out. Never expires, so an own-outfit save is
--                 unavailable only once the outfit is deleted.
--   daily_look  → membership of `friend_worn_outfits` (20260817000000 §3),
--                 which already encodes opted-in, after the sharing boundary,
--                 inside seven days, closet not hidden, and mutual-not-blocked.
--                 Every one of those going false is a revocation, and this
--                 answers false the instant any of them does — with no second
--                 rule to keep in step. It is the same instrument
--                 `daily_social_reactions: reactor can insert` uses.
--   event_look  → the post still exists AND `is_event_member(event_id)`, which
--                 is `event_posts: members can select` written out. Membership,
--                 not `can_see_event`: the looser predicate admits an invitee
--                 who has not joined, and the post policy does not, so using it
--                 here would make a save insertable that its own source is not
--                 readable through.
--
-- A source id that was never real, or has been hard-deleted, falls through
-- every branch and answers false. That is the same answer a revocation gives,
-- deliberately: the reader is told the look is not available, and never which
-- of the two happened to somebody else's data.
-- ---------------------------------------------------------------------------

create function can_save_source(p_type saved_look_source, p_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'own_outfit' then exists (
      select 1 from public.outfits o
       where o.id = p_id and o.user_id = (select auth.uid())
    )
    when 'daily_look' then exists (
      select 1 from public.friend_worn_outfits f where f.id = p_id
    )
    when 'event_look' then exists (
      select 1 from public.event_outfit_posts p
       where p.id = p_id and public.is_event_member(p.event_id)
    )
  end;
$$;

-- Called from a policy (evaluated with the CALLER's privileges) and from the
-- view below, so `authenticated` genuinely needs EXECUTE. Default function
-- privileges (20260805220000, extended to functions by 20260819000000) already
-- leave it born uncallable; the revoke is belt-and-braces, the grant is the
-- deliberate line.
revoke execute on function can_save_source(saved_look_source, uuid)
  from public, anon, authenticated;
grant  execute on function can_save_source(saved_look_source, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · Row level security
--
-- Four policies, one principal, and the UPDATE is the only one that is not
-- simply `owner_id = auth.uid()` in both halves — see §5 for why the rest of
-- that rule is a trigger and not a `with check`.
-- ---------------------------------------------------------------------------

create policy "saved_looks: owner can select" on saved_looks
  for select to authenticated using ((select auth.uid()) = owner_id);

-- THE ONE POLICY THAT DOES REAL WORK. Saving something you cannot see is
-- refused at the write, so an inaccessible or already-revoked source can never
-- become a row — OS-06 is a state a save ARRIVES at, never a state it is born
-- in. `source_owner_id` is not verified against the source here on purpose: it
-- is a display fallback for a label the client also snapshots, it cannot widen
-- anything (the row is readable by exactly one person), and verifying it would
-- need a fourth definer function returning somebody else's user id.
create policy "saved_looks: owner can insert a source they can see" on saved_looks
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and public.can_save_source(source_type, source_id)
  );

create policy "saved_looks: owner can update" on saved_looks
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "saved_looks: owner can delete" on saved_looks
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- 5 · What an update may actually change
--
-- The access matrix says the UPDATE is "note/collection only", and a `with
-- check` cannot say that: a policy sees the NEW row, so it can refuse a row
-- that no longer belongs to you and cannot notice that the snapshot underneath
-- it was rewritten. Only a trigger holds both versions.
--
-- WHY IT MATTERS RATHER THAN BEING TIDY. `source_type` and `source_id` are the
-- two arguments the availability recheck is made of. A row whose owner may
-- repoint them is a row whose owner may point a save they already hold at a
-- source they were never allowed to see — the INSERT policy's check is on
-- INSERT, and there is no second gate on the way past it. So the pair is frozen
-- for the life of the row, and the way to save something else is to save
-- something else.
--
-- The snapshot is frozen for a quieter reason: it is evidence of what was
-- visible at a moment, and OS-06's "We never copied their garments" is a claim
-- about that moment. An editable snapshot is not a snapshot.
--
-- `collection_id` and `note` move freely; `updated_at` is the trigger above's.
-- Same split, and the same reason, as `borrow_requests`: a policy answers whose
-- row this is, a trigger answers whether that was a legal move.
-- ---------------------------------------------------------------------------

create function assert_saved_look_immutable() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.owner_id               is distinct from old.owner_id
     or new.source_type         is distinct from old.source_type
     or new.source_id           is distinct from old.source_id
     or new.source_owner_id     is distinct from old.source_owner_id
     or new.snap_title          is distinct from old.snap_title
     or new.snap_image_url      is distinct from old.snap_image_url
     or new.snap_source_label   is distinct from old.snap_source_label
     or new.snap_source_visibility is distinct from old.snap_source_visibility
     or new.snap_saved_at       is distinct from old.snap_saved_at
     or new.created_at          is distinct from old.created_at then
    raise exception 'only the note and the collection may change'
      using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger saved_looks_immutable
  before update on saved_looks
  for each row execute function assert_saved_look_immutable();

revoke execute on function assert_saved_look_immutable()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6 · The read path, with availability resolved on it
--
-- `security_invoker = true`, which is the whole design of this view. The
-- caller's own RLS on `saved_looks` applies unchanged — owner-only, server-
-- enforced, with no second copy of the rule — and the linter's remedy for
-- `security_definer_view` (20260805213000:37) is satisfied rather than argued
-- around. The definer-ness that IS needed lives in `can_save_source`, one
-- function, granted deliberately.
--
-- One `can_save_source` call per row per read. Measured against what it buys:
-- a saved list is tens of rows belonging to one person, each branch is an
-- indexed `exists`, and the alternative is a stored boolean about somebody
-- else's privacy setting that goes stale in the direction of disclosure. There
-- is no version of this that is cheap AND correct, so it is correct.
--
-- `availability` is text rather than a second enum: it has exactly two values
-- that the client switches on, it is computed and never stored, and an enum
-- type would be a thing to migrate the day a third answer is wanted.
-- ---------------------------------------------------------------------------

create view saved_looks_resolved
with (security_invoker = true) as
  select s.id,
         s.owner_id,
         s.source_type,
         s.source_id,
         s.source_owner_id,
         s.collection_id,
         s.snap_title,
         s.snap_image_url,
         s.snap_source_label,
         s.snap_source_visibility,
         s.snap_saved_at,
         s.note,
         s.created_at,
         s.updated_at,
         case
           when can_save_source(s.source_type, s.source_id) then 'available'
           else 'unavailable'
         end as availability
    from saved_looks s;

-- ---------------------------------------------------------------------------
-- 7 · Grants. Explicit, and never to anon — 20260806100000.
--
-- The verb list is derived from the policies above and the two must agree, or a
-- policy is dead letter. The view is read-only: it has an expression column, so
-- it is not auto-updatable, and every write in this feature goes at the table.
-- ---------------------------------------------------------------------------

revoke all on saved_looks           from public, anon;
revoke all on saved_looks_resolved  from public, anon;
grant select, insert, update, delete on saved_looks          to authenticated;
grant select                         on saved_looks_resolved to authenticated;
