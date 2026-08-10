-- ===========================================================================
-- The wear diary, and the plates that are kept.
--
-- Atlases 33 and 35 are two readings of the same table. `outfits` already
-- holds both — a row with `worn_at` is a diary entry, a row without one is a
-- generated look nobody confirmed — but three things the designs state as
-- facts are not derivable from it as it stands:
--
--   WD-03  "Your note"                  — no user note survives onto a wear.
--   KP-01  "Monday standard · worn 6x"  — a kept plate has no link to the
--                                         wears that came out of it.
--   KP-03  "Lisbon · 4 plates"          — there are no boards at all.
--
-- The cause of the second is worth stating, because it is not a bug: every
-- confirm inserts a FRESH outfit row (`wear_outfit_tx` below, unchanged in
-- that respect). That is right — a wear is an event, and two wearings of the
-- same look are two events — but it means "worn 6x" can only ever be answered
-- by recording, at the moment of the confirm, which kept plate it came from.
-- Hence `origin_outfit_id`. There is no way to backfill it and none is
-- attempted: rows that predate this migration have no origin, and a kept plate
-- made from them starts its count at whatever it has actually been worn since.
--
-- Ground rules held (20260807100000 §0): no `to anon`, explicit grants only,
-- `(select auth.uid())` in every policy, an index on every policy-filtered
-- column. Both functions stay `security invoker` — the caller can do these
-- writes under their own RLS, so there is no reason to define away from them.
--
-- See docs/design/diary-boards-activity-contract.md §5.1.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Boards.
--
-- KP-05 is the whole specification: "a name, and optionally two dates. Nothing
-- else. No cover image to choose, no description, no colour." The column list
-- IS the contract — anything added here is a feature the design refused.
-- ---------------------------------------------------------------------------

create table boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  -- Optional, and optional TOGETHER. KP-05: "dates make it a trip" — a board
  -- with one end of a range is neither a collection nor a trip, and would grow
  -- a "Send to Packing" action it could not honour.
  starts_on  date,
  ends_on    date,
  constraint boards_dates_paired check (num_nonnulls(starts_on, ends_on) <> 1),
  constraint boards_dates_ordered check (ends_on is null or ends_on >= starts_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every policy filters on user_id; the chip row above KP-01 reads them by name.
create index boards_user_name_idx on boards (user_id, name);

alter table boards enable row level security;

create trigger boards_set_updated_at
  before update on boards for each row execute function set_updated_at();

create policy "boards: owner can select" on boards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "boards: owner can insert" on boards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "boards: owner can update" on boards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "boards: owner can delete" on boards
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table boards to authenticated;

-- ---------------------------------------------------------------------------
-- 2. What an outfit row can now say about itself.
-- ---------------------------------------------------------------------------

alter table outfits
  -- WD-03's "Your note". `outfit_calendar.note` is a PLAN's note and does not
  -- travel onto the wear, which is why the diary had nowhere to read one from.
  -- Bounded like every other free-text column that reaches the AI or a share
  -- card (20260807110000's bio precedent).
  add column if not exists note text check (note is null or char_length(note) <= 500),

  -- Kept. Null on the overwhelming majority of rows: a generated look that was
  -- never kept and never worn is the normal case, and KP is a lookbook of the
  -- exceptions.
  add column if not exists saved_at timestamptz,

  -- KP-05: "deleting a board keeps the plates — they return to All."
  -- `on delete set null` IS that sentence. It is not a convenience default.
  add column if not exists board_id uuid references boards (id) on delete set null,

  -- The lineage that makes "worn 6x" answerable. Set by `wear_outfit_tx` when
  -- a confirm starts from a kept plate ("Wear this again", or planning one
  -- into a day). `set null` rather than cascade: deleting a kept plate must
  -- not delete the history of having worn it — KP-05 says deleting a plate
  -- "never cascades to the pieces", and it must not cascade to the past either.
  add column if not exists origin_outfit_id uuid references outfits (id) on delete set null;

-- KP-01 reads the saved set newest-first; the partial index keeps it off the
-- ~99% of rows that are neither kept nor worn.
create index if not exists outfits_user_saved_idx on outfits (user_id, saved_at desc)
  where saved_at is not null;
-- WD-01 is this index, and nothing else.
create index if not exists outfits_user_worn_idx on outfits (user_id, worn_at desc)
  where worn_at is not null;
-- The "worn 6x" count, and the board chip counts.
create index if not exists outfits_origin_idx on outfits (origin_outfit_id)
  where origin_outfit_id is not null;
create index if not exists outfits_board_idx on outfits (board_id)
  where board_id is not null;

-- ---------------------------------------------------------------------------
-- 3. wear_outfit_tx, taught about origin and note.
--
-- Replaced rather than overloaded. Adding two defaulted parameters to a
-- `create or replace` would leave the six-argument version in place and make
-- every call ambiguous, so the old signature is dropped first and the grant
-- restated — a dropped function takes its grants with it.
-- ---------------------------------------------------------------------------

drop function if exists wear_outfit_tx(uuid, uuid[], text, text, jsonb, outfit_source);

create function wear_outfit_tx(
  p_op_id     uuid,
  p_item_ids  uuid[],
  p_name      text          default null,
  p_reasoning text          default null,
  p_context   jsonb         default null,
  p_source    outfit_source default 'ai',
  -- The kept plate this wearing came out of, when there was one.
  p_origin    uuid          default null,
  -- What the reader typed on the morning. Usually null; WD-03 lets it be
  -- added afterwards, which is an update to the row this returns.
  p_note      text          default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_outfit uuid;
  v_done   boolean;
  v_prior  uuid;
  v_owned  integer;
  v_asked  integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_op_id is null then
    raise exception 'an operation id is required' using errcode = '22004';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'an outfit needs at least one item' using errcode = '22004';
  end if;

  select already_done, existing_result into v_done, v_prior
    from public.claim_command(p_op_id, v_user, 'wear_outfit');
  if v_done then
    return v_prior;
  end if;

  select count(distinct x) into v_asked from unnest(p_item_ids) x;
  select count(*) into v_owned
    from public.items where id = any(p_item_ids) and user_id = v_user;
  if v_owned <> v_asked then
    raise exception 'one or more of those items is not yours' using errcode = '42501';
  end if;

  -- An origin that is not yours is not an origin. Checked rather than trusted
  -- because it is a client-supplied id that ends up quoted back as a count on
  -- somebody's saved plate.
  if p_origin is not null then
    if not exists (
      select 1 from public.outfits
       where id = p_origin and user_id = v_user
    ) then
      raise exception 'that plate is not yours' using errcode = '42501';
    end if;
  end if;

  insert into public.outfits
    (user_id, name, reasoning, context_snapshot, generated_by, worn_at,
     origin_outfit_id, note)
  values
    (v_user, p_name, p_reasoning, p_context, p_source, now(),
     p_origin, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, position)
  select v_outfit, x.id, v_user, x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord);

  update public.items
     set wear_count   = wear_count + 1,
         last_worn_at = now()
   where id = any(p_item_ids)
     and user_id = v_user;

  update public.command_log set result_id = v_outfit where op_id = p_op_id;

  return v_outfit;
end;
$$;

revoke execute on function
  wear_outfit_tx(uuid, uuid[], text, text, jsonb, outfit_source, uuid, text)
  from public, anon;
grant execute on function
  wear_outfit_tx(uuid, uuid[], text, text, jsonb, outfit_source, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. unwear_outfit_tx — the diary's one-day correction.
--
-- WD's rule: "the reader can correct or delete an entry within 24 hours; after
-- that it is history and only the note stays editable."
--
-- Deleting the outfit row alone would leave `items.wear_count` permanently
-- inflated, and wear_count is read by the closet grid, the item page, cost per
-- wear, The Repeat's exhaustion maths and the friend-closet view. A mis-tap
-- that silently corrupts five surfaces is worse than no undo at all, which is
-- why this is a transaction and not a delete.
--
-- The 24-hour window is enforced HERE, not in the client. A client-side check
-- is a courtesy; this is the rule.
-- ---------------------------------------------------------------------------

create function unwear_outfit_tx(p_op_id uuid, p_outfit_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_worn  timestamptz;
  v_done  boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_op_id is null then
    raise exception 'an operation id is required' using errcode = '22004';
  end if;

  select already_done into v_done
    from public.claim_command(p_op_id, v_user, 'unwear_outfit');
  if v_done then
    return;
  end if;

  -- `for update` so two taps on a flaky connection cannot both decrement.
  select worn_at into v_worn
    from public.outfits
   where id = p_outfit_id and user_id = v_user
   for update;

  if v_worn is null then
    raise exception 'no such wear' using errcode = '42704';
  end if;
  if now() - v_worn > interval '24 hours' then
    raise exception 'that entry is older than a day' using errcode = '22023';
  end if;

  update public.items i
     set wear_count   = greatest(0, i.wear_count - 1),
         last_worn_at = (
           select max(o.worn_at)
             from public.outfits o
             join public.outfit_items oi on oi.outfit_id = o.id
            where oi.item_id = i.id
              and o.user_id = v_user
              and o.worn_at is not null
              and o.id <> p_outfit_id
         )
    from public.outfit_items x
   where x.item_id = i.id
     and x.outfit_id = p_outfit_id
     and i.user_id = v_user;

  -- `outfit_items` goes with it on cascade; anything that recorded this wear
  -- as its origin keeps its own history and simply loses the pointer.
  delete from public.outfits where id = p_outfit_id and user_id = v_user;
end;
$$;

revoke execute on function unwear_outfit_tx(uuid, uuid) from public, anon;
grant execute on function unwear_outfit_tx(uuid, uuid) to authenticated;
