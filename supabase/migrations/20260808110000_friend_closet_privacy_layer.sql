-- ===========================================================================
-- Cinch — Friend's Closet privacy layer.
--
-- The Friend's Closet rebuild (docs/design-directive.md atlas) renders wear
-- data and headline stats a friend chose to share. That design EXPLICITLY
-- overrides Migration D's "no wear history crosses the friend layer" rule
-- (20260807103000 / tests/05), replacing a blanket ban with owner-held
-- toggles: everything visible by default, hideable per stat, and a master
-- `closet_hidden` that makes the whole closet — rows, counts, derivatives —
-- vanish server-side. The privacy layer answers first: a hidden closet is
-- zero rows from the database, never a filter on the phone.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Owner-held visibility toggles. Defaults are all-visible, which is exactly
-- today's behavior — this migration changes what CAN be hidden, not what IS.
-- (The toggle UI lands in a later Profile session; until then no row ever
-- flips these, so nothing regresses.) Table-level grants on profiles
-- (20260806100000) cover the new columns; owner RLS already scopes writes.
-- ---------------------------------------------------------------------------
alter table profiles
  add column closet_hidden             boolean not null default false,
  add column stat_pieces_hidden        boolean not null default false,
  add column stat_wears_hidden         boolean not null default false,
  add column stat_cost_per_wear_hidden boolean not null default false;

-- ---------------------------------------------------------------------------
-- friend_items, recreated. Two changes, both design-atlas driven:
--
--   * wear_count and last_worn_at now cross the layer — appended at the END
--     of the column list, because `create or replace view` refuses column
--     reordering. tests/05's "no wear history" column probe is obsolete by
--     the same design decision that created this migration.
--   * a hidden closet returns zero rows. The predicate lives HERE, in the
--     definer view's WHERE clause — the access control — not in client code.
--
-- Prices and originals still never cross: per-item cost never leaves the
-- owner's device; only the aggregate below does, and only while unhidden.
-- ---------------------------------------------------------------------------
create or replace view friend_items
with (security_invoker = false) as
  select i.id, i.user_id, i.category, i.subcategory, i.colors, i.pattern,
         i.material, i.brand, i.seasons, i.occasions, i.description,
         i.thumb_path, i.cutout_path, i.plate_path, i.borrowable, i.created_at,
         i.wear_count, i.last_worn_at
    from items i
   where not i.is_archived
     and is_friend(i.user_id)
     and exists (select 1 from profiles p
                  where p.user_id = i.user_id and not p.closet_hidden);

-- ---------------------------------------------------------------------------
-- friend_closet_meta — the closet header's one row per friend: bio plus the
-- three headline stats, each individually nullable by its owner's toggle.
--
-- Semantics of hidden:
--   * closet_hidden nulls ALL three stats — nothing about a hidden closet
--     crosses the layer, not even a count. The flag itself is projected so
--     the UI can say "closet hidden" instead of rendering an empty grid.
--   * bio always crosses — friends may see bio (it already crosses via
--     public_profiles for public accounts; friendship is a superset trust).
--
-- The aggregates MIRROR src/features/closet/profile.ts closetStats() and
-- src/schemas/item.ts costPerWear(), so a friend's headline number equals
-- the one on her own profile:
--   * scope: non-archived items only (the closet list the client computes over);
--   * pieces = count(*); wears_logged = sum(wear_count), 0 when closetless;
--   * cost_per_wear = MEAN of per-item price/wear_count over items with BOTH
--     a price and at least one wear (costPerWear returns null otherwise and
--     closetStats drops nulls) — NOT sum(price)/sum(wears). NULL when no
--     item qualifies. No rounding here: the client rounds at render, same
--     as it does for its own avgCostPerWear.
-- ---------------------------------------------------------------------------
create view friend_closet_meta
with (security_invoker = false) as
  select p.user_id,
         p.bio,
         p.closet_hidden,
         case when p.closet_hidden or p.stat_pieces_hidden
              then null else s.pieces end        as pieces,
         case when p.closet_hidden or p.stat_wears_hidden
              then null else s.wears_logged end  as wears_logged,
         case when p.closet_hidden or p.stat_cost_per_wear_hidden
              then null else s.cost_per_wear end as cost_per_wear
    from profiles p
   cross join lateral (
      select count(*)::bigint                        as pieces,
             coalesce(sum(i.wear_count), 0)::bigint  as wears_logged,
             avg(i.purchase_price / i.wear_count)
               filter (where i.purchase_price is not null
                         and i.wear_count > 0)       as cost_per_wear
        from items i
       where i.user_id = p.user_id
         and not i.is_archived) s
   where is_friend(p.user_id);

-- SELECT-only, authenticated only — the Migration D rule, unchanged: a write
-- grant on a definer view is a write against the base table with RLS off.
grant select on friend_closet_meta to authenticated;

-- ---------------------------------------------------------------------------
-- Storage follows the same switch: a hidden closet stops serving garment
-- derivatives too, not just rows. Same body as 20260807103000 plus the
-- closet_hidden check.
-- ---------------------------------------------------------------------------
create or replace function item_owned_by_friend(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items i
     join public.profiles p on p.user_id = i.user_id
     where i.id = p_item
       and not i.is_archived
       and not p.closet_hidden
       and public.is_friend(i.user_id));
$$;

-- ---------------------------------------------------------------------------
-- social_profiles, recreated with bio appended (last, for replace-legality):
-- the Friend's Closet header renders a friend's bio, and this view is the
-- identity surface it reads from. bio is not gated by closet_hidden — it is
-- profile identity, not closet contents.
-- ---------------------------------------------------------------------------
create or replace view social_profiles
with (security_invoker = false) as
  select p.user_id, p.username, p.display_name, p.avatar_url, p.bio
    from profiles p
   where p.user_id <> (select auth.uid())
     and not blocked_between((select auth.uid()), p.user_id)
     and (
       p.visibility = 'public'
       or is_friend(p.user_id)
       or exists (select 1 from follows f            -- either direction
                   where (f.follower_id = (select auth.uid()) and f.followee_id = p.user_id)
                      or (f.followee_id = (select auth.uid()) and f.follower_id = p.user_id))
       or exists (select 1 from event_members me     -- co-membership
                   join event_members them on them.event_id = me.event_id
                  where me.user_id = (select auth.uid())
                    and them.user_id = p.user_id)
     );
